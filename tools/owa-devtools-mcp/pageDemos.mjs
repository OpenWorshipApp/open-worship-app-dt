// Lessons for the smaller app windows. Kept dependency-free so the tips and
// the assistant use the same steps without loading any window's implementation.
export const PAGE_DEMO_LIST = [
  {
    id: 'setting-general',
    page: 'setting',
    label: 'Explore General settings',
    detail:
      'Explore folders, language, appearance, and automatic tips in General settings.',
    find: 'General',
  },
  {
    // The press the help's "Do it for me" makes for a data-folder question
    // (`genGuideActions`): Path Settings is there with a folder chosen and
    // without one, where Use This Folder is not (2026-10-23).
    id: 'setting-path',
    page: 'setting',
    label: 'Choose your data folder',
    detail:
      'Path Settings holds your data folder, where your songs, Bibles and settings are kept: choose it under Parent Directory, and copy it to a drive with Copy Data Folder.',
    find: 'Path Settings',
  },
  {
    id: 'setting-bible',
    page: 'setting',
    label: 'Manage Bible versions',
    detail: 'Open Bible settings to manage the installed Bible versions.',
    find: 'Bible',
  },
  {
    id: 'setting-others',
    page: 'setting',
    label: 'Find AI and extra tools',
    detail: 'Find AI features and extra binaries in Others settings.',
    find: 'Others',
  },
  {
    id: 'appDocumentEditor-edit',
    page: 'appDocumentEditor',
    label: 'Slide Editor',
    detail: 'Select a slide, then select an item on its canvas to edit it.',
  },
  {
    id: 'appDocumentEditor-save',
    page: 'appDocumentEditor',
    label: 'Save',
    detail:
      'Review your slide edits before saving. Use Undo to reverse an edit.',
  },
  // The Bible Note window (2026-11-09, /owa-enhance-tips bible-note): its
  // toolbar, menus and most of its footer are drawn by the bible-note
  // package, which has no translator -- they read in English in every
  // language, so a tip names them in English in every language and its
  // `find` is not translated (`isFindTranslated: false`: `tran()` THROWS on
  // a label that is no key, in a dev window of another language). One step
  // a lesson, so each tip opens the menu or panel it is about and names the
  // controls inside it; the ones that change the note stay words.
  {
    id: 'bibleNote-save',
    page: 'bibleNote',
    label: 'Keep your note with Save',
    detail:
      'Save (Ctrl+S) keeps the note. Undo Saved Change and Redo Saved Change step through what was saved; Discard changed drops what is not saved yet.',
  },
  {
    id: 'bibleNote-text-style',
    page: 'bibleNote',
    label: 'Make a heading, a list or a quote',
    detail:
      'The text style box (Formatting options for text style) turns a line into Normal, Heading 1, Numbered List, Bullet List, Check List, Quote or Code Block.',
    find: 'Formatting options for text style',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-font',
    page: 'bibleNote',
    label: 'Change the font and its size',
    detail:
      'Choose a font in Formatting options for font family. Decrease font size and Increase font size step it, or type a number in Font size.',
    find: 'Formatting options for font family',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-bold',
    page: 'bibleNote',
    label: 'Make words bold, italic or underlined',
    detail:
      'Select words, then Bold (Ctrl+B), Italic (Ctrl+I) or Underline (Ctrl+U). Insert code block and Insert link (Ctrl+K) mark code and links. Undo (Ctrl+Z), Redo (Ctrl+Y).',
  },
  {
    id: 'bibleNote-color',
    page: 'bibleNote',
    label: 'Colour words or the space behind them',
    detail:
      'Select words: Formatting text color colours them, Formatting background color shades behind them, Remove color takes both off.',
    find: 'Formatting text color',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-more-styles',
    page: 'bibleNote',
    label: 'Strike out, highlight or change case',
    detail:
      'Formatting options for additional text styles (•••): Strikethrough, Subscript, Superscript, Highlight, Lowercase, Uppercase, Capitalize, Clear Formatting, Link block text.',
    find: 'Formatting options for additional text styles',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-insert',
    page: 'bibleNote',
    label: 'Insert a table, a picture or a video',
    detail:
      'Insert (Insert specialized editor node) adds a Table, Media (a picture, video, PDF or sound), a Youtube Video, Embed Website, an Excalidraw drawing, a Poll, an Equation or a Date.',
    find: 'Insert specialized editor node',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-insert-mention',
    page: 'bibleNote',
    label: 'Insert a verse, a name or a place',
    detail:
      'Insert (Insert specialized editor node) also adds a Bible Verse, Mention Name, Pin Location, Emoji & HTML Character, a Columns Layout or a Collapsible container.',
    find: 'Insert specialized editor node',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-insert-parts',
    page: 'bibleNote',
    label: 'Divide the note into parts',
    detail:
      'Insert (Insert specialized editor node) adds a Horizontal Rule between parts, a Page Break before printing, a Sticky Note on top, or the Default Example to try.',
    find: 'Insert specialized editor node',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-sticky-table',
    page: 'bibleNote',
    label: 'Work with sticky notes and tables',
    detail:
      'A sticky note has Change sticky note color, Resize sticky note and Delete sticky note; Hide Sticky Notes hides them all. A table has Add row, Add column and Sort column.',
  },
  {
    id: 'bibleNote-align',
    page: 'bibleNote',
    label: 'Line up and indent text',
    detail:
      'Formatting options for text alignment: Left Align, Center Align, Right Align, Justify Align, Start Align or End Align. Outdent and Indent move a line in and out.',
    find: 'Formatting options for text alignment',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-find',
    page: 'bibleNote',
    label: 'Find words in your note',
    detail:
      'Find in note (Ctrl+F). Match case and Match whole word narrow it, Next match and Previous match step through, Close find bar ends it.',
    find: 'Find in note',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-zoom',
    page: 'bibleNote',
    label: 'Make the page bigger or smaller',
    detail:
      'Zoom in and Zoom out, or drag Editor zoom; Reset zoom puts it back. Toggle full view (F5) fills the window, Page size sets the page, Show invisible characters (¶) shows spaces.',
    find: 'Zoom in',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-lock-clear',
    page: 'bibleNote',
    label: 'Lock the note, or keep it on top',
    detail:
      'Read-Only Mode stops changes while you read or preach. Toggle Always On Top keeps this window over the others. Clear empties the note, after asking first.',
  },
  {
    id: 'bibleNote-files',
    page: 'bibleNote',
    label: 'Print the note or take it to Word',
    detail:
      'More actions holds Import, Export and Editor Information. Import Word Document and Download Word Document go to and from Word; Print prints it.',
    find: 'More actions',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-lookup',
    page: 'bibleNote',
    label: 'Look up people and places',
    detail:
      'Show Lookup: Search names, choose Names or Locations, filter with All types, go on with Jump to page, then Close lookup.',
    find: 'Show Lookup',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-comments',
    page: 'bibleNote',
    label: 'Read the comments on your note',
    detail:
      'Show Comments opens the comments written on words of the note; Close comments shuts them again.',
    find: 'Show Comments',
    isFindTranslated: false,
  },
  {
    id: 'bibleNote-bible-lookup',
    page: 'bibleNote',
    label: 'Put a Bible passage into the note',
    detail:
      'Open Bible Lookup (Ctrl+Shift+B), type the passage, then Insert Bible Text or Insert Collapse Bible Text. Change Bible Key picks the version.',
    find: 'Open Bible Lookup',
  },
  {
    id: 'bibleNote-assistant',
    page: 'bibleNote',
    label: 'Ask the assistant about your note',
    detail:
      'Open in Chatbot talks about this note; select words for Ask the assistant about this. Open in Markdown Editor opens the language editor.',
  },
  {
    id: 'webEditor-preview',
    page: 'webEditor',
    label: 'Previewer',
    detail: 'Edit the web page beside its preview and review it before saving.',
  },
  {
    id: 'lyricEditor-edit',
    page: 'lyricEditor',
    label: 'Lyric Editor',
    detail: 'Edit the song sections and check their preview before saving.',
  },
  {
    id: 'lwShare-share',
    page: 'lwShare',
    label: 'Local Web Share',
    detail:
      'Start the server when you are ready to share, then use its address or QR code on the same network.',
  },
];

export function getPageDemo(id, translate = (value) => value) {
  const source = PAGE_DEMO_LIST.find((demo) => demo.id === id);
  if (source === undefined) {
    return null;
  }
  return {
    ...source,
    title: translate(source.label),
    steps: [
      {
        text: translate(source.detail),
        ...(source.find === undefined
          ? { kind: 'look' }
          : {
              find:
                source.isFindTranslated === false
                  ? source.find
                  : translate(source.find),
              action: 'click',
            }),
      },
    ],
  };
}
