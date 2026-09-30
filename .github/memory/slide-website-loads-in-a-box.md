---
name: slide-website-loads-in-a-box
description: "A website canvas item's address is loaded in a walled hidden window; the same-host exemption keeps an intranet slide working and the webs-folder rule keeps the app's own local pages working"
metadata: 
  node_type: memory
  type: project
  originSessionId: e5ec9e8c-e9cc-4670-95e1-4aae6714bc30
  modified: 2026-09-24T21:25:01.229Z
---

`captureWebScreenShot` (`electron/electronHelpers.ts`) renders a website canvas
item and a web background by loading the document's address into a hidden
window. Since 2026-09-17 that window is boxed by
`electron/webCaptureHelpers.ts` on one rule: **a capture may talk to the site it
was asked for and to the public internet; never to this machine, and never to
anything else on the local network.**

**Why:** the address comes out of a DOCUMENT, so opening a shared presenting
flow — a memory stick, a `.owapf.tar.gz` from another church — was the whole
delivery, with no model and no agent involved. Measured live before the change:
a captured page reached `127.0.0.1` and `localhost`, where this app's CDP and
MCP doors live with no credential (the pair [[aichat-guest-cannot-reach-loopback]]
walled the AI Chat guest off from), and `file:///…/package.json` captured 58 622
characters of the operator's disk, because `webSecurity: false` lets a `file:`
page read its neighbours.

**How to apply:**

- The **same-host exemption** is the one difference from the AI Chat guest's
  wall, and it is deliberate: no chat site needs a local address, but a
  church's own intranet notice board is a legitimate slide. A private page may
  load its own assets; a public one may reach nothing private at all. Loopback
  gets no exemption — do not add one "so the app can preview its own pages".
- **A `file:` URL is not automatically the attack — the app makes its own
  local pages** (2026-09-24). The Webs panel's **New File** writes an `.html`
  into `<data folder>/webs`, and the Background **Webs** tab, every Foreground
  **Web Show** widget and a slide's website item all put it up as
  `file:///…/webs/x.html`. The first cut was "http(s) only", which left every
  one of those tiles on the globe-and-url placeholder with one
  `Only a web address can be captured` in the console per file — the remote
  URL item beside them still had its picture, which is what the symptom looks
  like. What separates them from `file:///C:/Users/.../setting.json` is the
  FOLDER, not the scheme. `resolveCaptureTarget` (`webCaptureHelpers.ts`)
  takes a `file:` URL only when it is an `.html`/`.htm` inside a folder the
  app's Webs panel was pointed at — the `select-dir-web-bg*` directory
  settings, `$DATA_DIR_PATH` and either OS's separator expanded, plus the
  default `<data folder>/webs`, listed by `listWebCaptureDirPaths` in
  `electronHelpers.ts` (5 s cache, and only ever asked for a URL that is not
  http(s)). `..` is resolved away first and case is folded on Windows and
  macOS only. A shared document fails the same test by naming the OTHER
  church's folders; where the two really are the same item,
  `$DATA_DIR_PATH` (see [[portable-data-dir-alias]]) has already rewritten it
  into this user's own webs folder.
- **`file:///*` is a wall pattern, not an afterthought.** Without it no `file:`
  request is judged at all: a site's page could read the disk and a local page
  could read the whole machine. With it, a site reads no file and a local page
  reads only the folder it lives in. Proven live by putting a page in that
  folder that fetches both ways — its own sibling READ, one folder up BLOCKED.
  Anything that widens `CAPTURE_REQUEST_URL_PATTERNS` must keep it.
- **`webSecurity: false` stays.** It may be load-bearing for a real user's
  slide and nothing has measured whether it is. The wall closes what it opens.
  Flipping it is a separate change that needs a corpus of real website items.
- Anything else that loads a foreign address into a window needs its own box.
  There are now three, on purpose, with three trust levels and ONE shared
  address dialect (`tools/owa-devtools-mcp/webUrlPolicy.mjs`): this one (a
  user's slide), `webPageHelpers.ts` (an address a MODEL chose — see
  [[mcp-read-website-tool]]), and `aiChatGuestHelpers.ts` (a whole site). Do
  not merge them into one function with a "be careful" flag.
- The proof harness serves a page on the machine's own LAN address and watches
  which requests arrive, which is the only way to see the wall work; a unit
  test cannot, and `electron/webCaptureHelpers.test.ts` covers the rules only.
