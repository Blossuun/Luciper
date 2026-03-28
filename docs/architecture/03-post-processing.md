# L3 — Post-processing Layer

> **상위 문서**: [00-overview.md](./00-overview.md)
> **의존**: [02-stt-runtime.md](./02-stt-runtime.md) (L2 → L3 인터페이스)
> **버전**: 0.1.0-draft
> **상태**: 초안

---

## 1. 책임 정의

Post-processing Layer는 **L2가 생성한 raw 전사 텍스트를 게임 도메인 용어집과 규칙에 따라 교정하여, L4(편집기)에 전달**하는 것이 유일한 책임이다.

### 이 레이어가 하는 것

- STT 오인식 교정 (음운 유사 오류)
- 별칭(alias) → 표준 용어 치환
- 표기 통일 (대소문자, 띄어쓰기)
- 복합 구문(phrase) 인식 및 보존
- 적용된 교정 내역 기록 (L5 학습 데이터로 활용)

### 이 레이어가 하지 않는 것

- STT 추론 → L2 책임
- UI 표시 → L4 책임
- 용어집 갱신 → L5 책임
- 사용자에게 교정 승인 요청 → L5 책임 (세션 종료 시)

---

## 2. 파이프라인 구조

L3는 **4단계 순차 파이프라인**으로 구성된다. 순서가 중요하다.

```text
L2 TranscriptionResult (raw text)
    │
    ↓
┌───────────────────────────────────────────────────┐
│                L3 Post-processing                  │
│                                                    │
│  Stage 1: Normalization (표기 통일)                 │
│    ↓                                               │
│  Stage 2: Misrecognition Correction (오인식 교정)   │
│    ↓                                               │
│  Stage 3: Alias Resolution (별칭 → 표준 용어)       │
│    ↓                                               │
│  Stage 4: Phrase Stabilization (복합 구문 보존)     │
│                                                    │
└───────────────────┬───────────────────────────────┘
                    ↓
          ProcessedResult (corrected text + diff)
                    ↓
              L4 Subtitle Editor
```

### 왜 이 순서인가

| 순서 | 단계 | 근거 |
|------|------|------|
| 1 | Normalization | 대소문자·공백을 먼저 정리해야 이후 매칭 정확도가 올라감 |
| 2 | Misrecognition | 오인식을 교정해야 alias 매칭이 가능해짐 ("벽강" → "벽꽝" 후 alias 적용) |
| 3 | Alias | 정리된 텍스트에서 별칭을 표준 용어로 치환 |
| 4 | Phrase | 최종 텍스트에서 복합 구문을 감지하고 하나의 단위로 표시 |

---

## 3. 각 단계 상세

### 3.1 Stage 1: Normalization (표기 통일)

**목적**: 동일 용어의 표기 편차를 제거한다.

#### 규칙 유형

| 규칙 | 입력 | 출력 | 설명 |
|------|------|------|------|
| 대소문자 통일 | `ewgf`, `Ewgf` | `EWGF` | 용어집에 정의된 canonical 표기로 |
| 공백 정리 | `카운터  히트` | `카운터 히트` | 다중 공백 → 단일 공백 |
| 전각/반각 | `ＷＳ` | `WS` | 전각 영숫자 → 반각 |
| 불필요 접미사 | `EWGF를`, `EWGF가` | `EWGF를`, `EWGF가` | 조사는 유지 (한국어 특성) |

#### 구현

