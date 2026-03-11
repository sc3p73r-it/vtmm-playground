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
