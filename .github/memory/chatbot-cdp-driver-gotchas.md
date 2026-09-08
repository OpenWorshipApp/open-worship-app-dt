---
name: chatbot-cdp-driver-gotchas
description: Driving the chatbot window over CDP from Git Bash - a /command argument is rewritten to C:/Program Files/Git/..., and at 12 tabs New chat silently does nothing so every ask lands in the last tab with its history
metadata:
  type: feedback
---

Two traps when a script asks questions through the real chatbot window
(`scratchpad/ask.mjs` pattern: CDP `Runtime.evaluate` on the React-controlled
textarea, `Network.enable` to count model rounds and `tools/call` posts):

- **Git Bash rewrites a leading-slash argument.** `--q="/screen"` reaches
  node as `C:/Program Files/Git/screen` (MSYS path conversion). Set
  `MSYS_NO_PATHCONV=1` (or run from PowerShell). Three paid Claude calls
  answered "that looks like a file path" before this was noticed.
- **The window caps tabs at 12 and New chat then does nothing.** A driver that
  opens a tab per question silently starts asking in the LAST tab, with its
  history, from question 12 on — which changes the answers being graded.
  Close the tabs first (`button.chat-tab-close`, one click per React render,
  with a wait between) and read a message's author from its **Ask again**
  button's title (`Put this question back in the box`), not from its text —
  the offline where-is answer itself contains the words "Ask again".

**Why:** both silently produce wrong measurements rather than errors.

**How to apply:** any live corpus run — `/owa-enhance-chatbot` research —
sets the env var and clears the tab strip before the first question.
Related: [[chatbot-builtin-commands]].
