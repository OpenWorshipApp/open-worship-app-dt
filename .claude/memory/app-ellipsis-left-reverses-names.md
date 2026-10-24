---
name: app-ellipsis-left-reverses-names
description: .app-ellipsis-left uses direction:rtl, which drew "12_cv.mp4" as "cv_12" until every user of the class wrapped its text in <bdi> (2026-09-19) — unwrapped text reverses again
metadata:
  type: project
---

`.app-ellipsis-left` (`src/others/appInit.scss`) truncates on the *left* by setting
`direction: rtl`. That also triggers bidi reordering, so a name whose digits and
letters are separated by a neutral char rendered reversed: the background thumbnails
labelled `cv_1`, `cv_10`, `cv_12` were really `1_cv.mp4`, `10_cv.mp4`, `12_cv.mp4` on
disk. Since 2026-09-19 every element carrying the class wraps its text in `<bdi>`, which
isolates it, so the name reads in its true order and the ellipsis stays on the left; text
put there WITHOUT `<bdi>` reverses again. Plain `.app-ellipsis` (right truncation) shows
the true name.

**Why:** it made screenshots and user reports name files that don't exist, and made a
correct new view look "wrong" next to the old one — the background list view added in
`BackgroundListItemComp` showed true names and so disagreed with the thumbnail grid
above it.

**How to apply:** never trust a name read off a thumbnail footer / path chip — confirm
against the directory listing (or `fileSource.fullName` in the DOM `title`) before
using it in a selector, a bug report, or a test fixture. See
[[dev-data-dir-is-separate]] for where the dev media dirs actually live.
