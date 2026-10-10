import {
    PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
    dirSourceSettingNames,
    screenManagerSettingNames,
} from '../../helper/constants';

/**
 * What **Export Settings / Import Settings** (the Settings window's sidebar)
 * offer to carry, as a tree a volunteer can read: a section ("Foreground") of
 * leaves ("Marquee", "Timers & Clocks"). Every setting key the app writes is
 * CLASSIFIED into exactly one leaf, or excluded, by `classifySettingKey`.
 *
 * Kept PURE -- no React, no `appProvider`, nothing but `constants` (a leaf) --
 * because the flow, the dialog and the tests all read it, and the sidebar
 * button must not drag the archive machinery into the Settings entry.
 *
 * There is no central registry of setting keys in this app: about ninety
 * features each name their own, many of them per file, per screen or per
 * session (`widget-size-<document>`, `video-show-<id>-…`). So the rules below
 * are prefixes and patterns read off the real keys, tried in a fixed order,
 * with the exact keys first. A key no rule claims still travels, under
 * **Other Settings**, so a feature added later is never silently left out of
 * a backup.
 *
 * Leaf ids are WRITTEN INTO EXPORTED FILES (`sections` in the manifest). Never
 * rename one -- a file made before the rename would come back with its
 * sections unknown. The test pins them.
 *
 * Constants that live in heavy modules are spelled out here with the place
 * they come from, rather than imported: importing `ScreenBibleManager` for one
 * prefix would load the screen machinery into the Settings window.
 */

export type SettingStoreType = 'local' | 'home' | 'secure' | 'theme';
export const SETTING_STORE_LIST: readonly SettingStoreType[] = [
    'local',
    'home',
    'secure',
    'theme',
];

export const SETTING_EXCLUDED = 'excluded';
export const OTHER_LEAF_ID = 'other.other';
/** The one key of the `theme` pseudo-store: `nativeTheme.themeSource`. */
export const THEME_SETTING_KEY = 'themeSource';
export const THEME_LEAF_ID = 'general.theme';

export type SettingLeafType = {
    id: string;
    /** A `tran()` KEY; translated where it is rendered. */
    titleKey: string;
    iconClassName: string;
    /** A `tran()` key shown beside the title -- a warning, not a count. */
    noteKey?: string;
    /**
     * Read by the MAIN process at launch (a display assignment, a server that
     * starts with the app), so a reload is not enough -- the import offers a
     * restart instead.
     */
    needsRelaunch?: boolean;
    /** Credentials: exported only into a password-protected file. */
    needsPassword?: boolean;
    /** Starts unticked on import: it reaches past this computer's look. */
    isOptInOnImport?: boolean;
};

export type SettingSectionType = {
    id: string;
    titleKey: string;
    iconClassName: string;
    leaves: SettingLeafType[];
};

const CONNECTIONS_NOTE = 'Lets other devices connect to this computer';

