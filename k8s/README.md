# Kubernetes Deployment (Example)

This folder contains example manifests to deploy Linux Playground on Kubernetes.

Important:
- The API uses the Docker socket to create per-user Ubuntu containers. In Kubernetes this typically means mounting the node's `/var/run/docker.sock` into the API pod via `hostPath`. This is powerful and risky; treat it like root access to the node.
- If your cluster uses containerd without a Docker socket, you need to rework the "isolated environment" implementation (e.g. run per-user pods via the Kubernetes API).

## Apply

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
```

Then expose `web` with your preferred Ingress/controller.

