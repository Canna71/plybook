# Board textures

The images here are Lichess's board textures, from
[lichess-org/lila](https://github.com/lichess-org/lila) `public/images/board`, commit
`898ad2cdee0aa803d7959d83868efc00097a648b`, by the lila authors and
[pirouetti](https://lichess.org/@/pirouetti), under the
[AGPLv3+](https://www.gnu.org/licenses/agpl-3.0.txt) as listed in lila's
[COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md). Copied unchanged
(file names with `_` for `-`): wood, wood2, wood3, wood4, maple, maple2, olive, leather,
marble, blue-marble, blue2, blue3, canvas2, metal, grey, green-plastic, pink-pyramid,
purple-diag. Not copied: horsey (Lichess's own), ic, and the plain-colour boards (ReChess draws
those itself).

ReChess lists them in `src/models/boardtheme.ts` (`BOARD_TEXTURES`), with each one's light and
dark square colours as measured on the image, for the coordinates.
