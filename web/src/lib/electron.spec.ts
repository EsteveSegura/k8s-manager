// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyElectronMacClass, isElectronMac } from './electron'

const MAC_ELECTRON =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) k8s-manager/0.0.1 Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36'
const WIN_ELECTRON =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) k8s-manager/0.0.1 Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36'
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

describe('isElectronMac', () => {
  it('is true only for Electron running on macOS', () => {
    expect(isElectronMac(MAC_ELECTRON)).toBe(true)
    expect(isElectronMac(WIN_ELECTRON)).toBe(false)
    expect(isElectronMac(MAC_CHROME)).toBe(false)
  })
})

describe('applyElectronMacClass', () => {
  it('adds the class in Electron on macOS and removes it elsewhere', () => {
    const root = document.createElement('html')
    applyElectronMacClass(root, MAC_ELECTRON)
    expect(root.classList.contains('electron-mac')).toBe(true)
    applyElectronMacClass(root, MAC_CHROME)
    expect(root.classList.contains('electron-mac')).toBe(false)
  })
})
