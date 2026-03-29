"""
stt_worker/notification_sender.py

스레드 안전 stdout 쓰기 모듈.
JSON-RPC 알림(Notification)을 Electron 으로 전송한다.
세부 로직은 Phase 1에서 구현한다.
"""
from __future__ import annotations
from typing import Any


class NotificationSender:
    """
    stdout NDJSON 알림 송신기.

    Responsibilities:
    - Thread-safe stdout 쓰기 (lock 보호)
    - JSON 직렬화
    - 알림 메시지 포맷팅
    """

    def send(self, method: str, params: dict[str, Any]) -> None:
        """
        Electron으로 JSON-RPC 알림을 전송한다.

        Args:
            method: 알림 메서드명 (e.g. "partial_result", "audio_level")
            params: 알림 파라미터
        """
        pass

    def send_ready(self) -> None:
        """워커 준비 완료 알림 전송. 구현은 Phase 1."""
        pass
