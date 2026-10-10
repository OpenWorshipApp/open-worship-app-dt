import { describe, expect, test } from 'vitest';

import { dirSourceSettingNames } from '../../helper/constants';
import {
    OTHER_LEAF_ID,
    SECURE_SETTING_KEY_LIST,
    SETTING_EXCLUDED,
    SETTING_SECTION_LIST,
    THEME_LEAF_ID,
    THEME_SETTING_KEY,
    checkIsPortableSettingKey,
    classifySettingKey,
    getSettingLeaf,
    listLocalExactKeyClaims,
    listSettingLeaves,
    toSettingLeafId,
} from './settingArchiveCatalog';

// Key NAMES as a real profile has them (2026-10, ~700 keys), with the user's
// own document names replaced. Each must land where a volunteer would look
// for it -- and the ones that share a prefix with a broader family are the
// point of the list.
const REAL_LOCAL_KEY_LEAF_MAP: Record<string, string> = {
    'language-locale': 'general.language',
    'app-font-family': 'general.font',
    'daily-tips-disabled': 'general.tips',
    'daily-tip-last-presenter': 'general.tips',
    'select-dir-app-document': 'general.folders',
    'select-dir-image-bg': 'general.folders',
    'select-dir-bible-read': 'general.folders',
    'select-dir-lyric': 'general.folders',
    'resources-folder-list': 'general.folders',
    itemSourcesMeta: 'general.colorNotes',
    'bible-find-recent-search': 'bible.lookup',
    'bible-lookup-online': 'bible.lookup',
    'close-on-add-bible-item': 'bible.lookup',
    'history-text-list': 'bible.lookup',
    'bible-items-preview-lookup-data': 'bible.openPassages',
    'bible-items-preview-lookup-input-text': 'bible.openPassages',
    'bible-items-preview-presenter-bible-verse-key': 'bible.openPassages',
    'bible-items-preview-lookupbible-note-selected-bible-item':
        'bible.openPassages',
    'bible-items-preview-lookup-view-new-line': 'bible.view',
    'bible-items-preview-lookupbible-items-color-note': 'bible.view',
    'bible-preview-font-size-presenter': 'bible.view',
    'model-bible-info': 'bible.view',
    'show-ai-bible-ref': 'bible.view',
    'screen-bible--style-text': 'bible.screenStyle',
    'bible-custom-style-floating': 'bible.screenStyle',
    'bible-note-bible-key': 'bible.notes',
    'excalidraw-libraries': 'bible.notes',
    'screen-managers': 'screens.setup',
    'screen-display--pid-0': 'screens.setup',
    'pt-effect-0-background': 'screens.transitions',
    'presenting-control-focus-blur': 'screens.drawing',
    'screen-draw-mode-1': 'screens.drawing',
    'mini-screen-wallpaper-backdrop': 'screens.preview',
    'pdf-full-width': 'screens.pages',
    'page-base-virtual-bg-color': 'screens.pages',
    'foreground-marquee-top-setting': 'foreground.marquee',
    'marquee-bottom-common-font-family': 'foreground.marquee',
    'foreground-message-interval': 'foreground.messages',
    'quick-text-s1-setting-show-widget-scale': 'foreground.messages',
    'foreground-alert-setting': 'foreground.messages',
    'message-common-font-family': 'foreground.messages',
    'countdown-setting-show-widget-font-size': 'foreground.timers',
    'foreground-stopwatch-history-setting': 'foreground.timers',
    'foreground-time-id-list': 'foreground.timers',
    'foreground-city-name-setting-f516f799': 'foreground.timers',
    'foreground-hours-setting': 'foreground.timers',
    'stopwatch-setting-show-widget-scale': 'foreground.timers',
    'foreground-video-show-s1-show-properties-setting': 'foreground.media',
    'foreground-images-slide-show-show-opened': 'foreground.media',
    'video-show-s1-common-color': 'foreground.media',
    'image-show-setting-show-widget-offset-x': 'foreground.media',
    'web-show-setting-show-widget-alignment-data': 'foreground.media',
    'web-snow.html-setting-show-widget-width-percentage': 'foreground.media',
    'select-dir-video-fg-s1': 'foreground.media',
    'camera-vd-camera': 'foreground.camera',
    'foreground-camera-vd-camera': 'foreground.camera',
    'screen-show-1-scale': 'foreground.screenShow',
    'foreground-open-panels': 'foreground.panel',
    'presenter-foreground-floating': 'foreground.panel',
    'foreground-active': 'foreground.panel',
    'background-image-sessions': 'background.images',
    'select-dir-image-bg-s1': 'background.images',
    'images-slide-auto-play-show': 'background.images',
    'bg-view-mode-images-slide-show': 'background.images',
    'video-fading-at-the-end': 'background.videos',
    'bg-view-mode-select-dir-video-bg': 'background.videos',
    'background-web-url-list': 'background.webs',
    'select-dir-web-bg-s1-list-sort': 'background.webs',
    'select-dir-audio-bg-repeat-0123456789abcdef': 'background.audios',
    'background-tab': 'background.panel',
    'bg-thumbnail-width': 'background.panel',
    'presenter-tab': 'documents.presenter',
    'selected-vary-app-document-item': 'documents.presenter',
    'vary-app-document-slide-auto-play-step': 'documents.presenter',
    'select-dir-app-document-color-note-collapsed-unknown':
        'documents.presenter',
    'presenter-item-thumbnail-size-C__Users_me_data_documents_a_ows':
        'documents.presenter',
    'lyric-stage-style-0': 'documents.lyrics',
    'open-lyric-previewer-setting': 'documents.lyrics',
    'canvas-editor-scale': 'documents.editors',
    'canvas-item-preview': 'documents.editors',
    'web-editor-wrap-text': 'documents.editors',
    'bible-xml-wrap-text': 'documents.editors',
    'slide-editor-tool-title': 'documents.editors',
    'presenting-flow-opened-@data_presenting-flows_a_owpf':
        'documents.presentingFlows',
    'presenting-flow-preview-thumbnail-size-scale': 'documents.presentingFlows',
    'resources-search-showing': 'documents.resources',
    'widget-size-a song.ows': 'layout.documentPanelSizes',
    'widget-size-@data_documents_a_ows': 'layout.documentPanelSizes',
    'widget-size-C__Users_me_slides_b_pptx': 'layout.documentPanelSizes',
    'widget-size-app-presenter-left': 'layout.panelSizes',
    'widget-size-flex-size-background': 'layout.panelSizes',
    'widget-size-bible-reading-left-h': 'layout.panelSizes',
    'floating-widget-rect-foreground-marquee-top': 'layout.windows',
    'floating-widget-rect-presenting-flow-preview-@data_a_owpf':
        'layout.windows',
    'presenting-control-widget-rect': 'layout.windows',
    'app-document-preview-rect-C__Users_me_a_ows': 'layout.windows',
    'keyboard-shortcuts-panel-rect-presenter': 'layout.windows',
    'last-page-location': 'layout.windows',
    'setting-tabs': 'layout.windows',
    'bible-setting-KJV-xml-data-editing-type': 'layout.windows',
    'chatbot-llm-provider': 'ai.assistant',
    'chatbot-llm-model-bedrock': 'ai.assistant',
    'chatbot-spend-limit': 'ai.assistant',
    'virtual-display-1-card-expanded': 'connections.mirror',
    'virtual-screens-manager-tab': 'connections.mirror',
    notes: OTHER_LEAF_ID,
    'a-feature-added-next-year': OTHER_LEAF_ID,
    // Never travel.
    'presenting-flow-rename-migrated': SETTING_EXCLUDED,
    'setting-key-path-migration': SETTING_EXCLUDED,
    'previewer-note-close-migration': SETTING_EXCLUDED,
    'setting-tab-request': SETTING_EXCLUDED,
    'error-datetime-setting': SETTING_EXCLUDED,
    'chatbot-sessions': SETTING_EXCLUDED,
    'chatbot-spend-ledger': SETTING_EXCLUDED,
    'aichat-sessions': SETTING_EXCLUDED,
    'aichat-sessions-3': SETTING_EXCLUDED,
    'screen-vary-app-document-manager': SETTING_EXCLUDED,
    'screen-bg-manager': SETTING_EXCLUDED,
    'screen-draw-data-0': SETTING_EXCLUDED,
    'selected-lyric': SETTING_EXCLUDED,
};

