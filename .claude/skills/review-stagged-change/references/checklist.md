# Staged-review checklist — repo-specific traps

Concrete things to look for, drawn from this codebase's real history. Each line is a
pattern that has actually caused a bug or a regression here. Use it as a sweep list, not
as a list of things to report — a finding still needs a failure scenario (SKILL.md §3).

---

## §1 Performance & memory (top priority)

The target machine is old, weak church/volunteer hardware. Memory bloat that is
invisible on a dev box makes the app unusable there.

- **Eager loading.** Does the change read or hold data not needed for what is on screen
  right now? Whole bibles, whole media files, whole document lists, all PDF pages.
  Precedent: presenter load once decoded an 88-page PDF into ~162MB of bitmaps; the fix
  was file-scoped preload + reading sizes from the PNG header.
- **Long-lived caches.** Caches must be short-lived and bounded. Watch for a new
  module-level `Map`/`Set`/object that only ever grows, and for TTLs refreshed on
  **read** — a sliding expiry means a frequently-read entry never expires. Expiry must
  be absolute, stamped at write.
- **Slice vs whole.** Reading a whole file/collection to use one element. Prefer a
  targeted read even at the cost of a little more code.
- **Missing debounce on high-frequency events.** Expensive work subscribed to
  `useScreenUpdateEvents` / `useFileSourceEvents` must be wrapped in
  `genTimeoutAttempt(500)`. Exemplar: `useFileSourceIsOnScreen` in
  `src/_screen/screenHelpers.ts`.
  - **Multi-instance hooks** (one per list row / tab / bible item) need a *per-instance*
    timer: `const attemptTimeout = useMemo(() => genTimeoutAttempt(500), [])`.
    A module-level shared timer collapses every instance into one and leaves N−1 rows
    stale — that is a bug, and it is easy to miss in review because it looks correct.
  - A module-level `genTimeoutAttempt(500)` is fine only for a clearly single-instance
    helper.
  - Only debounce when the latest result is all that matters (a `setState`). Do not
    debounce cheap callbacks, and do not debounce a site whose test asserts synchronous
    post-event state unless the test moves too.
- **Work inside a per-row × per-screen callback.** Anything that runs once per list row
  per screen event must be O(1)-ish. Precedent: `checkIsVaryAppDocumentOnScreen` must
  match on `filePath` and must never call `getSlides()`.
- **Parse amplification in getters.** A getter that re-parses a settings string on every
  read, or a reader memoized on a raw string that then hands out a shared mutable
  object. Getters that return settings objects must keep returning a **copy**.
- **Per-row subscriptions in a tree.** One shared subscription + one shared debounce for
  a whole tree; a per-row screen hook here has produced "Maximum update depth exceeded".
- **Eager imports** pulled in at module scope for something used on one rare path.

## §2 Correctness patterns that bite here

- **Event dispatch is microtask-async.** `BasicEventHandler.addPropEvent` dispatches
  immediately into an async `checkOnEvent`; listeners run on microtasks. There is no
  debounce and **no payload dedup** — identical consecutive events all fire. Code that
  assumes coalescing is wrong.
- **State read across an `await`.** After awaiting, re-read; the screen/document may have
  changed under you.
- **Shared object identity.** Sync-grouped screens share identical foreground-data
  objects — never key a module-global map by such an object.
- **Fire-and-forget callbacks.** Event hooks do not await their callbacks, so an
  `async` handler's rejection is unhandled. A converted
  `() => { attemptTimeout(async () => {…}) }` is safe; a rejected promise inside is not
  logged unless caught.
- **Search scope of ID lookups.** Precedent: `getSlideById` searched only
  `getSlidesQuick()`, which never lists appended attachment slides — the row was dead.
- **A playlist reads its editing-history HEAD**, not the `.owp` on disk. Any finding
  premised on hand-edited on-disk state is likely wrong.

## §3 Project conventions

