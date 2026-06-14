# NPM Auth Gateway

<p align="center">
  <a href="https://nginxproxymanager.com/">
    <img src="https://nginxproxymanager.com/icon.png" alt="Nginx Proxy Manager" width="120" />
  </a>
</p>

<p align="center">
  User-level access control for <a href="https://nginxproxymanager.com/"><strong>Nginx Proxy Manager</strong></a>
  <br />
  Auto IP whitelisting via auth providers
</p>

<p align="center">
  <a href="https://github.com/NginxProxyManager/nginx-proxy-manager">NPM on GitHub</a> ·
  <a href="https://nginxproxymanager.com/">NPM Website</a> ·
  <a href="#quick-start">Quick Start</a>
</p>

---

> **Requires [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager)** — this is a companion app, not a replacement. NPM handles all SSL, reverse proxying, and access list enforcement. This app adds user management on top.

## The Problem

[Nginx Proxy Manager](https://nginxproxymanager.com/) by [@jc21](https://github.com/jc21) makes reverse proxying and SSL dead simple. Its access lists are powerful — they enforce IP-based whitelisting at the nginx level. But managing IPs for multiple users is manual:

- User needs access → admin manually adds their IP to an access list
- User's IP changes (mobile, VPN, travel) → admin re-adds the new IP
- No visibility into who an IP belongs to
- No way for users to self-service their IP whitelisting
- Managing 10+ users across multiple access lists doesn't scale

## The Solution

A companion app that sits alongside NPM on the same Docker network. It adds **user-level access control** on top of NPM's existing access list system — without modifying NPM.

```
Browser → NPM (SSL) → Auth Gateway → Auth Provider
                                          ↓
                                    NPM REST API (:81)
                                    auto-add IP to access lists
```

**NPM remains the boss.** The gateway only reads and writes through [NPM's REST API](https://github.com/NginxProxyManager/nginx-proxy-manager). All access enforcement stays in NPM's nginx config. If the gateway goes down, all existing IP whitelists persist.

## How It Works

1. **Admin invites a user** by email
2. **Admin assigns access** — a table of all proxy hosts with checkboxes
3. **User logs in** → their IP is detected → automatically added to assigned NPM access lists
4. **User's IP changes** → they log in again → new IP auto-added
5. **Admin revokes access** → user's IPs removed from all access lists

## Features

- **Auto IP whitelisting** — user logs in, IP added to their assigned NPM access lists
- **Per-host access control** — checkboxes on a proxy host table, not abstract groups
- **Admin/User roles** — admin sees everything, users see only their assigned hosts
- **Invite by email** — users sign in via Google SSO or password
- **Searchable tables** — find hosts and users instantly
- **Login logging** — IP history per user
- **Revoke access** — one click removes user's IPs from all access lists
- **Personalized dashboard** — users see only their services as clickable cards
- **Self-documenting** — DEV-MAN page scans source code for live architecture docs
- **Survives gateway failure** — NPM keeps enforcing all existing IP whitelists

## Architecture

### Who Controls What

| Responsibility | Who Handles It |
|---|---|
| SSL termination | [**Nginx Proxy Manager**](https://nginxproxymanager.com/) |
| Proxy host configuration | [**Nginx Proxy Manager**](https://nginxproxymanager.com/) |
| Access list enforcement (nginx) | [**Nginx Proxy Manager**](https://nginxproxymanager.com/) |
| IP whitelisting (the actual security) | [**Nginx Proxy Manager**](https://nginxproxymanager.com/) |
| User identity (who is this person?) | **Auth Provider** |
| User → access list mapping | **This App** |
| Auto IP detection + whitelisting | **This App** |
| Login logging + IP history | **This App** |

### Data Flow

```
Reads:  Server Component → npm-api.ts → NPM REST API → JSON
Writes: Client Component → Server Action → auth check → NPM API → revalidate
```

**No database.** NPM is the data store for proxy and access list configuration. This app keeps a small local user store for access assignments and login metadata.

### Security Model

```
Authentication:
  Browser → NPM (SSL) → Gateway → Auth Middleware
    ├─ No session? → Redirect to login
    ├─ Has session? → Render page
    └─ Mutation? → auth check → NPM API call

Access Control:
  ✓ Local user store: { aclIds: [3, 7], isAdmin: true }
  ✓ Admin: full access, IP whitelisted on ALL ACLs
  ✓ Non-admin: only sees hosts in their assigned ACLs
  ✓ On login: auto-add IP to assigned ACLs only
  ✓ If gateway dies: NPM keeps enforcing existing whitelists
```

## Quick Start

### Prerequisites

- **[Nginx Proxy Manager](https://nginxproxymanager.com/)** (must be running — this app depends on it)
- Docker + Docker Compose
- [Clerk](https://clerk.com/) account or any OIDC provider such as authentik

### 1. Clone and configure

```bash
git clone https://github.com/Mark0025/npm-auth-gateway.git
cd npm-auth-gateway
cp .env.example .env
```

Edit `.env`:

```env
# Choose one auth mode
AUTH_PROVIDER=oidc

# Clerk (used when AUTH_PROVIDER=clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Auth.js / OIDC (used when AUTH_PROVIDER=oidc)
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_URL=http://localhost:3100
OIDC_ISSUER=https://auth.example.com/application/o/npm-auth-gateway/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_GROUPS_CLAIM=groups
ADMIN_GROUPS=npm-auth-admins,admins
ACL_GROUP_MAP=media:3,infra:7,dev:8

# NPM API credentials (an admin user in your Nginx Proxy Manager instance)
NPM_API_EMAIL=admin@example.com
NPM_API_PASSWORD=your-npm-password
NPM_API_URL=http://nginx-proxy-manager:81/api
```

### 2. Deploy

```bash
docker compose up -d --build
```

The gateway runs on port 3100. It must be on the same Docker network as your Nginx Proxy Manager container.

### 3. Set up NPM proxy

In Nginx Proxy Manager, create a proxy host pointing to the gateway:

- **Domain**: `auth.yourdomain.com`
- **Forward Host**: `npm-auth-gateway` (container name)
- **Forward Port**: `3100`
- **SSL**: Enable with Let's Encrypt

### 4. Access precedence

User access is resolved in this order:

1. **Explicit local override** stored by this app
2. **Group-derived access** from OIDC groups
3. **Default no access**

Local overrides are created when an admin changes a user's ACLs or admin flag in the UI. Users without a local override continue to refresh from OIDC groups on login.

### 5. Optional OIDC group mapping

The OIDC group mapping is optional. These environment variables control it:

```env
OIDC_GROUPS_CLAIM=groups
ADMIN_GROUPS=npm-auth-admins,admins
ACL_GROUP_MAP=media:3,infra:7,dev:8
```

Behavior:

- `OIDC_GROUPS_CLAIM` chooses which token/session claim contains group names.
- If a user belongs to any group in `ADMIN_GROUPS`, they become admin.
- `ACL_GROUP_MAP` maps `group-name:aclId` pairs to NPM access list IDs.
- If no local override exists, group-derived access is applied on login.

### 6. authentik example

Example environment:

```env
AUTH_PROVIDER=oidc
AUTH_URL=https://auth-gateway.example.com
AUTH_SECRET=replace-with-a-long-random-secret
OIDC_ISSUER=https://auth.example.com/application/o/npm-auth-gateway/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_GROUPS_CLAIM=groups
ADMIN_GROUPS=npm-auth-admins,admins
ACL_GROUP_MAP=media:3,infra:7,dev:8
```

Example authentik setup:

- Redirect URI: `https://auth-gateway.example.com/api/auth/callback/oidc`
- Groups claim: `groups`
- Example groups:
  - `npm-auth-admins` grants admin access
  - `media` grants ACL `3`
  - `infra` grants ACL `7`
  - `dev` grants ACL `8`

> **Sign-out behavior (OIDC):** Signing out performs a *local* logout — it ends the gateway session and shows a confirmation page, but leaves your OIDC provider's SSO session intact. This is intentional: other apps sharing that SSO session stay logged in, and signing back in is one click. Logout does **not** revoke a user's whitelisted IP — that's a separate admin action.

## NPM API Endpoints Used

This app uses [Nginx Proxy Manager's REST API](https://github.com/NginxProxyManager/nginx-proxy-manager) exclusively:

| Endpoint | Purpose |
|---|---|
| `POST /api/tokens` | Auth token |
| `GET /api/nginx/proxy-hosts` | List all proxy hosts |
| `GET /api/nginx/proxy-hosts/:id` | Single proxy host |
| `GET /api/nginx/access-lists` | List access lists |
| `PUT /api/nginx/access-lists/:id` | Update access list IPs |
| `POST /api/nginx/access-lists` | Create access list |
| `GET /api/nginx/certificates` | List SSL certificates |

## Tech Stack

- **Next.js 16** / React 19 / TypeScript
- **Clerk** or **Auth.js (OIDC)** for auth — set `AUTH_PROVIDER=clerk|oidc`
- **shadcn/ui** + Tailwind CSS for components
- **Docker** (multi-stage build, Alpine)
- **[Nginx Proxy Manager](https://nginxproxymanager.com/) REST API** for all data operations

## Screenshots

*Coming soon — the app is in production use managing 90+ proxy hosts behind Nginx Proxy Manager.*

## Acknowledgments

This project exists because of [Nginx Proxy Manager](https://nginxproxymanager.com/) by [@jc21](https://github.com/jc21). NPM made self-hosting accessible — this app just adds user management on top of the excellent foundation NPM provides.

Generic **OIDC / Auth.js support** — letting you swap Clerk for self-hosted providers like [authentik](https://goauthentik.io/), Keycloak, or any OIDC issuer — was contributed by [@mapo-89](https://github.com/mapo-89). Thank you! This delivered the swappable-auth the project always aimed for.

## Changelog

### 2026-06-14 — Generic OIDC / Auth.js support

- **Authentication is now swappable** via `AUTH_PROVIDER=clerk|oidc`. Clerk remains the default; point `OIDC_ISSUER` at any OpenID Connect provider ([authentik](https://goauthentik.io/), Keycloak, Google, etc.). Contributed by [@mapo-89](https://github.com/mapo-89) (#1).
- **OIDC group → role mapping**: map IdP groups to admin access and NPM ACLs via `ADMIN_GROUPS` and `ACL_GROUP_MAP`.
- Verified end-to-end against a live authentik instance. Three follow-up fixes landed alongside (#2, #3): request the `groups` scope, preserve groups across requests, and a dedicated `/signed-out` page so sign-out no longer bounces back through SSO.
- Also fixed a pre-existing `npm install` dependency conflict on `main` (React canary + floating Clerk version).

## Contributing

Issues and PRs welcome. This is a companion tool for [Nginx Proxy Manager](https://nginxproxymanager.com/), not a fork — it respects NPM's architecture and authority.

## License

MIT

---

Built by [Mark Carpenter](https://aireinvestor.com) — solving the "just add their IP" problem for [Nginx Proxy Manager](https://nginxproxymanager.com/) users everywhere.
