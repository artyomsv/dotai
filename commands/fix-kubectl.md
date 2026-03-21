---
description: Fix kubectl config across all machines after k3s cluster update. Updates kubeconfig from master node (192.168.6.15) to localhost, personal host, and GitHub runners.
allowed-tools: Bash(*)
---

# Fix Kubectl Config

Update kubeconfig files across all machines after k3s cluster regenerates certificates.

## Environment
- **Master Node**: 192.168.6.15 (source of kubeconfig at `/etc/rancher/k3s/k3s.yaml`)
- **Personal Host**: 192.168.6.12 (`~/.kube/config`)
- **Localhost**: Windows (`~/.kube/config`)
- **GitHub Runners**: 192.168.6.227, 192.168.6.239, 192.168.6.228 (`~/.kube/config`)

## Steps

### 1. Update Personal Host (192.168.6.12)
```bash
ssh artyom@192.168.6.15 "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/192.168.6.15/g' | ssh artyom@192.168.6.12 "cat > ~/.kube/config"
```

### 2. Update Localhost (Windows)
```bash
mkdir -p /c/Users/artjo/.kube && ssh artyom@192.168.6.15 "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/192.168.6.15/g' > /c/Users/artjo/.kube/config
```

### 3. Update GitHub Runners
```bash
ssh artyom@192.168.6.15 "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/192.168.6.15/g' | ssh artyom@192.168.6.227 "cat > ~/.kube/config"
ssh artyom@192.168.6.15 "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/192.168.6.15/g' | ssh artyom@192.168.6.239 "cat > ~/.kube/config"
ssh artyom@192.168.6.15 "sudo cat /etc/rancher/k3s/k3s.yaml" | sed 's/127.0.0.1/192.168.6.15/g' | ssh artyom@192.168.6.228 "cat > ~/.kube/config"
```

### 4. Verify Connectivity
Test kubectl from each machine:
```bash
kubectl get nodes
ssh artyom@192.168.6.12 "kubectl get nodes"
ssh artyom@192.168.6.227 "kubectl get nodes"
ssh artyom@192.168.6.239 "kubectl get nodes"
ssh artyom@192.168.6.228 "kubectl get nodes"
```

Expected: All nodes show `Ready` status.
