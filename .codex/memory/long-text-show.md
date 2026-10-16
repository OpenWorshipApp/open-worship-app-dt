---
name: long-text-show
description: "Long Text Show (Foreground panel) puts one text in several languages up in the BIBLE's layer — ScreenLongTextManager, the renamed ScreenBibleManager — row by row, checked before Show; the traps are in the layer's data, the lyric reader and where each thing is read from"
metadata:
  node_type: memory
  type: project
  originSessionId: 6301d837-d2bf-49ee-ae70-5b5cdb819c41
  modified: 2026-10-15T22:16:47.252Z
---

Asked for on 2026-10-12: _I want to have foreground component call `Long Text
Show`. Imagine I have lyric just want to show like what showing for bible in
screen, with multiple language_ — and _for multiple language it should check and
verify first, if not match then must not allow showing_. The user renamed the
class to `ScreenLongTextManager` themselves and chose the rename depth: the
manager's file, the `screenLongTextManager` property, its events hook and event
type. Everything else keeps its Bible name ON PURPOSE — the render helpers,
`#bible-screen-view`, `data-kjv-verse-key`, the setting keys (`screen-ft-manager`,
`screen-bible--*`), `eventNamePrefix` and the three `bible-screen-view*` message
types — so saved screens, Screen Mirror and virtual displays did not move.

What is not obvious from the code:

- **A Foreground panel that is not in the foreground manager.** It has to
  scroll, and nothing in `#foreground` does. So it takes a Bible passage's
  place on a screen and takes the slide down; Clear Long Text clears it, and so does
  Clear Foreground (`ScreenManager.clearForeground`, also the run sheet's
  `clear-foreground`) because its panel lives there. The launcher asks it for
  its screens through `getShowingScreenIds` and gives it no transition button.
- **Row by row by TYPE, never by the Line Sync setting.** A showing screen
  page reads settings from the snapshot it was shown with
  ([[screen-page-settings-are-page-local]]), so a setting flipped for a long
  text would not reach it.