export const SETTING_SECTION_LIST: readonly SettingSectionType[] = [
    {
        id: 'general',
        titleKey: 'General',
        iconClassName: 'bi-gear',
        leaves: [
            {
                id: 'general.language',
                titleKey: 'Language',
                iconClassName: 'bi-translate',
            },
            {
                id: THEME_LEAF_ID,
                titleKey: 'Theme',
                iconClassName: 'bi-circle-half',
            },
            {
                id: 'general.font',
                titleKey: 'Font',
                iconClassName: 'bi-fonts',
            },
            {
                id: 'general.tips',
                titleKey: 'Tips of the Day',
                iconClassName: 'bi-lightbulb',
            },
            {
                id: 'general.folders',
                titleKey: 'Folders',
                iconClassName: 'bi-folder2-open',
                // A folder outside the data folder may not exist on the
                // other computer, and the web-background folders widen what
                // a web capture may read there.
                isOptInOnImport: true,
            },
            {
                id: 'general.colorNotes',
                titleKey: 'File Color Notes',
                iconClassName: 'bi-palette',
            },
        ],
    },
    {
        id: 'bible',
        titleKey: 'Bible',
        iconClassName: 'bi-book',
        leaves: [
            {
                id: 'bible.lookup',
                titleKey: 'Bible Lookup',
                iconClassName: 'bi-search',
            },
            {
                id: 'bible.openPassages',
                titleKey: 'Open Passages',
                iconClassName: 'bi-journal-bookmark',
            },
            {
                id: 'bible.view',
                titleKey: 'Reading View',
                iconClassName: 'bi-eye',
            },
            {
                id: 'bible.screenStyle',
                titleKey: 'Bible on Screen',
                iconClassName: 'bi-easel',
            },
            {
                id: 'bible.notes',
                titleKey: 'Bible Notes',
                iconClassName: 'bi-journal-text',
            },
        ],
    },
    {
        id: 'screens',
        titleKey: 'Screens',
        iconClassName: 'bi-display',
        leaves: [
            {
                id: 'screens.setup',
                titleKey: 'Screens & Monitors',
                iconClassName: 'bi-tv',
                needsRelaunch: true,
            },
            {
                id: 'screens.transitions',
                titleKey: 'Transitions',
                iconClassName: 'bi-shuffle',
            },
            {
                id: 'screens.drawing',
                titleKey: 'Drawing & Spotlight',
                iconClassName: 'bi-brush',
            },
            {
                id: 'screens.preview',
                titleKey: 'Mini Screen',
                iconClassName: 'bi-window',
            },
            {
                id: 'screens.pages',
                titleKey: 'PDF & Pages on Screen',
                iconClassName: 'bi-file-earmark-pdf',
            },
        ],
    },
    {
        id: 'foreground',
        titleKey: 'Foreground',
        iconClassName: 'bi-layers',
        leaves: [
            {
                id: 'foreground.marquee',
                titleKey: 'Marquee',
                iconClassName: 'bi-arrow-left-right',
            },
            {
                id: 'foreground.messages',
                titleKey: 'Messages & Quick Text',
                iconClassName: 'bi-chat-square-text',
            },
            {
                id: 'foreground.timers',
                titleKey: 'Timers & Clocks',
                iconClassName: 'bi-stopwatch',
            },
            {
                id: 'foreground.media',
                titleKey: 'Image, Video & Web Shows',
                iconClassName: 'bi-collection-play',
            },
            {
                id: 'foreground.camera',
                titleKey: 'Camera',
                iconClassName: 'bi-camera-video',
            },
            {
                id: 'foreground.screenShow',
                titleKey: 'Screen Show',
                iconClassName: 'bi-cast',
            },
            {
                id: 'foreground.panel',
                titleKey: 'Foreground Panel',
                iconClassName: 'bi-sliders',
            },
        ],
    },
    {
        id: 'background',
        titleKey: 'Background',
        iconClassName: 'bi-image',
        leaves: [
            {
                id: 'background.images',
                titleKey: 'Images',
                iconClassName: 'bi-image',
            },
            {
                id: 'background.videos',
                titleKey: 'Videos',
                iconClassName: 'bi-film',
            },
            {
                id: 'background.webs',
                titleKey: 'Webs',
                iconClassName: 'bi-globe',
            },
            {
                id: 'background.audios',
                titleKey: 'Audios',
                iconClassName: 'bi-music-note-beamed',
            },
            {
                id: 'background.panel',
                titleKey: 'Background Panel',
                iconClassName: 'bi-sliders',
            },
        ],
    },
    {
        id: 'documents',
        titleKey: 'Documents & Lyrics',
        iconClassName: 'bi-file-earmark-text',
        leaves: [
            {
                id: 'documents.presenter',
                titleKey: 'Presenter',
                iconClassName: 'bi-easel2',
            },
            {
                id: 'documents.lyrics',
                titleKey: 'Lyrics',
                iconClassName: 'bi-music-note-list',
            },
            {
                id: 'documents.editors',
                titleKey: 'Editors',
                iconClassName: 'bi-pencil-square',
            },
            {
                id: 'documents.presentingFlows',
                titleKey: 'Presenting Flows',
                iconClassName: 'bi-collection',
            },
            {
                id: 'documents.resources',
                titleKey: 'Resources',
                iconClassName: 'bi-archive',
            },
        ],
    },
    {
        id: 'layout',
        titleKey: 'Layout',
        iconClassName: 'bi-layout-split',
        leaves: [
            {
                id: 'layout.documentPanelSizes',
                titleKey: 'Panel Sizes per Document',
                iconClassName: 'bi-file-earmark-ruled',
            },
            {
                id: 'layout.panelSizes',
                titleKey: 'Panel Sizes',
                iconClassName: 'bi-arrows-angle-expand',
            },
            {
                id: 'layout.windows',
                titleKey: 'Windows & Pages',
                iconClassName: 'bi-window-stack',
            },
        ],
    },
    {
        id: 'ai',
        titleKey: 'AI & Assistant',
        iconClassName: 'bi-robot',
        leaves: [
            {
                id: 'ai.providers',
                titleKey: 'AI Providers',
                iconClassName: 'bi-cpu',
            },
            {
                id: 'ai.assistant',
                titleKey: 'Assistant',
                iconClassName: 'bi-chat-dots',
            },
        ],
    },
    {
        id: 'connections',
        titleKey: 'Connections',
        iconClassName: 'bi-broadcast',
        leaves: [
            {
                id: 'connections.mirror',
                titleKey: 'Screen Mirror & Virtual Displays',
                iconClassName: 'bi-broadcast',
                noteKey: CONNECTIONS_NOTE,
                needsRelaunch: true,
                isOptInOnImport: true,
            },
        ],
    },
    {
        id: 'secrets',
        titleKey: 'API Keys & Sign-ins',
        iconClassName: 'bi-key',
        leaves: [
            {
                id: 'secrets.aiKeys',
                titleKey: 'AI Keys',
                iconClassName: 'bi-stars',
                needsPassword: true,
                isOptInOnImport: true,
            },
            {
                id: 'secrets.songSelect',
                titleKey: 'SongSelect',
                iconClassName: 'bi-music-note',
                needsPassword: true,
                isOptInOnImport: true,
            },
            {
                id: 'secrets.connectionCodes',
                titleKey: 'Connection Codes',
                iconClassName: 'bi-shield-lock',
                needsPassword: true,
                isOptInOnImport: true,
            },
        ],
    },
    {
        id: 'other',
        titleKey: 'Other Settings',
        iconClassName: 'bi-three-dots',
        leaves: [
            {
                id: OTHER_LEAF_ID,
                titleKey: 'Other Settings',
                iconClassName: 'bi-three-dots',
            },
        ],
    },
];

