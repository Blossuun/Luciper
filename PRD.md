# Tekken Local STT Product Architecture Review

## 1. 목적

이 문서는 **철권(Tekken) 특화 로컬 STT 제품**의 전체 구조를 평가받기 위한 아키텍처 요약 문서다.

제품 목표는 다음과 같다.

- 누구나 GitHub 등으로 내려받아 **로컬에서 설치/실행** 가능
- 기본 STT는 **API 없이 로컬 추론**
- 실시간 자막 생성 + 사후 자막 수정 가능
- 자막 수정 중에는 방해하지 않고, **세션 종료/다운로드 직전에 한 번만 학습 제안**
- 수정 결과를 바탕으로 **로컬 용어집**이 점점 정교해짐
- 여러 사용자의 검증된 수정 결과를 모아 **공유 용어집**도 점진적으로 개선
- 악의적 기여나 사전 오염은 방지

---

## 2. 핵심 제품 원칙

### 2.1 사용성 우선
- 수정 중간에는 팝업이나 방해 요소를 띄우지 않음
- 모든 수정이 끝난 뒤, 저장/다운로드 직전에만 한 번 검토
- 사용자는 사전을 직접 편집하는 게 아니라, **추천된 항목을 클릭으로 승인**만 함

### 2.2 로컬 우선
- STT 추론은 로컬에서 수행
- 네트워크 없이도 핵심 기능 사용 가능
- 공유 용어집은 선택적 동기화

### 2.3 점진적 학습
- 처음부터 완성된 철권 용어집을 요구하지 않음
- 사용자의 실제 수정 기록을 바탕으로 로컬/공유 용어집을 점진적으로 강화

### 2.4 공유는 검증 기반
- 아무나 직접 공유 용어집을 수정하지 못함
- 실제 자막 수정 + 저장/다운로드가 완료된 세션만 기여 후보가 됨
- 다수 사용자 검증과 점수화 이후에만 공유 용어집 반영

---

## 3. 전체 시스템 구조

