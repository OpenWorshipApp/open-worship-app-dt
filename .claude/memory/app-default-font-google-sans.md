---
name: app-default-font-google-sans
description: "English's Google Sans (src/lang/data/en/fonts.json) is the app's default face on every page; a selected language's own face goes IN FRONT of it (app-Battambang, app-Google-Sans, system)"
metadata:
  node_type: memory
  type: project
  originSessionId: d05747ff-28dd-4113-baf9-5fc0cb8f18ec
  modified: 2026-11-20T13:46:22.409Z
---

2026-11-06, the user: _use en's font-family as default app. add selected
language's font-family, when available_, then, asked for the order and the
reach, _Language first, English after_ and _everywhere, all pages should
embed and set app-Google-Sans_, with six static faces (Regular, Medium,
SemiBold, Bold, Italic, BoldItalic) and _remove any unused files to reduce
bundle size_. The variable fonts, the `17pt` set, MediumItalic, SemiBoldItalic
and Google's README were deleted (each face is ~2 MB; OFL.txt stays, as the
licence requires).

- English is made like any language: `src/lang/data/en/fonts.json`
  (`uiFamily: app-Google-Sans`, `family: Google Sans`), its faces imported
  by `?url` in `en/index.ts` and drawn by `online/langFontFaces.ts`. That module
  holds the generator the factory used to own, and an optional face
  `style: "italic"`, which is written only when it is set, so Khmer's sheet
  stayed byte-identical and no language was bumped.
- `boot.ts` `init()` loads English too, even in another language, which
  registers `<style id="lang-en">`. `appFontFamilyHelpers.ts` then sets
  `--app-font-family` on `<html>` and `body` inline to `var(--app-font-family),
var(--bs-body-font-family, …)`. `main.tsx` no longer sets the body font.
- Screens (no boot): `screen.scss` body and `SCREEN_FONT_FAMILY` start with
  `app-Google-Sans`, and `initAllLangCss()` registers it there.
- The 🤖/✨ stacks and the markdown preview's body name `--app-font-family`
  (see [[chat-windows-honor-app-font]]). A face picked in Settings → General
  still wins everywhere.
- On purpose, English sets `fontFamily` but NOT `globalFontFamily` /
  `getFontFamilyFiles`. Those make the Word Bible export offer to copy the
  font files, which an English Bible never needed.
- `--chat-lang-font` and the ✨ guest's language face skip English.
- **PPTX slides get it from the converter** (2026-11-20, the user: _check why
  googleSans font (english default) not effect in pptx slides_). Each run in
  converted HTML carries its own inline list, closed by a generic family
  (`'Khmer OS Freehand',sans-serif`). A face the computer lacks therefore fell
  to Arial and never reached the inherited default.
  `pptx-to-html-conv` 1.2.0 `exportPptx(…, defaultFontFamily)` and
  `--default-font-family` put the given face in front of that generic family.
  `electron/msHelpers.ts` passes `PPTX_DEFAULT_FONT_FAMILY`, the literal face
  (`enFonts.uiFamily`, read from English's `fonts.json` since 974ecbbea),
  because the screen window has no `--app-font-family`.
  It goes into every list, serif and monospace included.
  `docx-to-html-conv` 1.1.0 takes the same option for its heading and body
  lists and after each run's face, but it was unpublished on 2026-11-20 and the
  app's DOCX call does not pass it yet.
  An app-side rewrite of the slides' styles was tried first and reverted
  ([[office-converter-fixes-go-upstream]]).

- **A second Google Sans ships, and it is not this one.** The `open-lyric`
  dependency bundles 8 faces of its own (`node_modules/open-lyric/dist/assets`,
  ~15.7 MB, a different build: Regular 1.94 MB against 2.01 MB). It registers
  them as `editor-GoogleSans` in its editor. A production build measured
  2026-11-06 carried 14 `GoogleSans*` files, 27.75 MB: 6 of them English's.
  Removing that copy is open-lyric's change (let it use a host family, for
  example `app-Google-Sans`), not this repo's.

**Why:** one default face across the app, with a language's script face taking
its letters first.

**How to apply:**

- A new page that skips `boot.ts` has to register English's faces itself
  (`initAllLangCss`) and name `app-Google-Sans`.
- Changing the screen stack means changing `screen.scss` and
  `SCREEN_FONT_FAMILY` together.
- Each face is fetched only when text uses it, so do not add a face that
  nothing draws in. See [[screen-window-has-no-app-fonts]].
