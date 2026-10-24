---
name: khmer-text-spacing-traps
description: "Khmer separates words with zero-width spaces and writes a sentence with no space — word checks and \"one word\" tests break on both"
metadata:
  node_type: memory
  type: project
  originSessionId: b9fcd212-e504-4d3a-86cc-ba6ed2f3ba33
  modified: 2026-10-23T15:49:00.337Z
---

Khmer text in this app's data and in model answers has two spacing traps:

- **Zero-width spaces (U+200B) between words** (`អ្នក​ជំងឺ`, the Bible text,
  the cross-reference bundle). `title.includes('អ្នកជំងឺ')` misses every one
  written that way: a check for "patient" read as a sick person found 0 of
  the 90 (EC-417). Strip `[​-‍﻿]` before matching words.
- **No space inside a sentence.** A whole Khmer question is ONE
  whitespace-separated "word", so a "bare name" test took
  `តើមានខគម្ពីរណាផ្សេងទៀត…?` as a name and loaded the 34 MB names dataset
  (EC-422). Bound such tests by length, sentence marks and lead words
  (`nameAskLead`), not by word count.

**Why:** both are invisible on screen; tests written with ordinary spaces
pass while real data fails.

**How to apply:** when matching or counting Khmer words, normalise the
zero-width characters first, and never treat "one token" as "one word".
Writing the escape `​` through the Edit tool can put the literal
character into the file instead — eslint's `no-irregular-whitespace` catches
it in `src/`, nothing does in `extra-work/`; write such regexes from a script
file. Related: [[chatbot-follows-app-language]], [[electron-icu-has-no-khmer]].
