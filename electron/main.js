const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');
const { fixPath } = require('./fix-path');

const isDev = !app.isPackaged;
const DEV_URL = 'http://localhost:5173';

let mainWindow = null;
let appUrl = null;

// Starts the same Express app used by `npm start` inside the main process.
// Packaged, electron-builder copies server/ and web/dist into resources/ (see
// "extraResources" in package.json), keeping the relative path app.js uses to
// find web/dist. Port 0 picks a free port so it never clashes with a server
// already running on 47823, and it only listens on loopback.
function startServer() {
  const expressApp = require(path.join(process.resourcesPath, 'server/src/app'));
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.on('error', reject);
  });
}

function isAppUrl(url) {
  try {
    return new URL(url).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'k8s-manager',
    show: false,
    // On macOS the native title bar is hidden so the window top matches the app
    // background; the web UI draws a transparent draggable strip there (.electron-mac in web/src/style.css).
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 8 },
    }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // External links open in the system browser instead of a new app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(appUrl);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    if (isDev) {
      // In dev, server/ and web/ already run via `npm run dev:desktop`; Electron is just the window.
      appUrl = DEV_URL;
    } else {
      // Apps launched from Finder/Dock/desktop menus don't inherit the login shell PATH,
      // which kubeconfig exec auth plugins (gke-gcloud-auth-plugin, aws, kubelogin...) need.
      fixPath();
      const port = await startServer();
      appUrl = `http://127.0.0.1:${port}`;
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
