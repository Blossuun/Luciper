/**
 * src/main/db.ts
 *
 * SQLite 데이터베이스 래퍼.
 * 스키마 초기화, 기본 CRUD 인터페이스를 제공한다.
 * 세부 로직은 Phase 1에서 구현한다.
 *
 * @see docs/architecture/00-system-overview.md §8
 */

/** DB 인스턴스 설정 */
export interface DbConfig {
  /** DB 파일 경로 */
  dbPath: string
}

export class Db {
  private _config: DbConfig

  constructor(config: DbConfig) {
    this._config = config
  }

  /**
   * DB 연결을 열고 스키마를 초기화한다.
   * 구현은 Phase 1.
   */
  init(): Promise<void> {
    return Promise.resolve()
  }

  /**
   * SQL 쿼리를 실행하고 결과 행들을 반환한다.
   * @param sql - SQL 쿼리 문자열
   * @param params - 바인딩 파라미터
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    return Promise.resolve([])
  }

  /**
   * INSERT/UPDATE/DELETE 를 실행한다.
   * @param sql - SQL 쿼리 문자열
   * @param params - 바인딩 파라미터
   */
  run(sql: string, params?: unknown[]): Promise<void> {
    return Promise.resolve()
  }

  /**
   * DB 연결을 닫는다.
   * 구현은 Phase 1.
   */
  close(): Promise<void> {
    return Promise.resolve()
  }
}
