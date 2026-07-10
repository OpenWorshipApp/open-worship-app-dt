# Project instructions

## Naming conventions

Every React function component must have a name ending in `Comp`
(e.g. `FormComp`, `ForegroundCountDownComp`).

## Verifying code changes

Always verify any code change against the running app using `chrome-devtools`
(the chrome-devtools MCP). A passing typecheck/build is not sufficient — take a
screenshot of the live app and confirm the change actually renders/behaves as
intended before considering the work done.

After any code change, also run `npm run lint` and make sure it passes. It is
the full gate: tests (`test:all`), typecheck (`lint:all:error`), prettier
(`lint:pre`, which rewrites files — expect formatting diffs), eslint with
`--max-warnings 0` (`lint:es`), and a production `build`.

## Mapping DOM elements to components in dev

The dev server (and only the dev server — `apply: 'serve'` in
`vite-plugin-comp-name.ts`; production DOM has neither attribute) stamps the
root DOM element of every `*Comp` React function component with:

- `data-react-comp-name="<ComponentName>"` — e.g. `RenderBibleLookupHeaderComp`
- `data-react-comp-fp="src/<path>.tsx"` — repo-relative source file, e.g.
  `src/bible-lookup/RenderBibleLookupHeaderComp.tsx`

The DOM carries the **innermost** component's name: when a component's root is
another component, the outer one is not stamped.

Use these when working against the running app via chrome-devtools:

- To locate a component's element: query `[data-react-comp-name="FooComp"]`.
- To find which source file renders something on screen: read
  `data-react-comp-fp` off the element (or
  `el.closest('[data-react-comp-fp]')`) and open that file directly — no
  grepping class names to find which component rendered what.