```text
[1] Audio Capture Layer
    ↓
[2] STT Runtime Layer
    ↓
[3] Post-processing Layer
    ↓
[4] Subtitle Editing Layer
    ↓
[5] Lexicon Learning Layer
    ↓
[6] Shared Lexicon Sync Layer
````

---

## 4. 레이어별 구조

### 4.1 Audio Capture Layer

#### 역할

* 마이크 또는 지정된 오디오 소스를 입력으로 수집
* 가능하면 게임 소리와 분리된 **마이크 트랙**을 사용
* 실시간 STT에 넘길 오디오 청크 생성

#### 구현 후보

* WASAPI loopback
* 마이크 장치 직접 캡처
* OBS / 가상 오디오 장치 연동 (선택)

#### UX

* 기본값은 “마이크만 사용”
* 고급 사용자는 OBS/가상 오디오 장치를 선택 가능
* 입력 레벨 미터로 현재 입력 상태 확인 가능

#### 판단

* 정확도 향상에서 가장 중요한 요소 중 하나는 모델보다 입력 분리
* 게임 사운드가 섞이지 않도록 하는 것이 최우선

---

### 4.2 STT Runtime Layer

#### 역할

* 오디오 청크를 받아 실시간 전사
* 부분 자막(partial)과 확정 자막(final) 생성
* 낮은 지연 유지

#### 구현 후보

* `faster-whisper` 중심
* 보조 참고: `whisper.cpp`, WhisperLive 계열 구조
* VAD 포함

#### 권장 구조

* UI 프로세스와 STT 워커 프로세스 분리
* 내부 파이프라인:

```text
Audio Buffer
→ Chunk Splitter
→ VAD
→ STT Inference
→ Partial Result
→ Final Result
```

#### UX

* 실시간 자막 영역에 “인식 중” 텍스트와 “확정 자막”을 구분해 표시
* 너무 자주 확정하지 않고, 일정 안정화 후 확정

#### 판단

* noise suppression보다 VAD가 우선
* 모델 재학습보다 로컬 추론 안정성과 후처리가 더 중요

---

### 4.3 Post-processing Layer

#### 역할

* STT 결과를 철권 문맥에 맞게 정리
* 오인식 교정
* 표기 통일
* 철권 용어 기반 후처리 적용

#### 내부 모듈

1. Raw cleanup
2. Alias mapping
3. Misrecognition correction
4. Phrase stabilization

#### 예시

* 일렉 → EWGF
* 엘지에프 → EWGF
* 카운터 히트 → CH
* ewgf → EWGF

#### 구현 후보

* 정규식 기반 규칙
* lexicon lookup
* fuzzy matching(선택)

#### UX

* 기본은 자동 적용
* 필요할 때 원문/후처리/최종 수정 결과 비교 가능

#### 판단

* 철권은 일반 회화보다 표기 체계가 강한 도메인이라 후처리 비중이 큼

---

### 4.4 Subtitle Editing Layer

#### 역할

* 사용자가 STT 결과를 빠르게 검수/수정
* 수정 행위를 학습 후보 데이터로 저장

#### UI 형태

* 타임라인형 자막 편집기
* 각 자막 구간별 인라인 편집
* 수정 여부 표시
* 검색/치환 지원

#### UX 원칙

* 수정 중간에는 추천 팝업 금지
* 자막 검수 툴처럼 단순해야 함
* 텍스트 수정 외 조작 최소화

#### 판단

* 제품 전체 사용성의 핵심 레이어
* 이 단계에서 사용자가 불편하면 전체 구조가 실패함

---

### 4.5 Lexicon Learning Layer

#### 역할

* 사용자의 수정 기록을 분석
* 세션 종료 시 로컬 용어집 반영 후보 생성
* 사용자의 클릭 승인으로 로컬 용어집 업데이트

#### 핵심 UX

* 수정 중에는 개입하지 않음
* 저장/다운로드 직전에 한 번만 “학습 제안 패널” 표시

#### 추천 패널 예시

* 엘지에프 → EWGF (별칭 추천)
* ewgf → EWGF (표기 통일 추천)
* 벽강 → 벽꽝 (오인식 교정 추천)
* 벽꽝 이후 (구문 추천)

#### UX 원칙

* 사용자가 hotword / alias / phrase / normalization을 직접 고민하지 않게 함
* 시스템이 추천 분류를 제안하고, 사용자는 체크만 함

#### 내부 분류

* alias
* normalization
* misrecognition correction
* phrase

#### 로컬 저장

* SQLite 기반
* 수정 로그와 용어집을 함께 관리

#### 판단

* 완전 자동 승격보다 “세션 끝 반자동 승인”이 사용성과 정확도 모두에서 유리

---

### 4.6 Shared Lexicon Sync Layer

#### 역할

* 여러 사용자의 검증된 수정 결과를 집계
* 공유 용어집을 점진적으로 강화
* 로컬 클라이언트는 최신 공유 용어집을 pull

#### 기본 원칙

* 공유 기여는 선택 사항
* 실제 수정 + 실제 저장/다운로드 완료 세션만 기여 후보
* 단순 입력이나 실험성 수정은 제외

#### 서버 구조

```text
Client Upload
→ Ingestion API
→ Candidate Aggregator
→ Trust Scoring
→ Optional Review
→ Published Shared Lexicon JSON
→ Clients Pull Latest Version
```

#### 테러 방지

* 단일 사용자 영향 상한
* 다중 사용자 교차 검증
* 비정상 반복 패턴 필터링
* 롤백 가능한 버전 관리
* 금칙/스팸 필터

#### 최종 적용 우선순위

1. Local Lexicon
2. Shared Lexicon
3. Built-in Defaults

#### 판단

* GitHub 직접 편집보다 중앙 집계 + 정적 배포 구조가 더 현실적
* 공유는 강력하지만, 검증 기반이 아니면 오염 위험이 큼

---

## 5. 전체 UX 흐름

### 5.1 첫 실행

1. 앱 실행
2. 입력 장치 선택
3. 모델 선택/다운로드
4. 공유 용어집 사용 여부 선택
5. 실시간 전사 시작

### 5.2 실시간 사용

1. 부분 자막 표시
2. 확정 자막 누적
3. 사용자가 필요한 부분만 수정

### 5.3 저장/다운로드 직전

1. 수정 로그 분석
2. 학습 후보 요약 표시
3. 사용자가 선택 적용/모두 적용/건너뛰기
4. 로컬 용어집 반영
5. 기여가 켜져 있으면 공유 기여 큐에 적재

### 5.4 다음 세션

* 로컬 용어집 + 공유 용어집이 적용되어 점진적 성능 향상

---

## 6. 권장 기술 스택

### 데스크톱 앱

* Tauri + React 권장
* 대안: Electron + React

### 로컬 런타임

* Python
* FastAPI 또는 IPC
* faster-whisper
* SQLite

### 오디오 처리

* sounddevice / PyAudio
* Windows WASAPI
* OBS / 가상 오디오 입력 연동(선택)

### 공유 서버

* FastAPI
* PostgreSQL
* aggregation worker
* 정적 JSON 배포(CDN/object storage)

---

## 7. 로컬 데이터 모델

### 주요 테이블

* `sessions`
* `subtitle_segments`
* `correction_events`
* `lexicon_entries`
* `sync_queue`

### `lexicon_entries` 예시 필드

* `entry_id`
* `type` (`hotword`, `alias`, `phrase`, `normalization`)
* `source`
* `target`
* `weight`
* `scope` (`local`, `shared`)
* `enabled`

---

## 8. 단계별 개발 계획

### V1

* 로컬 오디오 입력
* faster-whisper 전사
* 자막 편집 UI
* 세션 종료 학습 제안
* 로컬 용어집 반영

### V1.5

* 추천 품질 개선
* partial/final 자막 안정화
* 로컬 용어집 import/export

### V2

* 공유 기여 업로드
* 중앙 aggregation
* 공유 용어집 pull
* 버전 관리/롤백

### V3

* 캐릭터별 용어팩
* 언어별 용어팩
* 방송/해설 프리셋
* 매치업별 확장

---

## 9. 평가 포인트

이 구조를 평가할 때 특히 봐야 할 것은 다음이다.

1. 레이어 분리가 적절한가
2. 로컬 우선 구조가 현실적인가
3. UX가 실제로 “방해가 적고 빠른가”
4. 세션 종료 학습 구조가 과하지 않고 효과적인가
5. 공유 용어집 구조가 네트워크 효과와 안전성을 같이 만족하는가
6. 테러/오염 방지 설계가 충분한가
7. MVP부터 V2/V3까지의 확장 경로가 타당한가
8. 구현 난이도 대비 가치가 높은 구조인가

---

## 10. 요약

이 제품은 “새로운 STT 모델 개발”이 아니라 아래 문제를 푸는 구조다.

* 로컬 실시간 STT 제품 만들기
* 철권 특화 용어 적응 루프 만들기
* 수정 행위를 방해하지 않는 UX 만들기
* 공유 용어집을 안전하게 운영하기

핵심 차별점은 모델 자체보다,
**철권 특화 후처리 + 세션 종료 학습 UX + 검증 기반 공유 용어집 구조**에 있다.
