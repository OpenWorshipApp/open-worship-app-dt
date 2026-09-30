---
name: no-user-specific-references-in-notes
description: Never record a user-entered site, URL, name or other personal reference (e.g. a domain the user typed into the chatbot) in memory, CLAUDE.md, skills or docs — use a neutral placeholder like example.com
metadata:
  type: feedback
---

Do not write a reference the user entered into the app or the chat — a
website, a URL, a song source, a name — into memory, `CLAUDE.md`, the skill
references, the manual sources or tests. On 2026-09-02 the user asked for every
mention of a site they had pasted into the chatbot (used as the example in the
`Reading <site>` progress-line note) to be removed from the repo, and set this
as the rule.

**Why:** a value the user typed is their own data, not project knowledge; it
ends up in the committed repo, the Copilot mirror, the built chatbot knowledge
bundle and the public manual, where it names a real site or person for no
reason.

**How to apply:** when an example needs a concrete value, use a neutral
placeholder (`example.com`, "Amazing Grace"). If a note is *about* something
the user pasted, describe its shape ("a chord-sheet URL with a query string"),
not the value. Remember the `.github/` mirror and
`node extra-work/build-knowledge.mjs` when scrubbing one that slipped in
([[claude-dir-edits-need-knowledge-rebuild]]).
