"""SQLite persistence layer for pinned Live Dashboard cards."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from semantic_engine.app.schemas import DashboardCard, QueryResponse


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class DashboardStore:
    """Manages pinned dashboard cards in a lightweight local SQLite database."""

    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS dashboard_cards (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    question TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    refreshed_at TEXT NOT NULL,
                    response_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _row_to_card(self, row: sqlite3.Row) -> DashboardCard:
        return DashboardCard(
            id=row["id"],
            title=row["title"],
            question=row["question"],
            created_at=row["created_at"],
            refreshed_at=row["refreshed_at"],
            response=QueryResponse.model_validate_json(row["response_json"]),
        )

    def list_cards(self) -> list[DashboardCard]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, title, question, created_at, refreshed_at, response_json
                FROM dashboard_cards
                ORDER BY created_at DESC
                """
            ).fetchall()
        return [self._row_to_card(row) for row in rows]

    def get_card(self, card_id: str) -> Optional[DashboardCard]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, title, question, created_at, refreshed_at, response_json
                FROM dashboard_cards
                WHERE id = ?
                """,
                (card_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_card(row)

    def create_card(
        self, title: str, question: str, response: QueryResponse
    ) -> DashboardCard:
        card_id = f"card-{uuid.uuid4().hex[:12]}"
        now = _utc_now_iso()
        response_json = response.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO dashboard_cards (id, title, question, created_at, refreshed_at, response_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (card_id, title.strip(), question.strip(), now, now, response_json),
            )
            conn.commit()
        return DashboardCard(
            id=card_id,
            title=title.strip(),
            question=question.strip(),
            created_at=now,
            refreshed_at=now,
            response=response,
        )

    def update_card(
        self, card_id: str, response: QueryResponse
    ) -> Optional[DashboardCard]:
        existing = self.get_card(card_id)
        if existing is None:
            return None
        now = _utc_now_iso()
        response_json = response.model_dump_json()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE dashboard_cards
                SET refreshed_at = ?, response_json = ?
                WHERE id = ?
                """,
                (now, response_json, card_id),
            )
            conn.commit()
        return DashboardCard(
            id=existing.id,
            title=existing.title,
            question=existing.question,
            created_at=existing.created_at,
            refreshed_at=now,
            response=response,
        )

    def delete_card(self, card_id: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute(
                "DELETE FROM dashboard_cards WHERE id = ?", (card_id,)
            )
            conn.commit()
            return cursor.rowcount > 0
