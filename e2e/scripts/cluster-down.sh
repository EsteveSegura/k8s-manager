#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

kind delete cluster --name k8s-manager-e2e
rm -rf .kube
