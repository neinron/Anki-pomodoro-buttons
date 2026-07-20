from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timedelta
from typing import Any


PRESETS: dict[str, dict[str, int]] = {
    "classic": {
        "focus_minutes": 25,
        "short_break_minutes": 5,
        "long_break_minutes": 15,
        "long_break_after": 4,
    },
    "deep": {
        "focus_minutes": 50,
        "short_break_minutes": 10,
        "long_break_minutes": 30,
        "long_break_after": 4,
    },
    "quick": {
        "focus_minutes": 15,
        "short_break_minutes": 3,
        "long_break_minutes": 10,
        "long_break_after": 4,
    },
}

DEFAULT_CONFIG: dict[str, Any] = {
    "preset": "classic",
    **PRESETS["classic"],
    "idle_autopause_enabled": True,
    "idle_minutes": 2,
    "focus_hide": True,
    "completion_sound": True,
    "daily_goal": 4,
    "card_size": 96,
    "progress_style": "line",
    "answer_button_height": 44,
    "answer_timer_style": "line",
}

DEFAULT_POSITION = {"x": 0.94, "y": 0.06}

PHASE_DURATION_KEY = {
    "focus": "focus_minutes",
    "short_break": "short_break_minutes",
    "long_break": "long_break_minutes",
}


def _clamp(value: Any, minimum: int, maximum: int, fallback: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, parsed))


def normalize_config(raw: dict[str, Any] | None) -> dict[str, Any]:
    source = {**DEFAULT_CONFIG, **(raw or {})}
    preset = str(source.get("preset", "classic"))
    if preset not in {*PRESETS, "custom"}:
        preset = "custom"
    progress_style = str(source.get("progress_style", "line"))
    if progress_style not in {"line", "circle"}:
        progress_style = "line"
    answer_timer_style = str(source.get("answer_timer_style", "line"))
    if answer_timer_style not in {"line", "circle", "hidden"}:
        answer_timer_style = "line"
    return {
        "preset": preset,
        "focus_minutes": _clamp(source.get("focus_minutes"), 1, 120, 25),
        "short_break_minutes": _clamp(
            source.get("short_break_minutes"), 1, 60, 5
        ),
        "long_break_minutes": _clamp(
            source.get("long_break_minutes"), 1, 120, 15
        ),
        "long_break_after": _clamp(source.get("long_break_after"), 1, 8, 4),
        "idle_autopause_enabled": bool(
            source.get("idle_autopause_enabled", True)
        ),
        "idle_minutes": _clamp(source.get("idle_minutes"), 1, 10, 2),
        "focus_hide": bool(source.get("focus_hide", True)),
        "completion_sound": bool(source.get("completion_sound", True)),
        "daily_goal": _clamp(source.get("daily_goal"), 1, 12, 4),
        "card_size": _clamp(source.get("card_size"), 50, 144, 96),
        "progress_style": progress_style,
        "answer_button_height": _clamp(
            source.get("answer_button_height"), 36, 64, 44
        ),
        "answer_timer_style": answer_timer_style,
    }


def _wall_now() -> datetime:
    return datetime.now().astimezone()