describe('the section tree', () => {
    // Leaf ids are written into exported files; renaming one makes every file
    // exported before the rename come back with that section unknown.
    test('keeps every leaf id that files carry', () => {
        expect(
            listSettingLeaves().map((leaf) => {
                return leaf.id;
            }),
        ).toEqual([
            'general.language',
            'general.theme',
            'general.font',
            'general.tips',
            'general.folders',
            'general.colorNotes',
            'bible.lookup',
            'bible.openPassages',
            'bible.view',
            'bible.screenStyle',
            'bible.notes',
            'screens.setup',
            'screens.transitions',
            'screens.drawing',
            'screens.preview',
            'screens.pages',
            'foreground.marquee',
            'foreground.messages',
            'foreground.timers',
            'foreground.media',
            'foreground.camera',
            'foreground.screenShow',
            'foreground.panel',
            'background.images',
            'background.videos',
            'background.webs',
            'background.audios',
            'background.panel',
            'documents.presenter',
            'documents.lyrics',
            'documents.editors',
            'documents.presentingFlows',
            'documents.resources',
            'layout.documentPanelSizes',
            'layout.panelSizes',
            'layout.windows',
            'ai.providers',
            'ai.assistant',
            'connections.mirror',
            'secrets.aiKeys',
            'secrets.songSelect',
            'secrets.connectionCodes',
            OTHER_LEAF_ID,
        ]);
    });

    test('credentials need a password and are never ticked by default', () => {
        const secretLeaves = SETTING_SECTION_LIST.find((section) => {
            return section.id === 'secrets';
        })!.leaves;
        expect(secretLeaves.length).toBe(3);
        for (const leaf of secretLeaves) {
            expect(leaf.needsPassword).toBe(true);
            expect(leaf.isOptInOnImport).toBe(true);
        }
        expect(
            listSettingLeaves().filter((leaf) => {
                return leaf.needsPassword;
            }),
        ).toHaveLength(3);
    });

    test('the leaves the main process reads at launch ask for a restart', () => {
        expect(getSettingLeaf('screens.setup')?.needsRelaunch).toBe(true);
        expect(getSettingLeaf('connections.mirror')?.needsRelaunch).toBe(true);
        expect(getSettingLeaf('foreground.marquee')?.needsRelaunch).toBe(
            undefined,
        );
        expect(getSettingLeaf('no.such.leaf')).toBeNull();
    });

    test('no exact key is claimed twice', () => {
        const seenKeys = new Map<string, string>();
        const duplicates: string[] = [];
        for (const { key, leafId } of listLocalExactKeyClaims()) {
            if (seenKeys.has(key)) {
                duplicates.push(`${key}: ${seenKeys.get(key)} & ${leafId}`);
            }
            seenKeys.set(key, leafId);
        }
        expect(duplicates).toEqual([]);
    });
});