- **`Comp` suffix.** Every React function component's name must end in `Comp`.
- **`useAppCurrentRef`.** The pattern is: wrap unstable deps in a ref, read
  `ref.current` inside the callback, empty deps array, `// eslint-disable-next-line
  react-hooks/exhaustive-deps` as the last body line. Exemplar:
  `src/_screen/ScreenCloseButtonComp.tsx`.
  **Do not flag the ~63 unconverted sites** — they are deliberate: callbacks whose
  identity sits in another hook's dependency array (stabilizing them would stop the
  consuming effect re-running), and render-prop callbacks returning JSX.
  `useAppEffect`/`useMemo` deps were left alone on purpose.
- **`tran()` throws on a missing key in dev** and blanks the page. Any new user-facing
  string needs its key present in *both* locales. Concatenated and dynamic
  `tran(prop)` call sites hide from literal grepping — check them by hand.
- **`ConfirmPopupComp` `tran()`s its button labels** — pass raw English keys, and pair
  `'Yes'` with `'No'`.
- **Write files with `fsWriteFile`,** not an `<a download>` blob: there is no
  `will-download` handler, so a blob download pops a Save As dialog and orphans a
  `.tmp`.
- **Downloads are protocol-aware** — only `initHttpRequest` speaks plain http;
  `httpUtils.request` is https/443-only.
- **Print scaling uses CSS `zoom`, never `transform: scale()`** — transform keeps the
  full-size layout box and print fragmentation silently drops text across page breaks.
- **Dev-only DOM stamps.** `data-react-comp-name` / `data-react-comp-fp` exist only
  under `apply: 'serve'`. Production code must never depend on them.

## §4 Tests

- New behavior with no test; a changed behavior whose test still passes for the wrong
  reason.
- **Dead mock path:** `vi.mock('.../debuggerHelpers')` — that module is now `appHooks`.
  Such a mock is inert and silently fails to stub `useAppEffect`. The fix is a partial
  mock via `importOriginal` so `useAppEffect` becomes plain `useEffect` while siblings
  like `useAppCurrentRef` survive.
- **`appProvider` mocks need `systemUtils.isDev`** — `appHooks` reads it at module load.
- **`appProvider` touches `document` at module scope**, so any node-env test that
  reaches `langHelpers` dies on import.
- **jsdom timing.** Flows that hop a real macrotask (`setTimeout(0)`,
  `genTimeoutAttempt`) need `await new Promise((r) => setTimeout(r, 25))` inside
  `act(...)`; flushing microtasks is not enough.
- Env-leak flakes exist — a node-env test importing `appProvider` may pass only when a
  jsdom file shares the worker. Do not "fix" a flake by asserting less.

## §5 Security & IPC

- New `ipcMain` handler → validate every argument; assume the renderer is hostile.
- Any path built from a user-supplied name joined onto a data dir → containment check
  (this repo has a known deferred trash-path containment gap; a *new* one is a finding).
- `shell.openExternal` / `loadURL` on unvalidated input.
- New or loosened `webPreferences`.
- Committed secrets, tokens, or absolute local paths.

## §6 Docs & memory drift

If the staged change alters observable behavior:

- `.claude/skills/owa-robot-test/references/user-workflows.md` — the stable `W-xx`
  recipes; it is the source of truth for user-facing docs.
- `docs/test-paths/coverage-matrix.md` — the row IDs.
- Both must be updated in the *same* change, with their version dates bumped, and no
  step may be published that was not observed working live.
- `.claude/memory/*.md` — flag any note the change makes wrong. Note that a stale copy
  of the skill exists under `.github/skills/owa-robot-test`; do not extend it.

## §7 Verification commands

Cheap, and they convert guesses into facts. Run on the touched files only.

```sh
npx tsc --noEmit                    # typecheck
npx vitest run <changed test file>  # targeted tests
npm run lint:es                     # eslint, --max-warnings 0
```

Do **not** run the full `npm run lint` for a review — it ends with a production `build`,
and `electron:build` deletes `electron-build/`, killing a running dev app. If live
verification is also wanted, do it *before* any build.

Do not pipe a lint run through `tee`/`grep` and trust the exit code — bash has no
`pipefail` here, so the pipeline reports the last command's status and masks the real
failure. Read the log body.
