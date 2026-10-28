# Opening names

`a.tsv` to `e.tsv` are the ECO volumes A to E of
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), copied unchanged
from commit `e76b8b4ec5c8aeeba41dac6caf4a60b938f652db` (2026-10-28). Released by their authors
under the [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) public domain
dedication.

Columns: `eco` (the ECO code), `name` (the English name, "Family: Variation, Subvariation"),
`pgn` (the moves from the starting position). ReChess reads them in `models/openings.ts`
(P1.7). To update, copy the five files again from the repository and change the commit above.
