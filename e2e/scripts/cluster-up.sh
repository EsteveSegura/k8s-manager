#!/usr/bin/env bash
# Creates (or reuses) the kind cluster for the e2e suite, seeds it with the
# known fixtures, waits until everything the tests assert on is settled and
# writes the kubeconfig the app runs with (.kube/config).
#
# Nothing here touches ~/.kube/config: kind and kubectl use .kube/admin.config.
set -euo pipefail

cd "$(dirname "$0")/.."

CLUSTER_NAME="k8s-manager-e2e"
CONTEXT_NAME="k8s-manager-e2e"
METRICS_SERVER_VERSION="v0.9.0"
ADMIN_KUBECONFIG="$PWD/.kube/admin.config"
APP_KUBECONFIG="$PWD/.kube/config"

mkdir -p .kube
export KUBECONFIG="$ADMIN_KUBECONFIG"

log() { printf '\n==> %s\n' "$*"; }

# Retries a command every 3 seconds until it succeeds or the timeout (in seconds) expires.
wait_for() {
  local description="$1" timeout="$2"
  shift 2
  local deadline=$((SECONDS + timeout))
  until "$@" >/dev/null 2>&1; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "Timed out waiting for $description" >&2
      return 1
    fi
    sleep 3
  done
}

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  log "Reusing kind cluster $CLUSTER_NAME"
  kind export kubeconfig --name "$CLUSTER_NAME" --kubeconfig "$ADMIN_KUBECONFIG"
else
  log "Creating kind cluster $CLUSTER_NAME"
  kind create cluster --name "$CLUSTER_NAME" --config cluster/kind-config.yaml --kubeconfig "$ADMIN_KUBECONFIG" --wait 120s
fi

log "Installing metrics-server $METRICS_SERVER_VERSION"
kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/$METRICS_SERVER_VERSION/components.yaml"
# kind's kubelets use self-signed serving certificates.
if ! kubectl -n kube-system get deployment metrics-server -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q kubelet-insecure-tls; then
  kubectl -n kube-system patch deployment metrics-server --type=json \
    -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
fi

log "Applying fixtures"
kubectl apply -f manifests/00-access.yaml -f manifests/10-workloads.yaml -f manifests/20-crd.yaml
kubectl wait --for=condition=Established --timeout=60s crd/widgets.e2e.k8s-manager.dev
kubectl apply -f manifests/30-crd-instances.yaml
helm upgrade --install e2e-release ./chart --namespace e2e --wait --timeout 2m

log "Waiting for workloads"
kubectl -n e2e rollout status deployment/web --timeout=180s
kubectl -n e2e rollout status statefulset/db --timeout=180s
kubectl -n e2e rollout status daemonset/agent --timeout=180s
kubectl -n e2e wait --for=condition=Complete --timeout=180s job/migrate
kubectl -n kube-system rollout status deployment/metrics-server --timeout=180s

# Tests expect exactly two web pods (no leftovers terminating after a rescale).
two_web_pods() {
  [ "$(kubectl -n e2e get pods -l app=web --no-headers | wc -l)" -eq 2 ]
}
wait_for "exactly two web pods" 120 two_web_pods

broken_pod_is_failing() {
  kubectl -n e2e get pods -l app=broken \
    -o jsonpath='{.items[*].status.containerStatuses[*].state.waiting.reason}' | grep -Eq 'ErrImagePull|ImagePullBackOff'
}
wait_for "the broken pod to fail pulling its image" 120 broken_pod_is_failing

# metrics-server needs a couple of scrapes before it reports anything.
web_pod_metrics_ready() {
  [ "$(kubectl -n e2e top pods -l app=web --no-headers | wc -l)" -ge 2 ] && kubectl top nodes --no-headers | grep -q .
}
log "Waiting for metrics-server to report usage"
wait_for "pod and node metrics" 240 web_pod_metrics_ready

log "Writing the app's kubeconfig to .kube/config"
server="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')"
ca_data="$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')"
token="$(kubectl -n e2e-access create token k8s-manager --duration=24h)"
limited_token="$(kubectl -n e2e-access create token k8s-manager-limited --duration=24h)"
umask 077
# Besides the main read-only context, three contexts to test error handling:
# partial permissions, a token the API server rejects and an API server that
# does not answer at all (nothing listens on port 1).
cat >"$APP_KUBECONFIG" <<EOF
apiVersion: v1
kind: Config
clusters:
  - name: kind-$CLUSTER_NAME
    cluster:
      server: $server
      certificate-authority-data: $ca_data
  - name: unreachable
    cluster:
      server: https://127.0.0.1:1
      insecure-skip-tls-verify: true
users:
  - name: k8s-manager-read-only
    user:
      token: $token
  - name: k8s-manager-limited
    user:
      token: $limited_token
  - name: invalid-token
    user:
      token: not-a-valid-token
contexts:
  - name: $CONTEXT_NAME
    context:
      cluster: kind-$CLUSTER_NAME
      user: k8s-manager-read-only
  - name: $CONTEXT_NAME-limited
    context:
      cluster: kind-$CLUSTER_NAME
      user: k8s-manager-limited
  - name: $CONTEXT_NAME-invalid-token
    context:
      cluster: kind-$CLUSTER_NAME
      user: invalid-token
  - name: $CONTEXT_NAME-unreachable
    context:
      cluster: unreachable
      user: invalid-token
current-context: $CONTEXT_NAME
EOF

log "Cluster ready"
