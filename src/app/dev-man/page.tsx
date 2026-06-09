import { NavBar } from "@/components/nav-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getUserCount } from "@/lib/auth-provider";
import { getProxyHosts, getAccessLists, getCertificates } from "@/lib/npm-api";
import { groupHosts, CATEGORY_ORDER } from "@/lib/categorize";
import {
  scanServerActions,
  scanNpmApiFunctions,
  scanLibFunctions,
  scanClientComponents,
  scanServerComponents,
  scanRoutes,
} from "@/lib/source-scanner";

export const dynamic = "force-dynamic";

export default async function DevManPage() {
  // Fetch live API data
  let proxyHosts: Awaited<ReturnType<typeof getProxyHosts>> = [];
  let accessLists: Awaited<ReturnType<typeof getAccessLists>> = [];
  let certificates: Awaited<ReturnType<typeof getCertificates>> = [];
  let userCount: number | null = null;
  let npmOnline = true;

  try {
    [proxyHosts, accessLists, certificates] = await Promise.all([
      getProxyHosts(),
      getAccessLists(),
      getCertificates(),
    ]);
  } catch {
    npmOnline = false;
  }

  try {
    userCount = await getUserCount();
  } catch {
    userCount = null;
  }

  // Scan source files for functions, components, routes
  const [serverActions, npmApiFunctions, libFunctions, clientComponents, serverComponents, routes] =
    await Promise.all([
      scanServerActions(),
      scanNpmApiFunctions(),
      scanLibFunctions(),
      scanClientComponents(),
      scanServerComponents(),
      scanRoutes(),
    ]);

  const groups = groupHosts(proxyHosts);
  const enabledCount = proxyHosts.filter((h) => h.enabled).length;
  const publicCount = proxyHosts.filter((h) => h.access_list_id === 0 && h.enabled).length;
  const sslCount = proxyHosts.filter((h) => h.ssl_forced && h.certificate_id > 0).length;

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">DEV-MAN — Architecture</h1>
          <p className="text-sm text-muted-foreground">
            Live documentation — all numbers from real API data, all functions
            scanned from source files. Nothing is hardcoded.
          </p>
        </div>

        {/* ── Purpose ── */}
        <Card>
          <CardHeader>
            <CardTitle>Purpose</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none space-y-2">
            <p>
              Clerk-authenticated gateway for Nginx Proxy Manager. NPM is the
              boss — it owns all proxy host config, SSL certs, and access lists.
              This app adds authentication (Clerk), ACL-based access control,
              IP logging, and a cleaner UI on top of NPM&apos;s REST API.
            </p>
            <p>
              If this app goes down, NPM keeps working. All access lists and
              proxy hosts survive independently.
            </p>
          </CardContent>
        </Card>

        {/* ── Architecture Diagram ── */}
        <Card>
          <CardHeader>
            <CardTitle>Architecture</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre font-mono">
{`┌─────────────────────────────────────────────────────────┐
│                      BROWSER                            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│              NPM (Nginx Proxy Manager)                  │
│         SSL termination + reverse proxy                 │
│            ${proxyHosts.length} proxy hosts | ${certificates.length} SSL certs              │
│            ${accessLists.length} access lists | ${publicCount} public hosts            │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (internal docker network)
                         ▼
┌─────────────────────────────────────────────────────────┐
│           npm-auth-proxy (Next.js 16)                   │
│              Port 3100 | nginx-network                  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  Clerk   │  │  Server  │  │    NPM REST API       │ │
│  │  Auth    │  │  Actions │  │    (${npmApiFunctions.length} functions)     │ │
│  │          │──│  (${serverActions.length} fn)  │──│    via fetch()        │ │
│  │ Middleware│  │          │  │                       │ │
│  └──────────┘  └──────────┘  └───────────┬───────────┘ │
│                                          │              │
│  ┌──────────────────────────────────┐    │              │
│  │  ${clientComponents.length} Client Components          │    │              │
│  │  (toggle, delete, filter, forms) │    │              │
│  └──────────────────────────────────┘    │              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                         ┌─────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│          nginx-proxy-manager:81 (NPM API)               │
│                  THE BOSS                                │
│                                                         │
│   POST /api/tokens          → Auth                      │
│   GET  /api/nginx/proxy-hosts → Read hosts              │
│   PUT  /api/nginx/proxy-hosts/:id → Update host         │
│   DELETE /api/nginx/proxy-hosts/:id → Delete host       │
│   GET  /api/nginx/access-lists → Read ACLs              │
│   PUT  /api/nginx/access-lists/:id → Update ACL IPs     │
│   POST /api/nginx/access-lists → Create ACL             │
│   GET  /api/nginx/certificates → Read certs             │
└─────────────────────────────────────────────────────────┘`}
            </pre>
          </CardContent>
        </Card>

        {/* ── Live Stats ── */}
        <Card>
          <CardHeader>
            <CardTitle>Live Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Proxy Hosts" value={proxyHosts.length} sub={`${enabledCount} enabled`} />
              <Stat label="SSL Certs" value={certificates.length} sub={`${sslCount} hosts with SSL`} />
              <Stat label="Access Lists" value={accessLists.length} sub={`${proxyHosts.length - publicCount} hosts protected`} />
              <Stat label="Public Hosts" value={publicCount} sub="No ACL" />
              <Stat label="Users" value={userCount ?? "?"} sub="Registered" />
              <Stat label="NPM API" value={npmOnline ? "Online" : "Offline"} sub={npmOnline ? "Connected" : "Unreachable"} />
              <Stat label="Categories" value={CATEGORY_ORDER.length} sub="Auto-detected" />
              <Stat label="Server Actions" value={serverActions.length} sub="Scanned from src" />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* ── Routes (scanned) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Routes ({routes.length})</CardTitle>
            <p className="text-xs text-muted-foreground">Scanned from src/app/</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {routes.map((r) => (
                <div key={r.path} className="flex items-center gap-3 text-sm">
                  <Badge
                    variant={
                      r.type === "dynamic" ? "default" :
                      r.type === "static" ? "secondary" :
                      r.type === "proxy" ? "outline" :
                      r.type === "api" ? "outline" : "secondary"
                    }
                    className="text-xs w-16 justify-center"
                  >
                    {r.type}
                  </Badge>
                  <span className="font-mono text-primary">{r.path}</span>
                  {r.desc && (
                    <span className="text-muted-foreground text-xs">{r.desc}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Server Actions (scanned) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Server Actions ({serverActions.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Scanned from src/actions/ — all mutations go through Server Actions → NPM API
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {serverActions.map((fn) => (
                <div key={`${fn.file}:${fn.name}`} className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-primary text-xs shrink-0">{fn.name}()</span>
                  {fn.desc ? (
                    <span className="text-muted-foreground text-xs">{fn.desc}</span>
                  ) : (
                    <Badge variant="destructive" className="text-xs">No JSDoc</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── NPM API Functions (scanned) ── */}
        <Card>
          <CardHeader>
            <CardTitle>NPM API Client ({npmApiFunctions.length} functions)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Scanned from src/lib/npm-api.ts — server-only, types defined once here
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {npmApiFunctions.map((fn) => (
                <div key={fn.name} className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-primary text-xs shrink-0">{fn.name}()</span>
                  {fn.desc ? (
                    <span className="text-muted-foreground text-xs">{fn.desc}</span>
                  ) : (
                    <Badge variant="destructive" className="text-xs">No JSDoc</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Library Functions (scanned) ── */}
        {libFunctions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Library Functions ({libFunctions.length})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Scanned from src/lib/ (excluding npm-api.ts)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {libFunctions.map((fn) => (
                  <div key={`${fn.file}:${fn.name}`} className="flex items-baseline gap-2 text-sm">
                    <span className="font-mono text-primary text-xs shrink-0">{fn.name}()</span>
                    {fn.desc ? (
                      <span className="text-muted-foreground text-xs">{fn.desc}</span>
                    ) : (
                      <Badge variant="destructive" className="text-xs">No JSDoc</Badge>
                    )}
                    <span className="text-muted-foreground/50 text-xs ml-auto">{fn.file}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Client Components (scanned) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Client Components ({clientComponents.length})</CardTitle>
            <p className="text-xs text-muted-foreground">
              Scanned from src/components/ — files with &quot;use client&quot; directive
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {clientComponents.map((c) => (
                <div key={c.file} className="flex items-baseline gap-2 text-sm">
                  <Badge variant="secondary" className="text-xs shrink-0">{c.name}</Badge>
                  {c.desc ? (
                    <span className="text-muted-foreground text-xs">{c.desc}</span>
                  ) : (
                    <Badge variant="destructive" className="text-xs">No JSDoc</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Server Components (scanned) ── */}
        {serverComponents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Server Components ({serverComponents.length})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Scanned from src/components/ — no &quot;use client&quot; directive
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {serverComponents.map((c) => (
                  <div key={c.file} className="flex items-baseline gap-2 text-sm">
                    <Badge variant="outline" className="text-xs shrink-0">{c.name}</Badge>
                    {c.desc ? (
                      <span className="text-muted-foreground text-xs">{c.desc}</span>
                    ) : (
                      <Badge variant="destructive" className="text-xs">No JSDoc</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Category Breakdown ── */}
        <Card>
          <CardHeader>
            <CardTitle>Categories (auto-detected from domains)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {CATEGORY_ORDER.map((cat) => {
                const hosts = groups.get(cat) ?? [];
                return (
                  <div key={cat} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="w-28 justify-center">
                      {cat}
                    </Badge>
                    <span className="font-bold">{hosts.length}</span>
                    <span className="text-muted-foreground text-xs truncate">
                      {hosts
                        .slice(0, 4)
                        .map((h) => h.domain_names[0])
                        .join(", ")}
                      {hosts.length > 4 && ` +${hosts.length - 4} more`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Security Model ── */}
        <Card>
          <CardHeader>
            <CardTitle>Security Model</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre font-mono">
{`Authentication Flow:
  Browser → NPM (SSL) → npm-auth-proxy → Clerk Middleware
    │
    ├─ No session? → Redirect to /login (Clerk SignIn)
    ├─ Has session? → Render page (Server Component)
    └─ Server Action? → auth() check → NPM API call

Data Flow (reads):
  Server Component → npm-api.ts fetcher → NPM REST API → JSON response

Data Flow (writes):
  Client Component → Server Action → auth() check → npm-api.ts mutator → NPM API
    → revalidatePath() → page re-renders with fresh data

Who controls what:
  Clerk  = WHO you are (identity, session)
  App    = WHAT you see (ACL-filtered dashboard, admin panel)
  NPM    = WHO can access (IP whitelists survive if app dies)

ACL-based access control:
  ✓ User metadata: { aclIds: [3, 7], isAdmin: true }
  ✓ Admin: full access, IP whitelisted on ALL ACLs
  ✓ Non-admin: only sees hosts in their assigned ACLs
  ✓ On login: auto-add IP to assigned ACLs only
  ✓ /users/[id]: host table with checkboxes per host
  ✓ Revoke: remove user's IPs from all ACLs

NPM is the boss:
  ✓ All data lives in NPM
  ✓ All writes go to NPM API
  ✓ Access lists enforced by NPM nginx (not our app)
  ✓ If our app dies, NPM keeps enforcing access lists
  ✗ Our app adds: auth, UI, categories, IP logging, auto-IP`}
            </pre>
          </CardContent>
        </Card>

        {/* ── Deploy ── */}
        <Card>
          <CardHeader>
            <CardTitle>Deploy Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre font-mono">
{`Merge PR to main (squash, linear history enforced)
    ↓
GitHub webhook POST (HMAC signed)
    ↓
NPM proxy (your-deploy-webhook-domain)
    ↓
npm-auth-webhook container (port 9001)
    ↓
deploy/redeploy.sh
  ├── git fetch + reset --hard origin/main
  ├── docker-compose down
  ├── docker-compose up -d --build
  └── Health check (wget :3100)

Branch Protection:
  ✓ PRs required (even admins)
  ✓ Linear history (squash only)
  ✓ Conversation resolution required
  ✓ Pre-commit hook: tsc --noEmit`}
            </pre>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
