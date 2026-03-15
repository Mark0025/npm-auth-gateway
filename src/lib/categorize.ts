import type { ProxyHost } from "@/lib/npm-api";

export type Category =
  | "Pete"
  | "Terry"
  | "AI / LLM"
  | "Monitoring"
  | "Infrastructure"
  | "Tools"
  | "Voice / VAPI"
  | "Clients"
  | "Other";

// Order matters — first match wins
const RULES: { category: Category; test: (domain: string, forward: string) => boolean }[] = [
  {
    category: "Pete",
    test: (d, f) =>
      d.startsWith("pete-") ||
      d.startsWith("pete.") ||
      f.startsWith("pete-") ||
      f.startsWith("scott-localleasing") ||
      d.includes("localleasing"),
  },
  {
    category: "Terry",
    test: (d, f) =>
      d.startsWith("terry-") ||
      d.startsWith("terry.") ||
      f.startsWith("terry-") ||
      f === "terry-ui-dev",
  },
  {
    category: "AI / LLM",
    test: (d, f) =>
      f === "ollama" ||
      f === "open-webui" ||
      d.includes("ollama") ||
      d.includes("open-webui") ||
      d.includes("ai.") ||
      d.includes("fabric") ||
      d.includes("unified") ||
      d.includes("yt-intel") ||
      d.includes("youtube-api") ||
      f.includes("fabric") ||
      f.includes("unified-knowledge"),
  },
  {
    category: "Monitoring",
    test: (d, f) =>
      f === "grafana" ||
      f === "prometheus" ||
      f === "uptime-kuma" ||
      f === "homepage" ||
      f === "npm-exporter" ||
      f === "vercel-exporter" ||
      f === "prometheus-pushgateway" ||
      d.includes("grafana") ||
      d.includes("prometheus") ||
      d.includes("uptime-kuma") ||
      d.includes("status.") ||
      d.includes("metrics.") ||
      d.includes("vercel.") ||
      d.includes("dashboard.") ||
      d.includes("homepage.") ||
      d.includes("diagram."),
  },
  {
    category: "Infrastructure",
    test: (d, f) =>
      f === "portainer" ||
      f === "n8n" ||
      f === "kasm_proxy" ||
      f === "guacamole-web" ||
      f === "npm-auth-proxy" ||
      d.includes("portainer") ||
      d.includes("n8n.") ||
      d.includes("kasm") ||
      d.includes("nging") ||
      d.includes("desktop.") ||
      d.includes("deploy."),
  },
  {
    category: "Voice / VAPI",
    test: (d, f) =>
      d.includes("vapi") ||
      d.includes("twilio") ||
      d.includes("invite.") ||
      f.includes("vapi") ||
      f.includes("twilio"),
  },
  {
    category: "Clients",
    test: (d, f) =>
      d.includes("fairdealhousebuyer") ||
      d.includes("aireinvestor") ||
      d.includes("sellyouroklahomahouse") ||
      d.includes("mybookbuddy") ||
      d.includes("investmenthouseokc") ||
      d.includes("theairealestateinvestor") ||
      d.includes("freeblog-aireinvestor") ||
      f.includes("aireinvestor") ||
      f.includes("wesapp") ||
      f.includes("mybookbuddy"),
  },
  {
    category: "Tools",
    test: (d, f) =>
      d.includes("mdops") ||
      d.includes("mddpy") ||
      d.includes("warp-code") ||
      d.includes("scraper") ||
      d.includes("httpx") ||
      d.includes("naabu") ||
      d.includes("if3scraper") ||
      d.includes("games-") ||
      d.includes("minecraft") ||
      d.includes("white-glove") ||
      d.includes("rmd.") ||
      d.includes("mcv") ||
      d.includes("datacleaner") ||
      f.includes("mdops") ||
      f.includes("scraper"),
  },
];

/** Return the category a proxy host belongs to based on its domain and forward host. */
export function categorizeHost(host: ProxyHost): Category {
  const domain = (host.domain_names[0] ?? "").toLowerCase();
  const forward = (host.forward_host ?? "").toLowerCase();

  for (const rule of RULES) {
    if (rule.test(domain, forward)) return rule.category;
  }

  return "Other";
}

/** Group an array of proxy hosts into a Map keyed by category. */
export function groupHosts(hosts: ProxyHost[]): Map<Category, ProxyHost[]> {
  const groups = new Map<Category, ProxyHost[]>();

  for (const host of hosts) {
    const cat = categorizeHost(host);
    const list = groups.get(cat) ?? [];
    list.push(host);
    groups.set(cat, list);
  }

  return groups;
}

// Ordered for display
export const CATEGORY_ORDER: Category[] = [
  "Pete",
  "Terry",
  "AI / LLM",
  "Monitoring",
  "Infrastructure",
  "Voice / VAPI",
  "Clients",
  "Tools",
  "Other",
];

// --- Group system (Issue #19) ---

export type GroupSlug =
  | "admin"
  | "pete"
  | "terry"
  | "ai-llm"
  | "monitoring"
  | "infrastructure"
  | "voice-vapi"
  | "clients"
  | "tools"
  | "other";

export const CATEGORY_TO_GROUP: Record<Category, GroupSlug> = {
  Pete: "pete",
  Terry: "terry",
  "AI / LLM": "ai-llm",
  Monitoring: "monitoring",
  Infrastructure: "infrastructure",
  "Voice / VAPI": "voice-vapi",
  Clients: "clients",
  Tools: "tools",
  Other: "other",
};

export const ALL_GROUPS: GroupSlug[] = [
  "admin",
  "pete",
  "terry",
  "ai-llm",
  "monitoring",
  "infrastructure",
  "voice-vapi",
  "clients",
  "tools",
  "other",
];