const LEAF_MAP = new Map<string, SettingLeafType>(
    SETTING_SECTION_LIST.flatMap((section) => {
        return section.leaves.map((leaf) => {
            return [leaf.id, leaf] as const;
        });
    }),
);

export function getSettingLeaf(leafId: string) {
    return LEAF_MAP.get(leafId) ?? null;
}

export function listSettingLeaves() {
    return Array.from(LEAF_MAP.values());
}

// ---------------------------------------------------------------------------
// Keys that never travel, whichever section is ticked.
// ---------------------------------------------------------------------------

const EXCLUDED_LOCAL_KEY_LIST = [
    // One-off migration markers: carried to a computer that has not run the
    // migration, they would stop it from ever running there.
    PRESENTING_FLOW_RENAME_MIGRATION_SETTING_NAME,
    'setting-key-path-migration', // `src/boot.ts`
    'previewer-note-close-migration', // `src/boot.ts`
    // Requests one window leaves for another, consumed within seconds.
    'setting-tab-request', // `src/setting/settingHelpers.ts`
    'setting-ai-key-focus', // `src/helper/ai/aiKeyFocusHelpers.ts`
    'chatbot-handoff-ask', // `src/helper/ai/chatbotHandoffStoreHelpers.ts`
    'bible-xml-import-request', // `bibleImportRequestHelpers.ts`
    'error-datetime-setting', // `src/others/main.tsx`
    // Conversations and what they cost: the user's data, not a preference,
    // and the spend guard's ledger must stay with the hour it measured.
    'chatbot-spend-ledger',
    'chatbot-sessions',
    'chatbot-ask-history',
    'aichat-sessions',
    'aichat-closed-tabs',
    // What is ON the screens right now, not how they are set up.
    screenManagerSettingNames.VARY_APP_DOCUMENT,
    screenManagerSettingNames.FOREGROUND,
    screenManagerSettingNames.BACKGROUND,
    screenManagerSettingNames.FULL_TEXT,
    // Replaced by `selected-vary-app-document`; read once on upgrade.
    'selected-lyric',
];

const EXCLUDED_LOCAL_PATTERN_LIST = [
    /-migrat(?:ed|ion)$/,
    /^aichat-sessions-\d+$/, // the overflow pages of `aichat-sessions`
    /^screen-draw-data-/, // a drawing on a screen, `ScreenDrawManager.ts`
    /^screen-mask-/, // retired, `screenManagerDeleteHelpers.ts`
];