class TimerEngine:
    """Pure Pomodoro state machine. Qt and Anki integration live elsewhere."""

    def __init__(
        self,
        config: dict[str, Any] | None = None,
        history: list[dict[str, Any]] | None = None,
        persisted: dict[str, Any] | None = None,
        *,
        now_mono: float = 0.0,
        now_wall: datetime | None = None,
    ) -> None:
        self.config = normalize_config(config)
        self.history = list(history or [])
        self.state = "idle"
        self.phase = "focus"
        self.pause_reason: str | None = None
        self.round_index = 1
        self.remaining_seconds = float(self.phase_duration_seconds())
        self.deadline_mono: float | None = None
        self.last_activity_mono = now_mono
        self.session_started_at: str | None = None
        self.session_answer_count = 0
        self.completion: dict[str, Any] | None = None
        self.next_phase: str | None = None
        self.next_round_index: int | None = None
        self.position = dict(DEFAULT_POSITION)
        if persisted:
            self._restore(persisted)
        self.prune_history((now_wall or _wall_now()).date())

    def phase_duration_seconds(self, phase: str | None = None) -> int:
        phase = phase or self.phase
        return int(self.config[PHASE_DURATION_KEY[phase]]) * 60

    def elapsed_seconds(self, now_mono: float | None = None) -> float:
        remaining = self.remaining(now_mono)
        return max(0.0, float(self.phase_duration_seconds()) - remaining)

    def remaining(self, now_mono: float | None = None) -> float:
        if self.state == "running" and self.deadline_mono is not None:
            if now_mono is None:
                return self.remaining_seconds
            return max(0.0, self.deadline_mono - now_mono)
        return max(0.0, self.remaining_seconds)

    def register_activity(self, now_mono: float) -> None:
        self.last_activity_mono = now_mono

    def start(
        self, now_mono: float, now_wall: datetime | None = None
    ) -> str | None:
        if self.state == "running":
            return None
        if self.state == "completed":
            self._prepare_next_phase()
        if self.remaining_seconds <= 0:
            self.remaining_seconds = float(self.phase_duration_seconds())
        if self.session_started_at is None:
            self.session_started_at = (now_wall or _wall_now()).isoformat()
        self.state = "running"
        self.pause_reason = None
        self.completion = None
        self.deadline_mono = now_mono + self.remaining_seconds
        self.last_activity_mono = now_mono
        return "started"

    def pause(self, reason: str, now_mono: float) -> str | None:
        if self.state != "running":
            return None
        self.remaining_seconds = self.remaining(now_mono)
        self.deadline_mono = None
        self.state = "paused"
        self.pause_reason = reason
        return "paused"

    def pause_while_away(
        self, now_mono: float, reason: str = "app_inactive"
    ) -> str | None:
        """Pause active study time while allowing breaks to keep running."""
        if self.phase != "focus":
            return None
        return self.pause(reason, now_mono)

    def reset(self) -> str:
        self.state = "idle"
        self.pause_reason = None
        self.completion = None
        self.next_phase = None
        self.next_round_index = None
        self.deadline_mono = None
        self.remaining_seconds = float(self.phase_duration_seconds())
        self.session_started_at = None
        self.session_answer_count = 0
        return "reset"

    def skip(self, now_mono: float, now_wall: datetime | None = None) -> str:
        if self.state == "completed":
            return "ignored"
        if self.state == "running":
            self.remaining_seconds = self.remaining(now_mono)
        if self.phase == "focus":
            self._record_focus("incomplete", now_wall or _wall_now())
            next_phase, next_round = self._next_after_focus()
        else:
            next_phase, next_round = "focus", self.round_index
        self._set_phase(next_phase, next_round)
        return "skipped"

    def answer_card(self) -> bool:
        if self.state == "running" and self.phase == "focus":
            self.session_answer_count += 1
            return True
        return False

    def rate_card(
        self, now_mono: float, now_wall: datetime | None = None
    ) -> list[str]:
        """Process the deadline and one Anki rating as one ordered event."""
        now_wall = now_wall or _wall_now()
        events: list[str] = []
        deadline_event = self.tick(now_mono, now_wall)
        if deadline_event is not None:
            events.append(deadline_event)
        events.append(self.answer_study_action(now_mono, now_wall))
        return events

    def answer_study_action(
        self, now_mono: float, now_wall: datetime | None = None
    ) -> str:
        """Apply one rating atomically: transition first, then count once.

        A rating starts or resumes focus. If a break is ready, running, paused,
        or completed, the rating ends that break and starts the next focus.
        """
        now_wall = now_wall or _wall_now()
        if self.state == "completed" and self.phase == "focus":
            self._prepare_next_phase()
        interrupted_break = self.phase in {"short_break", "long_break"}
        if interrupted_break:
            self._set_phase("focus", self.round_index)

        started = False
        if self.state != "running":
            started = self.start(now_mono, now_wall) == "started"
        self.register_activity(now_mono)
        self.answer_card()

        if interrupted_break:
            return "break_interrupted_and_answered"
        if started:
            return "focus_started_and_answered"
        return "answer_counted"

    def tick(
        self, now_mono: float, now_wall: datetime | None = None
    ) -> str | None:
        if self.state != "running":
            return None
        self.remaining_seconds = self.remaining(now_mono)
        if self.remaining_seconds <= 0:
            return self._complete(now_mono, now_wall or _wall_now())
        if (
            self.phase == "focus"
            and self.config["idle_autopause_enabled"]
            and now_mono - self.last_activity_mono
            >= int(self.config["idle_minutes"]) * 60
        ):
            return self.pause("idle", now_mono)
        return None

    def apply_settings(
        self,
        patch: dict[str, Any],
        now_mono: float,
        now_wall: datetime | None = None,
    ) -> str | None:
        old_total = self.phase_duration_seconds()
        if self.state == "running":
            self.remaining_seconds = self.remaining(now_mono)
        old_remaining = self.remaining_seconds
        elapsed = max(0.0, old_total - old_remaining)

        next_config = dict(self.config)
        requested_preset = patch.get("preset")
        if requested_preset in PRESETS:
            next_config.update(PRESETS[str(requested_preset)])
            next_config["preset"] = requested_preset
        else:
            next_config.update(patch)
            if any(key in patch for key in PHASE_DURATION_KEY.values()):
                next_config["preset"] = "custom"
        self.config = normalize_config(next_config)
        self.round_index = min(self.round_index, self.config["long_break_after"])

        if self.state != "completed":
            new_total = self.phase_duration_seconds()
            self.remaining_seconds = max(0.0, new_total - elapsed)
            if self.state in {"running", "paused"} and self.remaining_seconds <= 0:
                return self._complete(now_mono, now_wall or _wall_now())
            if self.state == "running":
                self.deadline_mono = now_mono + self.remaining_seconds
        return "settings_updated"

    def set_position(self, x: Any, y: Any) -> None:
        try:
            parsed_x = float(x)
            parsed_y = float(y)
        except (TypeError, ValueError):
            return
        self.position = {
            "x": max(0.0, min(1.0, parsed_x)),
            "y": max(0.0, min(1.0, parsed_y)),
        }

    def reset_position(self) -> None:
        self.position = dict(DEFAULT_POSITION)

    def clear_history(self) -> None:
        self.history = []

    def prune_history(self, today: date) -> None:
        cutoff = today - timedelta(days=89)
        pruned: list[dict[str, Any]] = []
        for record in self.history:
            try:
                record_date = date.fromisoformat(str(record["date"]))
            except (KeyError, TypeError, ValueError):
                continue
            if cutoff <= record_date <= today:
                pruned.append(record)
        self.history = pruned

    def daily_summary(self, today: date | None = None) -> dict[str, Any]:
        today = today or _wall_now().date()
        self.prune_history(today)
        by_day: dict[str, dict[str, int]] = {}
        for record in self.history:
            bucket = by_day.setdefault(
                str(record["date"]),
                {"completed": 0, "incomplete": 0, "answers": 0},
            )
            status = str(record.get("status", "incomplete"))
            if status == "completed":
                bucket["completed"] += 1
            else:
                bucket["incomplete"] += 1
            bucket["answers"] += int(record.get("answers", 0))

        days: list[dict[str, Any]] = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            values = by_day.get(
                day.isoformat(), {"completed": 0, "incomplete": 0, "answers": 0}
            )
            days.append(
                {
                    "date": day.isoformat(),
                    **values,
                    "goal": self.config["daily_goal"],
                    "goal_met": values["completed"] >= self.config["daily_goal"],
                    "streak_met": values["completed"] >= 1,
                }
            )

        streak = 0
        cursor = today
        if by_day.get(cursor.isoformat(), {}).get("completed", 0) < 1:
            cursor -= timedelta(days=1)
        while by_day.get(cursor.isoformat(), {}).get("completed", 0) >= 1:
            streak += 1
            cursor -= timedelta(days=1)

        today_values = by_day.get(
            today.isoformat(), {"completed": 0, "incomplete": 0, "answers": 0}
        )
        return {
            "today": {
                **today_values,
                "goal": self.config["daily_goal"],
                "goal_met": today_values["completed"] >= self.config["daily_goal"],
            },
            "streak": streak,
            "days": days,
        }

    def snapshot(
        self, now_mono: float, today: date | None = None
    ) -> dict[str, Any]:
        remaining = self.remaining(now_mono)
        duration = self.phase_duration_seconds()
        progress = 0.0 if duration <= 0 else max(0.0, min(1.0, remaining / duration))
        return {
            "state": self.state,
            "phase": self.phase,
            "pause_reason": self.pause_reason,
            "remaining_seconds": remaining,
            "duration_seconds": duration,
            "progress": progress,
            "elapsed_seconds": max(0.0, duration - remaining),
            "round_index": self.round_index,
            "round_total": self.config["long_break_after"],
            "answer_count": self.session_answer_count,
            "completion": deepcopy(self.completion),
            "config": deepcopy(self.config),
            "position": dict(self.position),
            "daily": self.daily_summary(today),
        }

    def serialize_runtime(self, now_mono: float) -> dict[str, Any]:
        remaining = self.remaining(now_mono)
        state = self.state
        pause_reason = self.pause_reason
        if state == "running":
            state = "paused"
            pause_reason = "app_closed"
        return {
            "state": state,
            "phase": self.phase,
            "pause_reason": pause_reason,
            "round_index": self.round_index,
            "remaining_seconds": remaining,
            "session_started_at": self.session_started_at,
            "session_answer_count": self.session_answer_count,
            "completion": deepcopy(self.completion),
            "next_phase": self.next_phase,
            "next_round_index": self.next_round_index,
            "position": dict(self.position),
        }

    def _restore(self, data: dict[str, Any]) -> None:
        phase = str(data.get("phase", "focus"))
        if phase not in PHASE_DURATION_KEY:
            phase = "focus"
        state = str(data.get("state", "idle"))
        if state not in {"idle", "paused", "completed"}:
            state = "paused"
        self.phase = phase
        self.state = state
        self.pause_reason = data.get("pause_reason")
        self.round_index = _clamp(
            data.get("round_index"), 1, self.config["long_break_after"], 1
        )
        try:
            remaining = float(data.get("remaining_seconds"))
        except (TypeError, ValueError):
            remaining = float(self.phase_duration_seconds())
        self.remaining_seconds = max(
            0.0, min(float(self.phase_duration_seconds()), remaining)
        )
        self.session_started_at = data.get("session_started_at")
        self.session_answer_count = max(
            0, int(data.get("session_answer_count", 0))
        )
        completion = data.get("completion")
        self.completion = completion if isinstance(completion, dict) else None
        next_phase = data.get("next_phase")
        self.next_phase = next_phase if next_phase in PHASE_DURATION_KEY else None
        next_round = data.get("next_round_index")
        self.next_round_index = (
            _clamp(next_round, 1, self.config["long_break_after"], 1)
            if next_round is not None
            else None
        )
        position = data.get("position")
        if isinstance(position, dict):
            self.set_position(position.get("x"), position.get("y"))
        if self.state == "paused" and not self.pause_reason:
            self.pause_reason = "app_inactive"

    def _complete(self, now_mono: float, now_wall: datetime) -> str:
        completed_phase = self.phase
        if completed_phase == "focus":
            self._record_focus("completed", now_wall)
            next_phase, next_round = self._next_after_focus()
            self._set_phase(next_phase, next_round)
            self.start(now_mono, now_wall)
            return "focus_completed"
        else:
            next_phase, next_round = "focus", self.round_index
            self.completion = {
                "kind": "break",
                "answers": 0,
                "next_phase": "focus",
            }
        self.next_phase = next_phase
        self.next_round_index = next_round
        self.state = "completed"
        self.pause_reason = None
        self.deadline_mono = None
        self.remaining_seconds = 0.0
        return "break_completed"

    def _record_focus(self, status: str, now_wall: datetime) -> None:
        started = self.session_started_at or now_wall.isoformat()
        elapsed = max(
            0,
            int(round(self.phase_duration_seconds() - self.remaining_seconds)),
        )
        if status == "completed":
            elapsed = max(elapsed, self.phase_duration_seconds())
        self.history.append(
            {
                "started_at": started,
                "ended_at": now_wall.isoformat(),
                "date": now_wall.date().isoformat(),
                "planned_seconds": self.phase_duration_seconds(),
                "elapsed_seconds": elapsed,
                "status": status,
                "answers": self.session_answer_count,
                "round": self.round_index,
            }
        )
        self.prune_history(now_wall.date())

    def _next_after_focus(self) -> tuple[str, int]:
        if self.round_index >= self.config["long_break_after"]:
            return "long_break", 1
        return "short_break", self.round_index + 1

    def _prepare_next_phase(self) -> None:
        phase = self.next_phase or ("short_break" if self.phase == "focus" else "focus")
        round_index = self.next_round_index or self.round_index
        self._set_phase(phase, round_index)

    def _set_phase(self, phase: str, round_index: int) -> None:
        self.phase = phase
        self.round_index = max(
            1, min(self.config["long_break_after"], int(round_index))
        )
        self.state = "idle"
        self.pause_reason = None
        self.completion = None
        self.next_phase = None
        self.next_round_index = None
        self.deadline_mono = None
        self.remaining_seconds = float(self.phase_duration_seconds())
        self.session_started_at = None
        self.session_answer_count = 0
