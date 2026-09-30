# Test recipes — how this repo actually writes tests

Every pattern here is copied from a test that is green in the repo today. Where
a trap is named, it has already cost someone a debugging session; most are
recorded in `.claude/memory/`.

There is **no `@testing-library/react`** in this project, **no shared
`appProvider` mock**, and **no global test setup beyond a localStorage
polyfill**. Anything a test needs, that test builds.

---

## 1. The two vitest projects

| | `vitest.config.ts` | `vitest.electron.config.ts` |
| --- | --- | --- |
| Runs | `src/**/*.test.ts(x)`, `tools/**/*.test.mjs` | `electron/**/*.test.ts` |
| Environment | `node`, jsdom **per file** via pragma | `node` |
| Setup | `src/test-setup/localStoragePolyfill.ts` | none |
| Inlined deps | `open-lyric`, `monaco-editor` | none |
| Mocks | `clearMocks`, `restoreMocks`, `mockReset` all **true** | same |
| Command | `npm test` | `npm run test:electron` |

`npm run test:all` runs both, and `npm run lint` runs `test:all`.

`mockReset: true` matters more than it looks: **every mock's implementation is
reset between tests**, so a `vi.fn(() => x)` factory default set at module scope
is gone by the second test. Set implementations in `beforeEach`, or use
`mockReturnValueOnce`.

## 2. The jsdom pragma — the literal first line

```ts
// @vitest-environment jsdom

import { act } from 'react';
```

Needed by any test whose imports reach `appProvider`, `FileSource`, or React.
`src/server/appProvider.ts` runs `document.addEventListener(...)` **at module
scope**, and `src/lang/langHelpers.ts` imports it for `tran`, which nearly
every `helper/` module imports — so it lands in files that never mention it.

**Why it must not be skipped:** workers are reused across files, so jsdom
globals leak into later node-env files in the same worker. A pragma-less test
that needs a DOM passes or fails *depending on file scheduling*. Worse, when it
does fail it fails at import, and vitest reports the file as `(0 test)` —
**a "(0 test)" line is a failure, not a skip**, and its assertions have been
rotting against the code silently. Memory `vitest-env-leak-flakes`.

To find latent cases, run the pragma-less files together so they get a pure
node worker:

```bash
npx vitest run --config vitest.config.ts $(grep -rL "@vitest-environment" $(git ls-files 'src/**/*.test.ts*'))
```

## 3. The mock bundle — `vi.hoisted` + `vi.mock`

`vi.mock` calls are hoisted above imports, so anything a factory closes over
must be hoisted too. This repo's convention is one `vi.hoisted` object holding
every mock, destructured at the top of the file. Exemplar:
`src/app-document-list/appDocumentHelpers.coverage.test.tsx`.

```ts
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { showAppAlertMock, appProviderMock, hookState } = vi.hoisted(() => ({
    showAppAlertMock: vi.fn(),
    // State the mocks read and the test drives — the captured event callback,
    // a fake file system, whatever the module under test talks to.
    hookState: { fileSourceEventCallback: null as null | (() => void) },
    appProviderMock: {
        isPagePresenter: false,
        pathUtils: { join: (...parts: string[]) => parts.join('/') },
        // domHelpers registers an open-about listener at module load.
        messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
    },
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
}));

beforeEach(() => {
    hookState.fileSourceEventCallback = null;
    appProviderMock.isPagePresenter = false;
});
```

**Mock `appProvider` in the file that needs it.** There is no shared fake and
none may be added — the user deleted `appProvider.mock.ts` (a 1 200-line
browser fake) in so many words, and 65 test files went with it. Memory
`appprovider-mock-node-env`.

### The `resetModules` trap

A `vi.mock` factory is evaluated **once and cached**. `vi.resetModules()` does
NOT re-run it — but it DOES invalidate the modules the factory imported. So a
test that resets and then re-imports the mock's state module gets a **fresh**
state object while the module under test still holds the **first** one, and
every assertion reads "Number of calls: 0". Invisible with one test in the
file; it appears when a second test resets.

- Needs `vi.resetModules()` (re-running import side effects)? Pin the mock by
  importing it **statically at the top**, before any reset.
- Only needs different flags per case? Do not reset at all — mock the helper
  module with **getters** over a `vi.hoisted` object and flip the fields in
  `beforeEach`. Exemplar: `electron/taskbarHelpers.test.ts`.

Memory `vitest-mock-factory-survives-resetmodules`.

## 4. Components — no testing-library

### Smoke render (cheap, for breadth)

```ts
import { renderToStaticMarkup } from 'react-dom/server';

const html = renderToStaticMarkup(<FooComp {...props} />);
expect(html).toContain('expected-class');
```

Server rendering runs no effects and touches no DOM, which is exactly why it is
cheap — and exactly why it proves little. Use it to sweep a folder of
components for *crashes on render*, and assert something true about the output
(a class, a label, a count of rows) so the test can still fail.

### Behaviour (for anything worth asserting)