- **The data is a union** (`LongTextDataType`): the Bible's shape exactly as it
  was, or `type: 'long-text'` with `longTextData: { renderedList, sourceId }`.
  A section's key is `lt-<n>` — the ROW's, shared by its languages, so a chorus
  sung twice is two rows — and it rides in `data-kjv-verse-key`, which four
  things read (selection, column alignment, auto-scroll pace, a viewer's tap).
  ASCII because `electron/virtualDisplayProtocol.ts` lets only
  `[\w .:-]` back from a viewer.
- **The on-screen reader drops only a bad entry now.** One invalid entry used
  to blank `screen-ft-manager` for EVERY screen; a kind an older build does not
  know is such an entry.
- **Marks are read from the setting, actions from the live managers.** After a
  reload a panel is drawn before any manager exists: reading live instances
  left a restored text marked nowhere. Restyle and hide go by the live data,
  which holds the scroll position the setting only catches up with 500 ms on.
- **The session key is `long-text-setting<suffix>`, not `foreground-…`**:
  `screenBootstrapHelpers` hands every `foreground-*` setting to a Screen
  Mirror guest, and this one holds a song's words and a file path.
- **A lyric as words** (`foregroundLongTextLyricHelpers.ts`, proven against the
  real library in its test): a never-mounted
  `new OpenLyric({ value, isSkipStyleInjection: true })`,
  `genLyricPlaySteps` for the SUNG order, `getElementMap({ type: 'text',
  isWithInfo: false })` for the words. That text has the chords out and still
  carries `{c: …}` / `{p: #n}` and the bars of a mixed part (`toSingAlongText`
  takes them); a part of chords alone is `''` — no row, or every real song
  would be refused; a Structure step with no part answers the SENTENCE
  `Missing declared part for X.`; a translation line comes along (a bilingual
  file is one column); `<font>` markup loses the space after it (the library's).
- **`DirSource.getFilePaths('lyric')` on the Documents folder lists PowerPoint
  and PDF files too** — the Documents panel sets `checkExtraFile` on that
  shared instance. `getFilePathsQuick('lyric', true)` asks without it.
- **A test importing the real open-lyric imports it at the TOP of the file.**
  Left to the code under test's own lazy import, the seconds of monaco are
  charged to the first test's timeout, which a full-suite run then fails.
- **A column's own look.** Family: inline, WITHOUT `var(--bible-font-family)`,
  or the screen-wide font wins. Alignment: a class rule with `!important`,
  because Bible Properties writes `tr td { text-align … !important }`. Size:
  on the cells only — the header's `font-size` is rewritten on every scroll.
- **Bring to middle** rides the selected-index message as `isToMiddle` and
  centres the ROW once (`closest('tr')`): a row's cells are other heights in
  each language.
- **A lyric card's parts are buttons, or text cards** (`sectionView:
  'cards'` on the language, kept with the session). Asked for step by step
  the same evening, each with a picture: a button per part that brings it
  to the middle; a toggle to see the parts as cards of text; the whole card
  clickable; the text inline (lines joined by ` / `); the cards
  inline-block with wrapping text. The words are held by the card only
  while that view is on. And the mark on a selected verse or section went
  from `0.6` to `0.2` alpha for both, at the user's word.
  **Cards are the default for a NEW language** (2026-10-15, the toggle
  circled on a card a lyric's menu had opened: _make it enabled by
  default_): `genLongTextLanguage` writes `sectionView: 'cards'`, so Add
  Language and a lyric's own `Long Text Show` start there. The absence
  still means buttons and was NOT flipped: switching back to buttons
  deletes the key, so a stored card without it cannot be told from one
  never touched, and flipping the meaning would have overridden a choice.

- **The layer's clear button is `LT`, Clear Long Text** (2026-10-13, the
  user's ask with the Mini Screen's `BB` circled: _search across for any
  related to long text screen manager … change it to long-text (LT)_). The
  button, its `tran()` key (`លុបអត្ថបទវែង`, `Effacer le texte long`),
  `clearLongTextEventMapper`, the shortcut list's row and the run sheet
  action's label and badge moved. What a file or a habit holds did NOT: the
  run sheet action id `clear-bible`, the chatbot's `/screen-clear-bible`
  (it gained `/clear-lt` and `/clear-long-text`), and everything the first
  rename kept. The Khmer of Clear Bible was also Delete Bible's, which the
  MCP interlock let through as a shared translation; alone now, that phrase
  is refused, and three MCP tests read the real dictionary for it.
- **The marked part is lit on its button** (`fg-part-on`, the same day, with
  the cards circled: _I want to see those element got focus highlighted
  when clicked_). The mark is the SCREEN's, so nothing is held in the
  panel: the layer fires `selected` for a long text only (a Bible verse is
  marked far more often and no panel draws it), and the panel reads
  `getLongTextSelectedSectionKeys` at render — the live managers, the
  setting when there is none yet. So a click on the text in the mini
  screen lights the button too. The style is DECLARED, three classes deep:
  the theme writes `.btn { border }` outright, so the Bootstrap border
  variable is dead ([[bootstrap-btn-vars-are-dead]]).

- **The lit part steps by the slide keys** (2026-10-15, the user's ask with
  the text cards in the picture: _like slides preview for next keying … should
  not jump to the first element when in last element_). `useLongTextPartKeying`
  registers `slideMovingEventMappers` and acts only while the FOCUSED element
  is a part button (`data-long-text-row`) whose row the SCREEN has marked —
  read from `getLongTextSelectedSectionKeys`, not the button's `aria-current`,
  because the mark moves at once and the button is only lit on the next
  render. It brings row ±1 up and focuses that row's button in the SAME card
  (`data-long-text-parts`), so the next key steps again. No wrap, and the key
  is still taken at an end (Space would otherwise press the last part again).
  A part that is not lit keeps Space for itself. It is the fourth keying area
  ([[remote-key-take-over]]), LAST.

- **A lyric's own menu starts one** (2026-10-15, the user's ask with the
  Documents list's lyric menu in the picture: _when clicked it should create
  long text new session then create `EN` language and set the lyric to be
  ready to show_). `openLyricInLongTextShow` (`foregroundLongTextOpenHelpers`,
  imported by the menu item only when pressed) writes the session's
  `long-text-setting-<id>` FIRST, then `addMediaSession`, then opens the panel:
  `LongTextBodyComp` is keyed by the active id and reads its setting on mount,
  so the order is the whole trick. Two outside doors it needed, because both
  were per-mount `useStateSettingString` state a bare `setSetting` never
  reached: `addMediaSession` tells every mounted strip of its target to read
  back (`sessionRefresherMap`; the strip's own `+` goes through it too), and
  `requestForegroundPanelOpening` reaches the launcher in `PresenterComp`,
  which opens the panel and bumps its `raiseToken` — false when no launcher is
  mounted, and the caller writes `foreground-open-panels` instead. Always a NEW
  session named after the song: the open one may be typed text or on a screen.

Not built, by decision of the first change: a Presenting Flow row or a drag to
a screen, the `owa_foreground` tool and a tip lesson for it, a saved-text
library. Not driven live that day (the user was in the app): the Khmer pass,
moving and removing a language or a section, the Hide chip, the font and colour
rows, a second tab.

Related: [[screen-bible-columns]], [[lyric-subsystem-architecture]],
[[foreground-effects-one-setting]], [[message-editor-text-is-local-state]],
[[dev-hmr-stale-state-qa]].