// ---------------------------------------------------------------------------
// The home store (`clientSetting` in `setting.json`) and the secure store are
// ALLOWLISTS: a key named nowhere below never leaves and never comes in. The
// main process reads several of them, and `__proto__` must never reach
// `clientSetting[key]`.
// ---------------------------------------------------------------------------

const HOME_KEY_LEAF_MAP = new Map<string, string>([
    // `{isAutoPlay, anthropicWorkspaceId, bedrockRegion}` -- the plaintext half.
    ['ai-setting', 'ai.providers'],
    ['ai-custom-servers', 'ai.providers'], // `electron/customLlmProtocol.ts`
    // SongSelect's `clientId` and token expiry: meaningless without the
    // secret beside it, so the two travel as one leaf.
    ['song-select-setting', 'secrets.songSelect'],
    // `electron/screenMirrorService.ts` (`screen-mirror-` + name) and
    // `electron/virtualDisplayProtocol.ts`.
    ['screen-mirror-host', 'connections.mirror'],
    ['screen-mirror-internet', 'connections.mirror'],
    ['screen-mirror-tunnel', 'connections.mirror'],
    ['screen-mirror-public-address', 'connections.mirror'],
    ['screen-mirror-port', 'connections.mirror'],
    ['screen-mirror-public-port', 'connections.mirror'],
    ['virtual-displays', 'connections.mirror'],
    ['virtual-display-share', 'connections.mirror'],
    ['virtual-display-https', 'connections.mirror'],
    ['virtual-display-viewer-labels', 'connections.mirror'],
]);
// The note editor's own store (`bibleNoteHelpers.ts`), all but the editor
// state, which is routed into the note file and never stored here.
const HOME_PREFIX_LEAF_LIST: [string, string][] = [
    ['lexical-playground-', 'bible.notes'],
];
const EXCLUDED_HOME_KEY_LIST = [
    // Where `local-storage/` itself lives: importing it would move the data
    // folder out from under the import.
    'selected-parent-dir',
    'selected-parent-dir-id',
    'selected-parent-dir-history',
    // This computer's identity on the network, the devices it trusts and
    // how it lets them in -- never cloned onto a second computer.
    'screen-mirror-identity',
    'screen-mirror-guests',
    'screen-mirror-router-mapping',
    'screen-mirror-last-port',
    'screen-mirror-mode',
    'virtual-display-access',
    // The AI master switch opens the agent doors on the next launch, and
    // must be turned on knowingly (`.claude/rules/agent-access.md`).
    'ai-enabled',
    'lexical-playground-editor-state',
];

const SECURE_KEY_LEAF_MAP = new Map<string, string>([
    ['ai-setting-secret', 'secrets.aiKeys'], // `src/helper/ai/aiHelpers.ts`
    ['ai-custom-servers-secret', 'secrets.aiKeys'],
    ['song-select-setting-secret', 'secrets.songSelect'],
    ['screen-mirror-code', 'secrets.connectionCodes'],
    ['virtual-display-code', 'secrets.connectionCodes'],
    // NOT `virtual-display-tls`: this computer's own TLS key material.
]);

/** Every secure key that may travel; the secure store cannot be listed. */
export const SECURE_SETTING_KEY_LIST: readonly string[] = Array.from(
    SECURE_KEY_LEAF_MAP.keys(),
);

// ---------------------------------------------------------------------------
// The local store (`<data folder>/local-storage/<key>`).
// ---------------------------------------------------------------------------

/**
 * Exact keys beat every prefix. Each one names its leaf, or `excluded`.
 */
