# UX overhaul (U.1)

The plan for making ReChess feel like one product, designed as if starting over, delivered in
steps the owner evaluates one at a time. Branch: `feature/ux-overhaul`.

## Where we are

Features were added one at a time, each with its own corner:

- **Navigation** is a flat list (Home, Play Engine, Puzzles, Repertoires, History, Databases,
  Scan position, Settings) above an always-open Library tree. Several screens can only be
  reached from inside others (Guess the move, Scan a book, the PDF reader, the board editor).
- **Home** is a logo. Nothing says what to do today.
- **Analysis** stacks everything in one sidebar: edit toolbar, engine control, what-if, facts,
  human moves, tablebase, engine lines, then tabs (moves, review, explorer), then the move
  buttons. Engine on, the moves list is pushed far down.
- **Look**: Bulma defaults with a purple-grey scheme, a dark mode block that is empty, hand-
  sized boards on several pages, toasts unstyled in builds, three different toolbars.
- **Code**: `GameManager.tsx` is 1,000+ lines; layouts are per-page grids.

## Principles

1. **Tasks, not features.** Navigation follows what you came to do: study, train, play, look
   up games. Features live inside those, not next to them.
2. **The board is the centre.** Every chess screen is the same layout: board in the middle,
   one panel beside it, one toolbar above. Learn it once.
3. **Calm by default, depth on demand.** Show the moves and the evaluation; engine lines,
   explanations, explorer and the rest are panels you open, and they remember being open.
4. **Keyboard first, mouse friendly.** Everything reachable with keys (O.2 started it), a
   command palette to jump anywhere.
5. **One look.** Design tokens (colour, spacing, type, radius) and a small set of components;
   light and dark themes that follow the system.
6. **Every state designed.** Empty, loading, error and first-run states say what to do next.

Decisions taken (owner: "do it your own way"; easy to revisit):

- A **dense, tool-like** look (closer to Lichess analysis than to a marketing page): small
  type scale, compact controls, the board as large as the window allows.
- **Keep Bulma underneath**, but behind our own tokens and components: replacing it outright
  is churn with no visible gain, and Bulma 1 is themeable through CSS variables.
- **Light and dark** both supported, following the system, with an override in Settings.
- Each step is a sub-branch merged into `feature/ux-overhaul`, then into `develop` once the
  owner approves it, so the overhaul never becomes one giant merge. `develop` is merged back
  into the branch regularly.

## Information architecture

```
┌──────────────┐
│ ♞ ReChess    │   ⌘K  Go to…  (command palette: screens, files, actions)
│              │
│ ⌂ Today      │   dashboard: what to do now
│              │
│ STUDY        │
│  Analysis    │   board + moves + engine (new game, or the open file)
│  Library     │   files and folders (PGN, studies, notes), as a browser
│  Books       │   PDFs: reader, scanned diagrams
│  Repertoires │
│              │
│ TRAIN        │
│  Puzzles     │   your puzzles and the Lichess set
│  Mistakes    │   positions from your reviewed games
│  Openings    │   repertoire drill (due cards)
│  Guess move  │
│              │
│ PLAY         │
│  vs engine   │
│              │
│ GAMES        │
│  History     │   your games against the engine and synced online games
│  Databases   │
│              │
│ TOOLS        │
│  Scan        │   screenshot, screen, book
│  Board editor│
│              │
│ ⚙ Settings   │
└──────────────┘
```

The sidebar collapses to icons. The Library tree moves into the Library screen (and a "Recent"
list on Today), instead of filling the sidebar on every page.

## Screen layouts

**Every chess screen** (analysis, play, puzzles, trainer, guess, reader notes):

```
┌ toolbar: title · context actions ·················· ⋯ more ┐
├──────────────────────────────┬─┬──────────────────────────┤
│                              │e│ ▸ Moves            (open) │
│                              │v│ ▸ Engine        ▾ 3 lines │
│            board             │a│ ▸ Why (explanations)      │
│                              │l│ ▸ Explorer / book / TB    │
│                              │ │ ▸ Review                  │
│                              │ │                           │
├──────────────────────────────┴─┤  ⏮ ◀ ▶ ⏭    comment box   │
│ players, clocks                │                           │
└────────────────────────────────┴───────────────────────────┘
          ↔ the divider is draggable; sizes remembered per screen
```

- One **toolbar** replaces the edit bar, engine control and button bar: file actions (save,
  flip, export, video), engine (on/off, threat, settings), mode actions (review, guess, play
  from here), with an overflow menu instead of a row of icons.
- An **eval bar** beside the board.
- The **panel** is a stack of collapsible sections; Moves is always first and always visible.

**Today**:

```
┌ Good evening ──────────────────────────────────────────────┐
│ ┌ Openings ─────┐ ┌ Puzzles ──────┐ ┌ Mistakes ───────────┐ │
│ │ 12 cards due  │ │ rating 1640   │ │ 5 from last week's  │ │
│ │ [Train]       │ │ [Next puzzle] │ │ games  [Train]      │ │
│ └───────────────┘ └───────────────┘ └─────────────────────┘ │
│ ┌ Continue ─────────────────────────────────────────────────┐ │
│ │ Understanding the Chess Openings, p. 15   [Open]          │ │
│ │ Italian Game.pgn (studied yesterday)      [Open]          │ │
│ └───────────────────────────────────────────────────────────┘ │
│ ┌ Games to review ──────────────────────────────────────────┐ │
│ │ 3 new games from Lichess              [Review]            │ │
│ └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
first start: a checklist instead (add an engine, link an account, import puzzles, add a book)
```

