/**
 * src/main/sidecar-manager.ts
 *
 * Electron Main 프로세스에서 Python STT Worker를 관리하는 클래스.
 * JSON-RPC over NDJSON(stdin/stdout) 통신을 담당한다.
 * 세부 로직은 Phase 1에서 구현한다.
 *
 * @see docs/architecture/06-sidecar-manager.md
 */

import { ChildProcess } from 'child_process'

/** Sidecar 상태 */
export type SidecarStatus = 'stopped' | 'starting' | 'ready' | 'crashed'

/** JSON-RPC 요청 */
export interface RpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: Record<string, unknown>
}

/** JSON-RPC 응답 */
export interface RpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

/** JSON-RPC 알림 (id 없음) */
export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

export class SidecarManager {
  private _process: ChildProcess | null = null
  private _status: SidecarStatus = 'stopped'

  /**
   * Python Worker 프로세스를 spawn하고 초기화한다.
   * 구현은 Phase 1.
   */
  start(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * JSON-RPC 요청을 Python Worker에 전송하고 응답을 기다린다.
   * @param method - RPC 메서드명
   * @param params - RPC 파라미터
   * @returns 응답 result 필드
   */
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  /**
   * Graceful shutdown 시퀀스를 수행한다.
   * 구현은 Phase 1.
   */
  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  get status(): SidecarStatus {
    return this._status
  }
}
