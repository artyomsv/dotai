---
description: Fix kubectl config across all machines after a k3s cluster update. Copies the kubeconfig from the k3s master node to this machine and to every host listed in the local hosts file.
allowed-tools: Bash(*)
---

# Fix Kubectl Config

Update kubeconfig files across all machines after k3s regenerates its certificates.

## Environment

Hosts live outside this repository, in `~/.config/dotai/k3s-hosts.env`, so no address or user
name is ever committed. The file is plain shell:

```bash
K3S_SSH_USER=<ssh user on every host>
K3S_MASTER=<master node address; source of /etc/rancher/k3s/k3s.yaml>
K3S_TARGETS="<space-separated addresses of every remote host that needs ~/.kube/config>"
```

If the file is missing, stop and ask the user for these three values. Never write them into this
command or anywhere else in the repository.

## Steps

### 1. Load the hosts

```bash
source ~/.config/dotai/k3s-hosts.env
fetch() { ssh "$K3S_SSH_USER@$K3S_MASTER" "sudo cat /etc/rancher/k3s/k3s.yaml" | sed "s/127.0.0.1/$K3S_MASTER/g"; }
```

### 2. Update this machine

```bash
mkdir -p ~/.kube && fetch > ~/.kube/config
```

### 3. Update every remote host

```bash
for h in $K3S_TARGETS; do fetch | ssh "$K3S_SSH_USER@$h" "mkdir -p ~/.kube && cat > ~/.kube/config" && echo "updated $h"; done
```

### 4. Verify connectivity

```bash
kubectl get nodes
for h in $K3S_TARGETS; do echo "== $h"; ssh "$K3S_SSH_USER@$h" "kubectl get nodes"; done
```

Expected: every node shows `Ready` on every host.