const LOCAL_EXACT_KEY_LIST: [string, string[]][] = [
    ['general.language', ['language-locale']],
    ['general.font', ['app-font-family', 'app-font-weight']],
    ['general.tips', ['daily-tips-disabled']],
    [
        // EXACT only: `select-dir-` also prefixes list sorts and filters,
        // per-session folders, audio repeat flags and color-note toggles.
        'general.folders',
        [
            ...Object.values(dirSourceSettingNames),
            'select-dir-lyric',
            'select-dir-note',
            'select-dir-notes',
            'resources-folder-list',
        ],
    ],
    ['general.colorNotes', ['itemSourcesMeta']],
    [
        'bible.lookup',
        [
            'close-on-add-bible-item',
            'history-text-list',
            'bible-search-tab',
            'location-name-lookup-lang-code',
        ],
    ],
    ['bible.openPassages', ['bible-presenter']],
    [
        'bible.view',
        [
            'view-should-model-new-line',
            'model-bible-info',
            'show-standard-bible-ref',
            'show-ai-bible-ref',
            'graph-view-presets',
        ],
    ],
    ['bible.screenStyle', ['bible-custom-style-floating']],
    ['bible.notes', ['bible-note-bible-key', 'excalidraw-libraries']],
    ['screens.setup', [screenManagerSettingNames.MANAGERS]],
    ['screens.pages', ['pdf-full-width', 'page-base-virtual-bg-color']],
    [
        'foreground.panel',
        ['foreground-open-panels', 'presenter-foreground-floating'],
    ],
    ['background.videos', ['video-fading-at-the-end']],
    [
        'background.panel',
        [
            'background-tab',
            'bg-thumbnail-width',
            'background-tab-transition',
            'background-item-transition',
        ],
    ],
    [
        'documents.presenter',
        ['presenter-tab', 'document-slides-previewer-stages'],
    ],
    ['documents.lyrics', ['open-lyric-previewer-setting']],
    [
        'documents.editors',
        [
            'canvas-editor-scale',
            'editor-tools-tab',
            'document-font-editor',
            'web-editor-wrap-text',
            'bible-xml-wrap-text',
        ],
    ],
    [
        'layout.windows',
        [
            'presenting-control-widget-rect',
            'verse-comment-editor',
            'last-page-location',
            'setting-tabs',
        ],
    ],
    [
        'ai.assistant',
        ['chatbot-llm-provider', 'chatbot-spend-limit', 'chatbot-tip-shown'],
    ],
    [SETTING_EXCLUDED, EXCLUDED_LOCAL_KEY_LIST],
];

function genLocalExactKeyMap() {
    const map = new Map<string, string>();
    for (const [leafId, keys] of LOCAL_EXACT_KEY_LIST) {
        for (const key of keys) {
            map.set(key, leafId);
        }
    }
    return map;
}
const LOCAL_EXACT_KEY_MAP = genLocalExactKeyMap();

/** Exposed for the test that no exact key is claimed twice. */
export function listLocalExactKeyClaims() {
    return LOCAL_EXACT_KEY_LIST.flatMap(([leafId, keys]) => {
        return keys.map((key) => {
            return { key, leafId };
        });
    });
}

type LocalRuleType = {
    leafId: string;
    prefixes?: string[];
    patterns?: RegExp[];
};

// A key a per-file setting was made for: `toFilePathSettingName` turns
// `<data folder>/documents/a.ows` into `@data_documents_a_ows`, any other path
// into `C__Users_…`, and older keys kept the file's own name.
const PER_DOCUMENT_WIDGET_SIZE_PATTERN =
    /^widget-size-.*(?:@data_|(?:^|[-_])[A-Za-z]__|_(?:Users|home|Volumes|media|mnt|run)_|\.[A-Za-z0-9]{2,5}$)/;

/**
 * Tried IN ORDER after the exact keys; the first match wins. Narrow families
 * come before the broad ones they share a prefix with: the floating-panel
 * rectangles before the panels they belong to, Open Passages before the rest
 * of the Bible view, each foreground widget before the `foreground-` fallback.
 */