## Steps

Each step ends with something to look at and a short list in `docs/TESTING.md`.

1. **Foundation: tokens, themes, components.** Colour/spacing/type tokens, light and dark
   themes (system + override), restyled base components (buttons, inputs, selects, modals,
   toasts, tabs, panels, empty states). No layout change yet: the app looks consistent and
   dark mode works. *Evaluate:* every screen in both themes.
2. **App shell and navigation.** The grouped, collapsible sidebar above; Library tree out of
   the sidebar; a page header (title, breadcrumb, page actions); the ⌘K command palette.
   *Evaluate:* can you get everywhere, faster?
3. **Today.** The dashboard and the first-start checklist. *Evaluate:* does it tell you what
   to do?
4. **The analysis workspace.** The shared layout above for analysis: one toolbar, eval bar,
   collapsible panel sections with remembered state, draggable divider remembered per screen
   (the "resizable panels" request). `GameManager.tsx` split into layout, state and panels on
   the way. *Evaluate:* the main screen, with the engine on and off.
5. **Every chess screen on it.** Play, puzzles, repertoire trainer, guess the move, reader
   notes, scan review move to the same layout; one board component (responsive size,
   coordinates, animation, sound setting). *Evaluate:* consistency across screens.
6. **Training feels like training.** A shared trainer frame (prompt, feedback, progress,
   next) for puzzles, mistakes, openings and guess the move; clear success/failure moments.
7. **Library and books.** The Library as a browser (list with types and dates, search, drag and
   drop import), Books (PDF reader entry, scanned collections), Databases tidied.
8. **Settings and polish.** Settings in sections with search; accessibility (focus rings,
   labels, contrast); remaining empty/error states; dead code and `obsoleted/` removed.

## Decisions log

- 2026-10-25: plan written; the owner asked for an own-judgement redesign, evaluated step by
  step.
- 2026-10-25: tooling first: Claude checks each step in the running app with screenshots
  (`tools/shot.sh` + the dev-only driver, webview errors in the dev terminal).
- 2026-10-25, step 1 (foundation) ready for review:
  - Tokens in `src/styles/tokens.scss`: neutral cool greys, a calmer green for primary
    actions, blue for links and focus; 14 px root size; spacing and type scales; radii.
  - The old purple scheme override removed. Light and dark both work, following the
    system, or Settings → Appearance (new section: theme, board, pieces, live preview; the
    board and piece choices were only in the settings file before).
  - Base styles in `src/styles/_base.scss`: compact buttons (square when icon-only), dense
    tables with quiet headers and hover rows, aligned form controls, dialogs with a header,
    body and right-aligned buttons, sliders that keep their value inside the dialog, focus
    rings for keyboard use, thin scrollbars, toasts that follow the theme (bottom right).
  - Not yet: layout changes (step 2+), page headers, empty states applied to screens.
