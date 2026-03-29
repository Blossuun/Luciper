"""
stt_worker/main.py

Python STT Worker 진입점.
stdin NDJSON 입력을 읽고 stdout NDJSON 응답을 반환한다.
세부 로직은 Phase 1에서 구현한다.
"""
from __future__ import annotations


class STTWorker:
    """
    Electron Sidecar Worker 메인 루프.

    Responsibilities:
    - stdin에서 JSON-RPC 요청을 읽음
    - Dispatcher에 위임하여 처리
    - stdout으로 JSON-RPC 응답/알림을 씀
    """

    def __init__(self) -> None:
        pass

    def run(self) -> None:
        """메인 이벤트 루프 진입점. 구현은 Phase 1."""
        pass

    def shutdown(self) -> None:
        """워커를 깨끗하게 종료한다. 구현은 Phase 1."""
        pass


if __name__ == "__main__":
    worker = STTWorker()
    worker.run()
