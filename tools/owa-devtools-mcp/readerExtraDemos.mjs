// Reader-only lessons for controls omitted by the original overview catalog.
// Shared by Tips and MCP; no I/O, model calls, fixtures or application imports.
// File choices, destructive actions and audience output stay with the person.
function lesson(id, category, label, detail, steps) {
  return {
    id: `reader-${id}`,
    category,
    label,
    title: label,
    detail,
    isFeatured: false,
    steps: steps.map((step) =>
      typeof step === 'string' ? { text: step } : step,
    ),
  };
}

function click(find, text) {
  return { find, text, translateFind: true, action: 'click' };
}

function study(view) {
  return [
    {
      ...click('Advance Bible Lookup', 'Open the study sidebar.'),
      skipIfVisible: 'Bible Online Lookup',
    },
    {
      text: `Choose ${view} in Bible Online Lookup.`,
      find: 'Bible Online Lookup',
      translateFind: true,
      action: 'type',
      value: view,
      translateValue: true,
    },
  ];
}

const reading = 'Reading and layout';
const notes = 'Notes and marks';
const research = 'Study tools';

export const READER_EXTRA_DEMO_LIST = [
  lesson(
    'practice-tips',
    'Reader shortcuts',
    'Find and replay Reader demos',
    'Use Help > All tips, search a task, then choose Show it to practise one step at a time.',
    [
      'Open Help > All tips in the Reader. Search for a control such as Copy Text, New File, Resources, or Find Connection.',
      'Choose a tip and press Show it. Do it performs one named action; Next explains a step you do yourself. Back revisits a step and the close button ends the lesson.',
      'If a panel is hidden, reopen it from View > Widgets. File and record lessons use your own choice; native menus and destructive or audience actions are explained for you to perform.',
    ],
  ),
  ...[
    [
      'copy-title',
      'Copy only the passage reference',
      'Use Copy Title when you need a reference for an outline without the verse text.',
      'Copy Title',
    ],
    [
      'copy-text',
      'Copy only the Bible words',
      'Use Copy Text to paste the passage into your study notes without its title.',
      'Copy Text',
    ],
    [
      'copy-all',
      'Copy the reference and Bible words',
      'Use Copy All to keep the passage reference with the text you paste.',
      'Copy All',
    ],
    [
      'copy-verse-key',
      'Copy a verse key for study files',
      'Use Copy Verse Full Key for a stable book, chapter and verse identifier.',
      'Copy Verse Full Key',
    ],
    [
      'copy-chapter-key',
      'Copy a chapter key for Resources',
      'Use Copy Chapter Full Key as the starting point for a chapter resource filename.',
      'Copy Chapter Full Key',
    ],
  ].map(([id, label, detail, command]) =>
    lesson(id, reading, label, detail, [
      click(
        'Lookup > Copy',
        'With a passage open, open Copy above the current passage.',
      ),
      click(
        command,
        `Choose ${command} to put this passage's information on the clipboard.`,
      ),
      'Paste into your own notes or filename box when you are ready. The demo leaves the clipboard ready for you.',
    ]),
  ),
  lesson(
    'bible-information',
    'Getting started',
    'Read the installed Bible information',
    'Clear the reference, then open Bible Information to check the translation and publisher.',
    [
      click('Clear input', 'Clear the reference to display the book picker.'),
      click(
        'Bible Information',
        'Open Bible Information beside the book picker.',
      ),
      'Read the information supplied by this Bible, then close the popup. Use passage history to return to your reading.',
    ],
  ),
  lesson(
    'scroll-speed',
    reading,
    'Adjust or stop automatic scrolling',
    'Double-click the bottom chevron to speed up, right-click to slow down, or Alt+right-click to stop.',
    [
      'Move over the lower-right corner of the passage to reveal the scrolling chevrons. Click the downward chevron to start.',
      'Double-click that same chevron to speed up, right-click it to slow down, and Alt+right-click it to stop. Use the upward chevron to return to the top.',
    ],
  ),
  lesson(
    'remove-extra-version',
    reading,
    'Remove an extra Bible version',
    'Use the remove icon beside an extra version when you want one translation again.',
    [
      'In a passage with extra translations, find the remove icon beside the extra Bible abbreviation. Its tooltip starts with Click to remove extra Bible.',
      'Press it yourself to remove that extra translation from this passage. Add Extra Bible brings another version back.',
    ],
  ),
  lesson(
    'sync-panes',
    reading,
    'Keep reading panes scrolling together',
    'Give passages the same color note to follow corresponding verses as you scroll.',
    [
      'Open two passages or split a passage. Use the color circle in each passage header and choose the same color note for both.',
      'Scroll one passage by hand and watch the matching verse in the other. Choose different color notes to read independently.',
    ],
  ),
  lesson(
    'split-translation',
    reading,
    'Split directly into another translation',
    'Use Split Horizontal to or Split Vertical to from a passage menu, then choose a Bible.',
    [
      'Right-click the passage you want to compare. Choose Split Horizontal to for side-by-side panes, or Split Vertical to for stacked panes.',
      'Choose an installed Bible from the next menu. Keep both passages visible while comparing their wording.',
    ],
  ),
  lesson(
    'model-info',
    reading,
    'Choose the Bible formatting model',
    'Use Change Bible Model Info in the footer; choosing a different model reloads the Reader.',
    [
      'Reveal the bottom passage footer with its three-dot button and find Change Bible Model Info beside the line-break controls.',
      'Open it to see the available models. Selecting a model reloads this window, so make that choice yourself when ready.',
    ],
  ),
  lesson(
    'bibles-folder',
    notes,
    'Find the Reader saved-passage folder',
    'Use Show path editor in Bibles to inspect the folder used for Reader passage lists.',
    [
      click(
        'Bibles > Show path editor',
        'Toggle Show path editor in the Bibles panel.',
      ),
      'The path belongs to the Reader Bibles list. Use the folder controls yourself to choose another location; the Presenter keeps a separate passage list.',
    ],
  ),
  lesson(
    'bibles-new-list',
    notes,
    'Create a saved Bible list',
    'Open Bibles > More Options > New File to keep passages for a study in their own list.',
    [
      click(
        'Bibles > More Options',
        'Open More Options in the Bibles panel header.',
      ),
      'Choose New File, enter your list name, and confirm it yourself. Save bible item above a passage lets you choose the list to receive it.',
    ],
  ),
  lesson(
    'bibles-open-saved',
    notes,
    'Reopen a saved passage in the Reader',
    'Expand a Bibles list, then double-click a passage; hold Shift to open it beside the current passage.',
    [
      'Click a Bibles list heading to expand its saved passages. Double-click the passage you want, or choose Open in its More Options menu.',
      'Hold Shift while opening a passage to put it beside the current reading. A saved row can also be dragged into a reading pane.',
    ],
  ),
  lesson(
    'bibles-organize',
    notes,
    'Arrange saved Bible passages',
    'Use a passage row menu for Duplicate, Move To, Move up or Move down, and its color circle to group it.',
    [
      'On a saved passage row, open More Options. Duplicate makes another entry, Move To chooses another list, and Move up or Move down changes its order.',
      'Use the row color circle to group passages and the Bible abbreviation to change that saved passage translation. Delete removes the chosen row, so select it yourself only when intended.',
    ],
  ),
  lesson(
    'bibles-share',
    notes,
    'Import or export a Bible list',
    'Export from a list file menu; Import or Import From URL from the Bibles panel menu.',
    [
      click(
        'Bibles > More Options',
        'Open the Bibles panel menu to find Import and Import From URL.',
      ),
      'Choose an archive file or its address yourself, or drop an exported Bible archive onto Bibles. To share a list, use Export on that list file, then choose the archive options.',
      'The list file menu also offers Copy All Items and Export to MS Word when it has passages. Choose the format that suits your study notes.',
    ],
  ),
  lesson(
    'bibles-file-actions',
    notes,
    'Manage saved Bible list files',
    'Right-click a list file for Rename, Duplicate, Reload, Copy Path to Clipboard and file location.',
    [
      'Use More Options on the list file itself, below the Bibles panel header, to rename, duplicate, reload, copy its path, or reveal its location.',
      'Move All Items To relocates its passages to another list. Empty clears its entries; Move to Trash removes the file. Those choices and confirmations are yours to make.',
    ],
  ),
  lesson(
    'notes-folder',
    notes,
    'Find the Bible Notes folder',
    'Use Show path editor in Bible Notes when you need to locate or choose your note library.',
    [
      click(
        'Bible Notes > Show path editor',
        'Toggle Show path editor in the Bible Notes panel.',
      ),
      'Inspect the current folder. If choosing another library, use the folder controls yourself and return here to see the files in that location.',
    ],
  ),
  lesson(
    'notes-new-file',
    notes,
    'Create a Bible Notes file',
    'Use Bible Notes > More Options > New File to group notes for a topic or study.',
    [
      click(
        'Bible Notes > More Options',
        'Open More Options in the Bible Notes panel header.',
      ),
      'Choose New File, enter a name, and confirm it yourself. Expand the new file to start collecting note items.',
    ],
  ),
  lesson(
    'notes-new-item',
    notes,
    'Add a note to the right file',
    'Expand your chosen Bible Notes file and press its New Note Item plus button.',
    [
      'Expand the note file you want in Bible Notes. Press New Note Item on that file heading to create a note there.',
      'Double-click the new note or use its Open BibleNote button when you want to write. The note editor opens separately; this Reader lesson ends at that doorway.',
    ],
  ),
  lesson(
    'notes-organize',
    notes,
    'Arrange and move Bible note items',
    'Use a note row menu to Duplicate, Move To, Move up or Move down; drag between note files.',
    [
      'Open More Options on a note item. Choose Duplicate for a copy, Move To for another note file, or Move up and Move down to reorder it.',
      'Drag a note item to another note file to move it, or use its color circle to mark it. Delete and Discard Change are personal decisions; the demo will not run them.',
    ],
  ),
  lesson(
    'notes-share',
    notes,
    'Import and export Bible notes',
    'Import note files from the panel menu, import an item into a file, or Export the file or item you need.',
    [
      click(
        'Bible Notes > More Options',
        'Open the Bible Notes panel menu to find the note-file import choices.',
      ),
      'Import in the panel menu brings in a note-file archive. Import on a particular note file brings an exported note item into that file.',
      'Use Export on a note file or note item to share that scope. Select the destination and archive options yourself.',
    ],
  ),
  lesson(
    'notes-file-actions',
    notes,
    'Manage Bible Notes files',
    'Use a note file menu for Rename, Duplicate, Reload, Copy All Items and Move All Items To.',
    [
      'Right-click the note file heading, or use its More Options, to rename, duplicate, reload, reveal the file, or copy its path.',
      'Copy All Items copies the file contents; Move All Items To chooses a different note file. Empty and Move to Trash are destructive choices that you make yourself.',
    ],
  ),
  lesson(
    'search-selection',
    research,
    'Search for words selected in a verse',
    'Select Bible words, right-click them, then choose Search in Bible Search.',
    [
      'Drag across the words you want to study inside the passage, then right-click the selection.',
      'Choose Search in Bible Search to open Find with those words. Review the Bible version and All Books filter before interpreting the results.',
    ],
  ),
  lesson(
    'cross-reference-verse',
    research,
    'Choose the verse for cross references',
    'Open Cross Reference, then select a verse to follow its related passages.',
    [
      ...study('Cross Reference'),
      'Click the verse you want to study in the reading pane. Cross Reference follows that verse; choose a related entry to read its passage.',
    ],
  ),
  lesson(
    'names-filter',
    research,
    'Filter the people and places lookup',
    'Switch Names or Locations, search the list, and use Filter by name type for people.',
    [
      {
        ...click(
          'Names and locations lookup',
          'Open Names and locations lookup beside Bible Reference.',
        ),
        skipIfVisible: 'Filter by name type',
      },
      'Choose Names or Locations. Type into Search names or Search locations, then choose a result to open its details.',
      'In Names, use Filter by name type to narrow the records. Clear search restores the list; the type filter does not apply to Locations.',
    ],
  ),
  lesson(
    'location-map',
    research,
    'Read a place and open its map',
    'Choose Locations in the names lookup, open a place, then use Open in Google Maps if available.',
    [
      {
        ...click(
          'Names and locations lookup',
          'Open the names and locations lookup.',
        ),
        skipIfVisible: 'Filter by name type',
      },
      'Choose Locations and find a place. Open its detail panel to read related locations and references.',
      'When coordinates are available, Open in Google Maps opens your browser. Treat the marker as an approximate location; the demo leaves external links to you.',
    ],
  ),
  lesson(
    'resources-search',
    research,
    'Find a resource by filename',
    'In Resources, use Search file name to narrow the files; clear the words when finished.',
    [
      ...study('Resources'),
      'Press Search file name if its box is hidden, then type part of a filename. Clear your search words to return to the normal chapter resources.',
    ],
  ),
  lesson(
    'resources-others',
    research,
    'Show resources without chapter names',
    'Toggle Others in Resources to include files that do not use a book and chapter filename.',
    [
      ...study('Resources'),
      click(
        'Show files not named after a book and chapter',
        'Toggle Others to show or hide files without book and chapter names.',
      ),
      'Expand Others inside a folder to find those files. Chapter files still follow the passages you have open.',
    ],
  ),
  lesson(
    'resources-refresh',
    research,
    'Refresh or extend the Resources library',
    'Use the Resources menu for Add Folder or Reload, and a folder menu for Refresh or Add Files.',
    [
      ...study('Resources'),
      click(
        'Bible Online Lookup > More Options',
        'Open More Options at the top of Resources.',
      ),
      'Reload rescans the library; Add Folder chooses another folder. On an individual folder, Refresh rescans that folder and Add Files copies chosen files into it.',
    ],
  ),
  lesson(
    'resources-portable',
    research,
    'Keep study resources with app data',
    'Use a resource folder menu > Copy to Data Directory to make a portable library copy.',
    [
      ...study('Resources'),
      'Open More Options on the resource folder you want to keep, then choose Copy to Data Directory when offered.',
      'Review the confirmation yourself: it copies the folder into app data and lists that copy instead. Remove Folder removes a library entry, not the source folder on disk.',
    ],
  ),
  lesson(
    'graph-filters',
    research,
    'Show one kind of graph relationship',
    'In an open graph, toggle relation chips or right-click a chip to show only that relationship.',
    [
      'Open a person or place record, then Open Graph Preview. Use the relation chips across the graph toolbar to show or hide categories.',
      'Right-click one chip to show only that relation; right-click it again to restore the others. Expand a node to choose which relatives or places to add.',
    ],
  ),
  lesson(
    'graph-path',
    research,
    'Find a connection between Bible records',
    'Open Graph Preview, press Find Connection, choose Path to, then run the search.',
    [
      'From a person or place record, open Graph Preview. Press Find Connection in the graph toolbar to reveal its path bar.',
      'Choose the destination under Path to, then press Find Connection in that bar. The graph reports when no connection is found.',
      'To start from another node, right-click it and choose Use as root, then search again.',
    ],
  ),
  lesson(
    'graph-layout',
    research,
    'Fit and rearrange a connection graph',
    'Use Fit to view, Re-layout, Zoom, Collapse all, Undo and Redo inside the graph.',
    [
      'With a graph open, use Fit to view after expanding nodes. Drag a box to move it, drag empty space to pan, and use Zoom to inspect it.',
      'Re-layout arranges the boxes again. Collapse all and Expand all change their detail; Undo and Redo in the graph reverse or restore graph changes.',
      'A node menu offers Set as centre, Use as root, Open detail, Verses and Remove. Remove takes a node from this drawing, not from the Bible data.',
    ],
  ),
  lesson(
    'graph-copy',
    research,
    'Copy or export a connection graph',
    'Use the graph Copy menu for Markdown or diagram text; Presets also offers Save as image and Print.',
    [
      'Open a graph, then use its Copy menu. Choose Markdown for written study notes or a diagram format for a diagram editor.',
      'The Copy menu also offers Open in mermaid.live. That opens an external site only when you choose it yourself.',
      'Use Presets > Save as image or Print when you need the drawing. Select the destination or print options yourself.',
    ],
  ),
  lesson(
    'graph-presets',
    research,
    'Save and revisit a graph preset',
    'Use Presets > Save preset to name your graph, then pick it from Presets later.',
    [
      'Arrange a graph, open Presets, and choose Save preset. Enter your own name and confirm it yourself.',
      'Open Presets again to choose a saved arrangement. Delete preset removes a saved arrangement only after your confirmation.',
    ],
  ),
  lesson(
    'divider-menu',
    reading,
    'Resize or close one Reader panel',
    'Drag a panel divider, or right-click it for Reset Size, Close First Widget and Close Second Widget.',
    [
      'Drag the divider between Bibles and Bible Notes, or between the left sidebar and Bible Lookup, to give a panel more room.',
      'Right-click that divider for Reset Size, Close First Widget, and Close Second Widget. View > Widgets reopens a panel you closed.',
    ],
  ),
];
