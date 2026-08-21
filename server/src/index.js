const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`k8s-manager server listening on http://localhost:${PORT}`);
});