```python
class NormalizationStage:
    """Stage 1: 표기 통일."""

    def __init__(self, entries: list[LexiconEntry]):
        # type=normalization인 항목에서 source→target 매핑 구축
        self._mappings: dict[str, str] = {
            e.source.lower(): e.target
            for e in entries
            if e.type == "normalization" and e.enabled
        }

    def apply(self, text: str) -> tuple[str, list[CorrectionRecord]]:
        """텍스트에 표기 통일을 적용한다."""
        corrections = []
        result = text

        # 전각 → 반각
        result = unicodedata.normalize("NFKC", result)

        # 다중 공백 정리
        result = re.sub(r"\s+", " ", result).strip()

        # 용어집 기반 정규화 (대소문자 무시 매칭)
        for source, target in self._mappings.items():
            pattern = re.compile(re.escape(source), re.IGNORECASE)
            if pattern.search(result):
                new_result = pattern.sub(target, result)
                if new_result != result:
                    corrections.append(CorrectionRecord(
                        stage="normalization",
                        original=source,
                        corrected=target,
                    ))
                    result = new_result

        return result, corrections
```

### 3.2 Stage 2: Misrecognition Correction (오인식 교정)

**목적**: STT가 음운적으로 유사한 다른 단어로 잘못 인식한 것을 교정한다.

#### 예시

| STT 출력 (오인식) | 교정 결과 | 원인 |
|-------------------|----------|------|
| 벽강 | 벽꽝 | 음운 유사 |
| 풍신궐 | 풍신권 | 음운 유사 |
| 일렉기 | 일렉 | 접미사 환각 |
| 스쿠류 | 스크류 | 음운 유사 |

#### 매칭 전략

| 방식 | V1 채택 | 설명 |
|------|---------|------|
| **정확 매칭** | ✓ | `lexicon_entries`에 등록된 source→target 직접 치환 |
| **fuzzy 매칭** | ✗ (V1.5) | 편집 거리 기반. false positive 위험 → 충분한 데이터 확보 후 |

```python
class MisrecognitionStage:
    """Stage 2: STT 오인식 교정."""

    def __init__(self, entries: list[LexiconEntry]):
        self._corrections: list[tuple[re.Pattern, str]] = []
        for e in sorted(entries, key=lambda x: len(x.source), reverse=True):
            if e.type == "misrecognition" and e.enabled:
                # 단어 경계를 고려한 패턴 생성
                pattern = self._build_pattern(e.source)
                self._corrections.append((pattern, e.target))

    def _build_pattern(self, source: str) -> re.Pattern:
        """한국어 조사 경계를 고려한 매칭 패턴.

        '벽강'이 '벽강을', '벽강이' 등에서도 매칭되되,
        '벽강산'처럼 다른 단어의 일부에서는 매칭되지 않도록 한다.
        """
        # 한국어 조사 패턴: 을/를/이/가/은/는/에/도/로/의 등
        particles = r"(?=[을를이가은는에도로의와과]|[\s,.\!\?]|$)"
        return re.compile(re.escape(source) + particles)

    def apply(self, text: str) -> tuple[str, list[CorrectionRecord]]:
        corrections = []
        result = text
        for pattern, target in self._corrections:
            match = pattern.search(result)
            if match:
                original = match.group(0).rstrip()
                # 조사는 보존: "벽강을" → "벽꽝을"
                particle = match.group(0)[len(original.rstrip()):]
                new_result = pattern.sub(target + particle, result, count=1)
                if new_result != result:
                    corrections.append(CorrectionRecord(
                        stage="misrecognition",
                        original=original.rstrip(),
                        corrected=target,
                    ))
                    result = new_result
        return result, corrections
```

> **한국어 조사 처리**: "벽강을" → "벽꽝을"처럼, 어근만 교정하고 뒤따르는 조사는 보존한다. 이것이 한국어 후처리에서 가장 까다로운 부분이다.

### 3.3 Stage 3: Alias Resolution (별칭 → 표준 용어)

**목적**: 동일 개념의 다양한 표현을 표준 용어로 통합한다.

#### 예시

| 입력 (별칭) | 출력 (표준) | 관계 |
|------------|-----------|------|
| 일렉 | EWGF | 약칭 |
| 엘지에프 | EWGF | 음역 |
| 일렉트릭 윈드 갓 피스트 | EWGF | 정식 명칭 |
| 카운터 히트 | CH | 약칭 |
| 카힛 | CH | 구어 약칭 |
| 라이트닝 스쿠류 | 스크류 | 기술 별칭 |

