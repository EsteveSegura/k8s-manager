// Electron's user agent includes "Electron/<version>"; on macOS it also includes "Macintosh".
export function isElectronMac(userAgent: string = navigator.userAgent): boolean {
  return /\bElectron\//.test(userAgent) && /\bMacintosh\b/.test(userAgent)
}

// The desktop app hides the native macOS title bar (see electron/main.js) so the
// window chrome matches the app background; this class reserves room for it.
export function applyElectronMacClass(root: HTMLElement = document.documentElement, userAgent?: string) {
  root.classList.toggle('electron-mac', isElectronMac(userAgent))
}
