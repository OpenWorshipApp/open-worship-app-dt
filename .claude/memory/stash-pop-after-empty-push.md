---
name: stash-pop-after-empty-push
description: "In a pull routine, `git stash push` on a clean tree stashes NOTHING, and the `git stash pop` after it applies an OLD stash -- pop only when the push made one"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 64c20cce-a53c-493c-b1f4-046abac8f766
  modified: 2026-11-14T02:44:33.814Z
---

`git stash push -m X` on a tree with no changes prints "No local changes to
save" and makes no stash; a `git stash pop` right after then pops whatever
stash is on top -- an old one kept from an earlier pull (keep-all-stashes is
this checkout's rule). On 2026-11-13 that put an hour-old stash back over a
freshly pulled clean tree: 90 files with conflict markers. Nothing was lost
(a conflicting pop keeps the stash), and every changed file was in that
stash's own list, so `git checkout -- <those files>` put the tree back.

**Why:** the shared worktree's stash list holds other sessions' work kept
on purpose (`git stash drop` is not used), so the top entry is never "ours"
unless the push just made it.

**How to apply:** count first -- `before=$(git stash list | wc -l)`, push,
and pop only if `git stash list | wc -l` grew; or skip the stash entirely
when `git status --short` is empty. After any pop, count conflict markers
over the WHOLE tree (`git grep -l '^<<<<<<< ' | wc -l`), never `| head`.
Related: [[reset-keep-drops-other-sessions-staging]].