describe('classifying a local setting', () => {
    test('puts every real key where a volunteer would look for it', () => {
        const misplaced = Object.entries(REAL_LOCAL_KEY_LEAF_MAP)
            .map(([key, expectedLeafId]) => {
                return {
                    key,
                    expected: expectedLeafId,
                    actual: classifySettingKey('local', key),
                };
            })
            .filter(({ expected, actual }) => {
                return expected !== actual;
            });
        expect(misplaced).toEqual([]);
    });

    test('every data folder is a Folder, never a session or a sort', () => {
        for (const key of Object.values(dirSourceSettingNames)) {
            expect(classifySettingKey('local', key)).toBe('general.folders');
        }
        expect(classifySettingKey('local', 'select-dir-image-bg-s1')).toBe(
            'background.images',
        );
        expect(
            classifySettingKey('local', 'select-dir-web-bg-list-filter-type'),
        ).toBe('background.webs');
    });

    test('a Reader key shadowing another lands with it', () => {
        expect(classifySettingKey('local', 'reader-pdf-full-width')).toBe(
            'screens.pages',
        );
    });

    test('toSettingLeafId reads excluded and invalid as no leaf', () => {
        expect(toSettingLeafId('local', 'chatbot-sessions')).toBeNull();
        expect(toSettingLeafId('local', '../escape')).toBeNull();
        expect(toSettingLeafId('local', 'pdf-full-width')).toBe(
            'screens.pages',
        );
    });
});

