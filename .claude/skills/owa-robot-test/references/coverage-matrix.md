# OWA Robot Test — Coverage Matrix

The **complete inventory of testable UI units**, each with a stable ID. "Coverage" for
this skill is defined against this file: a run (or a chain of runs) reaches full coverage
when **every in-scope row has been exercised with evidence**. Nothing may be silently
skipped — a row is either exercised (PASS/FAIL), BLOCKED with a stated reason, or
EXCLUDED by the policy table below.

> Derived from [components-path.md](./components-path.md) + a source sweep of `src/`.
> If the app UI changes, update the matrix **and bump `matrixVersion`** (the date below)
> — and check whether the affected [user-workflows.md](./user-workflows.md) recipes
> (each cites matrix rows in its `Verify:` line) need the same update.
> Before a full run, spot-check the matrix against `src/` (new `*Comp.tsx` folders =
> new rows).

**matrixVersion: 2026-07-08**

## How a run uses this matrix

1. This file is the **static inventory** — never write statuses into it.
2. Track statuses in a per-run state file
   `test-results/robot-test/coverage-<runid>.json` (schema in SKILL.md §"Coverage
   accounting"). Update it after every few rows so an interrupted run can resume.
3. Statuses:
   - **PASS** — interaction performed, expected observable confirmed, evidence recorded.
   - **FAIL** — interaction performed, expectation not met → also file a Finding.
   - **PARTIAL** — some interactions of the row done, others not (say which in `note`).
   - **BLOCKED** — could not exercise; `note` must say why (e.g. "no camera device").
   - **EXCLUDED** — matches a policy exclusion (EX-xx); `note` names the EX id.
4. **Evidence rule:** a row only counts as PASS/FAIL with at least one of: a screenshot
   path, an `evaluate_script` assertion result, or a console/network diff. "I clicked it
   and nothing crashed" without a checked observable = PARTIAL at best.
5. **Coverage formula** (goes in the report):

   ```
   in-scope   = total rows − EXCLUDED
   exercised  = PASS + FAIL
   coverage % = exercised / in-scope × 100
   ```

   Target for a full run: **100% of in-scope rows attempted; ≥ 99% exercised**, with
   every BLOCKED/PARTIAL row listed with its reason. Never inflate the number — an
   honest 97% with reasons beats a fake 100%.

## Policy exclusions (EX)

These are out of scope **by policy**, not laziness. They count separately and never
against coverage. Where a "covered-to-the-edge" trick exists, use it — it converts the
row's control to exercisable while excluding only the un-drivable/destructive tail.

| ID | Excluded | Why | Cover to the edge by… |
|---|---|---|---|
| EX-01 | OS-native file dialogs (browse/open/save) | Not drivable via CDP | click the button, confirm the app doesn't crash while the dialog is cancelled by policy — mark the *dialog itself* excluded |
| EX-02 | Physically presenting to / hiding the user's real display (`ShowHideScreen`, OS fullscreen) | Takes over a live window the user may be using (KB §10) | verify the control exists + is enabled; use the mini-screen for output assertions |
| EX-03 | Camera-dependent rows | Needs hardware; may be absent | if a device exists, exercise; else BLOCKED→EX-03 |
| EX-04 | Following external links (Help, About links) | Opens the user's browser | click-eligibility only: control present, named, enabled |
| EX-05 | Destructive tails: `Clear All Settings`, `Reset All Child Directories`, `Reset Widgets Size`, deleting user documents/lyrics | Destroys user data/state | click → **confirm dialog appears → Cancel** (covers the control + dialog); for delete, create a scratch item first, delete *that* |
| EX-06 | App quit / relaunch flows | Kills the session under test | — |
| EX-07 | Downloading new bible versions | Large network payloads on the user's machine | verify list/search/enable-disable UI; toggle an already-downloaded version and restore |

---

## GL — Cross-cutting (run on every page you visit)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| GL-01 | Page readiness | load / after navigation | `#root` has children, no `img.loading` remains |
| GL-02 | Console hygiene | diff after each row | no NEW uncaught errors / rejections / React warnings (KB §7 noise excluded) |
| GL-03 | Network hygiene | diff after each row | no NEW failed app requests (KB §8 noise excluded) |
| GL-04 | A11y snapshot scan | `take_snapshot` per page | interactive nodes have accessible names (known: Help=raw URL, fullscreen unnamed — still report) |
| GL-05 | Visual scan | screenshot per page/state | no clipped/overlapping/low-contrast/broken visuals |
| GL-06 | `AppContextMenuComp` | 🖱️R an item → menu; `Escape`; click-away | menu opens positioned at cursor; both dismissals close it |
| GL-07 | `ModalComp` close paths | red `btn-danger`; `Ctrl+Q` | both close the modal |
| GL-08 | Confirm/Alert popups | trigger one; `Ok`/`Cancel`; `Enter`/`Escape` | buttons and keys both work |
| GL-09 | `InputPopupComp` | trigger (e.g. rename); type; confirm; cancel | input applies on confirm, discards on cancel |
| GL-10 | `ToastComp` | trigger (e.g. Audios-off-while-playing) | toast appears, auto-dismisses |
| GL-11 | `TopProgressBarComp` | observe during heavy load (doc open) | bar shows then clears |
| GL-12 | `ResizeActorComp` splitters | ⇕ drag each splitter per page; 🖱️🖱️ quick-resize where enabled | panes resize; no layout break; size persists after reload |
| GL-13 | Responsive layout | `resize_page` to ~1024×700 and back | `BibleReadingLeftComp` flips H/V; nothing overlaps at either size |

## NAV — App header (`#app-header`: presenter + editor pages)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| NAV-01 | `Presenter` tab | 🖱️ | `.active` set; URL → `presenter.html` |
| NAV-02 | `Bible Reader` tab | 🖱️ | URL → `reader.html`; page ready |
| NAV-03 | `Slide Editor` tab, **no doc** | 🖱️ | alert shown; NO navigation |
| NAV-04 | `Slide Editor` tab, doc selected | 🖱️ | URL → `appDocumentEditor.html` |
| NAV-05 | `(dev)Experiment` tab | 🖱️ (dev builds) | experiment page loads without errors |
| NAV-06 | `BibleLookupButtonComp` | 🖱️ | lookup modal in `#modal-container` |
| NAV-07 | Same, keyboard | ⌨️ `Ctrl+B` | modal opens |
| NAV-08 | Lookup button tooltip | 🖐️ hover | tooltip shows shortcut |
| NAV-09 | `SettingButtonComp` (gear) | 🖱️ | NEW `setting.html` popup target in `list_pages` |
| NAV-10 | `HelpButtonComp` | presence/name only (EX-04) | control enabled; flag raw-URL a11y name |
| NAV-11 | Direct `navigate_page` routes | reader → editor → presenter | each main-window page reaches ready; never a popup page |

## PL — Presenter, left column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PL-01 | Documents list item | 🖱️ | `.active`; slides load; footer path updates |
| PL-02 | Documents item | 🖱️🖱️ | opens/presents the document |
| PL-03 | Documents item | 🖱️R | context menu with rename/delete/etc. entries |
| PL-04 | Documents list | ⇕ drag reorder | order changes and persists |
| PL-05 | PDF document item | 🖱️ (`bi-file-earmark-pdf`) | PDF selects + preview renders |
| PL-06 | Scratch document lifecycle | create new doc → rename (InputPopup) → delete it | all three succeed; list returns to original state |
| PL-07 | Lyrics list item | 🖱️ (`bi-music-note`) | lyric selected; middle switches to Lyrics |
| PL-08 | Lyrics item | 🖱️🖱️ | lyric on screen (`.app-on-screen`) — then restore |
| PL-09 | Lyrics item | 🖱️R → edit | **Lyric Editor popup** target appears |
| PL-10 | Playlists list (dev) | 🖱️ select; ⇕ reorder | dev builds only, else BLOCKED |

## PM — Presenter, middle column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PM-01 | Presenter tab bar (multi-select) | 🖱️ each of `Documents`/`Lyrics`/`Bibles`/`Foreground` | tab toggles in/out of split view |
| PM-02 | Presenter tab | 🖱️R | solo mode — only that tab remains |
| PM-03 | Live tab marker | observe | live tab has `.app-on-screen` |
| PM-04 | `RenderToggleFullViewComp` | 🖱️ toggle on+off | `.app-full-view` applied/removed (widget-level, not OS) |
| PM-05 | Slide thumbnails | observe | `<iframe srcdoc>` previews render |
| PM-06 | Slide thumb | 🖱️🖱️ → then Clear Slide | slide live on mini-screen; F8/click clears |
| PM-07 | Slide thumb | 🖱️R | context menu |
| PM-08 | Thumbnails keyboard | focus + ⌨️ arrows/`PageUp`/`PageDown`/`Space` | selection moves; `Space` toggles |
| PM-09 | Thumb size slider (`max=200`) | 🎚️ | thumbnails rescale |
| PM-10 | `SlideAutoPlayComp` (Documents footer) | 🖱️ stopwatch icon → expand; ⌨️✎ seconds; 🖱️ play; 🖱️ red X | expands; auto-advances; collapses |
| PM-11 | Lyrics tab verses | observe + 🖱️🖱️ a verse | verse renders (iframe); goes live — restore |
| PM-12 | Bibles tab verse | observe + 🖱️🖱️ | looked-up verse shows; goes live — restore |
| PM-13 | `BibleCustomStyleComp` → Appearance | open the Bibles-tab split; adjust `ScreenBibleAppearanceComp` controls | bible text on preview restyles — restore |
| PM-14 | `BibleCustomStyleComp` → Text Shadow | pick a `ScreenBibleTextShadow` option | shadow applies on preview — restore |
| PM-15 | `ForegroundMarqueeBottomComp` | ⌨️✎ text; 🖱️ Show; 🎚️ speed %; hide | marquee bottom scrolls along the bottom of the mini-screen; speed change re-paces it live; hides |
| PM-36 | `ForegroundMarqueeTopComp` | ⌨️✎ text; 🖱️ Show; 🎚️ speed %; hide | marquee top scrolls along the top of the mini-screen; speed change re-paces it live; hides; coexists with PM-15 |
| PM-16 | `ForegroundQuickTextComp` | ⌨️✎ text; 🖱️ Show; hide | text overlays; hides |
| PM-17 | `ForegroundCountDownComp` (datetime) | ⌨️✎ date+time; 🖱️ reset; 🖱️ start; hide | countdown live; hides |
| PM-18 | `ForegroundCountDownComp` (duration) | ⌨️✎ h/m; 🖱️ start; hide | countdown live; hides |
| PM-19 | `ForegroundStopwatchComp` | 🖱️ start/stop | stopwatch runs/stops on preview |
| PM-20 | `ForegroundTimeComp` (clock) | 🖱️ show; format option | clock shows; format applies |
| PM-21 | `ForegroundImagesSlideShowComp` | 🖱️ start w/ existing images; `SlideAutoPlayComp` control; (image *picking* = EX-01) | slideshow advances |
| PM-22 | `ForegroundCameraComp` | 🖱️ device select + show | live if device; else BLOCKED→EX-03 |
| PM-23 | `ForegroundWebComp` | ⌨️✎ URL; 🖱️ show; hide | web overlay renders |
| PM-24 | `ForegroundCommonPropertiesSettingComp` | 🎚️ font-size/color/position | live foreground restyles |
| PM-25 | Foreground Show button extras | 🖱️R (force screen); ⇕ drag → mini-screen | menu opens / drop starts the widget |
| PM-26 | `BackgroundComp` collapsed panel | 🖱️ `Background` label → expand; collapse | tab bar exists only after expand (KB §5) |
| PM-27 | Background tab bar | 🖱️ each of `Colors`/`Images`/`Videos`/`Cameras`/`Webs` | single-select switch; live tab gets `*` prefix |
| PM-28 | `RenderAudiosTabComp` | 🖱️ toggle; toggle-off while playing | split toggles; off-while-playing pops toast (GL-10) |
| PM-29 | `BackgroundColorsComp` swatch | 🖱️ a `role=group` swatch; handle contrast confirm | bg color on mini-screen — restore previous bg |
| PM-30 | `BackgroundImagesComp` | 🖱️🖱️ an image | bg image live — restore |
| PM-31 | `BackgroundVideosComp` | 🖱️🖱️ a video | bg video live — restore |
| PM-32 | `BackgroundCamerasComp` | 🖱️ device | live if device; else BLOCKED→EX-03 |
| PM-33 | `BackgroundWebComp` | 🖱️ item; 🖱️ `+` | web bg applies; `+` opens **Web Editor popup** |
| PM-34 | `BackgroundAudiosComp` | 🖱️ play; 🖱️ stop | `.app-on-screen` while playing |
| PM-35 | Background items | 🖱️R | context menu on image/video/web items |

## PR — Presenter, right column

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PR-01 | `Bibles`/`Notes` sub-tabs | 🖱️ each | panel switches |
| PR-02 | `BibleListComp` item | 🖱️; 🖱️🖱️; 🖱️R | selects; verse live (restore); context menu |
| PR-03 | `BibleNoteListComp` | 🖱️ note; edit | **Bible Note popup** target appears |
| PR-04 | `MiniScreenComp` | observe across PM rows | preview mirrors every live change |
| PR-05 | Zoom slider (`max=30`) | 🎚️ | preview rescales |
| PR-06 | `MiniScreenClearControlComp` | 🖱️ each clear button | each clears its layer (pair with KB-03..07) |
| PR-07 | `ShowHideScreen` | presence only (EX-02) | control present + enabled |

## RD — `reader.html` (Bible Reader)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| RD-01 | Page identity | load | ready with NO `#app-header` |
| RD-02 | Incremental picker | ⌨️✎ char-by-char book → 🖱️ book → chapter → verse options | each step narrows; verse renders |
| RD-03 | Full reference | ⌨️✎ `John 3:16` char-by-char | resolves to the exact verse (reader page does; modal doesn't — KB §5) |
| RD-04 | Picker keyboard | ⌨️ `Tab` complete chunk; `Escape` clear; `Ctrl+Escape` clear chunk | each behaves as titled |
| RD-05 | `InputExtraButtonsComp` | 🖱️ clear-input / clear-chunk / tab-complete buttons | same effects as keys |
| RD-06 | `BibleLookupInputHistoryComp` | 🖱️ a history entry | that lookup re-runs |
| RD-07 | `BibleLookupBodyPreviewerComp` | 🖱️🖱️ verse | verse presented — restore |
| RD-08 | Advance lookup toggle (`RenderExtraButtonsRightComp`) | 🖱️ toggle | **Bible Find** split (`Bible Online Lookup` widget) opens/closes |
| RD-09 | `BibleFindPreviewerComp` | ⌨️✎ find text; observe `BibleFindRenderPerPageComp`; 🖱️ `RenderPageNumberComp` pages | results render; pagination switches pages |
| RD-10 | Cross-references (`bible-cross-refs`) | open cross-ref view for a verse | found items render; AI variants BLOCKED if no API key configured |
| RD-11 | Bible-key selector (`RenderBibleLookupHeaderComp`) | 🖱️ switch bible version | verse re-renders in that version |
| RD-12 | Bibles + Notes lists on reader | as PR-02/03 | same behavior outside presenter |

## ED — `appDocumentEditor.html` (Slide/Doc Editor)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| ED-01 | Entry guard | load with OWA doc / with non-OWA doc | editor loads / "Return to Presenter" popup |
| ED-02 | Slide list | 🖱️ select; 🖱️🖱️ open | slide loads into canvas |
| ED-03 | Slide list | 🖱️R → duplicate, then delete the duplicate | self-cleaning add/delete both work |
| ED-04 | Slide list | ⇕ reorder | order persists |
| ED-05 | `CanvasContainerComp` | 🖱️ select box; ⇕ move; drag handle resize | box moves/resizes; selection outline |
| ED-06 | Multi-select | `Shift`/`Ctrl` + 🖱️ | multiple boxes selected |
| ED-07 | Text edit mode | 🖱️🖱️ text box; ⌨️✎ type; click-away | text persists on the slide |
| ED-08 | ⌨️ `Ctrl+Enter` | press | canvas focused |
| ED-09 | `ToolCanvasItemsComp` | 🖱️ add box; ⇕ drag tool → canvas | new item appears on canvas — then delete it |
| ED-10 | `SlideEditorPopupComp` (quick edit) | open; ⌨️ `Escape` | popup closes |
| ED-11 | ⌨️ `Ctrl+S` | after an edit | saved (dirty indicator clears / no data-loss on reload) |
| ED-12 | Bottom `BackgroundComp` | expand + tab switch | same as PM-26/27 in editor context |

## ST — `setting.html` (Settings **popup**)

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| ST-01 | Open + attach | gear → `list_pages` → `select_page` | title matches `/Settings/`; NEVER `navigate_page` the main window here |
| ST-02 | `General`/`Bible` tabs | 🖱️ each | panels switch |
| ST-03 | Directory paths section | observe; ⌨️✎ path input; (browse = EX-01) | section renders; input editable |
| ST-04 | `SettingGeneralLanguageComp` | 🖱️ other locale → verify → 🖱️ restore | UI re-renders in the new locale, then restored |
| ST-05 | `SettingGeneralThemeComp` | 🖱️ light → dark → restore | theme applies each time |
| ST-06 | `SettingGeneralFontFamilyComp` | 🖱️ pick a font → restore | font applies; `(Missing)` label is informative, not a bug |
| ST-07 | Destructive resets | 🖱️ each → confirm appears → **Cancel** (EX-05) | confirm dialog shows; Cancel leaves state intact |
| ST-08 | `SettingApplyComp` | 🖱️ `Apply Settings` **last**, with settings restored | windows reload cleanly; re-attach targets after |
| ST-09 | Bible tab list | ⌨️✎ search; 🖱️ enable/disable a downloaded version → restore; (downloads = EX-07) | search filters; toggle round-trips |
| ST-10 | Popup lifecycle | `close_page` the popup | main window unaffected |

## PU — Other popup windows

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| PU-01 | Finder (`FinderAppComp`) | open via its in-app trigger; ⌨️✎ query; 🖱️ prev/next; case checkbox; ⌨️ `Enter` | matches highlight; navigation cycles |
| PU-02 | Lyric Editor (`LyricEditorPopupComp`) | via PL-09; ⌨️✎ edit; ⌨️ `Ctrl+S`; **restore original text**; close | edit round-trips without corrupting the lyric |
| PU-03 | Bible Note (`NoteItemEditorPopupComp`) | via PR-03; ⌨️✎ type; save; restore | note editor renders in `#bible-note-root`; save works |
| PU-04 | Web Editor (`WebEditorComp`) | via PM-33 `+`; ⌨️✎ URL+title; save; then delete the created item | new web-bg item appears then is cleaned up |
| PU-05 | About (`AboutComp`) | open; observe | version renders; links present (EX-04 for following them) |
| PU-06 | LW Share (`LWShareAppComp`) | open if reachable | share view renders; else BLOCKED with the reason |

## SC — `screen.html` (presentation output)

> The physical screen window is **not on CDP** — its logs forward to the presenter via
> `all:app:log`. Never `navigate_page` the main window to `screen.html`.

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| SC-01 | Screen target | present content → `list_pages` | if a `screen.html` target appears, select + screenshot it; else verify via mini-screen + forwarded `all:app:log` lines and note that |
| SC-02 | Layer rendering | observe while bg + slide + bible + foreground live | all layers composite on mini-screen (and screen target if attached) |
| SC-03 | ⌨️ `Ctrl/Alt+ArrowLeft/Right` | only if screen target drivable | bible verse steps prev/next; else BLOCKED |

## KB — Keyboard-shortcut matrix (explicit pass)

| ID | Keys | Context | Pass condition |
|---|---|---|---|
| KB-01 | `Ctrl+B` | presenter/editor | lookup modal opens |
| KB-02 | `Ctrl+Q` | any modal | modal closes |
| KB-03 | `F6` | presenter | Clear All layers |
| KB-04 | `F7` | presenter | Clear Background |
| KB-05 | `F8` | presenter | Clear Slide |
| KB-06 | `F9` | presenter | Clear Bible |
| KB-07 | `F10` | presenter | Clear Foreground |
| KB-08 | arrows/`PageUp`/`PageDown`/`Space` | slide container focused | navigation + toggle |
| KB-09 | `Tab` / `Escape` / `Ctrl+Escape` | bible lookup input | complete / clear / clear-chunk |
| KB-10 | `Ctrl+Enter` | slide editor | canvas focused |
| KB-11 | `Ctrl+S` | editors (lyric/web/note/slide) | saves |
| KB-12 | `Enter` / `Escape` | confirm/input popups | confirm / cancel |

## LT — Locale & theme passes

| ID | Target | Interactions | Pass condition |
|---|---|---|---|
| LT-01 | Primary pass | full matrix in the CURRENT locale/theme | (this is the main run) |
| LT-02 | Secondary locale spot-check | switch via ST-04; re-screenshot presenter/reader/settings; check header tabs, lists, buttons | labels translate (KB §1 map); no raw i18n keys; no clipped Khmer text; **restore** |
| LT-03 | Dark theme spot-check | via ST-05; screenshot presenter + settings | readable contrast; no invisible text; **restore** |
| LT-04 | Light theme spot-check | via ST-05 | same; **restore** |

---

## Row counts (for the coverage denominator)

GL 13 · NAV 11 · PL 10 · PM 35 · PR 7 · RD 12 · ED 12 · ST 10 · PU 6 · SC 3 · KB 12 · LT 4
= **135 rows total**. Compute the denominator per run as `135 − EXCLUDED` (hardware and
policy exclusions vary by machine).
