---
name: language-fonts-in-every-font-list
description: "Every font list opens on the app's own faces -- each ENABLED language's app-… face first (app-Google-Sans, app-Battambang), then the families they ship -- loaded only when a list opens; Create Quick Text writes the Bible's face"
metadata:
  node_type: memory
  type: project
  originSessionId: 48f87cdb-a654-4ed3-ba60-fe8d9c0afea3
  modified: 2026-11-10T01:40:18.106Z
---

The user, 2026-11-09: _app's font-family (from language packages) should be
available in everywhere of selecting font-family_; later the same day _add
all language packages' font-family to all font-family list_, _app's
font-family should be on top_, _why I don't see `app-Battambang`_, _it should
list all enabled language packages'_ -- _because all related bible text have
to use its language font-family_. The packages' faces are on no computer, so
the system list every picker read never had them.

- **The `app-…` face IS the font, and it goes on top.** A Bible's text is
  drawn in `langData.fontFamily` (`getBibleFontFamily`: `app-Battambang` for
  a Khmer Bible, `app-Google-Sans` for English). The first version listed the
  real names only (`Battambang`) and left the alias out, so a session set to
  the Bible's face read `(Missing)`. Now every list is: each enabled
  language's `app-…` face, then the families the packages ship under their
  own names (Google Sans, Battambang, `km-font-Fasthand`), then the computer's.
  `parseLangFontFaces` / `getLangFontList` order `app-` first
  (`toAppFamiliesFirst`); a look-alike (`local(…)`) stays out.
- **Every list**: `useFontList` (`src/server/fontHelpers.ts`, every
  `FontFamilyControlComp` -- Settings, Slide Editor, foreground Properties,
  Bible/LongText) through a DYNAMIC import ([[renderer-entry-static-closure]]);
  the Bible Note editor's font box and sticky-note picker
  (`genLangEditorFontFamilies` / `genLangStickyNoteFontFamilies`, and the
  assistant's `loadNoteFontList` reads the same box); the Lyric Editor and
  song previewer (`genLangOpenLyricFontFaces`: a section per language, given
  a NEGATIVE `indexRange` in the packages' order so it sorts above `System`
  and survives English's later `genOpenLyricFontFaces` re-sort). The
  `bible-note` package sorts its main box by name itself
  (`getFontFamilyOptions`), which happens to put `app-` first; its paste
  switch takes the FIRST pair of a language, so each language's `app-` pair
  stays first in the list handed to it.
- **One broken package costs only its fonts** (`readLangCss`: no `genCss`,
  or one that throws, reads as an empty sheet) -- an editor listing every
  language must still open.
- **"Enabled" is live**: `initAllLangCss` keeps its answer for the plugin
  list it was read from (`getLoadedLangPlugins()` identity) and reads again
  once a language is installed, turned on or off; callers during that read
  share it.
- **Create Quick Text writes the Bible's face** into the new session's
  `quick-text<suffix>-common-font-family` (`applyBibleVerseFont`, after the
  Bible Verse preset), and so does the assistant's verse quick text in a NEW
  session (`verseFontFamily` on the plan). A Bible no installed language
  names a font for leaves it at `--`.
- Reading the packages registers their faces in THAT window, which is what
  draws a font just picked. The app font (`readFontsFor`) and the
  presenter's missing-font check (`Slide.getUnavailableFontFamilies`) ask
  only when the computer lacks the family.
- Not done: the Presenter's mini screen after a restart draws a foreground
  in another language's font with a fallback until something in that window
  registers the packages (a font list opened, a slide checked); the screen
  window registers every language at boot, so the wall is right.

**Why:** Bible text in any language is drawn in that language's `app-…`
face, so that face has to be pickable everywhere and first; the lazy load is
the performance rule -- a plugin is 0.4-0.6 MB and nothing pays it until a
list is opened.

**How to apply:** a new font list goes through `useFontList` (or the
`genLang*FontFamilies` / `genLangOpenLyricFontFaces` helpers for a package's
own picker), never `getFontFamilyMapByNodeFont` alone, and never drops the
`app-` faces; something that puts Bible text in a new place sets
`getBibleFontFamily`'s face. [[app-default-font-google-sans]],
[[own-font-list-with-weights]], [[language-plugins-runtime]]. W-06, W-07,
W-16, PM-176, CM-103.