```ts
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test('presses the button', async () => {
    await act(async () => root.render(<FooComp />));
    const button = container.querySelector('button')!;
    await act(async () => button.click());
    expect(onPressMock).toHaveBeenCalledOnce();
});
```

48 test files use this shape. Everything goes through `act`, including the
initial render and the unmount.

### The batched harness — the pattern for breadth

`src/_screen/components.smoke.test.tsx` (664 lines) builds **one** mock surface
— a fake screen manager, a fake settings store, a fake display list — and then
renders many components against it. That is the shape that pays for 417
components: one expensive mock surface amortised over a folder, instead of 40
files each booting the world.

Name a new one `<folder>/components.smoke.test.tsx`, or
`<module>.coverage.test.tsx` when it is one module's uncovered branches being
swept. Both names are already in the repo and neither is special to the
runner — they are a signal to the next reader about what the file is for.

**Watch its wall clock.** That file is the slowest in the suite and it is the
one that times out first when coverage instruments everything.

## 5. What is worth asserting — this repo's defect classes

The tests worth writing are the ones that would have caught the bugs this app
actually has. Each of these is a real, recorded defect; each makes a good
parameterised test on any module of the same shape.

| Class | The test |
| --- | --- |
| **A getter hands out its live array** and callers splice it in place (memory `bible-view-controller-live-arrays`, `onscreen-setting-parse-amplification`) | Call the getter twice; mutate the first result; assert the second is unchanged |
| **A module-level debounce shared by every instance** — one `genTimeoutAttempt(500)` at module scope collapses N hooks into one, leaving N-1 stale (CLAUDE.md) | Mount two instances over one `filePath`, fire one event, assert BOTH updated |
| **A cache with a sliding TTL** — every read pushed the timestamp forward, so it never expired (memory `filesource-cache-sliding-ttl`) | Read repeatedly across the TTL with fake timers; assert it DID expire |
| **A read cache keyed by path, past a rename** (memory `history-read-cache-stale-paths`) | Write, rename onto the cached path, read; assert the new bytes |
| **A settings write race** clobbering a map (memory `settings-write-race-corrupts-onscreen-map`) | Two concurrent writers; assert both entries survive |
| **A parse that drops the whole map on one bad entry** (memory `screen-onscreen-setting-all-or-nothing`) | Feed one invalid entry among valid ones; assert only the invalid one is dropped |
| **A missing `tran()` key** — throws in dev and blanks the page | Render with the key; a throw is a real bug, not a test to mock away |
| **`%` keeps the sign**, so stepping back off index 0 lands at -1 (CLAUDE.md, the chat tips) | Step backwards from the first element; assert it wraps to the last |
| **A regex over repo text on a CRLF checkout** (memory `crlf-checkout-line-regex`) | Feed the function `\r\n` text; assert it still matches |

## 6. Special imports

- **`open-lyric` (the real one)** — `// @vitest-environment jsdom`, then patch
  `document.queryCommandSupported ??= () => false` and
  `document.execCommand ??= () => false` (monaco's clipboard contrib probes
  both at module-eval time), then **dynamic-import** the module under test
  AFTER the patch — static imports hoist above it. Copy
  `src/plugins/public-domain-songs/publicDomainSongsHelpers.test.ts:17-24`.
  A node-env test must never import it at all. Memory
  `monaco-css-test-failure-local-open-lyric`.
- **`tools/owa-devtools-mcp/*.mjs`** — plain ESM, no app imports, no `node:fs`
  in the modules the renderer also bundles. They test like ordinary node
  modules and are the cheapest coverage in the repo.
- **electron main** — `vi.mock('electron', ...)` via
  `electron/testElectronModule.ts`'s `createElectronModuleMock()`. Note
  `electronMockState.reset()` uses `mockClear()`, not `mockReset()`, so a
  `mockReturnValue` set in one test leaks into the next when the instance is
  pinned.

## 7. Dead mocks to clean up as you pass

Four test files still `vi.mock('.../debuggerHelpers')` — a module that became
`appHooks`. Inert, but it silently fails to stub `useAppEffect`:
`src/_screen/screenInfrastructure.test.tsx`,
`src/app-document-editor/AppDocumentEditorComp.test.tsx`,
`src/server/appHelpers.test.tsx`, `src/event/KeyboardEventListener.test.tsx`
(plus a stale `describe('debuggerHelpers')` label in
`src/helper/appHooks.test.tsx`). Repoint to `appHooks` via a partial mock
(`importOriginal`) so `useAppEffect` becomes plain `useEffect` while sibling
exports like `useAppCurrentRef` survive. `appProvider` mocks need
`systemUtils.isDev`, because `appHooks` reads it at module load.

## 8. Event timing

`BasicEventHandler.addPropEvent` dispatches into an async `checkOnEvent`, so
listeners run on **microtasks** — there is no debounce and no dedup at that
layer. But several flows hop a real macrotask (`setTimeout(0)`,
`genTimeoutAttempt` call sites), so flushing microtasks is not always enough.
When a test drives UI through events, wait a real macrotask inside `act`:

```ts
await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
});
```

Prefer `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(500)` for anything
debounced — it is deterministic, and the 500ms debounces are everywhere.