#### 구현

```python
class AliasResolutionStage:
    """Stage 3: 별칭 → 표준 용어 치환."""

    def __init__(self, entries: list[LexiconEntry]):
        # 긴 source부터 매칭 (greedy matching)
        self._aliases: list[tuple[re.Pattern, str]] = []
        alias_entries = [e for e in entries if e.type == "alias" and e.enabled]
        alias_entries.sort(key=lambda e: len(e.source), reverse=True)

        for e in alias_entries:
            pattern = re.compile(re.escape(e.source), re.IGNORECASE)
            self._aliases.append((pattern, e.target))

    def apply(self, text: str) -> tuple[str, list[CorrectionRecord]]:
        corrections = []
        result = text
        for pattern, target in self._aliases:
            if pattern.search(result):
                new_result = pattern.sub(target, result)
                if new_result != result:
                    # 동일 target으로의 치환이 이미 기록되었으면 스킵
                    corrections.append(CorrectionRecord(
                        stage="alias",
                        original=pattern.pattern.replace("\\", ""),
                        corrected=target,
                    ))
                    result = new_result
        return result, corrections
```

> **긴 source 우선 매칭**: "일렉트릭 윈드 갓 피스트"가 "일렉"보다 먼저 매칭되어야 한다. 짧은 것부터 매칭하면 "일렉"이 먼저 치환되어 나머지 구문이 깨진다.

### 3.4 Stage 4: Phrase Stabilization (복합 구문 보존)

**목적**: 여러 단어로 구성되지만 하나의 의미 단위인 구문을 인식하고 보존한다.

#### 예시

| 구문 | 의미 | 보존 이유 |
|------|------|----------|
| 벽꽝 이후 | 벽에 맞은 후의 상황 | 하나의 상황 서술 단위 |
| 스크류 후 달려 | 스크류 이후 대시 공격 | 연속 행동 |
| 카운터 확인 후 | CH 확인 후 후속기 | 조건부 행동 |

#### 구현

이 단계는 **텍스트를 변형하지 않는다**. 대신, 매칭된 구문에 메타데이터를 첨부하여 L4 편집기에서 하나의 단위로 표시할 수 있게 한다.

```python
class PhraseStabilizationStage:
    """Stage 4: 복합 구문 인식 및 메타데이터 첨부."""

    def __init__(self, entries: list[LexiconEntry]):
        self._phrases: list[tuple[re.Pattern, str]] = []
        for e in entries:
            if e.type == "phrase" and e.enabled:
                pattern = re.compile(re.escape(e.source), re.IGNORECASE)
                self._phrases.append((pattern, e.target))

    def apply(self, text: str) -> tuple[str, list[PhraseAnnotation]]:
        annotations = []
        for pattern, canonical in self._phrases:
            for match in pattern.finditer(text):
                annotations.append(PhraseAnnotation(
                    start=match.start(),
                    end=match.end(),
                    matched_text=match.group(),
                    canonical=canonical,
                ))
        return text, annotations  # 텍스트는 변경하지 않음
```

---

## 4. 용어집 로딩 전략

### 4.1 로딩 소스 및 우선순위

```text
높음 ┌─────────────────────────┐
     │ 1. 사용자 로컬 용어집    │  SQLite (scope=local)
     ├─────────────────────────┤
     │ 2. 공유 용어집 (V2)     │  SQLite (scope=shared)
     ├─────────────────────────┤
     │ 3. 게임 프로필 기본값    │  profiles/tekken/lexicon_defaults.json
낮음 └─────────────────────────┘
```

**충돌 해결**: 같은 `source`에 대해 여러 레이어에 항목이 있으면 **우선순위가 높은 것만 적용**한다.

### 4.2 로딩 시점

| 시점 | 동작 |
|------|------|
| 세션 시작 (`start_capture`) | 전체 용어집을 메모리에 로드하여 각 Stage에 주입 |
| 세션 중 | 용어집 변경 없음 (무간섭 원칙) |
| 세션 종료 후 | L5에서 용어집 갱신 → 다음 세션에 반영 |