const LOCAL_RULE_LIST: LocalRuleType[] = [
    {
        leafId: 'layout.documentPanelSizes',
        patterns: [PER_DOCUMENT_WIDGET_SIZE_PATTERN],
    },
    { leafId: 'layout.panelSizes', prefixes: ['widget-size-'] },
    {
        leafId: 'layout.windows',
        prefixes: [
            'floating-widget-rect-',
            'keyboard-shortcuts-panel-rect-',
            'app-document-preview-rect-',
            'bible-xml-',
            'bible-setting-',
        ],
    },
    {
        leafId: 'foreground.marquee',
        patterns: [/^(?:foreground-)?marquee-(?:top|bottom)(?:-|$)/],
    },
    {
        leafId: 'foreground.messages',
        patterns: [
            /^(?:foreground-)?(?:message|quick-text|alert|announcement)(?:-|$)/,
        ],
    },
    {
        leafId: 'foreground.timers',
        patterns: [
            /^(?:foreground-)?(?:countdown|stopwatch|time|timezone|city-name|date|hours|minutes|seconds)(?:-|$)/,
        ],
    },
    {
        leafId: 'foreground.media',
        prefixes: [
            'foreground-image',
            'foreground-video',
            'foreground-web',
            'image-show',
            'video-show',
            'web-show',
            'select-dir-image-fg-',
            'select-dir-video-fg-',
        ],
        // The per-page properties of a local web page, before they moved
        // under `web-show`.
        patterns: [/^web-.+\.html?-/],
    },
    {
        leafId: 'foreground.camera',
        prefixes: ['camera-', 'foreground-camera-'],
    },
    {
        leafId: 'foreground.screenShow',
        prefixes: ['screen-show-', 'foreground-screen-'],
    },
    {
        leafId: 'foreground.panel',
        prefixes: ['foreground-component-transition-', 'foreground-'],
    },
    {
        leafId: 'background.images',
        prefixes: [
            'background-image',
            'select-dir-image-bg-',
            'bg-view-mode-select-dir-image-bg',
            'images-slide-',
            'bg-view-mode-images-',
        ],
    },
    {
        leafId: 'background.videos',
        prefixes: [
            'background-video',
            'select-dir-video-bg-',
            'bg-view-mode-select-dir-video-bg',
        ],
    },
    {
        leafId: 'background.webs',
        prefixes: [
            'background-web',
            'select-dir-web-bg-',
            'bg-view-mode-select-dir-web-bg',
        ],
    },
    {
        leafId: 'background.audios',
        prefixes: [
            'background-audio',
            'select-dir-audio-bg-',
            'bg-view-mode-select-dir-audio-bg',
        ],
    },
    { leafId: 'background.panel', prefixes: ['background-', 'bg-'] },
    // `SCREEN_BIBLE_SETTING_PREFIX`, `src/_screen/screenBibleHelpers.tsx`.
    { leafId: 'bible.screenStyle', prefixes: ['screen-bible-'] },
    {
        leafId: 'bible.openPassages',
        patterns: [
            /^bible-items-preview-.*(?:data|input-text|selected-bible-item|bible-verse-key)$/,
        ],
    },
    {
        leafId: 'bible.view',
        prefixes: [
            'bible-items-preview-',
            'bible-preview-font-size',
            'select-dir-bible-presenter-',
            'select-dir-bible-read-',
            'select-dir-bible-notes-',
        ],
    },
    { leafId: 'bible.lookup', prefixes: ['bible-lookup-', 'bible-find-'] },
    // `SCREEN_MANAGER_SETTING_NAME`, `src/_screen/managers/screenHelpers.ts`:
    // which monitor each screen opens on.
    { leafId: 'screens.setup', prefixes: ['screen-display-'] },
    // `ScreenEffectManager.ts`.
    { leafId: 'screens.transitions', prefixes: ['pt-effect-'] },
    {
        leafId: 'screens.drawing',
        // `screenSettingKeyHelpers.ts`, `ScreenFocusManager.ts` and
        // `presentingControlHelpers.ts`.
        prefixes: [
            'screen-draw-mode-',
            'draw-paint-',
            'screen-focus-',
            'presenting-control-',
        ],
    },
    { leafId: 'screens.preview', prefixes: ['mini-screen-'] },
    {
        leafId: 'documents.presentingFlows',
        prefixes: ['presenting-flow-', 'select-dir-presenting-flow-'],
    },
    {
        leafId: 'documents.presenter',
        prefixes: [
            'presenter-item-thumbnail-size',
            'selected-vary-app-document',
            'vary-app-document-',
            'select-dir-app-document-',
        ],
    },
    {
        leafId: 'documents.lyrics',
        prefixes: ['lyric-', 'select-dir-lyric-'],
    },
    {
        leafId: 'documents.editors',
        prefixes: ['canvas-', 'slide-editor-', 'slide-property-'],
    },
    { leafId: 'documents.resources', prefixes: ['resources-'] },
    {
        leafId: 'connections.mirror',
        prefixes: ['virtual-display-', 'virtual-screens-'],
    },
    { leafId: 'ai.assistant', prefixes: ['chatbot-llm-model-'] },
    { leafId: 'general.tips', prefixes: ['daily-tip-'] },
];

