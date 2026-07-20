from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from aqt import gui_hooks, mw
from aqt.qt import QAction, QApplication, QTimer, Qt
from aqt.reviewer import Reviewer, ReviewerBottomBar
from aqt.sound import av_player
from aqt.utils import tooltip

from .engine import TimerEngine, normalize_config


ADDON_DIR = Path(__file__).resolve().parent
SOUND_PATH = ADDON_DIR / "assets" / "completion.wav"
MESSAGE_PREFIX = "pomodoro_focus:"


def _asset_version() -> str:
    digest = hashlib.sha256()
    for name in ("pomodoro.css", "pomodoro.js", "pomodoro_bottom.js"):
        try:
            digest.update((ADDON_DIR / "web" / name).read_bytes())
        except OSError:
            digest.update(name.encode("utf-8"))
    return digest.hexdigest()[:12]


ASSET_VERSION = _asset_version()


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError, TypeError):
        return fallback


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
    os.replace(temporary, path)


class PomodoroController:
    def __init__(self) -> None:
        self.engine: TimerEngine | None = None
        self.timer = QTimer(mw)
        self.timer.setInterval(500)
        self.timer.timeout.connect(self.on_tick)
        self.last_persist_mono = 0.0
        application = QApplication.instance()
        if application is not None:
            application.applicationStateChanged.connect(
                self.on_application_state_change
            )

    def profile_storage_dir(self) -> Path:
        return Path(mw.pm.profileFolder()) / "pomodoro_focus"

    def on_profile_open(self) -> None:
        storage = self.profile_storage_dir()
        config = normalize_config(mw.addonManager.getConfig(__name__) or {})
        history = _read_json(storage / "history.json", [])
        if not isinstance(history, list):
            history = []
        runtime = _read_json(storage / "state.json", {})
        if not isinstance(runtime, dict):
            runtime = {}
        self.engine = TimerEngine(
            config=config,
            history=history,
            persisted=runtime,
            now_mono=time.monotonic(),
            now_wall=datetime.now().astimezone(),
        )
        self.last_persist_mono = time.monotonic()
        self.timer.start()

    def on_profile_close(self) -> None:
        self.set_native_bottom_visible(True)
        if self.engine is not None:
            self.engine.pause("app_closed", time.monotonic())
            self.persist()
        self.timer.stop()
        self.engine = None

    def persist(self) -> None:
        if self.engine is None or mw.pm.name is None:
            return
        storage = self.profile_storage_dir()
        now_mono = time.monotonic()
        _write_json(storage / "state.json", self.engine.serialize_runtime(now_mono))
        _write_json(storage / "history.json", self.engine.history)
        self.last_persist_mono = now_mono

    def on_tick(self) -> None:
        if self.engine is None:
            return
        now_mono = time.monotonic()
        now_wall = datetime.now().astimezone()
        application = QApplication.instance()
        app_is_inactive = (
            application is not None
            and application.applicationState()
            != Qt.ApplicationState.ApplicationActive
        )
        if mw.isMinimized() or app_is_inactive:
            event = self.engine.tick(now_mono, now_wall)
            if event is None:
                event = self.engine.pause_while_away(now_mono)
        else:
            event = self.engine.tick(now_mono, now_wall)
        self.handle_completion(event, now_mono, now_wall)
        if event in {"focus_completed", "break_completed", "paused"}:
            self.persist()
        elif now_mono - self.last_persist_mono >= 15:
            self.persist()
        self.broadcast()

    def on_application_state_change(self, state: Any) -> None:
        if (
            self.engine is None
            or state == Qt.ApplicationState.ApplicationActive
        ):
            return
        now_mono = time.monotonic()
        now_wall = datetime.now().astimezone()
        event = self.engine.tick(now_mono, now_wall)
        if event is None:
            event = self.engine.pause_while_away(now_mono)
        self.handle_completion(event, now_mono, now_wall)
        if event in {"focus_completed", "break_completed", "paused"}:
            self.persist()
        if event is not None:
            self.broadcast()

    def handle_completion(
        self, event: str | None, now_mono: float, now_wall: datetime
    ) -> None:
        if event not in {"focus_completed", "break_completed"} or self.engine is None:
            return
        self.play_completion_sound()
        if event == "focus_completed":
            self.signal_focus_completion()

    def signal_focus_completion(self) -> None:
        if mw.state != "review":
            return
        reviewer = getattr(mw, "reviewer", None)
        web = getattr(reviewer, "web", None)
        if web is not None:
            web.eval(
                "window.PomodoroFocus && "
                "window.PomodoroFocus.signalFocusComplete();"
            )
        bottom = getattr(reviewer, "bottom", None)
        bottom_web = getattr(bottom, "web", None)
        if bottom_web is not None:
            bottom_web.eval(
                "window.PomodoroFocusBottom && "
                "window.PomodoroFocusBottom.signalFocusComplete();"
            )

    def play_completion_sound(self) -> None:
        if (
            self.engine is not None
            and self.engine.config["completion_sound"]
            and SOUND_PATH.exists()
        ):
            av_player.play_file(str(SOUND_PATH))

    def on_state_change(self, new_state: str, old_state: str) -> None:
        if new_state == "review":
            self.set_native_bottom_visible(False)
        elif old_state == "review":
            self.set_native_bottom_visible(True)
        if old_state == "review" and new_state != "review":
            self.pause_focus_while_away("reviewer_left")

    def set_native_bottom_visible(self, visible: bool) -> None:
        bottom_web = getattr(mw, "bottomWeb", None)
        if bottom_web is not None:
            bottom_web.setVisible(visible)

    def on_reviewer_will_end(self) -> None:
        self.pause_focus_while_away("reviewer_left")

    def pause_focus_while_away(self, reason: str) -> None:
        if self.engine is None:
            return
        now_mono = time.monotonic()
        now_wall = datetime.now().astimezone()
        event = self.engine.tick(now_mono, now_wall)
        if event is None:
            event = self.engine.pause_while_away(now_mono, reason)
        self.handle_completion(event, now_mono, now_wall)
        if event is not None:
            self.persist()

    def on_reviewer_activity(self, _card: Any = None) -> None:
        if self.engine is None:
            return
        self.engine.register_activity(time.monotonic())
        self.broadcast()

    def on_reviewer_answer(self, _reviewer: Any, _card: Any, _ease: int) -> None:
        if self.engine is None:
            return
        now_mono = time.monotonic()
        now_wall = datetime.now().astimezone()
        for event in self.engine.rate_card(now_mono, now_wall):
            self.handle_completion(event, now_mono, now_wall)
        self.persist()
        self.broadcast()

    def handle_message(
        self, handled: tuple[bool, Any], message: str, context: Any
    ) -> tuple[bool, Any]:
        if not message.startswith(MESSAGE_PREFIX) or not isinstance(
            context, (Reviewer, ReviewerBottomBar)
        ):
            return handled
        if self.engine is None:
            return (True, None)
        try:
            payload = json.loads(message[len(MESSAGE_PREFIX) :])
        except (TypeError, ValueError):
            return (True, None)
        if not isinstance(payload, dict):
            return (True, None)

        action = payload.get("action")
        now_mono = time.monotonic()
        now_wall = datetime.now().astimezone()
        event: str | None = None

        if action == "ready":
            reviewer = getattr(mw, "reviewer", None)
            web = getattr(reviewer, "web", None)
            if web is not None:
                web.eval(
                    "window.PomodoroFocus && "
                    "window.PomodoroFocus.setAnswerBarMode(true);"
                )
            self.broadcast()
            return (True, None)
        if action == "ready_bottom":
            self.set_native_bottom_visible(False)
            reviewer = getattr(mw, "reviewer", None)
            web = getattr(reviewer, "web", None)
            if web is not None:
                web.eval(
                    "window.PomodoroFocus && "
                    "window.PomodoroFocus.setAnswerBarMode(true);"
                )
            self.broadcast()
            return (True, None)
        if action == "study_actions":
            layout = payload.get("layout")
            if isinstance(layout, dict):
                reviewer = getattr(mw, "reviewer", None)
                web = getattr(reviewer, "web", None)
                if web is not None:
                    data = json.dumps(
                        layout, ensure_ascii=False, separators=(",", ":")
                    )
                    web.eval(
                        "window.PomodoroFocus && "
                        "window.PomodoroFocus.setStudyActions(" + data + ");"
                    )
            return (True, None)
        if action == "open_panel":
            self.open_panel()
            return (True, None)
        if action == "edit_card":
            if mw.state == "review":
                mw.onEditCurrent()
            return (True, None)
        if action == "more_actions":
            reviewer = getattr(mw, "reviewer", None)
            if reviewer is not None and mw.state == "review":
                reviewer.showContextMenu()
            return (True, None)
        if action == "show_answer":
            reviewer = getattr(mw, "reviewer", None)
            if reviewer is not None and mw.state == "review":
                reviewer._getTypedAnswer()
            return (True, None)
        if action == "rate_card":
            reviewer = getattr(mw, "reviewer", None)
            try:
                ease = int(payload.get("ease"))
            except (TypeError, ValueError):
                ease = 0
            if reviewer is not None and mw.state == "review" and 1 <= ease <= 4:
                reviewer._answerCard(ease)
            return (True, None)
        if action == "card_info":
            reviewer = getattr(mw, "reviewer", None)
            if reviewer is not None and mw.state == "review":
                reviewer.on_card_info()
            return (True, None)
        if action == "skip_card":
            reviewer = getattr(mw, "reviewer", None)
            if reviewer is not None and mw.state == "review":
                reviewer.bury_current_card()
            return (True, None)
        if action == "activity":
            self.engine.register_activity(now_mono)
            return (True, None)
        if action in {"start", "resume"}:
            event = self.engine.start(now_mono, now_wall)
        elif action == "pause":
            event = self.engine.pause("manual", now_mono)
        elif action == "reset":
            event = self.engine.reset()
        elif action == "skip":
            event = self.engine.skip(now_mono, now_wall)
        elif action == "clear_history":
            self.engine.clear_history()
            event = "history_cleared"
        elif action == "update_settings":
            patch = payload.get("settings")
            if isinstance(patch, dict):
                allowed = {
                    "preset",
                    "focus_minutes",
                    "short_break_minutes",
                    "long_break_minutes",
                    "long_break_after",
                    "idle_autopause_enabled",
                    "idle_minutes",
                    "focus_hide",
                    "completion_sound",
                    "daily_goal",
                    "answer_button_height",
                    "answer_timer_style",
                }
                clean_patch = {key: value for key, value in patch.items() if key in allowed}
                event = self.engine.apply_settings(
                    clean_patch, now_mono, now_wall
                )
                mw.addonManager.writeConfig(__name__, self.engine.config)

        if event is not None:
            self.handle_completion(event, now_mono, now_wall)
            self.persist()
            self.broadcast()
        return (True, None)

    def snapshot(self) -> dict[str, Any] | None:
        if self.engine is None:
            return None
        return self.engine.snapshot(time.monotonic(), datetime.now().astimezone().date())

    def broadcast(self) -> None:
        if self.engine is None or mw.state != "review":
            return
        reviewer = getattr(mw, "reviewer", None)
        web = getattr(reviewer, "web", None)
        if web is None:
            return
        data = json.dumps(self.snapshot(), ensure_ascii=False, separators=(",", ":"))
        web.eval(
            "window.PomodoroFocus && window.PomodoroFocus.receive(" + data + ");"
        )
        bottom = getattr(reviewer, "bottom", None)
        bottom_web = getattr(bottom, "web", None)
        if bottom_web is not None:
            bottom_web.eval(
                "window.PomodoroFocusBottom && "
                "window.PomodoroFocusBottom.receive(" + data + ");"
            )

    def open_panel(self) -> None:
        if mw.state != "review":
            tooltip("Start reviewing cards to open Pomodoro Focus.", parent=mw)
            return
        reviewer = getattr(mw, "reviewer", None)
        web = getattr(reviewer, "web", None)
        if web is not None:
            web.eval("window.PomodoroFocus && window.PomodoroFocus.openPanel();")
            self.broadcast()


