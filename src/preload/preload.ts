/**
 * src/preload/preload.ts
 *
 * Electron Preload 스크립트.
 * contextBridge를 통해 Renderer에 안전한 IPC API를 노출한다.
 * 세부 로직은 Phase 1에서 구현한다.
 *
 * @see docs/architecture/06-sidecar-manager.md §8
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * Renderer에서 window.luciper 로 접근할 수 있는 API 인터페이스.
 * Phase 1에서 실제 메서드를 추가한다.
 */
export interface LuciperApi {
  /**
   * STT Worker에 RPC 요청을 보낸다.
   * @param method - RPC 메서드명
   * @param params - RPC 파라미터
   */
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown>

  /**
   * Sidecar 이벤트(알림)를 수신하는 리스너를 등록한다.
   * @param channel - 채널명 (e.g. 'partial_result', 'audio_level')
   * @param listener - 이벤트 수신 콜백
   */
  on(channel: string, listener: (...args: unknown[]) => void): void

  /**
   * 등록된 리스너를 제거한다.
   * @param channel - 채널명
   */
  off(channel: string, listener: (...args: unknown[]) => void): void
}

// Phase 1에서 실제 구현으로 교체
contextBridge.exposeInMainWorld('luciper', {
  invoke: (_method: string, _params?: Record<string, unknown>) => Promise.resolve(),
  on: (_channel: string, _listener: (...args: unknown[]) => void) => undefined,
  off: (_channel: string, _listener: (...args: unknown[]) => void) => undefined,
} satisfies LuciperApi)