function checkIsRuleMatched(rule: LocalRuleType, key: string) {
    return (
        (rule.prefixes ?? []).some((prefix) => {
            return key.startsWith(prefix);
        }) ||
        (rule.patterns ?? []).some((pattern) => {
            return pattern.test(key);
        })
    );
}

const FORBIDDEN_KEY_CHAR_PATTERN = /[/\\:*?"<>|]/;

function checkHasControlChar(text: string) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) {
            return true;
        }
    }
    return false;
}
const WINDOWS_DEVICE_NAME_PATTERN =
    /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\..*)?$/i;
// A file name's limit on every file system the data folder is carried on.
const MAX_KEY_BYTE_LENGTH = 255;

/**
 * Whether `key` can be a setting at all. A local setting is a FILE named
 * after its key (`appLocalStorage.toFullPath`), so an imported key is a file
 * name chosen by whoever made the file: no separator, no `..`, nothing a
 * Windows drive or a FAT stick would refuse or turn into something else (`:`
 * on NTFS writes a hidden stream of another file). Applied on the way out as
 * well, so a file this app writes is always one it would read back.
 */
export function checkIsPortableSettingKey(key: unknown): key is string {
    if (typeof key !== 'string' || key.length === 0) {
        return false;
    }
    if (
        FORBIDDEN_KEY_CHAR_PATTERN.test(key) ||
        checkHasControlChar(key) ||
        key.startsWith('.') ||
        key.endsWith('.') ||
        key.endsWith(' ') ||
        WINDOWS_DEVICE_NAME_PATTERN.test(key)
    ) {
        return false;
    }
    return new TextEncoder().encode(key).length <= MAX_KEY_BYTE_LENGTH;
}

function classifyLocalKey(key: string) {
    const exactLeafId = LOCAL_EXACT_KEY_MAP.get(key);
    if (exactLeafId !== undefined) {
        return exactLeafId;
    }
    if (
        EXCLUDED_LOCAL_PATTERN_LIST.some((pattern) => {
            return pattern.test(key);
        })
    ) {
        return SETTING_EXCLUDED;
    }
    for (const rule of LOCAL_RULE_LIST) {
        if (checkIsRuleMatched(rule, key)) {
            return rule.leafId;
        }
    }
    return OTHER_LEAF_ID;
}

function classifyHomeKey(key: string) {
    if (EXCLUDED_HOME_KEY_LIST.includes(key)) {
        return SETTING_EXCLUDED;
    }
    const leafId = HOME_KEY_LEAF_MAP.get(key);
    if (leafId !== undefined) {
        return leafId;
    }
    for (const [prefix, prefixLeafId] of HOME_PREFIX_LEAF_LIST) {
        if (key.startsWith(prefix)) {
            return prefixLeafId;
        }
    }
    return SETTING_EXCLUDED;
}

/**
 * The leaf `key` belongs to in `store`, `excluded` when it never travels, or
 * `null` when it is not a key at all (`checkIsPortableSettingKey`). An invalid
 * key is neither exported, nor removed, nor written.
 *
 * Always classified by THIS version's rules, on export and on import alike:
 * a file made by an older version is read as this one understands it, and a
 * key excluded since is dropped rather than written back.
 */
export function classifySettingKey(
    store: SettingStoreType,
    key: string,
): string | null {
    if (!checkIsPortableSettingKey(key)) {
        return null;
    }
    if (store === 'theme') {
        return key === THEME_SETTING_KEY ? THEME_LEAF_ID : SETTING_EXCLUDED;
    }
    if (store === 'secure') {
        return SECURE_KEY_LEAF_MAP.get(key) ?? SETTING_EXCLUDED;
    }
    if (store === 'home') {
        return classifyHomeKey(key);
    }
    // `getSettingPrefix()` once named the Reader's own keys `reader-<key>`;
    // any still on disk belong with the key they shadow.
    const normalizedKey = key.startsWith('reader-')
        ? key.slice('reader-'.length)
        : key;
    return classifyLocalKey(normalizedKey);
}

/**
 * `classifySettingKey` with `excluded` and invalid both read as "not in any
 * leaf" -- what every caller that only wants a leaf asks.
 */
export function toSettingLeafId(store: SettingStoreType, key: string) {
    const leafId = classifySettingKey(store, key);
    return leafId === null || leafId === SETTING_EXCLUDED ? null : leafId;
}