- 2026-10-25, step 1 polish (owner asked whether it could be better), checked with
  screenshots and measured contrast (WCAG):
  - Primary buttons: a deeper green with white text (4.7:1); Bulma had kept dark text, chosen
    at build time for its own default colour.
  - Placeholders were 1.7–2.2:1 and stand in for labels on the Databases filters: now the
    muted text colour (about 3.9:1; real labels come with that screen's redesign).
  - Buttons with an icon and text ("Clear", "Save") were squeezed as if icon-only (CSS can't
    see text nodes): `Button` now marks icon-only buttons itself (`.is-icon`).
  - The board editor's FEN box showed "undefined" without a position.
  - Toasts moved to bottom centre (bottom right covered the game navigator's "+").
  - Seen and fine in both themes: Databases, Puzzles, Repertoires, Scan, Play, History,
    Settings, dialogs, toasts. Left for later steps: the analysis board can overflow the
    window height (step 4), the board editor's "Advanced settings" box (step 5), empty
    states (step 7).
- 2026-10-25: step 1 approved by the owner and merged into `develop`.
- 2026-10-25, step 2 (app shell) ready for review:
  - Sidebar (`Views/Sidebar.tsx`): Today · Study (Analysis, Library, Repertoires) · Train
    (Puzzles) · Play (Play the engine) · Games (History, Databases) · Tools (Scan a
    position, Board editor), Settings at the bottom; icons; the current screen highlighted
    (an open game counts as Library, a puzzle as Puzzles: `models/navigation.ts`, tested).
    "Collapse" turns it into an icon rail (remembered). Board editor and Analysis are in
    the navigation for the first time.
  - Changed from the plan: the Library tree stays in the sidebar for now, as a collapsible
    "Files" section, until the Library screen is redone (step 7); removing it first would
    make files harder to reach in between.
  - Command palette (`components/shell/CommandPalette.tsx`, ranking in `models/commands.ts`,
    tested): ⌘K / Ctrl+K anywhere, or "Go to…" at the top of the sidebar; screens, actions
    (new analysis, capture from screen, scan a book, import a database, light/dark, collapse
    the sidebar) and every PGN/PDF in the Library. ↑ ↓ Enter Esc.
  - `PageHeader` (title, what the screen is for, actions on the right) on Puzzles, History,
    Databases, Repertoires, Settings. Analysis, Library and Scan get theirs in steps 4–7.
  - Puzzles showed "Loading..." for ever without puzzles of your own: now an empty state that
    says how to get some.
- 2026-10-25: step 2 approved by the owner and merged into `develop`.
- 2026-10-25, step 3 (Today) ready for review (`Views/Home.tsx`, logic in `models/today.ts`,
  tested):
  - Greeting and date; tiles for Openings (moves due and new, "Train" opens the repertoire
    with the most due), Puzzles (your Lichess puzzle rating, "Next puzzle"), Mistakes
    (positions from reviewed games, "Train"); each says what to do when empty.
  - Continue: the last games/studies and books opened (with the page reached), newest
    first. Recorded by the game screen (not puzzles) and the reader in the `recent.files`
    setting (`storage/recent.ts`).
  - Recent games: the last three against the engine.
  - Get started: a checklist (engine, account, Lichess puzzles, repertoire, a PDF book) that
    ticks itself as things get done; "Hide" dismisses it (`today.hideSetup`).
  - Not shown yet: synced online games waiting for review (the sync has no "reviewed" flag;
    a later step can add one).
- 2026-10-25: step 3 approved by the owner and merged into `develop`.
- 2026-10-25, step 4 (the analysis workspace) ready for review, done in substeps:
  - 4a, board area: the board is as large as its column allows in both directions (the
    column is a CSS size container; board = min(width − eval bar, height − player rows)),
    players and clocks above and below at the board's width, an evaluation bar beside it in
    analysis (`EvalBar.tsx`, `models/evalbar.ts` tested; the engine's evaluation of the
    position shown, else the PGN's [%eval]; hidden while playing and in puzzles). The
    divider sizes the panel and the board takes the rest (`layout.workspace.columns`):
    the "resizable panels" request, for this screen.
  - 4b, one toolbar: the engine on the left (a labelled "Engine" switch, settings, threat,
    find in databases); flip, an Export menu (copy image, PNG, GIF) and a More menu (play
    from here, description, YouTube video, starting position, PGN text) on the right, with
    a new `Menu` component. The header's repertoire and puzzle settings are labelled. Play:
    "Engine plays [Either colour]", "New game", "Resign".
  - 4c, panel sections (`PanelSection.tsx`, open state remembered in `layout.panel`): Engine
    (the judgement of the last move, then the lines; a hint when the engine is a human-like
    one that gives no evaluation), Moves (always open, takes the spare height), About this
    position (facts, human moves, tablebase), Game review and Explorer (folded at first;
    Game review opens itself when a review starts). The old tabs are gone.
  - Move list: a narrow, quiet number column, aligned moves, side lines indented in a box
    with a rule, the current move in the accent colour.
  - 4d, refactor: the panel moved out of `GameManager` into `AnalysisPanel.tsx`; old
    `SidebarTabs` removed. The board area stays in GameManager for now (it shares a dozen
    local values: promotion, puzzle and clock state); still on the refactor list.
  - Fixed on the way: `hasMoves` returned the move count instead of a boolean
    (`length ?? 0 > 0`), in GameManager and the button bar.
- 2026-10-25, the owner's call on engines: analysis, review, training and explanations always
  use a full-strength engine; the engine selected in Settings is only the one you play
  against. `analysisProfile()` is the one chosen in Settings → Engines → "Analysis" (setting
  `engine.analysisProfile`), else the first full-strength engine; Maia-style engines never
  analyse. `useChessEngine` uses it everywhere except Play. Settings → Engines has two
  columns: "Play against" and "Analysis".
- 2026-10-25: step 4 approved by the owner and merged into `develop`.
- 2026-10-25, step 5 (every chess screen on the layout) ready for review:
  - Looked at each: Play and puzzles already use the shared workspace (step 4). Puzzles and
    Guess the move need a prompt/feedback/next frame more than a new layout: that is step 6.
  - The board editor was the weak one (controls crammed above the board, a heavy "Advanced
    settings" box, the FEN under the board, half the window empty) and is used three times
    (Board editor, Scan, "Change the starting position"). Redone (`BoardEditor.tsx`): board
    and piece trays on the left, as large as the height allows; on the right a panel with
    help, side to move (two buttons), flip / starting position / clear, castling as four
    labelled checkboxes, en passant, the FEN with copy, and a slot for the screen's own
    actions. One column when narrow (a container query). Trays swap when flipped.
  - Board editor screen: a page header, starting from the initial position, with Analyze,
    Play from here and Find in databases.
  - Scan: a page header with Capture from screen, Choose an image and Scan a whole book; the
    scanned picture appears in the editor's panel, next to the board, to compare square by
    square; then the three actions.
