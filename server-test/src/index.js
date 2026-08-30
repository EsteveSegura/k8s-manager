const app = require('./app');

const PORT = process.env.PORT || 47823;

app.listen(PORT, () => {
  console.log(`k8s-manager server-test (fake data) listening at http://localhost:${PORT}`);
});
