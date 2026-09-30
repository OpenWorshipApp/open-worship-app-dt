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
  {
    id: 'bibleNote-edit',
    page: 'bibleNote',
    label: 'Bible Note',
    detail: 'Edit your note here, then use Save to keep your changes.',
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
          : { find: translate(source.find), action: 'click' }),
      },
    ],
  };
}
