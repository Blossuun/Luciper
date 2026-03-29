"""
stt_worker/dispatcher.py

JSON-RPC 메서드 이름을 실제 핸들러 함수에 연결하는 디스패처.
세부 로직은 Phase 1에서 구현한다.
"""
from __future__ import annotations
from typing import Any


class Dispatcher:
    """
    RPC 메서드 디스패처.

    Responsibilities:
    - 메서드명 → 핸들러 매핑
    - ping, initialize, shutdown 기본 명령 처리
    - 알 수 없는 메서드에 대한 에러 반환
    """

    def ping(self) -> dict[str, Any]:
        """워커 생존 확인. 구현은 Phase 1."""
        pass  # type: ignore[return-value]

    def initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        워커 초기화.

        Args:
            params: model_size, device 등 초기화 설정
        Returns:
            초기화 결과 딕셔너리
        """
        pass  # type: ignore[return-value]

    def shutdown(self) -> dict[str, Any]:
        """워커 종료 요청 처리. 구현은 Phase 1."""
        pass  # type: ignore[return-value]

    def dispatch(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        메서드 이름에 맞는 핸들러를 호출한다.

        Args:
            method: RPC 메서드명
            params: RPC 파라미터
        Returns:
            처리 결과 딕셔너리
        Raises:
            ValueError: 알 수 없는 메서드일 때
        """
        pass  # type: ignore[return-value]
