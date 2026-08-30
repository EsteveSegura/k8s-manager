# k8s-manager

<video src="https://github.com/EsteveSegura/k8s-manager/raw/main/demo.mp4" controls width="100%">
  Your browser doesn't support inline video — <a href="https://github.com/EsteveSegura/k8s-manager/raw/main/demo.mp4">download the demo</a> instead.
</video>

A read-only observability tool for Kubernetes clusters. It gives you a fast web UI to browse everything running in a cluster — Deployments, Services, Pods, StatefulSets, DaemonSets, Jobs/CronJobs, Ingresses, ConfigMaps/Secrets, PVs/PVCs, Nodes, CRDs, Helm releases, HPAs, Namespaces, NetworkPolicies, Endpoints and PodDisruptionBudgets — without ever creating, modifying, or deleting anything in the cluster.

## Features

- **Context switching** — pick any context from your kubeconfig and browse its resources.
- **Resource navigation** — Deployments → Services → Pods and every other resource kind, with relationships resolved between them (which Pods back a Service, which PVC is bound to which PV, etc.).
- **Describe panel** — click any resource to inspect it instantly, including raw YAML with copy-to-clipboard.
- **Command palette** (Cmd/Ctrl+K) — jump to any loaded resource by name.
- **Cluster dashboard** — overview of cluster health (non-Running pods, not-ready deployments, issues detected).
- **Cluster events** — `kubectl get events`-style view, filterable by namespace/resource.
- **Pod logs** — snapshot of recent logs with manual refresh, and log download.
- **Metrics** — CPU/RAM usage for pods and nodes, with a short in-memory history chart.
- **Namespace filter, pinned resources, sortable tables** for faster day-to-day inspection.
- Secrets are always shown redacted; the app has no write access to the cluster at all.

## Requirements

- Node.js 20+
- A working kubeconfig with access to the cluster(s) you want to inspect (`~/.kube/config` on macOS/Linux, `%USERPROFILE%\.kube\config` on Windows, or set `KUBECONFIG` to a custom path).

## Running it

Install dependencies once from the repo root:

```bash
npm install
npm install --prefix server
npm install --prefix web
```

Then build the web app and start a single server that serves both the UI and the API:

```bash
npm run start
```

This runs `vite build` for the web app and starts the Express server on **http://localhost:47823**. The command itself is identical on every OS:

- **macOS / Linux** (bash/zsh):
  ```bash
  npm run start
  # open it
  open http://localhost:47823        # macOS
  xdg-open http://localhost:47823    # Linux
  ```
- **Windows** (PowerShell or cmd.exe):
  ```powershell
  npm run start
  start http://localhost:47823
  ```

To use a different port:

```bash
# macOS / Linux
K8S_MANAGER_PORT=5000 npm run start
```

```powershell
# Windows PowerShell
$env:K8S_MANAGER_PORT=5000; npm run start

# Windows cmd.exe
set K8S_MANAGER_PORT=5000 && npm run start
```

## Starting the server automatically at boot

`npm run build` only needs to run once (after install or after pulling updates); after that, the server can start straight from the already-built `web/dist`. Replace `/path/to/k8s-manager` below with the actual path where you cloned this repo.

```bash
npm run build
```

- **macOS** (launchd): create `~/Library/LaunchAgents/com.k8s-manager.server.plist`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.k8s-manager.server</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>npm</string>
      <string>start</string>
      <string>--prefix</string>
      <string>server</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/k8s-manager</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
  </dict>
  </plist>
  ```
  Then enable it:
  ```bash
  launchctl load -w ~/Library/LaunchAgents/com.k8s-manager.server.plist
  ```
  To disable it later: `launchctl unload -w ~/Library/LaunchAgents/com.k8s-manager.server.plist`

- **Linux** (systemd user service): create `~/.config/systemd/user/k8s-manager.service`:
  ```ini
  [Unit]
  Description=k8s-manager server

  [Service]
  WorkingDirectory=/path/to/k8s-manager
  ExecStart=/usr/bin/npm start --prefix server
  Restart=on-failure

  [Install]
  WantedBy=default.target
  ```
  Then enable it and allow it to run even without an active login session:
  ```bash
  systemctl --user daemon-reload
  systemctl --user enable --now k8s-manager.service
  loginctl enable-linger "$USER"
  ```
  To disable it later: `systemctl --user disable --now k8s-manager.service`

- **Windows** (Task Scheduler, runs at logon):
  ```powershell
  schtasks /create /tn "k8s-manager" /tr "cmd /c cd /d C:\path\to\k8s-manager && npm start --prefix server" /sc onlogon /rl highest
  ```
  To remove it later: `schtasks /delete /tn "k8s-manager" /f`

### Trying it without a real cluster

A demo backend (`server-test/`) serves realistic but entirely fake cluster data, useful for exploring the UI without a kubeconfig:

```bash
npm install --prefix server-test
npm run dev:demo
```
