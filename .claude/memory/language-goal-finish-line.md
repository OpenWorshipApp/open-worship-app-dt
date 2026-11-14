---
name: language-goal-finish-line
description: "for 'work great for all languages', the finish line the user accepted (2026-11-09): every language measured live and every app-side failure fixed; native-speaker review and model limits stay open BN items"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5d3daa23-aa18-4c26-a85e-2ecada455922
  modified: 2026-11-09T12:33:03.235Z
---

On the goal _work great for all languages_ (the Bible-note chatbot,
2026-11-08/09) a goal hook rejected every stop while anything was not
confirmed by native speakers. Asked with the numbers -- two asks live in all
87 languages (_add a line_ exact everywhere, _make the first line bold_ 81 of
87), 176 of 176 undos kept, the misses the model's reading of an ambiguous
word or its not knowing Oromo and Fijian, no native review, a manual only in
Khmer and French -- the user chose **Stop here**, and kept the firewall
change made on the way (BN-46, an undo of the session's own change is no
removal).

**Why:** native-speaker confirmation and a model's knowledge of a small
language are outside what an agent can produce; another automated pass counts
as neither.

**How to apply:** for a language-quality goal, fix every app-side failure and
re-test first ([[corpus-test-goal-means-failures-fixed]]), measure each
language live, then leave native review and model limits as open BN items
(BN-32, BN-49) and ask with the numbers instead of looping on a bar no run can
reach. Related: [[chatbot-follows-app-language]], [[bible-note-chatbot]].
