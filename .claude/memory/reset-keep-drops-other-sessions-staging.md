---
name: reset-keep-drops-other-sessions-staging
description: 'In the shared worktree, moving HEAD with git reset --keep after a temporary-index commit silently unstages every file another session had staged; save their staged set first and stage it again'
metadata:
  type: project
---

Several sessions share this worktree, and one may have files STAGED for its
own commit. A commit built from a temporary index file (git's index-file
variable, `read-tree`, `update-index --cacheinfo`, `commit-tree`) leaves their index
alone, and `git merge` / `git pull` refuse while the index differs from
HEAD. But moving HEAD to that commit with `git reset --keep <commit>` resets
EVERY index entry to the new HEAD. Their whole staged set turns back into
plain unstaged changes, with nothing on disk lost and nothing said
(2026-11-13: the 224 files the MCP-distribution session had staged, one
of them staged in part).

**Why:** that session commits its index as it stands. With the stage gone,
its next commit holds nothing, or the wrong half of a file staged in part.

**How to apply:** before the reset, save `git diff --cached --name-only`
and `git diff --cached --stat`, plus `git diff --cached -- <file>` as a
patch for every file shown `MM` (staged in part). After the reset, `git add`
the fully staged files again, `git apply --cached` each partial patch, and
compare the stat. A file of theirs that your commit also changed is staged
as their staged version plus your committed hunks (the worktree, when its
unstaged part is only yours). Staging their old blob would quietly revert
your commit in theirs. Never stash (the `owa-gi` rule); see also
[[corpus-run-in-a-shared-dev-app]].
