# Linux Playground

Full-stack web-based Linux playground:
- `apps/web`: Next.js + Tailwind + xterm.js
- `apps/api`: Express + WebSocket + Docker API (Ubuntu containers) + PostgreSQL

## Prereqs

- Node.js 20+
- Docker (daemon running)
- Docker Compose

## Quickstart (local)

1. Start Postgres + API + Web:

```bash
docker compose up --build
```

2. Open:
- Web: `http://localhost:3000`
- API: `http://localhost:8080/healthz`

## Dev (without Compose)

```bash
npm install
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

## Env

Copy examples:
- `apps/api/.env.example` -> `apps/api/.env`
- `apps/web/.env.local.example` -> `apps/web/.env.local`

## Notes

- The API needs access to the Docker daemon to create per-user Ubuntu containers. In Compose, this is done by mounting `/var/run/docker.sock` into the API container.
- Command filtering is best-effort; isolation is primarily enforced by container sandboxing and resource limits.

## Kubernetes

Example manifests live in `k8s/` (see `k8s/README.md`). The example uses a `hostPath` mount for `/var/run/docker.sock`, which has major security implications.

## Domain Mapping (EC2 Public IP)

This is the simplest deployment model: map a domain to an EC2 instance public IP and reverse-proxy to the containers.

### 1) DNS

Assume:
- Domain: `playground.example.com`
- EC2 public IPv4: `EC2_PUBLIC_IP`

Create a DNS record:
- `A` record: `playground.example.com` -> `EC2_PUBLIC_IP`

If you use Route 53: Hosted Zone -> `Create record` -> type `A` -> value `EC2_PUBLIC_IP`.

Recommendation: use an Elastic IP so the address does not change.

### 2) EC2 Security Group

Allow inbound:
- TCP `80` from `0.0.0.0/0`
- TCP `443` from `0.0.0.0/0`

Do not expose container ports (like `3000`/`8080`) publicly unless you know why you need to.

### 3) Reverse Proxy (Nginx)

Run `docker compose up -d --build` on the EC2 instance and proxy:
- `/` -> `web` (`localhost:3000`)
- `/api/` -> `api` (`localhost:8080`)
- `/ws/terminal` -> `api` WebSocket (`localhost:8080`)

Example Nginx server block:

```nginx
server {
  listen 80;
  server_name playground.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # WebSocket terminal
  location /ws/terminal {
    proxy_pass http://127.0.0.1:8080/ws/terminal;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

If you add TLS (recommended), terminate TLS at Nginx and use `wss://` from the browser.

### 4) App Env For Domain + WebSockets

When serving the web UI from your domain, set:

- API `CORS_ORIGIN` to your domain (or `*` for a quick test):
  - `CORS_ORIGIN=https://playground.example.com`
- Web client API base and WS base:
  - `NEXT_PUBLIC_API_BASE_URL=https://playground.example.com/api`
  - `NEXT_PUBLIC_API_WS_URL=wss://playground.example.com`

With the Nginx config above, the web app should call `/api/*` and connect to `wss://playground.example.com/ws/terminal`.
