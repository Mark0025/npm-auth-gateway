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

**No database.** NPM is the data store for all proxy and access list configuration. User metadata stored in auth provider. Zero state duplication.

### Security Model

```
Authentication:
  Browser → NPM (SSL) → Gateway → Auth Middleware
    ├─ No session? → Redirect to login
    ├─ Has session? → Render page
    └─ Mutation? → auth check → NPM API call

Access Control:
  ✓ User metadata: { aclIds: [3, 7], isAdmin: true }
  ✓ Admin: full access, IP whitelisted on ALL ACLs
  ✓ Non-admin: only sees hosts in their assigned ACLs
  ✓ On login: auto-add IP to assigned ACLs only
  ✓ If gateway dies: NPM keeps enforcing existing whitelists
```

## Quick Start

### Prerequisites

- **[Nginx Proxy Manager](https://nginxproxymanager.com/)** (must be running — this app depends on it)
- Docker + Docker Compose
- [Clerk](https://clerk.com/) account (free tier works)

### 1. Clone and configure

```bash
git clone https://github.com/Mark0025/npm-auth-gateway.git
cd npm-auth-gateway
cp .env.example .env
```

Edit `.env`:

```env
# Clerk (get from clerk.com dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

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

### 4. Bootstrap admin

In Clerk Dashboard, find your user and set Public Metadata:

```json
{"aclIds": [], "isAdmin": true}
```

After that, all user management happens from the app — no more Clerk Dashboard needed.

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
- **Clerk** for auth (swappable for any OIDC provider)
- **shadcn/ui** + Tailwind CSS for components
- **Docker** (multi-stage build, Alpine)
- **[Nginx Proxy Manager](https://nginxproxymanager.com/) REST API** for all data operations

## Screenshots

*Coming soon — the app is in production use managing 90+ proxy hosts behind Nginx Proxy Manager.*

## Acknowledgments

This project exists because of [Nginx Proxy Manager](https://nginxproxymanager.com/) by [@jc21](https://github.com/jc21). NPM made self-hosting accessible — this app just adds user management on top of the excellent foundation NPM provides.

## Contributing

Issues and PRs welcome. This is a companion tool for [Nginx Proxy Manager](https://nginxproxymanager.com/), not a fork — it respects NPM's architecture and authority.

## License

MIT

---

Built by [Mark Carpenter](https://aireinvestor.com) — solving the "just add their IP" problem for [Nginx Proxy Manager](https://nginxproxymanager.com/) users everywhere.
