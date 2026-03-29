/**
 * src/main/model-store.ts
 *
 * Whisper 모델 파일의 다운로드 상태 및 경로를 관리한다.
 * 세부 로직은 Phase 2에서 구현한다.
 *
 * @see docs/architecture/02-stt-runtime.md §4.1
 */

export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3'

export interface ModelInfo {
  size: ModelSize
  /** 로컬 파일 경로. 미다운로드 시 null */
  localPath: string | null
  /** 다운로드 완료 여부 */
  isDownloaded: boolean
}

export class ModelStore {
  /**
   * 특정 크기 모델의 로컬 경로를 반환한다.
   * @param size - 모델 크기
   * @returns 다운로드된 경우 절대 경로, 아니면 null
   */
  getModelPath(size: ModelSize): string | null {
    return null
  }

  /**
   * 사용 가능한 모델 목록과 다운로드 상태를 반환한다.
   * 구현은 Phase 2.
   */
  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve([])
  }

  /**
   * 모델을 다운로드한다. 진행률은 콜백으로 보고한다.
   * @param size - 다운로드할 모델 크기
   * @param onProgress - 진행률 콜백 (0.0 ~ 1.0)
   */
  downloadModel(size: ModelSize, onProgress: (progress: number) => void): Promise<void> {
    return Promise.resolve()
  }
}