describe('classifying the main process stores', () => {
    test('the home store is an allowlist', () => {
        expect(classifySettingKey('home', 'ai-setting')).toBe('ai.providers');
        expect(classifySettingKey('home', 'ai-custom-servers')).toBe(
            'ai.providers',
        );
        expect(classifySettingKey('home', 'screen-mirror-tunnel')).toBe(
            'connections.mirror',
        );
        expect(classifySettingKey('home', 'song-select-setting')).toBe(
            'secrets.songSelect',
        );
        expect(
            classifySettingKey(
                'home',
                'lexical-playground-editor-zoom-percent',
            ),
        ).toBe('bible.notes');
        for (const key of [
            'selected-parent-dir',
            'selected-parent-dir-id',
            'selected-parent-dir-history',
            'screen-mirror-identity',
            'screen-mirror-guests',
            'screen-mirror-mode',
            'virtual-display-access',
            'ai-enabled',
            'lexical-playground-editor-state',
            '__proto__',
            'constructor',
            'something-new',
        ]) {
            expect(classifySettingKey('home', key)).toBe(SETTING_EXCLUDED);
        }
    });

    test('the secure store is an allowlist without the TLS key', () => {
        expect(SECURE_SETTING_KEY_LIST).toEqual([
            'ai-setting-secret',
            'ai-custom-servers-secret',
            'song-select-setting-secret',
            'screen-mirror-code',
            'virtual-display-code',
        ]);
        expect(classifySettingKey('secure', 'ai-setting-secret')).toBe(
            'secrets.aiKeys',
        );
        expect(classifySettingKey('secure', 'virtual-display-tls')).toBe(
            SETTING_EXCLUDED,
        );
        expect(classifySettingKey('secure', '__proto__')).toBe(
            SETTING_EXCLUDED,
        );
    });

    test('the theme has one key', () => {
        expect(classifySettingKey('theme', THEME_SETTING_KEY)).toBe(
            THEME_LEAF_ID,
        );
        expect(classifySettingKey('theme', 'other')).toBe(SETTING_EXCLUDED);
    });
});

describe('a key as a file name', () => {
    test('takes the names real settings have', () => {
        for (const key of [
            'widget-size-song 99 new.ows',
            'widget-size-សេចក្តីស្រឡាញ់.ows',
            'video-show-13_cv.mp4-setting-show-widget-blend-mode',
            'presenting-flow-opened-@data_presenting-flows_a_owpf',
        ]) {
            expect(checkIsPortableSettingKey(key)).toBe(true);
        }
    });

    test('refuses anything that is not a plain file name', () => {
        for (const key of [
            '',
            '..',
            '../escape',
            '..\\escape',
            'C:\\Windows\\x',
            'a/b',
            'bible-preview-font-size:presenter',
            'a*b',
            'a?b',
            'a"b',
            'a<b',
            'a|b',
            'tab\there',
            'nul\u0000',
            '.hidden',
            'dot-at-end.',
            'space-at-end ',
            'CON',
            'nul.txt',
            'com1',
            'LPT9.log',
            'x'.repeat(256),
            // 86 Khmer characters are 258 UTF-8 bytes.
            'ក'.repeat(86),
            42,
            null,
        ]) {
            expect(checkIsPortableSettingKey(key)).toBe(false);
        }
        expect(checkIsPortableSettingKey('x'.repeat(255))).toBe(true);
        expect(checkIsPortableSettingKey('ក'.repeat(85))).toBe(true);
        expect(classifySettingKey('local', '../escape')).toBeNull();
        expect(classifySettingKey('home', 'a/b')).toBeNull();
    });
});
