from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import TimerEngine  # noqa: E402


NOW = datetime(2026, 7, 14, 10, 0, tzinfo=timezone.utc)


def short_config(**overrides):
    config = {
        "preset": "custom",
        "focus_minutes": 1,
        "short_break_minutes": 1,
        "long_break_minutes": 1,
        "long_break_after": 4,
        "idle_autopause_enabled": True,
        "idle_minutes": 2,
        "focus_hide": True,
        "completion_sound": False,
        "daily_goal": 4,
        "card_size": 96,
        "progress_style": "line",
        "answer_button_height": 44,
        "answer_timer_style": "line",
    }
    config.update(overrides)
    return config


class TimerEngineTests(unittest.TestCase):
    def test_start_pause_resume_and_complete(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        self.assertEqual(engine.start(10, NOW), "started")
        engine.answer_card()
        self.assertEqual(engine.pause("manual", 30), "paused")
        self.assertAlmostEqual(engine.remaining_seconds, 40)
        self.assertEqual(engine.session_answer_count, 1)

        self.assertEqual(engine.start(100, NOW), "started")
        self.assertEqual(
            engine.tick(140, NOW + timedelta(minutes=1)), "focus_completed"
        )
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.phase, "short_break")
        self.assertEqual(engine.history[-1]["status"], "completed")
        self.assertEqual(engine.history[-1]["answers"], 1)

    def test_fourth_focus_prepares_long_break(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.round_index = 4
        engine.start(0, NOW)
        self.assertEqual(
            engine.tick(60, NOW + timedelta(minutes=1)), "focus_completed"
        )
        self.assertEqual(engine.phase, "long_break")
        self.assertEqual(engine.round_index, 1)
        self.assertEqual(engine.state, "running")

    def test_focus_completion_auto_starts_short_break(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.start(0, NOW)
        self.assertEqual(
            engine.tick(60, NOW + timedelta(minutes=1)), "focus_completed"
        )
        self.assertEqual(engine.phase, "short_break")
        self.assertEqual(engine.round_index, 2)
        self.assertEqual(engine.state, "running")
        self.assertAlmostEqual(engine.remaining(60), 60)

    def test_break_completion_does_not_auto_start_focus(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.phase = "short_break"
        engine.remaining_seconds = 60
        engine.start(0, NOW)
        self.assertEqual(
            engine.tick(60, NOW + timedelta(minutes=1)), "break_completed"
        )
        self.assertEqual(engine.phase, "short_break")
        self.assertEqual(engine.state, "completed")

    def test_skip_focus_records_incomplete_and_advances_round(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.start(0, NOW)
        engine.answer_card()
        engine.tick(20, NOW)
        self.assertEqual(engine.skip(20, NOW), "skipped")
        self.assertEqual(engine.phase, "short_break")
        self.assertEqual(engine.round_index, 2)
        self.assertEqual(engine.state, "idle")
        self.assertEqual(engine.history[-1]["status"], "incomplete")
        self.assertEqual(engine.history[-1]["answers"], 1)

    def test_idle_autopause_does_not_resume_on_activity(self):
        engine = TimerEngine(
            short_config(focus_minutes=5, idle_minutes=1), now_wall=NOW
        )
        engine.start(0, NOW)
        self.assertEqual(engine.tick(61, NOW), "paused")
        self.assertEqual(engine.pause_reason, "idle")
        engine.register_activity(70)
        self.assertEqual(engine.state, "paused")

    def test_break_does_not_idle_autopause(self):
        engine = TimerEngine(
            short_config(short_break_minutes=5, idle_minutes=1), now_wall=NOW
        )
        engine.phase = "short_break"
        engine.remaining_seconds = 300
        engine.start(0, NOW)
        self.assertIsNone(engine.tick(61, NOW + timedelta(minutes=1)))
        self.assertEqual(engine.state, "running")

    def test_leaving_anki_pauses_focus_but_not_break(self):
        focus = TimerEngine(short_config(focus_minutes=5), now_wall=NOW)
        focus.start(0, NOW)
        self.assertEqual(focus.pause_while_away(30), "paused")
        self.assertEqual(focus.pause_reason, "app_inactive")
        self.assertAlmostEqual(focus.remaining_seconds, 270)

        break_timer = TimerEngine(
            short_config(short_break_minutes=5), now_wall=NOW
        )
        break_timer.phase = "short_break"
        break_timer.remaining_seconds = 300
        break_timer.start(0, NOW)
        self.assertIsNone(break_timer.pause_while_away(30))
        self.assertEqual(break_timer.state, "running")
        self.assertAlmostEqual(break_timer.remaining(30), 270)

    def test_answer_count_only_while_running_focus(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        self.assertFalse(engine.answer_card())
        engine.start(0, NOW)
        self.assertTrue(engine.answer_card())
        engine.pause("manual", 5)
        self.assertFalse(engine.answer_card())
        engine.phase = "short_break"
        engine.state = "running"
        self.assertFalse(engine.answer_card())
        self.assertEqual(engine.session_answer_count, 1)

    def test_shortening_running_phase_completes_immediately(self):
        engine = TimerEngine(
            short_config(focus_minutes=5), now_wall=NOW
        )
        engine.start(0, NOW)
        engine.tick(180, NOW + timedelta(minutes=3))
        result = engine.apply_settings(
            {"focus_minutes": 2}, 180, NOW + timedelta(minutes=3)
        )
        self.assertEqual(result, "focus_completed")
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.phase, "short_break")

    def test_history_summary_goal_and_streak(self):
        history = []
        for day_offset, completed in [(0, 2), (1, 1), (2, 1)]:
            day = (NOW - timedelta(days=day_offset)).date().isoformat()
            for item in range(completed):
                history.append(
                    {
                        "date": day,
                        "status": "completed",
                        "answers": 10 + item,
                    }
                )
        engine = TimerEngine(short_config(daily_goal=2), history, now_wall=NOW)
        summary = engine.daily_summary(NOW.date())
        self.assertEqual(summary["streak"], 3)
        self.assertEqual(summary["today"]["completed"], 2)
        self.assertEqual(summary["today"]["answers"], 21)
        self.assertTrue(summary["today"]["goal_met"])

    def test_history_is_pruned_to_ninety_days(self):
        history = [
            {
                "date": (NOW - timedelta(days=100)).date().isoformat(),
                "status": "completed",
                "answers": 1,
            },
            {
                "date": (NOW - timedelta(days=89)).date().isoformat(),
                "status": "completed",
                "answers": 2,
            },
        ]
        engine = TimerEngine(short_config(), history, now_wall=NOW)
        self.assertEqual(len(engine.history), 1)
        self.assertEqual(engine.history[0]["answers"], 2)

    def test_running_state_is_restored_as_paused(self):
        persisted = {
            "state": "running",
            "phase": "focus",
            "remaining_seconds": 32,
            "round_index": 2,
            "session_answer_count": 5,
        }
        engine = TimerEngine(short_config(), persisted=persisted, now_wall=NOW)
        self.assertEqual(engine.state, "paused")
        self.assertEqual(engine.pause_reason, "app_inactive")
        self.assertEqual(engine.session_answer_count, 5)

    def test_card_size_is_clamped_and_does_not_change_timer(self):
        engine = TimerEngine(short_config(card_size=20), now_wall=NOW)
        self.assertEqual(engine.config["card_size"], 50)
        engine.start(0, NOW)
        engine.tick(15, NOW)
        result = engine.apply_settings({"card_size": 200}, 15, NOW)
        self.assertEqual(result, "settings_updated")
        self.assertEqual(engine.config["card_size"], 144)
        self.assertAlmostEqual(engine.remaining_seconds, 45)

    def test_progress_style_is_normalized_and_does_not_change_timer(self):
        engine = TimerEngine(short_config(progress_style="invalid"), now_wall=NOW)
        self.assertEqual(engine.config["progress_style"], "line")
        engine.start(0, NOW)
        engine.tick(15, NOW)
        result = engine.apply_settings({"progress_style": "circle"}, 15, NOW)
        self.assertEqual(result, "settings_updated")
        self.assertEqual(engine.config["progress_style"], "circle")
        self.assertAlmostEqual(engine.remaining_seconds, 45)

    def test_answer_bar_settings_are_normalized_and_do_not_change_timer(self):
        engine = TimerEngine(
            short_config(answer_button_height=10, answer_timer_style="invalid"),
            now_wall=NOW,
        )
        self.assertEqual(engine.config["answer_button_height"], 36)
        self.assertEqual(engine.config["answer_timer_style"], "line")
        engine.start(0, NOW)
        engine.tick(15, NOW)
        result = engine.apply_settings(
            {"answer_button_height": 100, "answer_timer_style": "circle"},
            15,
            NOW,
        )
        self.assertEqual(result, "settings_updated")
        self.assertEqual(engine.config["answer_button_height"], 64)
        self.assertEqual(engine.config["answer_timer_style"], "circle")
        self.assertAlmostEqual(engine.remaining_seconds, 45)

        engine.apply_settings({"answer_timer_style": "hidden"}, 15, NOW)
        self.assertEqual(engine.config["answer_timer_style"], "hidden")

    def test_rating_resumes_away_pause_and_is_counted(self):
        engine = TimerEngine(short_config(focus_minutes=5), now_wall=NOW)
        engine.start(0, NOW)
        engine.pause_while_away(30)
        self.assertEqual(
            engine.answer_study_action(90, NOW), "focus_started_and_answered"
        )
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.session_answer_count, 1)
        self.assertAlmostEqual(engine.remaining(90), 270)

    def test_first_rating_starts_idle_focus_and_counts(self):
        engine = TimerEngine(short_config(focus_minutes=5), now_wall=NOW)
        self.assertEqual(
            engine.answer_study_action(10, NOW), "focus_started_and_answered"
        )
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.session_answer_count, 1)
        self.assertAlmostEqual(engine.remaining(10), 300)

    def test_rating_resumes_manual_pause_and_counts_once(self):
        engine = TimerEngine(short_config(focus_minutes=5), now_wall=NOW)
        engine.start(0, NOW)
        engine.pause("manual", 30)
        self.assertEqual(
            engine.answer_study_action(90, NOW), "focus_started_and_answered"
        )
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.session_answer_count, 1)

    def test_rating_ends_running_break_starts_focus_and_counts(self):
        break_timer = TimerEngine(short_config(), now_wall=NOW)
        break_timer.phase = "short_break"
        break_timer.remaining_seconds = 60
        break_timer.start(0, NOW)
        self.assertEqual(
            break_timer.answer_study_action(10, NOW),
            "break_interrupted_and_answered",
        )
        self.assertEqual(break_timer.phase, "focus")
        self.assertEqual(break_timer.state, "running")
        self.assertEqual(break_timer.session_answer_count, 1)

    def test_rating_after_break_completion_starts_focus_and_counts(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.phase = "short_break"
        engine.remaining_seconds = 60
        engine.start(0, NOW)
        self.assertEqual(engine.tick(60, NOW), "break_completed")
        self.assertEqual(
            engine.answer_study_action(61, NOW),
            "break_interrupted_and_answered",
        )
        self.assertEqual(engine.phase, "focus")
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.session_answer_count, 1)

    def test_rating_migrates_legacy_completed_focus_without_double_counting(self):
        persisted = {
            "state": "completed",
            "phase": "focus",
            "remaining_seconds": 0,
            "round_index": 1,
            "session_answer_count": 9,
            "completion": {
                "kind": "focus",
                "answers": 9,
                "next_phase": "short_break",
            },
            "next_phase": "short_break",
            "next_round_index": 2,
        }
        engine = TimerEngine(short_config(), persisted=persisted, now_wall=NOW)
        self.assertEqual(
            engine.answer_study_action(10, NOW),
            "break_interrupted_and_answered",
        )
        self.assertEqual(engine.phase, "focus")
        self.assertEqual(engine.round_index, 2)
        self.assertEqual(engine.session_answer_count, 1)

    def test_rating_at_focus_deadline_belongs_to_next_focus(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.start(0, NOW)
        engine.answer_card()
        self.assertEqual(
            engine.rate_card(60, NOW),
            ["focus_completed", "break_interrupted_and_answered"],
        )
        self.assertEqual(engine.history[-1]["answers"], 1)
        self.assertEqual(engine.phase, "focus")
        self.assertEqual(engine.state, "running")
        self.assertEqual(engine.session_answer_count, 1)

    def test_rating_does_not_wait_for_answer_side_activity(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.register_activity(10)
        self.assertEqual(engine.state, "idle")
        engine.register_activity(20)
        self.assertEqual(engine.state, "idle")

    def test_skip_break_prepares_focus_without_starting(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.phase = "short_break"
        engine.remaining_seconds = 60
        engine.start(0, NOW)
        self.assertEqual(engine.skip(10, NOW), "skipped")
        self.assertEqual(engine.phase, "focus")
        self.assertEqual(engine.state, "idle")

    def test_runtime_serialization_pauses_running_break_for_restart(self):
        engine = TimerEngine(short_config(), now_wall=NOW)
        engine.phase = "short_break"
        engine.remaining_seconds = 60
        engine.start(0, NOW)
        runtime = engine.serialize_runtime(10)
        self.assertEqual(runtime["state"], "paused")
        self.assertEqual(runtime["pause_reason"], "app_closed")
        self.assertAlmostEqual(runtime["remaining_seconds"], 50)

    def test_rating_state_matrix_always_starts_focus_and_counts_once(self):
        scenarios = [
            ("focus", "idle", None),
            ("focus", "paused", "manual"),
            ("focus", "paused", "idle"),
            ("focus", "paused", "reviewer_left"),
            ("short_break", "idle", None),
            ("short_break", "running", None),
            ("short_break", "paused", "manual"),
            ("short_break", "completed", None),
            ("long_break", "running", None),
        ]
        for phase, state, reason in scenarios:
            with self.subTest(phase=phase, state=state, reason=reason):
                engine = TimerEngine(short_config(), now_wall=NOW)
                engine.phase = phase
                engine.state = state
                engine.pause_reason = reason
                engine.remaining_seconds = 30
                engine.deadline_mono = 30 if state == "running" else None
                if state == "completed":
                    engine.remaining_seconds = 0
                    engine.completion = {"kind": "break", "next_phase": "focus"}
                    engine.next_phase = "focus"
                    engine.next_round_index = 1
                engine.rate_card(10, NOW)
                self.assertEqual(engine.phase, "focus")
                self.assertEqual(engine.state, "running")
                self.assertEqual(engine.session_answer_count, 1)

    def test_completion_events_are_emitted_once(self):
        focus = TimerEngine(short_config(), now_wall=NOW)
        focus.start(0, NOW)
        self.assertEqual(focus.tick(60, NOW), "focus_completed")
        self.assertIsNone(focus.tick(60, NOW))
        self.assertEqual(len(focus.history), 1)

        break_timer = TimerEngine(short_config(), now_wall=NOW)
        break_timer.phase = "short_break"
        break_timer.remaining_seconds = 60
        break_timer.start(0, NOW)
        self.assertEqual(break_timer.tick(60, NOW), "break_completed")
        self.assertIsNone(break_timer.tick(61, NOW))


if __name__ == "__main__":
    unittest.main()
