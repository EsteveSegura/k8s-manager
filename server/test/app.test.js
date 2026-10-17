import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { SRC_DIR, loadApp, require } from './helpers/load-app.js';

const fs = require('fs');
const express = require('express');

const WEB_DIST = path.join(SRC_DIR, '..', '..', 'web', 'dist');

// app.js decides at load time whether to serve the built web app, so the
// filesystem check and express.static are stubbed before loading it.
function loadAppWithWebDist(exists) {
  const realExistsSync = fs.existsSync;
  const existsSync = vi.spyOn(fs, 'existsSync').mockImplementation((p) => (p === WEB_DIST ? exists : realExistsSync(p)));
  const staticMiddleware = vi.spyOn(express, 'static').mockImplementation(() => (req, res, next) => {
    if (req.path === '/assets/app.js') res.type('js').send('console.log("static")');
    else next();
  });
  vi.spyOn(express.response, 'sendFile').mockImplementation(function sendFile(file) {
    this.json({ sendFile: file });
  });
  const loaded = loadApp();
  return { ...loaded, existsSync, staticMiddleware };
}

describe('app', () => {
  it('enables CORS for the API', async () => {
    const { app, k8s } = loadApp();
    k8s.loadKubeConfig.mockReturnValue({ getContexts: () => [] });

    const res = await request(app).get('/api/contexts').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('answers 404 for unknown API routes and non-GET methods', async () => {
    const { app } = loadApp();

    expect((await request(app).get('/api/does/not/exist/at/all')).status).toBe(404);
    expect((await request(app).delete('/api/my-ctx/resources')).status).toBe(404);
    expect((await request(app).post('/api/my-ctx/resources').send({})).status).toBe(404);
  });

  describe('with a built web app (web/dist present)', () => {
    it('serves static files from web/dist', async () => {
      const { app, existsSync, staticMiddleware } = loadAppWithWebDist(true);

      const res = await request(app).get('/assets/app.js');

      expect(existsSync).toHaveBeenCalledWith(WEB_DIST);
      expect(staticMiddleware).toHaveBeenCalledExactlyOnceWith(WEB_DIST);
      expect(res.status).toBe(200);
      expect(res.text).toBe('console.log("static")');
    });

    it('falls back to index.html for client-side routes', async () => {
      const { app } = loadAppWithWebDist(true);

      for (const route of ['/', '/deployments', '/ctx/pods/web-123']) {
        const res = await request(app).get(route);
        expect(res.status, route).toBe(200);
        expect(res.body, route).toEqual({ sendFile: path.join(WEB_DIST, 'index.html') });
      }
    });

    it('never serves index.html for /api routes', async () => {
      const { app } = loadAppWithWebDist(true);

      const res = await request(app).get('/api/does/not/exist/at/all');

      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('sendFile');
    });
  });

  describe('without a built web app', () => {
    it('only serves the API', async () => {
      const { app, staticMiddleware } = loadAppWithWebDist(false);

      const res = await request(app).get('/deployments');

      expect(staticMiddleware).not.toHaveBeenCalled();
      expect(res.status).toBe(404);
    });
  });
});