### 4.3 메모리 내 구조

```python
class LexiconCache:
    """세션 시작 시 로드하여 L3 전체에서 공유하는 용어집 캐시."""

    def __init__(self, db: LexiconStore, profile: GameProfile):
        entries = self._merge_sources(db, profile)
        self.normalization = [e for e in entries if e.type == "normalization"]
        self.misrecognition = [e for e in entries if e.type == "misrecognition"]
        self.aliases = [e for e in entries if e.type == "alias"]
        self.phrases = [e for e in entries if e.type == "phrase"]

    def _merge_sources(
        self, db: LexiconStore, profile: GameProfile
    ) -> list[LexiconEntry]:
        """우선순위에 따라 용어집을 병합한다."""
        local = db.get_entries(scope="local", game_id=profile.game_id)
        shared = db.get_entries(scope="shared", game_id=profile.game_id)
        defaults = profile.load_lexicon_defaults()

        # source 기준 dedup: local > shared > defaults
        seen_sources: set[str] = set()
        merged: list[LexiconEntry] = []
        for layer in [local, shared, defaults]:
            for entry in layer:
                key = (entry.type, entry.source.lower())
                if key not in seen_sources:
                    seen_sources.add(key)
                    merged.append(entry)
        return merged
```

---

## 5. 파이프라인 실행

### 5.1 PostProcessor 클래스

```python
class PostProcessor:
    """L3 Post-processing 파이프라인. L2 결과를 받아 교정된 텍스트를 반환한다."""

    def __init__(self, lexicon_cache: LexiconCache):
        self._stages = [
            NormalizationStage(lexicon_cache.normalization),
            MisrecognitionStage(lexicon_cache.misrecognition),
            AliasResolutionStage(lexicon_cache.aliases),
            PhraseStabilizationStage(lexicon_cache.phrases),
        ]

    def process(self, result: TranscriptionResult) -> ProcessedResult:
        """전사 결과를 후처리한다."""
        text = result.text
        all_corrections: list[CorrectionRecord] = []
        phrase_annotations: list[PhraseAnnotation] = []

        for stage in self._stages:
            if isinstance(stage, PhraseStabilizationStage):
                text, annotations = stage.apply(text)
                phrase_annotations = annotations
            else:
                text, corrections = stage.apply(text)
                all_corrections.extend(corrections)

        return ProcessedResult(
            segment_id=result.segment_id,
            result_type=result.result_type,
            raw_text=result.text,
            processed_text=text,
            start_time=result.start_time,
            end_time=result.end_time,
            confidence=result.confidence,
            corrections=all_corrections,
            phrase_annotations=phrase_annotations,
        )
```

### 5.2 데이터 구조

```python
@dataclass
class CorrectionRecord:
    """후처리 단계에서 적용된 교정 하나."""
    stage: str              # "normalization" | "misrecognition" | "alias"
    original: str           # 교정 전 텍스트
    corrected: str          # 교정 후 텍스트

@dataclass
class PhraseAnnotation:
    """복합 구문 인식 결과."""
    start: int              # 텍스트 내 시작 위치
    end: int                # 텍스트 내 종료 위치
    matched_text: str       # 실제 매칭된 텍스트
    canonical: str          # 용어집의 canonical 표기

@dataclass
class ProcessedResult:
    """L3 출력. L4(편집기)와 L5(학습)에 전달된다."""
    segment_id: str
    result_type: Literal["partial", "final"]
    raw_text: str                           # L2 원본
    processed_text: str                     # L3 교정 후
    start_time: float
    end_time: float
    confidence: float
    corrections: list[CorrectionRecord]     # 적용된 교정 목록
    phrase_annotations: list[PhraseAnnotation]
```

---

## 6. 후처리 적용 예시

### 6.1 입력 → 각 단계 → 출력

