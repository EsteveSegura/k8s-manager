const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const contextsRouter = require('./routes/contexts');
const resourcesRouter = require('./routes/resources');
const logsRouter = require('./routes/logs');
const metricsRouter = require('./routes/metrics');
const crdsRouter = require('./routes/crds');
const helmRouter = require('./routes/helm');
const eventsRouter = require('./routes/events');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', contextsRouter);
app.use('/api', resourcesRouter);
app.use('/api', logsRouter);
app.use('/api', metricsRouter);
app.use('/api', crdsRouter);
app.use('/api', helmRouter);
app.use('/api', eventsRouter);

// Serves the built web app (npm run build) so `npm start` works as a single process.
const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
