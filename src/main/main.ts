/**
 * src/main/main.ts
 *
 * Electron Main 프로세스 진입점.
 * BrowserWindow 생성, SidecarManager 초기화, ipcMain 핸들러 등록을 담당한다.
 * 세부 로직은 Phase 1에서 구현한다.
 *
 * @see docs/architecture/06-sidecar-manager.md §8
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { SidecarManager } from './sidecar-manager'

let mainWindow: BrowserWindow | null = null
let sidecarManager: SidecarManager | null = null

/**
 * BrowserWindow를 생성하고 renderer를 로드한다.
 * 구현은 Phase 1.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Phase 1에서 URL 또는 파일 경로 결정
}

/**
 * 앱 초기화 시퀀스.
 * 구현은 Phase 1.
 */
async function initialize(): Promise<void> {
  sidecarManager = new SidecarManager()
  // Phase 1: await sidecarManager.start()
  createWindow()
}

app.whenReady().then(initialize).catch(console.error)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
