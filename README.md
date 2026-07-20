# Pomodoro Focus

Personal Pomodoro add-on for Anki on macOS, tested primarily with Anki 25.07.5.

## Development install

Copy this directory to:

`~/Library/Application Support/Anki2/addons21/pomodoro_focus/`

Then restart Anki. Pomodoro Focus augments Anki's native reviewer bottom bar;
Anki's own question and answer buttons remain responsible for reviewing cards.
The left timer opens the controls and settings, which are also available from
the Tools menu. The timer can be switched between an `MM:SS` pill and a
315-degree ring, and the native review-button height can be adjusted live.
Only grading a card starts or resumes a focus session; showing the answer does
not. The triggering rating is counted exactly once. This also resumes focus
after a manual, away, reviewer, or idle pause.
A running focus pauses while Anki is minimized, another application has focus,
or the reviewer is left. Returning to Anki does not resume it until the next
rating or a deliberate press of Resume. Break timers keep running while Anki is
away and are interrupted by the next rating, which starts the next focus and
counts as its first card.
Completing a focus plays the configured signal, briefly lights the card border
green, and starts the prepared short or long break automatically. Focus never
starts automatically after a completed break; it waits for Start Focus or the
next rating. Closing Anki pauses either phase for the next launch.

Runtime state and the 90-day history are stored inside the active Anki profile
folder under `pomodoro_focus/`. No card text, note fields, or deck names are
stored.

## Tests

Run from this directory:

```sh
python3 -m unittest discover -s tests -v
```
