---
name: app-ellipsis-left-reverses-names
description: .app-ellipsis-left uses direction:rtl, so file names like "12_cv.mp4" DISPLAY as "cv_12" — the on-screen name is not the name on disk
metadata:
  type: project
---

`.app-ellipsis-left` (`src/others/appInit.scss`) truncates on the *left* by setting
`direction: rtl`. That also triggers bidi reordering, so a name whose digits and
letters are separated by a neutral char renders reversed: the background thumbnails
labelled `cv_1`, `cv_10`, `cv_12` are really `1_cv.mp4`, `10_cv.mp4`, `12_cv.mp4` on
disk. Plain `.app-ellipsis` (right truncation) shows the true name.

**Why:** it makes screenshots and user reports name files that don't exist, and makes a
correct new view look "wrong" next to the old one — the background list view added in
`BackgroundListItemComp` shows true names and so disagrees with the thumbnail grid
above it.

**How to apply:** never trust a name read off a thumbnail footer / path chip — confirm
against the directory listing (or `fileSource.fullName` in the DOM `title`) before
using it in a selector, a bug report, or a test fixture. See
[[dev-data-dir-is-separate]] for where the dev media dirs actually live.
