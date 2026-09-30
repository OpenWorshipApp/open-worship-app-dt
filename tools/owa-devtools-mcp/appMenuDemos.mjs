// Native application-menu lessons shared by the Presenter and Reader catalogs.
// Electron draws these menus outside the page DOM, so the guide must explain
// them without pretending it can ring or press an OS-owned menu row.

const APP_MENU_DEMO_LIST = [
  {
    suffix: 'menu-file',
    label: 'Learn the File menu',
    detail:
      'Learn Print, Print Without Preview, Export Data, Import Data, Close, and Quit or Exit.',
    steps: [
      {
        text: 'File > Print opens a preview of the current window. Print Without Preview sends that window directly to the system print dialog.',
      },
      {
        text: 'Export Data makes a portable archive from the data folders you choose. Import Data restores an archive without overwriting files that are already there.',
      },
      {
        text: 'Close on macOS closes the current window. Quit or Exit on Windows and Linux closes the app, so save unfinished work first.',
      },
    ],
  },
  {
    suffix: 'menu-edit',
    label: 'Learn the Edit menu',
    detail:
      'Learn Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Find, Delete, Select All, Settings, and Speech.',
    steps: [
      {
        text: 'Undo and Redo reverse or restore the latest change in the control or editor that currently has focus.',
      },
      {
        text: 'Cut, Copy, Paste, Delete, and Select All act on the focused text or editor. On macOS, Paste and Match Style pastes without bringing the source formatting.',
      },
      {
        text: 'Find (Ctrl+F, or Command+F on macOS) opens search for the current app window.',
      },
      {
        text: 'Settings opens app settings on Windows and Linux; macOS calls it Preferences under the app-name menu. The macOS Speech submenu can start or stop reading selected text aloud.',
      },
    ],
  },
  {
    suffix: 'menu-tools',
    label: 'Learn the Tools menu',
    detail:
      'Learn Copy Debug Info, Copy Full Debug Info, Local Web Share, Google Fonts, App Assistant, AI Chat, Khmer Tools, and Start Controlling.',
    steps: [
      {
        text: 'Copy Debug Info copies the app, runtime, operating-system, and commit versions for a support report. Copy Full Debug Info also includes the complete build metadata.',
      },
      {
        text: 'Local Web Share opens the sharing window. Google Fonts opens the font catalog in your browser.',
      },
      {
        text: 'App Assistant opens help that understands this app. AI Chat opens supported chat websites in a separate sandboxed window.',
      },
      {
        text: 'Khmer Tools opens the Khmer Editor, Open Lyric, or BibleNote websites. Start Controlling (Ctrl+Shift+P, or Command+Shift+P on macOS) opens the drawing, spotlight, and keyboard-display overlay for the window in front.',
      },
    ],
  },
  {
    suffix: 'menu-window',
    label: 'Learn the Window menu',
    detail:
      'Learn Minimize, Maximize or Zoom, Close, Bring All to Front, window switching, and Reset Position and Size.',
    steps: [
      {
        text: 'Minimize sends the current window to the taskbar or Dock. Maximize or Zoom changes its size, and Close closes that window.',
      },
      {
        text: "On macOS, Bring All to Front and the window list help recover and switch between the app's open windows.",
      },
      {
        text: 'Reset Position and Size brings the main window and popup windows back to usable default bounds when one is off-screen or badly sized.',
      },
    ],
  },
  {
    suffix: 'menu-help',
    label: 'Learn the Help menu',
    detail:
      'Learn Tips of the Day, All tips, App Help (Chatbot), AI Chat, Learn More, both update checks, and About.',
    steps: [
      {
        text: 'Tips of the Day opens one learning suggestion for this page. All tips opens its complete searchable lesson list.',
      },
      {
        text: 'App Help (Chatbot) opens the app-aware assistant when AI features are enabled. AI Chat opens supported chat websites, which do not know what is happening inside this app.',
      },
      {
        text: 'Learn More opens the project website. Check for Updates checks the installed update channel or Store; Check for Updates Online opens the website download page when that option is available.',
      },
      {
        text: 'About shows the app version and build information on Windows and Linux. On macOS, About is under the app-name menu instead.',
      },
    ],
  },
];

export function genAppMenuDemos(pagePrefix) {
  return APP_MENU_DEMO_LIST.map(({ suffix, label, detail, steps }) => ({
    id: `${pagePrefix}-${suffix}`,
    label,
    detail,
    title: label,
    isFeatured: false,
    steps: steps.map((step) => ({ ...step })),
  }));
}
