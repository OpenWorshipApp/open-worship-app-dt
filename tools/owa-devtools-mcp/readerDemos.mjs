import { genAppMenuDemos } from './appMenuDemos.mjs';

// Small, deterministic Bible Reader lessons. They live beside the guide
// engine because the chatbot window and every outside MCP client must start
// the exact same safe steps. Nothing here calls a model or reads a Bible.

export const READER_DEMO_LIST = [
  {
    id: 'reader-font-larger',
    label: 'Make the words larger',
    detail: 'Open the hidden footer and raise Font Size.',
    title: 'Make the words larger',
    steps: [
      {
        text: 'Make the Bible words larger with Font Size.',
        find: 'Font Size',
        translateFind: true,
        action: 'type',
        value: '+8',
      },
    ],
  },
  {
    id: 'reader-font-smaller',
    label: 'Make the words smaller',
    detail: 'Open the hidden footer and lower Font Size.',
    title: 'Make the words smaller',
    steps: [
      {
        text: 'Make the Bible words smaller with Font Size.',
        find: 'Font Size',
        translateFind: true,
        action: 'type',
        value: '-8',
      },
    ],
  },
  {
    id: 'reader-open-john-3-16',
    label: 'Open John 3:16 with buttons',
    detail: 'Choose the book, chapter and verse without typing a reference.',
    title: 'Open John 3:16 with buttons',
    steps: [
      {
        text: "Clear the current reference to show this Bible's book buttons.",
        find: 'Clear input',
        translateFind: true,
        action: 'click',
      },
      {
        text: "Choose John from this Bible's book buttons.",
        find: 'John',
        action: 'click',
      },
      {
        text: 'Choose chapter 3.',
        find: 'Chapter 3',
        finds: ['Chapter 3', '3'],
        action: 'click',
      },
      {
        text: 'Choose verse 16.',
        find: 'Verse 16',
        translateFind: 'Verse',
        translateSuffix: ' 16',
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-find-text',
    label: 'Find words in the Bible',
    detail: 'Open Bible Find, then put the caret in its search box.',
    title: 'Find words in the Bible',
    steps: [
      {
        text: 'Open Bible Find with Advance Bible Lookup.',
        find: 'Advance Bible Lookup',
        translateFind: true,
        action: 'click',
        // If the search box is already showing, opening the panel is already
        // done. The MCP host removes this step before it starts the card.
        skipIfVisible: 'Bible Online Lookup',
      },
      {
        text: 'Choose Find in the Bible Online Lookup picker.',
        find: 'Bible Online Lookup',
        translateFind: true,
        action: 'type',
        value: 'Find',
        translateValue: true,
      },
      {
        text: 'Click Search verses, then type one word from the Bible you are reading. Matching verses will appear below.',
        find: 'Search verses',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-previous-passage',
    label: 'Go back to the previous passage',
    detail: 'Use the passage history without typing the reference again.',
    title: 'Go back to the previous passage',
    steps: [
      {
        text: 'Open the previous passage with Previous.',
        find: 'Previous',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-next-passage',
    label: 'Go forward to the next passage',
    detail: 'Move forward again after using passage history.',
    title: 'Go forward to the next passage',
    steps: [
      {
        text: 'Open the next passage with Next.',
        find: 'Next',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-clear-reference',
    label: 'Clear the reference box',
    detail: "Show this Bible's book buttons and start a fresh lookup.",
    title: 'Clear the reference box',
    steps: [
      {
        text: "Clear the current reference to show this Bible's book buttons.",
        find: 'Clear input',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-clear-reference-part',
    label: 'Remove the last part of a reference',
    detail:
      'Keep the earlier book or chapter and correct only the last choice.',
    title: 'Remove the last part of a reference',
    steps: [
      {
        text: 'Remove only the last book, chapter, or verse choice with Clear input chunk.',
        find: 'Clear input chunk',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-names-lookup',
    label: 'Look up a Bible person or place',
    detail: 'Open the names and locations lookup beside the passage.',
    title: 'Look up a Bible person or place',
    steps: [
      {
        text: 'Open Names and locations lookup at the right of the reference box.',
        find: 'Names and locations lookup',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-names-language',
    label: 'Change names and places language',
    detail: 'Open the language picker used by the people and places tools.',
    title: 'Change names and places language',
    steps: [
      {
        text: 'Open Names and locations language beside the lookup button.',
        find: 'Names and locations language',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-add-bible',
    label: 'Put two Bible versions side by side',
    detail: 'Open the version picker for a second Bible column.',
    title: 'Put two Bible versions side by side',
    steps: [
      {
        text: 'Open Add Extra Bible beside the current version.',
        find: 'Add Extra Bible',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-full-view',
    label: 'Toggle distraction-free reading',
    detail: 'Enter or leave the full reading view.',
    title: 'Toggle distraction-free reading',
    steps: [
      {
        text: 'Use Full or Exit Full at the bottom-right of the passage.',
        find: 'Full',
        finds: ['Full', 'Exit Full'],
        translateFinds: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-copy-passage',
    label: 'Choose how to copy a passage',
    detail: 'Open the Copy menu for the passage you are reading.',
    title: 'Choose how to copy a passage',
    steps: [
      {
        text: 'Open Copy above the passage and choose the format you want.',
        find: 'Copy',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-split-side-by-side',
    label: 'Split the passage side by side',
    detail: 'Make a second reading pane to the right.',
    title: 'Split the passage side by side',
    steps: [
      {
        text: 'Use Split horizontal above the passage.',
        find: 'Split horizontal',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-split-stacked',
    label: 'Split the passage top and bottom',
    detail: 'Make a second reading pane underneath.',
    title: 'Split the passage top and bottom',
    steps: [
      {
        text: 'Use Split vertical above the passage.',
        find: 'Split vertical',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-save-passage',
    label: 'Save this passage in Bibles',
    detail: 'Keep the passage in your Bibles list for later.',
    title: 'Save this passage in Bibles',
    steps: [
      {
        text: 'Use Save bible item above the passage.',
        find: 'Save bible item',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-present-passage',
    label: 'Present a passage from the Reader',
    detail:
      'Double-click a verse to send it to selected screens; use F9 to clear it.',
    title: 'Present a passage from the Reader',
    isFeatured: false,
    steps: [
      {
        text: 'Double-click a verse, or Alt+click it, to send that passage to the selected audience screens. This lesson will not press it for you.',
      },
      {
        text: 'Use F9 when you are ready to clear the Bible layer from the audience screens.',
      },
    ],
  },
  {
    id: 'reader-auto-scroll',
    label: 'Start automatic scrolling',
    detail: 'Let a long passage move down by itself.',
    title: 'Start automatic scrolling',
    steps: [
      {
        text: 'Start auto-scrolling with the double chevron at the bottom-right of the passage.',
        find:
          'Click to scroll to the bottom, double click to speed up, ' +
          'right click to slow down, Alt + right click to stop',
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-scroll-top',
    label: 'Jump back to the top',
    detail: 'Return to the beginning of a long passage.',
    title: 'Jump back to the top',
    steps: [
      {
        text: 'Return to the beginning with Scroll to the top.',
        find: 'Click or Double Click to scroll to the top',
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-bible-line-breaks',
    label: 'Toggle natural Bible line breaks',
    detail: "Choose whether the passage follows the Bible's own line breaks.",
    title: 'Toggle natural Bible line breaks',
    steps: [
      {
        text: 'Toggle Should New Lines in the hidden passage footer.',
        find: 'Should New Lines — break lines following bible info',
        translateFind: 'Should New Lines',
        translateSuffix: ' — break lines following bible info',
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-model-line-breaks',
    label: 'Toggle model-based line breaks',
    detail: 'Choose whether supported Bibles use their formatting model.',
    title: 'Toggle model-based line breaks',
    steps: [
      {
        text: 'Toggle Break lines following model formatting in the hidden passage footer.',
        find: 'Break lines following model formatting',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-cross-references',
    label: 'Open cross references',
    detail: 'See other verses connected to the passage you are reading.',
    title: 'Open cross references',
    steps: [
      {
        text: 'Open the study panel with Advance Bible Lookup.',
        find: 'Advance Bible Lookup',
        translateFind: true,
        action: 'click',
        skipIfVisible: 'Bible Online Lookup',
      },
      {
        text: 'Choose Cross Reference in the Bible Online Lookup picker.',
        find: 'Bible Online Lookup',
        translateFind: true,
        action: 'type',
        value: 'Cross Reference',
        translateValue: true,
      },
    ],
  },
  {
    id: 'reader-people-in-passage',
    label: 'See people and places in this passage',
    detail: 'Open the names and locations found in what you are reading.',
    title: 'See people and places in this passage',
    steps: [
      {
        text: 'Open the study panel with Advance Bible Lookup.',
        find: 'Advance Bible Lookup',
        translateFind: true,
        action: 'click',
        skipIfVisible: 'Bible Online Lookup',
      },
      {
        text: 'Choose Location-Name (KJV) in the Bible Online Lookup picker.',
        find: 'Bible Online Lookup',
        translateFind: true,
        action: 'type',
        value: 'Location-Name (KJV)',
        translateValue: true,
      },
    ],
  },
  {
    id: 'reader-resources',
    label: 'Open passage resources',
    detail: 'Show study resources for the passage beside the Bible.',
    title: 'Open passage resources',
    steps: [
      {
        text: 'Open the study panel with Advance Bible Lookup.',
        find: 'Advance Bible Lookup',
        translateFind: true,
        action: 'click',
        skipIfVisible: 'Bible Online Lookup',
      },
      {
        text: 'Choose Resources in the Bible Online Lookup picker.',
        find: 'Bible Online Lookup',
        translateFind: true,
        action: 'type',
        value: 'Resources',
        translateValue: true,
      },
    ],
  },
  {
    id: 'reader-filter-books',
    label: 'Search only selected Bible books',
    detail: 'Open the book filter used by Bible Find.',
    title: 'Search only selected Bible books',
    steps: [
      {
        text: 'Open the study panel with Advance Bible Lookup.',
        find: 'Advance Bible Lookup',
        translateFind: true,
        action: 'click',
        skipIfVisible: 'Bible Online Lookup',
      },
      {
        text: 'Choose Find in the Bible Online Lookup picker.',
        find: 'Bible Online Lookup',
        translateFind: true,
        action: 'type',
        value: 'Find',
        translateValue: true,
      },
      {
        text: 'Open All Books and choose where to search.',
        find: 'All Books',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-bible-notes-panel',
    label: 'Show or hide Bibles and Bible Notes',
    detail: 'Toggle the side panel that keeps saved passages and notes.',
    title: 'Show or hide Bibles and Bible Notes',
    isFeatured: false,
    steps: [
      {
        text: 'Open View > Widgets, then check or uncheck Bible and Notes. The open pane itself is not a toggle.',
      },
    ],
  },
  {
    id: 'reader-bibles-section',
    label: 'Show or hide saved Bibles',
    detail: 'Use View > Widgets to show or hide only the saved Bibles section.',
    title: 'Show or hide saved Bibles',
    isFeatured: false,
    steps: [
      {
        text: 'Open View > Widgets, then check or uncheck Bibles. The open pane itself is not a toggle.',
      },
    ],
  },
  {
    id: 'reader-notes-section',
    label: 'Show or hide Bible Notes',
    detail: 'Use View > Widgets to show or hide only the Bible Notes section.',
    title: 'Show or hide Bible Notes',
    isFeatured: false,
    steps: [
      {
        text: 'Open View > Widgets, then check or uncheck Bible Notes. The open pane itself is not a toggle.',
      },
    ],
  },
  {
    id: 'reader-filter-notes',
    label: 'Filter Bible Notes by name',
    detail: 'Focus Filter by name, then type part of the note you need.',
    title: 'Filter Bible Notes by name',
    steps: [
      {
        text: 'Click Filter by name, then type part of a note or note-file name.',
        find: 'Filter by name',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-sort-notes',
    label: 'Choose how Bible Notes are sorted',
    detail: 'Open Sort and choose one of the available list orders.',
    title: 'Choose how Bible Notes are sorted',
    steps: [
      {
        text: 'Open the available list orders with Sort.',
        find: 'Sort',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-type-reference',
    label: 'Type a complete Bible reference',
    detail: 'Enter a reference such as John 3:16 and open it directly.',
    title: 'Type a complete Bible reference',
    steps: [
      {
        text: 'Select Bible Reference, type a complete reference such as John 3:16, then choose the matching verse.',
        find: 'Bible Reference',
        translateFind: true,
        action: 'type',
        value: 'John 3:16',
      },
    ],
  },
  {
    id: 'reader-reference-shortcuts',
    label: 'Use the reference box shortcuts',
    detail:
      'Tab completes a choice, Escape removes one part, and Ctrl+Escape clears all.',
    title: 'Use the reference box shortcuts',
    isFeatured: false,
    steps: [
      {
        text: 'In Bible Reference, press Tab to complete the current book, chapter, or verse choice.',
      },
      {
        text: 'Press Escape to remove the last part of the reference, or Ctrl+Escape to clear the whole reference.',
      },
    ],
  },
  {
    id: 'reader-history-chips',
    label: 'Reuse and arrange passage history',
    detail:
      'Open, split, drag, save, or remove references from the history row.',
    title: 'Reuse and arrange passage history',
    isFeatured: false,
    steps: [
      {
        text: 'Double-click a passage in the history row to reopen it; Shift+double-click opens it in a split pane.',
      },
      {
        text: 'Drag a history passage into a reading pane, use its More Options menu to open or save it, or use Remove to clear that chip.',
      },
    ],
  },
  {
    id: 'reader-version-info',
    label: 'Change version and read Bible information',
    detail:
      'Choose a translation, then open its publisher, language, and copyright details.',
    title: 'Change version and read Bible information',
    isFeatured: false,
    steps: [
      {
        text: 'Use the Bible abbreviation beside Bible Reference to choose another installed translation.',
      },
      {
        text: 'Use Bible Information beside a passage to read its title, publisher, language, copyright, and available links.',
      },
    ],
  },
  {
    id: 'reader-verse-ranges',
    label: 'Choose one verse or a verse range',
    detail:
      'Use verse numbers to select a start, an end, or all verses in the chapter.',
    title: 'Choose one verse or a verse range',
    isFeatured: false,
    steps: [
      {
        text: 'Choose a verse number once for the start; choose another number to make a range.',
      },
      {
        text: 'Use the all-verses choice when you want to read the complete chapter.',
      },
    ],
  },
  {
    id: 'reader-extra-passage-actions',
    label: 'Use dictionary and Word export',
    detail:
      'Look up selected words in Wiki Dictionary or export a passage to Microsoft Word.',
    title: 'Use dictionary and Word export',
    isFeatured: false,
    steps: [
      {
        text: 'Select a word in the passage, then use Wiki Dictionary to research it.',
      },
      {
        text: 'Right-click selected words to copy them or send them into Bible Find.',
      },
      {
        text: 'Use Export to MS Word when you want a document copy of the passage; you will choose where to save it.',
      },
    ],
  },
  {
    id: 'reader-ai-audio',
    label: 'Use Bible audio and AI reading controls',
    detail:
      'Enable automatic AI audio, play verse audio, repeat it, or refresh the source.',
    title: 'Use Bible audio and AI reading controls',
    steps: [
      {
        text: 'Use Auto Play Audio AI when available to control automatic reading for supported passages.',
        find: 'Auto Play Audio AI when available',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'When audio is available, use the passage audio player to play, repeat, or refresh it.',
      },
    ],
  },
  {
    id: 'reader-edit-arrange-passages',
    label: 'Edit and arrange reading panes',
    detail:
      'Rename, recolor, drag, split, replace, or close the passages in your workspace.',
    title: 'Edit and arrange reading panes',
    isFeatured: false,
    steps: [
      {
        text: 'Use a passage header or its More Options menu to edit its title, choose a color note, split it, or close it.',
      },
      {
        text: 'Drag a passage header onto another pane to replace or split that pane; matching color notes keep panes aligned while scrolling.',
      },
    ],
  },
  {
    id: 'reader-find-results',
    label: 'Master Bible Find results',
    detail:
      'Change version, use suggestions and book filters, page through hits, then open or save one.',
    title: 'Master Bible Find results',
    isFeatured: false,
    steps: [
      {
        text: 'In Find, choose the Bible version and use a suggested phrase or your own search words.',
      },
      {
        text: 'Use All Books to narrow the search, page through result groups, then select a result to open or save it.',
      },
    ],
  },
  {
    id: 'reader-name-details',
    label: 'Explore people and place details',
    detail:
      'Filter records, follow references, open verses or maps, copy details, and change data language.',
    title: 'Explore people and place details',
    isFeatured: false,
    steps: [
      {
        text: 'In Location-Name, search or filter people and places, then select a record to open its detail panel.',
      },
      {
        text: 'Use the panel sections to follow related records, open a verse, view a map, copy details, or change the names-data language.',
      },
    ],
  },
  {
    id: 'reader-graph-explore',
    label: 'Explore the connection graph',
    detail:
      'Open a graph from a record, expand relations, filter, drag, pan, zoom, and find connections.',
    title: 'Explore the connection graph',
    isFeatured: false,
    steps: [
      {
        text: 'Open a person or place record and choose Open Graph Preview.',
      },
      {
        text: 'Expand a relation, use filters or connection finding, and drag, pan, or zoom the graph to explore it.',
      },
    ],
  },
  {
    id: 'reader-graph-manage',
    label: 'Organize and share a connection graph',
    detail:
      'Re-layout, undo, set a centre or root, then copy, save, print, or open the drawn view.',
    title: 'Organize and share a connection graph',
    isFeatured: false,
    steps: [
      {
        text: 'Use a graph box menu to set it as the centre or root; use Undo, Redo, or re-layout to organize the drawing.',
      },
      {
        text: 'Use the graph actions to copy it as text, save it, print it, choose a preset, or open the drawn view.',
      },
    ],
  },
  {
    id: 'reader-resource-organize',
    label: 'Organize passage resources by filename',
    detail:
      'Name files by book and chapter so they appear beside the right passage.',
    title: 'Organize passage resources by filename',
    isFeatured: false,
    steps: [
      {
        text: 'Name a chapter file BOOK.CHAPTER.anything, such as PSA.1.outline.pdf, to show it beside that chapter.',
      },
      {
        text: 'Use BOOK.0.anything for a whole-book introduction; files with no chapter appear under Others.',
      },
    ],
  },
  {
    id: 'reader-resource-file-actions',
    label: 'Build and use your Resources library',
    detail:
      'Add or drop folders, search and reload them, open files, add files, or copy them into app data.',
    title: 'Build and use your Resources library',
    isFeatured: false,
    steps: [
      {
        text: 'In Resources, use Add Folder or drop a folder into the panel; use Reload or Refresh after files change.',
      },
      {
        text: 'Search filenames, open or reveal a file, add files to a folder, or use Copy to Data Directory when the library should travel with the app.',
      },
      {
        text: 'JSON link lists open their links, Markdown opens in Preview, and Bible note files open read-only.',
      },
    ],
  },
  {
    id: 'reader-verse-marks',
    label: 'Highlight and comment on Bible text',
    detail:
      'Select words in one verse to highlight, recolor, remove marks, or attach a comment.',
    title: 'Highlight and comment on Bible text',
    isFeatured: false,
    steps: [
      {
        text: 'Drag across words inside one verse; the selection toolbar lets you highlight them or add a comment.',
      },
      {
        text: 'Select marked text to recolor or remove its marks; hover a commented phrase to edit or delete the comment.',
      },
    ],
  },
  {
    id: 'reader-note-actions',
    label: 'Work with marked verses in Bible Notes',
    detail:
      'Open, recolor, edit, move, drag, add to Bibles, or delete a marked verse.',
    title: 'Work with marked verses in Bible Notes',
    isFeatured: false,
    steps: [
      {
        text: 'Open Bible Notes and select a marked verse to reopen it in the Reader.',
      },
      {
        text: 'Use More Options on a mark or verse row to recolor, edit, move, add to a Bible list, or delete it; rows can also be dragged between notes or into Bibles.',
      },
    ],
  },
  {
    id: 'reader-header-tools',
    label: 'Use the Reader header tools',
    detail:
      'Return to Presenter or open Settings, App Assistant, AI Chat, and Help.',
    title: 'Use the Reader header tools',
    isFeatured: false,
    steps: [
      {
        text: 'At the right of Bible Reference, use Go Back to Presenter, Settings, App Assistant, AI Chat, or Help.',
      },
    ],
  },
  {
    id: 'reader-open-settings',
    label: 'Open Reader Settings',
    detail:
      'Open Settings from the Reader header without leaving your passage.',
    title: 'Open Reader Settings',
    steps: [
      {
        text: 'Open the app settings with Setting in the Reader header.',
        find: 'Setting',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'reader-open-help',
    label: 'Open Reader Help',
    detail: 'Open Help for tips, updates, and information about the app.',
    title: 'Open Reader Help',
    steps: [
      {
        text: 'Open the help choices with Help in the Reader header.',
        find: 'Help',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  ...genAppMenuDemos('reader'),
  {
    id: 'reader-view-reload',
    label: 'Reload or force-reload the Reader',
    detail:
      'Use Reload for a normal refresh; use Force Reload only to bypass cached app files.',
    title: 'Reload or force-reload the Reader',
    isFeatured: false,
    steps: [
      { text: 'View > Reload (Ctrl+R) refreshes this window normally.' },
      {
        text: 'View > Force Reload (Ctrl+Shift+R) bypasses cached app files and is mainly for troubleshooting.',
      },
    ],
  },
  {
    id: 'reader-view-relaunch',
    label: 'Restart the whole app with Relaunch',
    detail:
      'Use View > Relaunch when every app window needs a clean restart; the app asks first.',
    title: 'Restart the whole app with Relaunch',
    isFeatured: false,
    steps: [
      {
        text: 'View > Relaunch restarts the whole Open Worship app, not just the Reader. A confirmation protects against an accidental click.',
      },
    ],
  },
  {
    id: 'reader-view-devtools',
    label: 'Open Developer Tools for diagnostics',
    detail:
      'Use View > Toggle Developer Tools only when troubleshooting or collecting technical details.',
    title: 'Open Developer Tools for diagnostics',
    isFeatured: false,
    steps: [
      {
        text: 'View > Toggle Developer Tools (Ctrl+Shift+I) opens Chromium diagnostics. It is an advanced troubleshooting tool, not a reading control.',
      },
    ],
  },
  {
    id: 'reader-view-zoom',
    label: 'Zoom the whole Reader interface',
    detail:
      'Use Actual Size, Zoom In, or Zoom Out for the whole window; Font Size changes Bible text only.',
    title: 'Zoom the whole Reader interface',
    isFeatured: false,
    steps: [
      {
        text: 'View > Zoom In (Ctrl++), Zoom Out (Ctrl+-), and Actual Size (Ctrl+0) scale the whole Reader interface.',
      },
      {
        text: 'Use the Reader footer Font Size control instead when only the Bible words should change.',
      },
    ],
  },
  {
    id: 'reader-view-fullscreen',
    label: 'Make the whole app window full screen',
    detail:
      'Use View > Toggle Full Screen or F11; the passage Full button is the reading-only alternative.',
    title: 'Make the whole app window full screen',
    isFeatured: false,
    steps: [
      {
        text: 'View > Toggle Full Screen (F11) expands the entire app window.',
      },
      {
        text: 'Use Full at the bottom-right of the passage when you want only the reading area to fill the window.',
      },
    ],
  },
  {
    id: 'reader-view-widgets',
    label: 'Show or hide Reader panels from View',
    detail:
      'Use View > Widgets to check or uncheck Bible and Notes, Bibles, Bible Notes, Bible Lookup, and study panes.',
    title: 'Show or hide Reader panels from View',
    isFeatured: false,
    steps: [
      {
        text: 'Open View > Widgets. A checked item is open; choose it to collapse that panel, or choose an unchecked item to reopen it.',
      },
      {
        text: 'The Widgets list follows the current page, so the Reader menu names Reader panels only.',
      },
    ],
  },
  {
    id: 'reader-view-reset-widgets',
    label: 'Restore every Reader panel layout',
    detail:
      'Use View > Reset Widgets Size to restore defaults and reopen collapsed panels after confirmation.',
    title: 'Restore every Reader panel layout',
    isFeatured: false,
    steps: [
      {
        text: 'View > Reset Widgets Size asks for confirmation, then restores every panel to its default size and reopens collapsed panels.',
      },
    ],
  },
];

export const READER_DEMO_IDS = READER_DEMO_LIST.map((demo) => demo.id);

/** A fresh localized copy, so callers can safely drop or decorate steps. */
export function getReaderDemo(id, translate = (value) => value) {
  const source = READER_DEMO_LIST.find((demo) => demo.id === id);
  if (source === undefined) {
    return null;
  }
  return {
    ...source,
    steps: source.steps.map((sourceStep) => {
      const {
        translateFind,
        translateFinds,
        translateSuffix = '',
        translateValue,
        ...step
      } = sourceStep;
      const finds = [
        ...(step.finds ?? (typeof step.find === 'string' ? [step.find] : [])),
      ];
      if (translateFind) {
        const key = translateFind === true ? step.find : translateFind;
        const translated = translate(key);
        if (translated !== key) {
          finds.push(`${translated}${translateSuffix}`);
        }
      }
      if (translateFinds === true) {
        for (const find of [...finds]) {
          const translated = translate(find);
          if (translated !== find) {
            finds.push(translated);
          }
        }
      }
      return {
        ...step,
        ...(translateValue === true ? { value: translate(step.value) } : {}),
        ...(finds.length === 0
          ? {}
          : { finds: [...new Set(finds.filter(Boolean))] }),
      };
    }),
  };
}