controller = PomodoroController()


def inject_web_assets(web_content: Any, context: Any) -> None:
    package = mw.addonManager.addonFromModule(__name__)
    if isinstance(context, Reviewer):
        web_content.css.append(
            f"/_addons/{package}/web/pomodoro.css?v={ASSET_VERSION}"
        )
        # Anki emits entries from ``web_content.js`` before ``web_content.body``.
        # Keep the root before the script so the UI can initialise synchronously.
        web_content.body += (
            '<div id="pomodoro-focus-root"></div>'
            f'<script src="/_addons/{package}/web/pomodoro.js?v={ASSET_VERSION}"></script>'
        )
    elif isinstance(context, ReviewerBottomBar):
        web_content.body += (
            f'<script src="/_addons/{package}/web/pomodoro_bottom.js?v={ASSET_VERSION}"></script>'
        )


mw.addonManager.setWebExports(__name__, r"web/.*")

gui_hooks.profile_did_open.append(controller.on_profile_open)
gui_hooks.profile_will_close.append(controller.on_profile_close)
gui_hooks.webview_will_set_content.append(inject_web_assets)
gui_hooks.webview_did_receive_js_message.append(controller.handle_message)
gui_hooks.reviewer_did_show_question.append(controller.on_reviewer_activity)
gui_hooks.reviewer_did_show_answer.append(controller.on_reviewer_activity)
gui_hooks.reviewer_did_answer_card.append(controller.on_reviewer_answer)
gui_hooks.reviewer_will_end.append(controller.on_reviewer_will_end)
gui_hooks.state_did_change.append(controller.on_state_change)

menu_action = QAction("Pomodoro Focus", mw)
menu_action.setToolTip("Open the Pomodoro Focus controls")
menu_action.triggered.connect(controller.open_panel)
mw.form.menuTools.addAction(menu_action)
