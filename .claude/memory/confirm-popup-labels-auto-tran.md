---
name: confirm-popup-labels-auto-tran
description: showAppConfirm button labels are tran()'d by ConfirmPopupComp — pass raw English keys, never pre-translate
metadata:
  type: project
---

`ConfirmPopupComp` renders the footer buttons as
`tran(cancelButtonLabel ?? 'Cancel')` / `tran(confirmButtonLabel ?? 'Ok')`.
So `showAppConfirm`'s `cancelButtonLabel` / `confirmButtonLabel` must be given
the **raw English dictionary key** (`'Yes'`, `'No'`, `'Return to Presenter'`).
Title and body are the opposite — those are NOT translated by the component, so
callers must wrap them in `tran()` themselves.

**Why:** passing `tran('No')` double-translates. Under `km` the stored value is
already `'ទេ'`, and the component's `tran('ទេ')` finds no dictionary key →
throws in dev and blanks the page (see [[tran-missing-key-throws-in-dev]]).
Under `en-US` `tran` is a passthrough, so the bug is invisible in an
English-only run.

**How to apply:** when adding or reviewing a `showAppConfirm` call, check that
labels are bare string literals present as keys in every `src/lang/data/online/<code>/dictionary.json`,
and that a `confirmButtonLabel: 'Yes'` is paired with `cancelButtonLabel: 'No'`
(otherwise the dialog reads "Cancel / Yes"). Sites that keep both defaults get
the coherent "Cancel / Ok" pair and need no options object.

**The title and body rule is held by a test** since 2026-11-12 (EN-63):
`src/lang/userMessageTran.test.ts` fails on a literal with a word outside
`tran()` / `tranSafely()` in the first two arguments of `showAppConfirm`,
`showSimpleToast`, `showAppAlert` and `showAppInput` (`SimpleToastComp` does not
translate either). Data goes after the translated words or into a
`{placeholder}`; a file-system failure's body is `toFileErrorText(error)`
(EN-62), never `error.message`. An English message kept on purpose goes in the
test's allowlist with its reason.