```text
L2 raw text: "지금 ewgf가 깔끔하게 들어갔고 벽강까지 연결했습니다"
```

| 단계 | 적용 | 결과 |
|------|------|------|
| Stage 1: Normalization | `ewgf` → `EWGF` | "지금 EWGF가 깔끔하게 들어갔고 벽강까지 연결했습니다" |
| Stage 2: Misrecognition | `벽강` → `벽꽝` | "지금 EWGF가 깔끔하게 들어갔고 벽꽝까지 연결했습니다" |
| Stage 3: Alias | (해당 없음) | 변경 없음 |
| Stage 4: Phrase | "벽꽝까지 연결" 구문 감지 | 메타데이터 첨부 |

```text
L3 processed text: "지금 EWGF가 깔끔하게 들어갔고 벽꽝까지 연결했습니다"
corrections: [
    {stage: "normalization", original: "ewgf", corrected: "EWGF"},
    {stage: "misrecognition", original: "벽강", corrected: "벽꽝"}
]
```

### 6.2 복합 시나리오

```text
L2 raw text: "카운터 히트로 일렉 넣고 스쿠류 후 달려"
```

| 단계 | 적용 | 결과 |
|------|------|------|
| Stage 1 | (공백 정리만) | "카운터 히트로 일렉 넣고 스쿠류 후 달려" |
| Stage 2 | `스쿠류` → `스크류` | "카운터 히트로 일렉 넣고 스크류 후 달려" |
| Stage 3 | `카운터 히트` → `CH`, `일렉` → `EWGF` | "CH로 EWGF 넣고 스크류 후 달려" |
| Stage 4 | "스크류 후 달려" 구문 감지 | 메타데이터 첨부 |

```text
L3 processed text: "CH로 EWGF 넣고 스크류 후 달려"
corrections: [
    {stage: "misrecognition", original: "스쿠류", corrected: "스크류"},
    {stage: "alias", original: "카운터 히트", corrected: "CH"},
    {stage: "alias", original: "일렉", corrected: "EWGF"}
]
```

---

## 7. 성능 요구사항

후처리는 STT 추론 직후 동기적으로 실행된다. **추론보다 빠르지 않으면 병목**이 된다.

| 지표 | 목표 | 근거 |
|------|------|------|
| 단일 segment 후처리 시간 | < 5ms | 추론 지연(~500ms GPU)의 1% 이하 |
| 용어집 크기 1,000항목 | < 10ms | V3에서 다중 게임 프로필 합산 시 최대 예상 크기 |
| 메모리 (용어집 캐시) | < 10MB | 모든 항목 + 컴파일된 정규식 |

### 최적화 전략

| 전략 | 내용 |
|------|------|
| **정규식 사전 컴파일** | 세션 시작 시 모든 패턴을 `re.compile()`. 매 segment마다 재빌드하지 않음 |
| **긴 패턴 우선 매칭** | "일렉트릭 윈드 갓 피스트"를 먼저 매칭하여 불필요한 부분 매칭 방지 |
| **early exit** | 텍스트가 변경되지 않은 stage는 다음 stage로 즉시 넘김 |
| **Aho-Corasick (V1.5)** | 용어집이 500항목 이상일 때 다중 패턴 동시 매칭으로 전환 |

---

## 8. Partial vs Final 후처리

| 결과 유형 | 후처리 적용 | 근거 |
|----------|-----------|------|
| **partial** | **적용** | 사용자에게 교정된 텍스트를 실시간 피드백. 체감 품질 향상 |
| **final** | **적용** | 확정 자막에 교정 반영 |

partial에 후처리를 적용하면 **이미 교정된 부분이 partial 갱신 시 다시 교정**될 수 있다. 이는 **멱등성**이 보장되므로 문제가 되지 않는다.

```text
멱등성 보장 예시:
  "일렉" → Stage 3 → "EWGF"
  "EWGF" → Stage 3 → "EWGF" (이미 canonical, 변경 없음)
```

---

