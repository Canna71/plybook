# Piece sets

Each folder is one set: `pieces.css` embeds its 12 images for chessground (made with
`node tools/piece-css.mjs <folder of wK.svg, bQ.svg…> <folder>/pieces.css`). The app lists every
folder here (`theming/thememanager.tsx`). Authors and licences:

## Added 2026-10-29 (U.3), from Lichess

From [lichess-org/lila](https://github.com/lichess-org/lila) `public/piece`, commit
`898ad2cdee0aa803d7959d83868efc00097a648b`, licences as listed in its
[COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md). Only sets whose licence
allows shipping them in a GPL-3.0 app.

| Set | Author | Licence |
|---|---|---|
| celtic | Maurizio Monge | MIT |
| chessnut | Alexis Luengas | Apache 2.0 |
| fantasy | Maurizio Monge | MIT |
| firi | James Faure | CC BY 4.0 |
| kiwen_suwi | neverRare | CC BY 4.0 |
| letter | usolando | AGPLv3+ |
| mpchess | Maxime Chupin | GPLv3+ |
| papercut | Nikolay Anzarov | CC BY 4.0 |
| pirouetti | pirouetti | AGPLv3+ |
| pixel | therealqtpi | AGPLv3+ |
| rhosgfx | RhosGFX | CC0 1.0 |
| shapes | flugsio | CC BY-SA 4.0 |
| spatial | Maurizio Monge | MIT |
| totoy | Kosal Sen | CC BY 4.0 |

Not added: the non-commercial sets (CC BY-NC-SA: horsey, california, caliente, maestro, gioco,
dubrovny, icpieces, anarcandy, disguised, cooke, monarchy, minimal-warmth, xkcd), the
"freeware" or unstated ones (chess7, companion, leipzig, reillycraig, shahi-ivory-brown
(no derivatives), governor, kosal), and mono (one colour for both sides).

## From before (sharechess.github.io), see each folder's README.txt

| Set | Author | Licence | Shippable in a GPL app |
|---|---|---|---|
| alfarishy | Jordan Alfarishy | CC BY 3.0 | yes, with credit |
| cburnett | Colin M.L. Burnett | GPLv2+ | yes |
| icon54 | icon 54 | CC BY 3.0 | yes, with credit |
| merida | Armando Hernandez Marroquin | GPLv2+ | yes |
| riohacha | the lila authors | AGPLv3+ (Lichess: not stated) | yes, to confirm |
| trendy | Benjamin Kinard | CC BY 3.0 | yes, with credit |
| trendy_ink | Benjamin Kinard, caderek | CC BY 3.0 | yes, with credit |
| alpha | Eric Bentzen | "free for personal non commercial use" | kept: Plybook is free and non-commercial |
| cardinal | sadsnake1 | CC BY-NC-SA 4.0 | kept: non-commercial, with credit |
| fresca | sadsnake1 | CC BY-NC-SA 4.0 | kept: non-commercial, with credit |
| staunty | sadsnake1 | CC BY-NC-SA 4.0 | kept: non-commercial, with credit |
| tatiana | sadsnake1 | CC BY-NC-SA 4.0 | kept: non-commercial, with credit |

The non-commercial sets stay in the app by the owner's decision (2026-10-29): Plybook is
given away free. They keep their own licence, not the app's GPL; anyone selling a build of
Plybook would have to take them out.

## Not shipped: downloaded on the user's request

cases (Matthieu Leschemelle, Armando Hernandez Marroquin), motif (Armando Hernandez
Marroquin), pirat (Klaus Wolf), regular (Alastair Scott), smart (Christoph Wirth) and
traveller (Alan Cowderoy) are published as "freeware" or "free", with no right to
redistribute them, so the app does not ship them since 2026-10-29. Settings → Appearance →
More piece sets downloads them for the user from
[sharechess](https://github.com/caderek/sharechess) (commit `f249b986`), where they are
published with their authors' names (`src-tauri/src/pieces.rs`); a user can also add any set
of their own from a folder of 12 images.
