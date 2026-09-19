---
name: mcp-read-website-tool
description: "owa_read_website is the only tool that reaches OUT; its address policy is enforced twice (sync in the firewall, with DNS in main) and the page loads in a window locked down unlike every other renderer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b47a03e-c20d-4e2c-9dcd-fe2857a8917c
  modified: 2026-09-01T23:28:19.034Z
---

`owa_read_website` (added 2026-09-02) reads a page on the public web — text,
optionally its links, optionally a picture — for questions about the world
outside the app. Every other tool in `tools/owa-devtools-mcp` drives a window
the operator is already looking at; this one opens a socket to somewhere a
language MODEL chose, which inverts the direction of the whole threat model in
[[agent-access-mcp-chatbot]].

**Why:** asked for directly — the chatbot needed to extract text from a page
(the example was the Wikipedia article on the King James Version) and to
photograph one.

**How to apply:**

- **The address policy lives in ONE module**,
  `tools/owa-devtools-mcp/webUrlPolicy.mjs`, and is enforced at two layers that
  are deliberately not the same check twice. `firewall.mjs` refuses
  synchronously what it can see — scheme, address literals, local names, a
  600-character cap — at the seam both MCP doors share, so the refusal is
  logged where every other refusal is and costs no round trip.
  `electron/webPageHelpers.ts` re-checks **with DNS** immediately before it
  connects, and that one is authoritative. Do not collapse them: `localtest.me`
  is a real public domain whose A record is `127.0.0.1` and it passes every
  check that can be made without asking a resolver. Loopback matters here more
  than anywhere, because it is where this app serves its CDP and MCP doors with
  no credential on either ([[evaluate-script-disposablestack]], `MC-01`).
- **Node's `new URL()` does the hard part and the checks depend on it.**
  `0177.0.0.1`, `2130706433`, `0x7f.1` and `127.1` all canonicalise to
  `127.0.0.1`, and IPv6 to its canonical bracketed form, before the policy sees
  them. The checks read the canonical hostname only — "hardening" them to match
  the raw string the caller passed breaks the assumption they are built on.
- **The page loads in a window locked down unlike any other renderer here**:
  no Node, `contextIsolation`, `sandbox`, `webSecurity: true`, no preload, its
  own memory-only session, `window.open` denied (in this app it would reach
  `handlePopupWindowOpen` and its `nodeIntegration: true`), downloads denied,
  permissions denied, audio muted, every redirect re-checked. It is **not**
  `captureWebScreenShot` — that one previews an address the USER typed into a
  slide and runs `webSecurity: false` on the app's own session, which is a
  different trust level, not a shared function with a flag (`MC-16`).
- **Escaping trap, and it is silent.** The in-page script is a template literal
  inside a TypeScript template literal, so `\s` written with ONE backslash is
  swallowed and reaches the page as `s`: `replace(/\s+/g, ' ')` quietly became
  "replace runs of the letter s" and mangled every link's text. `\t` and `\n`
  are worse — they become a real tab and a real newline, breaking a regex
  across a line. Write `\\s`, `\\t`, `\\n`, and check by evaluating the
  generated expression, not by reading it. Typecheck and unit tests saw none of
  it; one live call saw all of it. Same family as the backtick trap in
  [[dom-match-memoised-in-page]].
- **Cut the text in the PAGE.** `maxChars` travels all the way in, so ~80 KB of
  a long article never crosses the IPC or CDP to be thrown away. `innerText`
  after layout beats any tag-stripper (it skips hidden elements and `<script>`
  for free), and hiding `nav`/`aside`/the navigation roles before reading drops
  a site's chrome with no site-specific rules — Wikipedia's tab strip lives
  inside its `<main>`.
- **What is NOT closed**: exfiltration is narrowed, not shut (a URL is a
  channel out — hence the 600-character cap, the 10-per-5-minutes budget on its
  own counter, and a banner naming the SITE on every read), and DNS rebinding
  is accepted knowingly. Both are written down in the skill's
  `references/threat-model.md` rather than implied.
- Cost: **+347 tokens on every round of every question** — the host went 44 →
  45 tools, the model's list 25 → 26. See [[mcp-model-hidden-tools]] for why
  those are different numbers.