## 9. 게임 프로필 규칙 파일

### 9.1 `rules.json` 구조

```json
{
  "game_id": "tekken",
  "version": "1.0.0",
  "rules": {
    "normalization": [
      {"source": "ewgf", "target": "EWGF"},
      {"source": "ch", "target": "CH"},
      {"source": "ws", "target": "WS"},
      {"source": "df", "target": "df"}
    ],
    "misrecognition": [
      {"source": "벽강", "target": "벽꽝"},
      {"source": "풍신궐", "target": "풍신권"},
      {"source": "스쿠류", "target": "스크류"},
      {"source": "일렉기", "target": "일렉"}
    ],
    "alias": [
      {"source": "일렉", "target": "EWGF"},
      {"source": "엘지에프", "target": "EWGF"},
      {"source": "일렉트릭 윈드 갓 피스트", "target": "EWGF"},
      {"source": "카운터 히트", "target": "CH"},
      {"source": "카힛", "target": "CH"},
      {"source": "라이징", "target": "WS"}
    ],
    "phrase": [
      {"source": "벽꽝 이후", "target": "벽꽝 이후"},
      {"source": "스크류 후 달려", "target": "스크류 후 대시"},
      {"source": "카운터 확인 후", "target": "CH 확인 후"}
    ]
  }
}
```

### 9.2 `lexicon_defaults.json` 구조

`rules.json`의 규칙을 `LexiconEntry` 형태로 변환하여 DB에 삽입할 때 사용한다.

```json
[
  {
    "type": "normalization",
    "source": "ewgf",
    "target": "EWGF",
    "weight": 1.0,
    "scope": "default"
  },
  {
    "type": "alias",
    "source": "일렉",
    "target": "EWGF",
    "weight": 1.0,
    "scope": "default"
  }
]
```

> `rules.json`은 사람이 편집하기 쉬운 구조이고, `lexicon_defaults.json`은 DB와 1:1 매핑되는 구조다. 앱 초기화 시 `rules.json` → `lexicon_defaults.json` → SQLite 순으로 변환한다.

---

## 10. L3 → L4 인터페이스

L3의 `ProcessedResult`는 IPC를 통해 Electron에 전달되고, L4(편집기 UI)에 표시된다.

### IPC 메시지 (Python → Electron)

#### `processed_result` (partial/final 공통)

```json
{
  "jsonrpc": "2.0",
  "method": "processed_result",
  "params": {
    "segment_id": "seg_a1b2c3",
    "result_type": "final",
    "raw_text": "지금 ewgf가 깔끔하게 들어갔고 벽강까지 연결했습니다",
    "processed_text": "지금 EWGF가 깔끔하게 들어갔고 벽꽝까지 연결했습니다",
    "start_time": 45.2,
    "end_time": 51.6,
    "confidence": 0.91,
    "corrections": [
      {"stage": "normalization", "original": "ewgf", "corrected": "EWGF"},
      {"stage": "misrecognition", "original": "벽강", "corrected": "벽꽝"}
    ],
    "phrase_annotations": [
      {"start": 28, "end": 36, "matched_text": "벽꽝까지 연결", "canonical": "벽꽝까지 연결"}
    ]
  }
}
```

> L2의 `final_result` / `partial_result` 대신, L3를 거친 `processed_result`가 UI에 전달된다. UI는 L2의 raw 결과를 직접 받지 않는다.

---

## 11. 에러 처리

| 에러 | 심각도 | 복구 |
|------|--------|------|
| 정규식 컴파일 실패 (잘못된 source) | `warning` | 해당 항목 스킵, 나머지 계속 적용 |
| 특정 stage에서 예외 | `warning` | 해당 stage 스킵, raw text 그대로 다음 stage로 |
| 용어집 로드 실패 | `error` | 빈 용어집으로 fallback (후처리 미적용, raw text 그대로 통과) |
| 후처리 timeout (> 100ms) | `warning` | 로그 기록, 결과 그대로 반환 |

