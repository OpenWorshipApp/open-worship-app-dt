// Small, deterministic Presenter lessons for Tips of the Day. These only
// reveal app controls; they never change the content shown to the congregation.

export const PRESENTER_DEMO_LIST = [
  {
    id: 'presenter-bible-lookup',
    label: 'Look up a Bible passage',
    detail: 'Open Bible Lookup without leaving the Presenter.',
    title: 'Look up a Bible passage',
    steps: [
      {
        text: 'Open Bible Lookup from the top of the Presenter.',
        find: 'Bible Lookup',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-document-list',
    label: 'Show or hide the Document List',
    detail: 'Toggle the panel that holds your slide documents.',
    title: 'Show or hide the Document List',
    steps: [
      {
        text: 'Toggle the Document List panel.',
        find: 'Document List',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-flow-list',
    label: 'Show or hide the Presenting Flow List',
    detail: 'Toggle the panel used to build and follow a service order.',
    title: 'Show or hide the Presenting Flow List',
    steps: [
      {
        text: 'Toggle the Presenting Flow List panel.',
        find: 'Presenting Flow List',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-bible-notes',
    label: 'Show or hide Bibles and Bible Notes',
    detail: 'Toggle the panel for saved passages and notes.',
    title: 'Show or hide Bibles and Bible Notes',
    steps: [
      {
        text: 'Toggle the Bible and Notes panel.',
        find: 'Bible and Notes',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-mini-screen',
    label: 'Show or hide the Mini Screen',
    detail: 'Toggle the panel that previews and controls audience screens.',
    title: 'Show or hide the Mini Screen',
    steps: [
      {
        text: 'Toggle the Mini Screen panel.',
        find: 'Mini Screen',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-full-view',
    label: 'Give the Presenter more room',
    detail: 'Switch the Presenter between normal and full view.',
    title: 'Give the Presenter more room',
    steps: [
      {
        text: 'Toggle the Presenter full view.',
        find: 'Full view',
        finds: ['Full view', 'Exit full view'],
        translateFinds: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-slide-editor-window',
    label: 'Open Slide Editor in its own window',
    detail: 'Keep the Presenter visible while editing the selected document.',
    title: 'Open Slide Editor in its own window',
    steps: [
      {
        text: 'Open Slide Editor in a new window from the top-left of the Presenter.',
        find: 'Open Slide Editor in a new window',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-reader-window',
    label: 'Open Bible Reader in its own window',
    detail: 'Read or study without replacing the Presenter page.',
    title: 'Open Bible Reader in its own window',
    steps: [
      {
        text: 'Open Bible Reader in a new window from the top-left of the Presenter.',
        find: 'Open Bible Reader in a new window',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-settings',
    label: 'Open app Settings',
    detail: 'Change language, theme, folders, screens, and other app options.',
    title: 'Open app Settings',
    steps: [
      {
        text: 'Open Settings from the top-right of the Presenter.',
        find: 'Setting',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-help-menu',
    label: 'Open the Help menu',
    detail: 'Find app help, tips, updates, and information about the app.',
    title: 'Open the Help menu',
    steps: [
      {
        text: 'Open Help at the top-right of the Presenter.',
        find: 'Help',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-foreground-panel',
    label: 'Open foreground controls',
    detail: 'Reach countdowns, clocks, marquees, and quick text.',
    title: 'Open foreground controls',
    steps: [
      {
        text: 'Open Foreground above the slide previews.',
        find: 'Foreground',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-colors-tab',
    label: 'Open background colors',
    detail: 'Choose a solid color for the selected audience screens.',
    title: 'Open background colors',
    steps: [
      {
        text: 'Open Colors in the Background panel.',
        find: 'Colors',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-images-tab',
    label: 'Open background images',
    detail: 'Browse still pictures available for screen backgrounds.',
    title: 'Open background images',
    steps: [
      {
        text: 'Open Images in the Background panel.',
        find: 'Images',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-videos-tab',
    label: 'Open background videos',
    detail: 'Browse and control moving backgrounds.',
    title: 'Open background videos',
    steps: [
      {
        text: 'Open Videos in the Background panel.',
        find: 'Videos',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-cameras-tab',
    label: 'Open camera backgrounds',
    detail: 'Choose a connected camera as a live background source.',
    title: 'Open camera backgrounds',
    steps: [
      {
        text: 'Open Cameras in the Background panel.',
        find: 'Cameras',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-webs-tab',
    label: 'Open website backgrounds',
    detail: 'Browse saved web pages used as screen backgrounds.',
    title: 'Open website backgrounds',
    steps: [
      {
        text: 'Open Webs in the Background panel.',
        find: 'Webs',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-audios-tab',
    label: 'Open the audio library',
    detail: 'Browse music and other audio used during a service.',
    title: 'Open the audio library',
    steps: [
      {
        text: 'Open Audios in the Background panel.',
        find: 'Audios',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-path-editor',
    label: 'Change the open document folder',
    detail: 'Show the folder path box above the Document List.',
    title: 'Change the open document folder',
    steps: [
      {
        text: 'Show the path editor at the top of the Document List.',
        find: 'Show path editor',
        finds: ['Document List > Show path editor', 'Show path editor'],
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-filter-documents',
    label: 'Find a document by name',
    detail: 'Filter a long Document List without moving or deleting anything.',
    title: 'Find a document by name',
    steps: [
      {
        text: 'Open Filter by name above the Document List.',
        find: 'Filter by name',
        finds: ['Document List > Filter by name', 'Filter by name'],
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-sort-documents',
    label: 'Sort the Document List',
    detail: 'Change how documents are ordered without changing their files.',
    title: 'Sort the Document List',
    steps: [
      {
        text: 'Open Sort above the Document List.',
        find: 'Sort',
        finds: ['Document List > Sort', 'Sort'],
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-filter-document-types',
    label: 'Filter documents by type',
    detail: 'Show only slides, lyrics, PDFs, or another document kind.',
    title: 'Filter documents by type',
    steps: [
      {
        text: 'Open Filter by Type above the Document List.',
        find: 'Filter by Type',
        finds: ['Document List > Filter by Type', 'Filter by Type'],
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-pin-document',
    label: 'Pin the selected document',
    detail: 'Keep presenting from one document while selecting another.',
    title: 'Pin the selected document',
    steps: [
      {
        text: 'Toggle Pin document above the slide previews.',
        find: 'Pin document',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-thumbnail-size',
    label: 'Make slide thumbnails larger',
    detail: 'Increase the preview size without changing audience output.',
    title: 'Make slide thumbnails larger',
    steps: [
      {
        text: 'Increase Slide Thumbnail Size above the preview footer.',
        find: 'Slide Thumbnail Size Scale',
        translateFind: true,
        action: 'type',
        value: '+10',
      },
    ],
  },
  {
    id: 'presenter-preview-width',
    label: 'Fit the selected document to width',
    detail: 'Toggle full-width document previews without changing the screen.',
    title: 'Fit the selected document to width',
    steps: [
      {
        text: 'Toggle Full Width or Not Full Width below the slide previews.',
        find: 'Full Width',
        finds: ['Full Width', 'Not Full Width'],
        translateFinds: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-present-slide',
    label: 'Present a slide from a document',
    detail:
      'Select a document, then send one of its slide cards to the audience.',
    title: 'Present a slide from a document',
    isFeatured: false,
    steps: [
      {
        text: 'Select a document in the Document List so its slide cards appear in the centre of the Presenter.',
        find: 'Documents',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Double-click the slide card you want to present. This lesson will not put anything on an audience screen for you.',
      },
    ],
  },
  {
    id: 'presenter-auto-play',
    label: 'Auto-play slides on a timer',
    detail:
      'Set a slide duration and let the selected document advance itself.',
    title: 'Auto-play slides on a timer',
    isFeatured: false,
    steps: [
      {
        text: "Open the selected document's More Options menu and choose its auto-play settings.",
        find: 'Documents',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Set the timing, then start auto-play only when the audience screens are ready.',
      },
    ],
  },
  {
    id: 'presenter-present-lyrics',
    label: 'Present song lyrics',
    detail: 'Choose a lyric document and present its generated stage slides.',
    title: 'Present song lyrics',
    isFeatured: false,
    steps: [
      {
        text: 'Select a lyric in the Document List and choose the stage whose slides you want to use.',
        find: 'Documents',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Double-click one generated lyric slide to present it. This lesson will not change the audience screen.',
      },
    ],
  },
  {
    id: 'presenter-present-bible',
    label: 'Look up and present a Bible verse',
    detail: 'Choose a passage, preview it, then send it to selected screens.',
    title: 'Look up and present a Bible verse',
    isFeatured: false,
    steps: [
      {
        text: 'Open Bible Lookup, choose the Bible version, and enter or select the reference.',
        find: 'Bible Lookup',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Use Show Bible Item when the reference and selected screens are correct. This lesson will not present it for you.',
      },
    ],
  },
  {
    id: 'presenter-style-bible',
    label: 'Style Bible text on screen',
    detail: 'Change the Bible layer font, size, colors, spacing, and layout.',
    title: 'Style Bible text on screen',
    isFeatured: false,
    steps: [
      {
        text: 'Open the Bible layer settings from the Mini Screen or Bible controls.',
        find: 'Mini Screen',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Adjust the text style while watching the Mini Screen preview before showing it to the audience.',
      },
    ],
  },
  {
    id: 'presenter-background-color',
    label: 'Use a solid background color',
    detail:
      'Choose a color and apply it only after checking the selected screens.',
    title: 'Use a solid background color',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Colors and choose the color you want.',
        find: 'Colors',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Check the selected screens before applying it. This lesson will not change the audience background.',
      },
    ],
  },
  {
    id: 'presenter-background-image',
    label: 'Use an image background',
    detail:
      'Choose a still picture and preview it before the audience sees it.',
    title: 'Use an image background',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Images and find the picture you want.',
        find: 'Images',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Preview the choice and confirm the selected screens before presenting it.',
      },
    ],
  },
  {
    id: 'presenter-background-video',
    label: 'Use a video background',
    detail: 'Choose a video, preview playback, and control it safely.',
    title: 'Use a video background',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Videos and choose a saved video.',
        find: 'Videos',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Use the preview and playback controls before sending it to an audience screen.',
      },
    ],
  },
  {
    id: 'presenter-background-camera',
    label: 'Use a camera background',
    detail: 'Choose a connected camera and check its live preview first.',
    title: 'Use a camera background',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Cameras and choose the connected camera.',
        find: 'Cameras',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Check the live preview and selected screens before showing the feed.',
      },
    ],
  },
  {
    id: 'presenter-background-web',
    label: 'Use a website background',
    detail: 'Create or choose a saved web item and preview its captured page.',
    title: 'Use a website background',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Webs and choose an existing web item, or create one in Slide Editor.',
        find: 'Webs',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Check the captured preview before sending it to an audience screen.',
      },
    ],
  },
  {
    id: 'presenter-play-audio',
    label: 'Play audio during a service',
    detail: 'Choose a saved audio file and use its playback controls.',
    title: 'Play audio during a service',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Audios and select the audio file you want.',
        find: 'Audios',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Use its play, pause, seek, and volume controls; stop it before changing service sections when needed.',
      },
    ],
  },
  {
    id: 'presenter-foreground-extras',
    label: 'Show a countdown, clock, or message',
    detail: 'Use Foreground for timers, marquees, and quick text overlays.',
    title: 'Show a countdown, clock, or message',
    isFeatured: false,
    steps: [
      {
        text: 'Open Foreground and choose Countdown, Stopwatch, Clock, Marquee, or Quick Text.',
        find: 'Foreground',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Set its words or time, check the selected screens, then start it when ready. This lesson will not start it for you.',
      },
    ],
  },
  {
    id: 'presenter-screen-controls',
    label: 'Control what the audience sees',
    detail: 'Use Mini Screen to show, hide, lock, or clear individual layers.',
    title: 'Control what the audience sees',
    isFeatured: false,
    steps: [
      {
        text: 'Open Mini Screen and check which screen card and layers currently hold content.',
        find: 'Mini Screen',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Use its show/hide, lock, display, and Clear buttons deliberately. This lesson will not change a live screen.',
      },
    ],
  },
  {
    id: 'presenter-multi-screen',
    label: 'Use more than one audience screen',
    detail:
      'Add screen cards, choose displays, and decide which screens receive content.',
    title: 'Use more than one audience screen',
    isFeatured: false,
    steps: [
      {
        text: 'Add or open another Mini Screen card and choose its physical display.',
        find: 'Mini Screen',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Tick only the screens that should receive the next slide, Bible passage, background, or foreground item.',
      },
    ],
  },
  {
    id: 'presenter-draw-spotlight',
    label: 'Draw or spotlight on the app',
    detail: 'Use Presenting Control for arrows, drawing, erasing, and focus.',
    title: 'Draw or spotlight on the app',
    isFeatured: false,
    steps: [
      {
        text: 'Open Tools > Start Controlling or press Ctrl+Shift+P.',
        press: 'Ctrl+Shift+P',
      },
      {
        text: 'Choose Arrow, Brush, Eraser, or Spotlight; use Undo or Redo, and close the toolbar when finished.',
      },
    ],
  },
  {
    id: 'presenter-keyboard-screencast',
    label: 'Show the keys you press',
    detail:
      'Display keyboard shortcuts while teaching or demonstrating the app.',
    title: 'Show the keys you press',
    isFeatured: false,
    steps: [
      {
        text: 'Open Presenting Control and keep the Arrow tool selected.',
        press: 'Ctrl+Shift+P',
      },
      {
        text: 'Press K or use Keyboard Screencast to show or hide the key display.',
        press: 'K',
      },
    ],
  },
  {
    id: 'presenter-download-media',
    label: 'Download a background video or song',
    detail: 'Use a supported public link to add video or audio to the library.',
    title: 'Download a background video or song',
    isFeatured: false,
    steps: [
      {
        text: 'Open Background > Videos or Audios and choose the download-from-link action.',
        find: 'Videos',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Paste the public link, choose video or audio, and wait for the new file to appear in the current folder.',
      },
    ],
  },
  {
    id: 'presenter-build-flow',
    label: 'Build a service presenting flow',
    detail:
      'Arrange documents, passages, actions, and cues into a running order.',
    title: 'Build a service presenting flow',
    isFeatured: false,
    steps: [
      {
        text: 'Open the Presenting Flow List, create or choose a flow, and add the service items in order.',
        find: 'Presenting Flow List',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Open its run player to rehearse the cursor, parked rows, screen actions, media controls, and automatic next steps.',
      },
    ],
  },
  {
    id: 'presenter-share-flow',
    label: 'Share a presenting flow',
    detail: 'Export a service order with the documents it references.',
    title: 'Share a presenting flow',
    isFeatured: false,
    steps: [
      {
        text: 'Use More Options on a presenting flow and choose its export action.',
        find: 'Presenting Flow List',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Set the archive password if needed, then share the resulting presenting-flow archive.',
      },
    ],
  },
  {
    id: 'presenter-songselect',
    label: 'Import a song from SongSelect',
    detail:
      'Sign in, search the service, and bring a licensed song into Documents.',
    title: 'Import a song from SongSelect',
    isFeatured: false,
    steps: [
      {
        text: 'Open the SongSelect import from the Documents list and sign in when asked.',
        find: 'Documents',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Search, preview the result, choose the file name, and import only songs your account may use.',
      },
    ],
  },
  {
    id: 'presenter-public-domain',
    label: 'Import a public-domain hymn',
    detail: 'Browse the built-in hymn collection without an account.',
    title: 'Import a public-domain hymn',
    isFeatured: false,
    steps: [
      {
        text: 'Open Import From Public Domain Songs from the Documents list.',
        find: 'Documents',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Search or browse the collection, preview a hymn, choose its file name, and import it.',
      },
    ],
  },
  {
    id: 'presenter-more-options',
    label: 'Use the More Options buttons',
    detail:
      'Open the three-dot menu on a document, slide, background, or flow item.',
    title: 'Use the More Options buttons',
    isFeatured: false,
    steps: [
      {
        text: 'Use the three-dot More Options button on the exact item you want to work with; right-clicking that item opens the same menu.',
        find: 'More Options',
        finds: ['Document List > More Options', 'More Options'],
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Read the menu before choosing an action because each surface offers different commands.',
      },
    ],
  },
  {
    id: 'presenter-app-assistant',
    label: 'Ask the App Assistant for help',
    detail:
      'Ask about the Presenter and request a safe step-by-step walkthrough.',
    title: 'Ask the App Assistant for help',
    isFeatured: false,
    steps: [
      {
        text: 'Use App Assistant at the top-right, Help > App Help, or Ctrl+Shift+A.',
        find: 'App Assistant',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Ask in your own words, then use a walkthrough button when you want the app to point at the real control.',
      },
    ],
  },
  {
    id: 'presenter-ai-chat',
    label: 'Open an AI chat website',
    detail:
      'Use ChatGPT, Claude, Gemini, or another supported site in a separate window.',
    title: 'Open an AI chat website',
    isFeatured: false,
    steps: [
      {
        text: 'Use AI Chat at the top-right, or open it from Tools or Help.',
        find: 'AI Chat',
        translateFind: true,
        action: 'click',
      },
      {
        text: 'Choose a site and sign in there. The website does not know what is happening inside this app.',
      },
    ],
  },
  {
    id: 'presenter-find',
    label: 'Find text anywhere in the app',
    detail:
      'Use the Find bar to locate a document, setting, or visible control.',
    title: 'Find text anywhere in the app',
    isFeatured: false,
    steps: [
      {
        text: 'Open Edit > Find or press Ctrl+F, then type the words you remember.',
        press: 'Ctrl+F',
      },
      {
        text: 'Choose a result to go to it; clear the box when you want the full result list again.',
      },
    ],
  },
  {
    id: 'presenter-view-reload',
    label: 'Reload or force-reload the Presenter',
    detail:
      'Use Reload normally; use Force Reload only to bypass cached app files.',
    title: 'Reload or force-reload the Presenter',
    isFeatured: false,
    steps: [
      { text: 'View > Reload (Ctrl+R) refreshes this window normally.' },
      {
        text: 'View > Force Reload (Ctrl+Shift+R) bypasses cached app files and is mainly for troubleshooting.',
      },
    ],
  },
  {
    id: 'presenter-view-relaunch',
    label: 'Restart the whole app with Relaunch',
    detail:
      'Use View > Relaunch when every app window needs a clean restart; the app asks first.',
    title: 'Restart the whole app with Relaunch',
    isFeatured: false,
    steps: [
      {
        text: 'View > Relaunch restarts the whole Open Worship app, including the Presenter and any audience windows. A confirmation protects against an accidental click.',
      },
    ],
  },
  {
    id: 'presenter-view-devtools',
    label: 'Open Developer Tools for diagnostics',
    detail:
      'Use View > Toggle Developer Tools only for technical troubleshooting.',
    title: 'Open Developer Tools for diagnostics',
    isFeatured: false,
    steps: [
      {
        text: 'View > Toggle Developer Tools (Ctrl+Shift+I) opens Chromium diagnostics. It is an advanced troubleshooting tool, not a presentation control.',
      },
    ],
  },
  {
    id: 'presenter-view-zoom',
    label: 'Zoom the whole Presenter interface',
    detail:
      'Use Actual Size, Zoom In, or Zoom Out for every panel and control.',
    title: 'Zoom the whole Presenter interface',
    isFeatured: false,
    steps: [
      {
        text: 'View > Zoom In (Ctrl++), Zoom Out (Ctrl+-), and Actual Size (Ctrl+0) scale the whole Presenter interface.',
        press: 'Ctrl++',
      },
      {
        text: 'Slide Thumbnail Size changes only the centre previews, while View zoom changes the whole window.',
      },
    ],
  },
  {
    id: 'presenter-view-fullscreen',
    label: 'Make the whole Presenter full screen',
    detail: 'Use View > Toggle Full Screen or F11 for the entire app window.',
    title: 'Make the whole Presenter full screen',
    isFeatured: false,
    steps: [
      {
        text: 'View > Toggle Full Screen (F11) expands the entire app window.',
        press: 'F11',
      },
      {
        text: 'Use Full view above the slide previews when you want more room inside the Presenter without changing the OS window mode.',
      },
    ],
  },
  {
    id: 'presenter-view-widgets',
    label: 'Show or hide Presenter panels from View',
    detail: 'Use View > Widgets to choose which Presenter panels are open.',
    title: 'Show or hide Presenter panels from View',
    isFeatured: false,
    steps: [
      {
        text: 'Open View > Widgets. A checked item is open; choose it to collapse that panel, or choose an unchecked item to reopen it.',
      },
      {
        text: 'The Widgets list follows the current page, so the Presenter menu names Presenter panels only.',
      },
    ],
  },
  {
    id: 'presenter-view-reset-widgets',
    label: 'Restore every Presenter panel layout',
    detail:
      'Use View > Reset Widgets Size to restore defaults after confirmation.',
    title: 'Restore every Presenter panel layout',
    isFeatured: false,
    steps: [
      {
        text: 'View > Reset Widgets Size asks for confirmation, then restores every panel to its default size and reopens collapsed panels.',
      },
    ],
  },
];

export const PRESENTER_DEMO_IDS = PRESENTER_DEMO_LIST.map((demo) => demo.id);

function checkIsActionableStep(step) {
  return (
    typeof step.find === 'string' ||
    (step.finds ?? []).length > 0 ||
    typeof step.press === 'string' ||
    step.action === 'rightClick'
  );
}

/** A fresh localized copy, so callers can safely decorate its steps. */
export function getPresenterDemo(id, translate = (value) => value) {
  const source = PRESENTER_DEMO_LIST.find((demo) => demo.id === id);
  if (source === undefined) {
    return null;
  }
  const canDemo = source.steps.some(checkIsActionableStep);
  return {
    ...source,
    label: translate(source.label),
    detail: translate(source.detail),
    title: translate(source.title),
    steps: source.steps.map((sourceStep) => {
      const { translateFind, translateFinds, ...step } = sourceStep;
      const finds = [
        ...(step.finds ?? (typeof step.find === 'string' ? [step.find] : [])),
      ];
      if (translateFind && typeof step.find === 'string') {
        const translated = translate(step.find);
        if (translated !== step.find) {
          finds.push(translated);
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
        ...(canDemo && !checkIsActionableStep(step) ? { kind: 'look' } : {}),
        ...(finds.length === 0 ? {} : { finds: [...new Set(finds)] }),
      };
    }),
  };
}
