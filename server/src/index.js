const app = require('./app');

const PORT = process.env.K8S_MANAGER_PORT || 47823;

app.listen(PORT, () => {
  console.log(`k8s-manager server listening on http://localhost:${PORT}`);
});