**원칙**: 후처리 실패가 전체 파이프라인을 멈추면 안 된다. 최악의 경우 raw text가 그대로 L4에 전달된다.

---

## 12. 테스트 전략

### 12.1 단위 테스트

| 대상 | 테스트 시나리오 | 케이스 수 |
|------|---------------|----------|
| `NormalizationStage` | 대소문자, 전각→반각, 다중 공백 | 5+ |
| `MisrecognitionStage` | 정확 매칭, 조사 보존, 미등록 단어 무변경 | 8+ |
| `AliasResolutionStage` | 긴 패턴 우선, 대소문자 무시, 중복 치환 방지 | 6+ |
| `PhraseStabilizationStage` | 구문 감지, 위치 정확도, 중첩 구문 | 4+ |
| `PostProcessor.process()` | 전체 파이프라인 통합, 순서 의존성 검증 | 5+ |
| `LexiconCache._merge_sources()` | 우선순위 dedup | 3+ |

### 12.2 회귀 테스트 (Golden Test)

실제 철권 해설 시나리오를 **golden test set**으로 유지한다.

```python
# tests/golden/post_processing.json
[
    {
        "input": "지금 ewgf가 깔끔하게 들어갔고 벽강까지 연결했습니다",
        "expected": "지금 EWGF가 깔끔하게 들어갔고 벽꽝까지 연결했습니다",
        "expected_corrections": [
            {"stage": "normalization", "original": "ewgf", "corrected": "EWGF"},
            {"stage": "misrecognition", "original": "벽강", "corrected": "벽꽝"}
        ]
    },
    {
        "input": "카운터 히트로 일렉 넣고 스쿠류 후 달려",
        "expected": "CH로 EWGF 넣고 스크류 후 달려",
        "expected_corrections": [
            {"stage": "misrecognition", "original": "스쿠류", "corrected": "스크류"},
            {"stage": "alias", "original": "카운터 히트", "corrected": "CH"},
            {"stage": "alias", "original": "일렉", "corrected": "EWGF"}
        ]
    }
]
```

### 12.3 성능 테스트

| 측정 항목 | 방법 | 목표 |
|----------|------|------|
| 500항목 용어집, 100자 텍스트 | timeit 1000회 반복 | 평균 < 5ms |
| 1000항목 용어집, 300자 텍스트 | timeit 1000회 반복 | 평균 < 15ms |
| 메모리 사용 | tracemalloc | LexiconCache < 10MB |

---

## 13. 파일 구조

```text
src/
└── stt_worker/
    ├── audio/              # L1
    ├── stt/                # L2
    └── postprocess/
        ├── __init__.py
        ├── pipeline.py     # PostProcessor, 파이프라인 조율
        ├── normalization.py
        ├── misrecognition.py
        ├── alias.py
        ├── phrase.py
        ├── lexicon_cache.py
        ├── types.py        # CorrectionRecord, PhraseAnnotation, ProcessedResult
        └── tests/
            ├── test_pipeline.py
            ├── test_normalization.py
            ├── test_misrecognition.py
            ├── test_alias.py
            ├── test_phrase.py
            ├── test_lexicon_cache.py
            └── golden/
                └── post_processing.json
```

---

## 14. 미결 사항 및 후속 결정

| 항목 | 현재 상태 | 결정 시점 |
|------|----------|----------|
| Fuzzy matching 도입 | V1 제외, 정확 매칭만 | V1.5에서 오탐률 데이터 확보 후 |
| Aho-Corasick 최적화 | V1 제외, 순차 정규식 | 용어집 500항목 초과 시 |
| 한국어 형태소 분석 도입 | V1 제외, 조사 패턴 정규식 | 조사 처리 오류 빈도에 따라 |
| 다중 언어 후처리 분기 | `ko` 고정 | V3 언어 확장 시 |
| L3 → L4 diff 표시 방식 | corrections 배열로 전달 | [04-subtitle-editor.md](./04-subtitle-editor.md) |
