# Design QA

- Source visual truth: `/var/folders/y1/gzwdl6n12hl2gxwwbryzfs940000gn/T/codex-clipboard-70fa4d7b-9155-435d-bd12-7346210d29a3.png`, `/var/folders/y1/gzwdl6n12hl2gxwwbryzfs940000gn/T/codex-clipboard-724a70d1-af54-4ba0-b8c8-c9039198124e.png`, `/var/folders/y1/gzwdl6n12hl2gxwwbryzfs940000gn/T/codex-clipboard-3f36d456-b696-4b64-b112-ced8f88ba0b8.png`
- Implementation screenshots: `output/design-qa/line-96-final.png`, `output/design-qa/circle-96-final.png`
- Combined comparison: `output/design-qa/comparison.png`
- Viewport/state: local reviewer harness, 96 px card, running focus, 20 minutes remaining, 20% elapsed

## Full-view comparison evidence

The line version gives the number a centered text box with exactly the same width as the horizontal track. The circle version uses the largest square that fits inside the ring's inner radius, so all four text-box corners touch the inner circle. Text is measured and proportionally reduced before display; it is not cropped. The ring is one continuous 315-degree arc with its 45-degree opening centered at the bottom. Progress begins at the lower-left endpoint and grows clockwise to the lower-right endpoint.

The card itself is the complete comparison region, so a separate focused crop would duplicate the full-view evidence.

## Fidelity surfaces

- Fonts and typography: SF Pro Display remains the display face. One-, two-, and three-digit values are measured against the active text box and uniformly reduced until both width and height fit while remaining centered. The glyphs are never horizontally compressed or skewed.
- Spacing and layout rhythm: card radius scales at 22% with 14–28 px clamps; content inset stays at 16%; line thickness scales from 3.5–7.5 px; circle thickness scales from 4–8 px.
- Colors and visual tokens: running focus remains green, breaks remain orange, and all non-running states remain gray. Track opacity remains subordinate to active progress.
- Image quality and assets: no raster imagery is used in this compact timer component. The progress geometry remains resolution-independent.
- Copy and content: the compact card continues to show only rounded remaining minutes.

## Comparison history

- Earlier P1: number sizing collided with the rounded safe area at small and large sizes. Fixed by replacing the 76/96 font ratio with a proportional 65% system and bounded card radii.
- Earlier P1: the ring gap appeared on the lower-left side. Fixed with one continuous 315-degree arc whose 45-degree opening is centered at the bottom.
- Earlier P2: splitting the progress into two arcs created a discontinuous fill. Replaced with a single clockwise path from the lower-left endpoint to the lower-right endpoint.
- Final polish: increased line and ring thickness using bounded proportional scaling, then rechecked the standard card against the supplied screenshots.

## Findings

No actionable P0, P1, or P2 findings remain in the verified standard-size state. Minimum and maximum sizes use the same deterministic geometry tokens and are covered by the 50–144 px bounds.

final result: passed
