import "server-only";

// NPM_API_URL ends with /api (e.g. http://localhost:81/api)
// We strip /api since npmFetch prepends /api to all paths
const NPM_BASE = (process.env.NPM_API_URL ?? "http://nginx-proxy-manager:81/api").replace(/\/api\/?$/, "");
const NPM_EMAIL = process.env.NPM_API_EMAIL ?? "";
const NPM_PASSWORD = process.env.NPM_API_PASSWORD ?? "";

// --- Types (single source of truth — import these downstream) ---

export type ProxyHost = {
  id: number;
  created_on: string;
  modified_on: string;
  owner_user_id: number;
  domain_names: string[];
  forward_scheme: "http" | "https";
  forward_host: string;
  forward_port: number;
  certificate_id: number;
  ssl_forced: boolean;
  caching_enabled: boolean;
  block_exploits: boolean;
  access_list_id: number;
  enabled: boolean;
  allow_websocket_upgrade: boolean;
  http2_support: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  meta: Record<string, unknown>;
  advanced_config: string;
  locations: unknown[];
};

export type AccessList = {
  id: number;
  created_on: string;
  modified_on: string;
  owner_user_id: number;
  name: string;
  satisfy_any: boolean;
  pass_auth: boolean;
  proxy_host_count: number;
  meta: Record<string, unknown>;
  items: AccessListItem[];
  clients: AccessListClient[];
};

export type AccessListItem = {
  id: number;
  access_list_id: number;
  username: string;
  password: string;
};

export type AccessListClient = {
  id: number;
  access_list_id: number;
  address: string;
  directive: "allow" | "deny";
  meta: Record<string, unknown>;
};

export type Certificate = {
  id: number;
  created_on: string;
  modified_on: string;
  provider: string;
  nice_name: string;
  domain_names: string[];
  expires_on: string;
  meta: Record<string, unknown>;
};

// --- Token management ---

let cachedToken: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const res = await fetch(`${NPM_BASE}/api/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: NPM_EMAIL, secret: NPM_PASSWORD }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[npm-api] Auth failed: ${res.status} ${res.statusText}`, body);
    throw new Error(
      `NPM auth failed (${res.status}). Check NPM_EMAIL and NPM_PASSWORD env vars.`
    );
  }

  const data = await res.json();
  cachedToken = { token: data.token, expires: Date.now() + 55 * 60 * 1000 };
  return data.token;
}

async function npmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const url = `${NPM_BASE}/api${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[npm-api] ${options?.method ?? "GET"} ${path}: ${res.status}`, body);
    throw new Error(
      `NPM API error: ${res.status} on ${path}. ` +
        `Likely cause: ${res.status === 404 ? "endpoint not found" : res.status === 403 ? "token expired, restart app" : "check NPM container logs"}`
    );
  }

  return res.json();
}

// --- Data fetchers (no cache — NPM API is local, sub-ms) ---

/** Fetch all proxy hosts with ACL and certificate data expanded. */
export async function getProxyHosts(): Promise<ProxyHost[]> {
  return npmFetch<ProxyHost[]>("/nginx/proxy-hosts?expand=access_list,certificate");
}

/** Fetch a single proxy host by ID. */
export async function getProxyHost(id: number): Promise<ProxyHost> {
  return npmFetch<ProxyHost>(`/nginx/proxy-hosts/${id}`);
}

/** Fetch all access lists with clients and items expanded. */
export async function getAccessLists(): Promise<AccessList[]> {
  // expand=clients,items includes nested data in single request
  return npmFetch<AccessList[]>("/nginx/access-lists?expand=clients,items");
}

/** Fetch all SSL certificates from NPM. */
export async function getCertificates(): Promise<Certificate[]> {
  return npmFetch<Certificate[]>("/nginx/certificates");
}

// --- Mutators (called from server actions) ---

/** Update a proxy host with partial data (full PUT under the hood). */
export async function updateProxyHost(
  id: number,
  data: Partial<ProxyHost>
): Promise<ProxyHost> {
  return npmFetch<ProxyHost>(`/nginx/proxy-hosts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Enable or disable a proxy host. */
export async function toggleProxyHost(
  id: number,
  enabled: boolean
): Promise<ProxyHost> {
  const host = await getProxyHost(id);
  return npmFetch<ProxyHost>(`/nginx/proxy-hosts/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...host, enabled }),
  });
}

/** Delete a proxy host by ID. */
export async function deleteProxyHost(id: number): Promise<void> {
  await npmFetch(`/nginx/proxy-hosts/${id}`, { method: "DELETE" });
}

/** Fetch a single access list by ID with clients and items expanded. */
export async function getAccessList(id: number): Promise<AccessList> {
  return npmFetch<AccessList>(`/nginx/access-lists/${id}?expand=clients,items`);
}

/** Add an IP address to an access list (fetches existing clients, appends, PUTs back). */
export async function addIpToAccessList(
  listId: number,
  address: string,
  directive: "allow" | "deny" = "allow"
): Promise<AccessList> {
  const list = await getAccessList(listId);
  const clients = [
    ...(list.clients ?? []).map((c) => ({
      address: c.address,
      directive: c.directive,
    })),
    { address, directive },
  ];

  return npmFetch<AccessList>(`/nginx/access-lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: list.name,
      satisfy_any: list.satisfy_any,
      pass_auth: list.pass_auth,
      items: (list.items ?? []).map((i) => ({
        username: i.username,
        password: i.password,
      })),
      clients,
    }),
  });
}

/** Remove an IP address from an access list by filtering it out and PUTting back. */
export async function removeIpFromAccessList(
  listId: number,
  address: string
): Promise<AccessList> {
  const list = await getAccessList(listId);
  const clients = (list.clients ?? [])
    .filter((c) => c.address !== address)
    .map((c) => ({ address: c.address, directive: c.directive }));

  return npmFetch<AccessList>(`/nginx/access-lists/${listId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: list.name,
      satisfy_any: list.satisfy_any,
      pass_auth: list.pass_auth,
      items: (list.items ?? []).map((i) => ({
        username: i.username,
        password: i.password,
      })),
      clients,
    }),
  });
}

/** Create a new empty access list with the given name. */
export async function createAccessList(name: string): Promise<AccessList> {
  return npmFetch<AccessList>("/nginx/access-lists", {
    method: "POST",
    body: JSON.stringify({
      name,
      satisfy_any: true,
      pass_auth: false,
      items: [],
      clients: [],
    }),
  });
}

/** Delete an access list by ID. */
export async function deleteAccessList(id: number): Promise<void> {
  await npmFetch(`/nginx/access-lists/${id}`, { method: "DELETE" });
}

/** Assign an access list to a proxy host (fetches host, PUTs with new ACL ID). */
export async function assignAccessListToHost(
  hostId: number,
  accessListId: number
): Promise<ProxyHost> {
  const host = await getProxyHost(hostId);
  return npmFetch<ProxyHost>(`/nginx/proxy-hosts/${hostId}`, {
    method: "PUT",
    body: JSON.stringify({ ...host, access_list_id: accessListId }),
  });
}
