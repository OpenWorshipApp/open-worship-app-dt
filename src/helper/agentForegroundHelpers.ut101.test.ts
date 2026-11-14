// @vitest-environment jsdom

import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

// The same mock surface as `agentForegroundHelpers.test.ts`, with the doors
// that file never opens: cameras, a session's folder of files, the backup
// failing, a panel that could not be opened, a Long Text Show on a screen.
const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        settings: new Map<string, string>(),
        restoresList: [] as any[][],
        appendedList: [] as any[][],
        notified: [] as string[],
        opened: [] as string[],
        presets: [] as [string, string][],
        longTextHidden: [] as [string, number | undefined][],
        longTextShowing: new Map<string, [number][]>(),
        cameras: [] as { deviceId: string; label: string }[],
        dirPaths: new Map<string, string>(),
        files: new Map<string, { filePath: string; fullName: string }[]>(),
        backupError: null as Error | null,
        isPanelOpened: true,
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getLongTextShowingList: (sourceId: string) => {
            return h.longTextShowing.get(sourceId) ?? [];
        },
        hideLongText: (sourceId: string, screenId?: number) => {
            h.longTextHidden.push([sourceId, screenId]);
        },
        restyleLongText: () => {},
        getInstance: () => null,
    },
}));
// The Properties panel's own style, marked so a test can tell whose it is.
vi.mock('../presenter-foreground/propertiesSettingHelpers', () => ({
    genForegroundExtraStyle: (prefix: string) => {
        return {
            look: prefix,
            fontSize: `${h.settings.get(`${prefix}-setting-show-widget-font-size`) ?? 100}px`,
        };
    },
    getForegroundIsBehind: () => false,
    getForegroundWidthScale: () => 50,
}));
vi.mock('../presenter-foreground/foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: () => undefined,
}));
vi.mock('../presenter-foreground/foregroundSessionHelpers', () => ({
    checkIsSessionData: (
        data: { id?: string },
        sessionId: string,
        sessionIds: string[],
    ) => {
        const owner = data.id ?? '';
        const resolved =
            sessionIds.length === 0 || sessionIds.includes(owner)
                ? owner
                : sessionIds[0];
        return resolved === sessionId;
    },
}));
vi.mock('../presenter-foreground/ForegroundSoundControlComp', () => ({
    getForegroundSoundData: () => ({ isSoundOn: false, soundVolume: 100 }),
}));
vi.mock('../presenter-foreground/foregroundPanelRevisionHelpers', () => ({
    notifyForegroundPanel: (key: string) => {
        h.notified.push(key);
    },
}));
vi.mock('../presenter-foreground/foregroundWidgetHelpers', () => ({
    FOREGROUND_OPEN_PANELS_SETTING_NAME: 'foreground-open-panels',
    requestForegroundPanelOpening: (key: string) => {
        if (h.isPanelOpened) {
            h.opened.push(key);
        }
        return h.isPanelOpened;
    },
    toOpenedPanelKeys: (raw: string, key: string) => {
        return [...raw.split(',').filter(Boolean), key].join(',');
    },
}));
vi.mock('../presenter-foreground/quickTextPresetHelpers', () => ({
    applyQuickTextPreset: (suffix: string, presetId: string) => {
        h.presets.push([suffix, presetId]);
        return true;
    },
}));
vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: async (text: string) => ({ html: `<p>${text}</p>` }),
}));
vi.mock('./agentBibleHelpers', () => ({
    resolveVersionOrder: async () => ({ order: ['KJV'], installed: ['KJV'] }),
    resolveBibleItem: async (reference: string) => {
        return reference === 'John 3:16'
            ? {
                  toText: async () => 'For God so loved the world.',
              }
            : null;
    },
}));
vi.mock('../presenter-foreground/foregroundQuickTextOpenHelpers', () => ({
    genBibleItemQuickTextMarkdown: async () => ({
        title: '(KJV) John 3:16',
        markdown: '**(KJV) John 3:16**\n\nFor God so loved the world.',
        fontFamily: 'app-Sample Serif',
    }),
    applyBibleVerseFont: (suffix: string, fontFamily: string) => {
        h.settings.set(`quick-text${suffix}-common-font-family`, fontFamily);
    },
}));
vi.mock('../presenter-foreground/ForegroundMessageComp', () => ({
    toStoredText: (list: { text: string }[]) => {
        return list
            .map((one) => {
                return one.text;
            })
            .join('\n\n');
    },
}));
vi.mock('./agentScreenHelpers', () => ({
    toForegroundSummary: (data: any) => {
        return Object.entries(data ?? {})
            .filter(([, value]) => {
                return Array.isArray(value) ? value.length > 0 : value !== null;
            })
            .map(([key]) => key);
    },
    // A stand-in for the text layer's line: `{ longText: 'title' }`.
    toLongTextSummary: (viewData: any) => {
        return viewData?.longText ? [`long text "${viewData.longText}"`] : [];
    },
}));
vi.mock('./cameraHelpers', () => ({
    getAllCameraDevices: async () => h.cameras,
}));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            return h.dirPaths.get(settingName) ?? null;
        },
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    runWithAgentBackup: async (
        _summary: string,
        restores: any[],
        change: () => Promise<unknown>,
    ) => {
        // The real one refuses the change when its backup cannot be kept.
        if (h.backupError !== null) {
            throw h.backupError;
        }
        h.restoresList.push(restores);
        return { meta: { id: 'undo-1' }, value: await change() };
    },
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    // What a show did to the screens joins the backup after it (EC-540).
    appendAgentBackupRestores: async (_id: string, restores: any[]) => {
        h.appendedList.push(restores);
    },
    listAgentFiles: async (dirPath: string) => {
        return h.files.get(dirPath) ?? [];
    },
}));

import {
    handleAgentForegroundRequest,
    refreshForegroundAfterUndo,
} from './agentForegroundHelpers';

// A stand-in for `ScreenForegroundManager`, as the other file builds it, with
// the camera and screen doors added.
function genForegroundManager() {
    const manager: any = {
        foregroundData: {
            messageDataList: [],
            countdownDataList: [],
            stopwatchDataList: [],
            timeDataList: [],
            marqueeTopDataList: [],
            marqueeBottomDataList: [],
            quickTextDataList: [],
            cameraDataList: [],
            screenDataList: [],
            webDataList: [],
            videoDataList: [],
            imageDataList: [],
        },
        calls: [] as string[],
    };
    const setter = (key: string) => {
        return (data: any) => {
            manager.calls.push(key);
            manager.foregroundData = { ...manager.foregroundData, [key]: data };
        };
    };
    const toSessionKey = (data: any) => {
        return typeof data?.id === 'string' ? data.id : '';
    };
    manager.putSessionData = (key: string, data: any) => {
        manager.calls.push(`put:${key}`);
        const dataList: any[] = manager.foregroundData[key];
        const index = dataList.findIndex((one) => {
            return toSessionKey(one) === toSessionKey(data);
        });
        manager.foregroundData = {
            ...manager.foregroundData,
            [key]:
                index === -1
                    ? [...dataList, data]
                    : dataList.map((one, oneIndex) => {
                          return oneIndex === index ? data : one;
                      }),
        };
    };
    manager.removeSessionData = (key: string, data: any) => {
        manager.calls.push(`remove:${key}`);
        manager.foregroundData = {
            ...manager.foregroundData,
            [key]:
                data === null
                    ? []
                    : manager.foregroundData[key].filter((one: any) => {
                          return toSessionKey(one) !== toSessionKey(data);
                      }),
        };
    };
    for (const [name, key] of [
        ['setCountdownData', 'countdownDataList'],
        ['setStopwatchData', 'stopwatchDataList'],
        ['setMarqueeTopData', 'marqueeTopDataList'],
        ['setMarqueeBottomData', 'marqueeBottomDataList'],
        ['setQuickTextData', 'quickTextDataList'],
    ]) {
        manager[name] = (data: any) => {
            manager.putSessionData(key, data);
        };
    }
    for (const key of [
        'timeDataList',
        'messageDataList',
        'videoDataList',
        'imageDataList',
        'webDataList',
        'cameraDataList',
        'screenDataList',
    ]) {
        manager[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            setter(key);
    }
    manager.addTimeData = (data: any) => {
        manager.calls.push('addTimeData');
        manager.foregroundData = {
            ...manager.foregroundData,
            timeDataList: [
                ...manager.foregroundData.timeDataList.filter((one: any) => {
                    return one.id !== data.id;
                }),
                data,
            ],
        };
    };
    manager.removeTimeData = (data: any) => {
        manager.calls.push('removeTimeData');
        manager.foregroundData = {
            ...manager.foregroundData,
            timeDataList: manager.foregroundData.timeDataList.filter(
                (one: any) => {
                    return one !== data;
                },
            ),
        };
    };
    // One entry per camera / source screen, by its id.
    for (const [part, key] of [
        ['Camera', 'cameraDataList'],
        ['Screen', 'screenDataList'],
    ]) {
        manager[`add${part}Data`] = (data: any) => {
            manager.calls.push(`add${part}Data`);
            manager.foregroundData = {
                ...manager.foregroundData,
                [key]: [
                    ...manager.foregroundData[key].filter((one: any) => {
                        return one.id !== data.id;
                    }),
                    data,
                ],
            };
        };
        manager[`remove${part}Data`] = (data: any) => {
            manager.calls.push(`remove${part}Data`);
            manager.foregroundData = {
                ...manager.foregroundData,
                [key]: manager.foregroundData[key].filter((one: any) => {
                    return one.id !== data.id;
                }),
            };
        };
    }
    return manager;
}

function genManager(screenId: number, extra: any = {}) {
    const screenManager: any = {
        screenId,
        isShowing: false,
        isLocked: false,
        isSelected: true,
        isDeleted: false,
        screenForegroundManager: genForegroundManager(),
        screenLongTextManager: { screenViewData: null },
        ...extra,
    };
    screenManager.clearForeground = () => {
        screenManager.screenForegroundManager.calls.push('clearForeground');
        screenManager.screenForegroundManager.foregroundData =
            genForegroundManager().foregroundData;
    };
    return screenManager;
}

function dataOf(index = 0) {
    return h.managers[index].screenForegroundManager.foregroundData;
}

function setData(index: number, key: string, list: any[]) {
    const manager = h.managers[index].screenForegroundManager;
    manager.foregroundData = { ...manager.foregroundData, [key]: list };
}

function readSessionList(widget: string) {
    return JSON.parse(h.settings.get(`foreground-${widget}-sessions`) ?? '[]');
}

async function ask(request: Record<string, unknown>, now = NOW) {
    return (await handleAgentForegroundRequest(request, now)) as any;
}

// A fixed "now": 10:00 in the morning, local time.
const NOW = new Date(2026, 8, 11, 10, 0, 0, 0);

beforeEach(() => {
    h.isPagePresenter = true;
    h.managers = [genManager(0)];
    h.settings.clear();
    h.restoresList = [];
    h.appendedList = [];
    h.notified = [];
    h.opened = [];
    h.presets = [];
    h.longTextHidden = [];
    h.longTextShowing = new Map();
    h.cameras = [];
    h.dirPaths = new Map();
    h.files = new Map();
    h.backupError = null;
    h.isPanelOpened = true;
});

describe('the front door', () => {
    it('refuses an action it does not know, naming the ones there are', async () => {
        const result = await ask({ action: 'explode', widget: 'countdown' });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('Unknown action "explode"');
        expect(result.reason).toContain('start, stop, check, read, set');
    });

    it('asks which extra to stop when none is named', async () => {
        const result = await ask({ action: 'stop' });
        expect(result.reason).toContain('Say which extra to stop');
        expect(h.managers[0].screenForegroundManager.calls).toEqual([]);
    });

    it('answers a failure inside the worker as a sentence, never a throw', async () => {
        h.managers = null as any;
        const result = await ask({ action: 'check' });
        expect(result.isError).toBe(true);
        expect(typeof result.reason).toBe('string');
        expect(result.reason).not.toBe('');
    });

    it('reads "messages" as the Messages component', async () => {
        const result = await ask({ action: 'read', widget: 'messages' });
        expect(result).toMatchObject({
            did: 'read',
            widget: 'message',
            component: 'Messages',
            content: { texts: [], rotate: false, interval: 8 },
        });
        expect(h.restoresList).toEqual([]);
    });
});

describe('check', () => {
    it('says no extra is up, and changes nothing', async () => {
        const result = await ask({ action: 'check' });
        expect(result).toMatchObject({
            did: 'checked',
            widget: null,
            detail: 'No foreground extra is on any screen.',
            isAnyShowing: false,
            note: 'Nothing was changed: this only read the screens.',
        });
    });

    it('names what each screen holds and which one is off', async () => {
        h.managers = [
            genManager(0, { isShowing: true }),
            genManager(1),
            genManager(2, { isDeleted: true }),
        ];
        setData(0, 'countdownDataList', [{ dateTime: NOW }]);
        setData(1, 'marqueeTopDataList', [{ text: 'Welcome' }]);
        setData(2, 'quickTextDataList', [{ htmlText: 'gone' }]);
        const result = await ask({ action: 'check', widget: 'clock' });
        expect(result.widget).toBe('time');
        expect(result.isAnyShowing).toBe(true);
        expect(result.detail).toBe(
            'Screen 0 holds countdownDataList. ' +
                'Screen 1 holds marqueeTopDataList (off).',
        );
        // A deleted screen is no screen at all.
        expect(
            result.screens.map((one: any) => {
                return one.screenId;
            }),
        ).toEqual([0, 1]);
    });

    it('names a Long Text Show up in the text layer (EC-552)', async () => {
        // Drawn where a passage is, not in the foreground list: it had
        // read "No foreground extra is on any screen" over it.
        h.managers = [
            genManager(0, {
                screenLongTextManager: {
                    screenViewData: { longText: 'Morning Psalm' },
                },
            }),
        ];
        setData(0, 'countdownDataList', [{ dateTime: NOW }]);
        const result = await ask({ action: 'check' });
        expect(result.detail).toBe(
            'Screen 0 holds countdownDataList, long text "Morning Psalm" (off).',
        );
        expect(result.screens[0].foreground).toEqual([
            'countdownDataList',
            'long text "Morning Psalm"',
        ]);
    });
});

describe('a camera, by its name', () => {
    beforeEach(() => {
        h.cameras = [
            { deviceId: 'dev-a', label: 'Cam 2 Wide' },
            { deviceId: 'dev-b', label: 'Cam 2' },
            { deviceId: 'dev-c', label: 'Side Camera' },
        ];
    });

    it('asks which camera when none is named', async () => {
        const result = await ask({ action: 'show', widget: 'camera' });
        expect(result.reason).toContain('Say which camera to show');
        expect(dataOf().cameraDataList).toEqual([]);
    });

    it('says when no camera is connected at all', async () => {
        h.cameras = [];
        const result = await ask({
            action: 'show',
            widget: 'camera',
            camera: 'Front',
        });
        expect(result.reason).toBe(
            'There is no camera called "Front". No camera is connected to ' +
                'this computer.',
        );
    });

    it('names the cameras there are for one it cannot find', async () => {
        const result = await ask({
            action: 'show',
            widget: 'camera',
            camera: 'Front',
        });
        expect(result.reason).toContain(
            'The cameras are "Cam 2 Wide", "Cam 2", "Side Camera".',
        );
        expect(h.restoresList).toEqual([]);
    });

    it('takes the camera called exactly that over one whose name holds it', async () => {
        const result = await ask({
            action: 'show',
            widget: 'camera',
            camera: 'cam 2',
        });
        expect(result).toMatchObject({
            did: 'shown',
            component: 'Camera Show',
            session: null,
            name: 'Camera Show › Cam 2',
            detail: 'the camera "Cam 2"',
            undoId: 'undo-1',
        });
        expect(dataOf().cameraDataList).toHaveLength(1);
        expect(dataOf().cameraDataList[0]).toMatchObject({
            id: 'dev-b',
            label: 'Cam 2',
            extraStyle: { look: 'camera-dev-b' },
        });
        // The camera's own Properties are what an undo puts back.
        expect(
            h.restoresList[0].map((one: any) => {
                return one.key;
            }),
        ).toContain('camera-dev-b-setting-show-widget-scale');
    });

    it('finds a camera by part of its name', async () => {
        const result = await ask({
            action: 'show',
            widget: 'camera',
            camera: 'side',
        });
        expect(result.name).toBe('Camera Show › Side Camera');
        expect(dataOf().cameraDataList[0].id).toBe('dev-c');
    });

    it('takes one camera off and leaves the other up', async () => {
        setData(0, 'cameraDataList', [
            { id: 'dev-b', label: 'Cam 2' },
            { id: 'dev-c', label: 'Side Camera' },
        ]);
        const result = await ask({
            action: 'stop',
            widget: 'camera',
            camera: 'Side Camera',
        });
        expect(result.did).toBe('stopped');
        expect(result.session).toBeUndefined();
        expect(
            dataOf().cameraDataList.map((one: any) => {
                return one.id;
            }),
        ).toEqual(['dev-b']);
    });

    it('reads the cameras, and the look of the one named', async () => {
        setData(0, 'cameraDataList', [{ id: 'dev-b', label: 'Cam 2' }]);
        const all = await ask({ action: 'read', widget: 'camera' });
        expect(all).toMatchObject({
            did: 'read',
            component: 'Camera Show',
            cameras: ['Cam 2 Wide', 'Cam 2', 'Side Camera'],
            onScreens: [0],
        });
        expect(all.look).toBeUndefined();
        h.settings.set('camera-dev-b-setting-show-widget-blend-mode', 'screen');
        const one = await ask({
            action: 'read',
            widget: 'camera',
            camera: 'Cam 2',
        });
        expect(one.look).toMatchObject({
            position: expect.any(String),
            width: '50%',
            blend: 'screen',
            color: '#FFFFFF',
        });
        expect(one.look.size).toBeUndefined();
    });

    it('asks which camera before changing a look', async () => {
        const result = await ask({
            action: 'set',
            widget: 'camera',
            look: { opacity: 50 },
        });
        expect(result.reason).toBe('Say which camera: camera, by its name.');
        expect(h.restoresList).toEqual([]);
    });
});

describe('another screen, by its number', () => {
    beforeEach(() => {
        h.managers = [genManager(0), genManager(1)];
    });

    it('asks which screen, and refuses one there is not', async () => {
        const unnamed = await ask({ action: 'show', widget: 'screen' });
        expect(unnamed.reason).toContain('Say which screen to show: source');
        const missing = await ask({
            action: 'show',
            widget: 'screen',
            source: 5,
        });
        expect(missing.reason).toBe('There is no screen 5.');
        const read = await ask({ action: 'read', widget: 'screen', source: 9 });
        expect(read.reason).toBe('There is no screen 9.');
    });

    it('puts one screen up on the others, never on itself', async () => {
        const result = await ask({
            action: 'show',
            widget: 'screen',
            source: 1,
        });
        expect(result).toMatchObject({
            did: 'shown',
            name: 'Screen Show › 1',
            detail: 'what screen 1 shows',
        });
        expect(dataOf(0).screenDataList).toHaveLength(1);
        expect(dataOf(0).screenDataList[0]).toMatchObject({
            id: 1,
            extraStyle: { look: 'screen-show-1' },
        });
        expect(dataOf(1).screenDataList).toEqual([]);
    });

    it('reads the screens there are, and a source screen its look', async () => {
        const all = await ask({ action: 'read', widget: 'screen' });
        expect(all.sources).toEqual([0, 1]);
        expect(all.look).toBeUndefined();
        const one = await ask({
            action: 'read',
            widget: 'screen',
            source: '1',
        });
        expect(one.look).toMatchObject({ blend: 'normal', opacity: '100%' });
        expect(one.look.color).toBeUndefined();
    });

    it('asks which screen before changing a look', async () => {
        const result = await ask({
            action: 'set',
            widget: 'screen',
            look: { opacity: 50 },
        });
        expect(result.reason).toBe('Say which screen: source, its number.');
    });
});

describe('a clip, a picture or a page from the session folder', () => {
    function setFolder(
        widget: 'video' | 'image' | 'web',
        names: string[],
        suffix = '',
    ) {
        const setting = {
            video: 'select-dir-video-fg',
            image: 'select-dir-image-fg',
            web: 'select-dir-web-bg',
        }[widget];
        const dirPath = `${widget}-folder${suffix}`;
        h.dirPaths.set(`${setting}${suffix}`, dirPath);
        h.files.set(
            dirPath,
            names.map((fullName) => {
                return { filePath: `${dirPath}/${fullName}`, fullName };
            }),
        );
    }

    it('asks which file, and says when the session has no folder', async () => {
        const unnamed = await ask({ action: 'show', widget: 'video' });
        expect(unnamed.reason).toBe(
            'Say which video to show: file, by its name.',
        );
        const noFolder = await ask({
            action: 'show',
            widget: 'video',
            file: 'intro',
        });
        expect(noFolder.reason).toContain(
            'That Video Show session has no folder set yet.',
        );
    });

    it("puts the one file up by its name, with the clip's sound set", async () => {
        setFolder('video', ['intro.mp4', 'outro.mp4']);
        const result = await ask({
            action: 'show',
            widget: 'video',
            file: 'intro',
            sound: 'on',
            volume: 40.4,
        });
        expect(result).toMatchObject({ did: 'shown', detail: '"intro.mp4"' });
        expect(dataOf().videoDataList).toHaveLength(1);
        expect(dataOf().videoDataList[0].filePath).toBe(
            'video-folder/intro.mp4',
        );
        expect(h.settings.get('video-show-sound-on')).toBe('true');
        expect(h.settings.get('video-show-sound-volume')).toBe('40');
        // The sound keys are in the backup, absent ones as null.
        expect(h.restoresList[0]).toContainEqual({
            type: 'app-setting',
            key: 'video-show-sound-volume',
            text: null,
            foreground: 'video',
        });
    });

    it('names the files that fit when several do', async () => {
        setFolder('image', ['wedding one.jpg', 'wedding two.jpg', 'tree.jpg']);
        const result = await ask({
            action: 'show',
            widget: 'image',
            file: 'wedding',
        });
        expect(result.reason).toBe(
            'Several files fit "wedding": "wedding one.jpg", ' +
                '"wedding two.jpg". Say which one.',
        );
        expect(dataOf().imageDataList).toEqual([]);
    });

    it('says the folder is empty, or names what it holds', async () => {
        setFolder('web', []);
        const empty = await ask({
            action: 'show',
            widget: 'web',
            file: 'clock',
        });
        expect(empty.reason).toBe(
            'There is no file called "clock" in that session\'s folder. ' +
                'The folder is empty.',
        );
        setFolder(
            'web',
            Array.from({ length: 31 }, (_, index) => {
                return `page-${String(index).padStart(2, '0')}.html`;
            }),
        );
        const many = await ask({
            action: 'show',
            widget: 'web',
            file: 'clock',
        });
        expect(many.reason).toContain('"page-29.html" (and more).');
        expect(many.reason).not.toContain('page-30.html');
    });

    it('lists a session folder when read, cut at thirty', async () => {
        const none = await ask({ action: 'read', widget: 'image' });
        expect(none.files).toBeNull();
        setFolder('image', ['a.jpg', 'b.jpg']);
        const two = await ask({ action: 'read', widget: 'image' });
        expect(two.files).toEqual(['a.jpg', 'b.jpg']);
        expect(two.isFileListCut).toBeUndefined();
        setFolder(
            'image',
            Array.from({ length: 33 }, (_, index) => {
                return `p${index}.jpg`;
            }),
        );
        const many = await ask({ action: 'read', widget: 'image' });
        expect(many.files).toHaveLength(30);
        expect(many.isFileListCut).toBe(true);
    });

    it('refuses a volume outside 0-100, writing nothing', async () => {
        setFolder('video', ['intro.mp4']);
        const result = await ask({
            action: 'show',
            widget: 'video',
            file: 'intro.mp4',
            volume: 150,
        });
        expect(result.reason).toBe('volume is 0-100.');
        expect(h.restoresList).toEqual([]);
        expect(dataOf().videoDataList).toEqual([]);
    });

    it('turns the sound off by its word, without putting anything up', async () => {
        const result = await ask({
            action: 'set',
            widget: 'video',
            sound: 'off',
        });
        expect(result.did).toBe('changed');
        expect(h.settings.get('video-show-sound-on')).toBe('false');
        expect(result.detail).toContain('It is not on a screen');
    });

    it('refuses sound to anything but a clip, started or changed', async () => {
        const started = await ask({
            widget: 'countdown',
            minutes: 5,
            sound: true,
        });
        expect(started.reason).toBe('Only a Video Show clip has sound.');
        const changed = await ask({
            action: 'set',
            widget: 'countdown',
            volume: 50,
        });
        expect(changed.reason).toBe('Only a Video Show clip has sound.');
        expect(dataOf().countdownDataList).toEqual([]);
        expect(h.restoresList).toEqual([]);
    });
});

describe('the screens an ask names', () => {
    beforeEach(() => {
        h.managers = [
            genManager(0),
            genManager(1, { isSelected: false }),
            genManager(2),
        ];
    });

    it('goes to the screens named, ticked or not, and no others', async () => {
        const result = await ask({
            widget: 'stopwatch',
            screens: [1, '2', 'x'],
        });
        expect(
            result.screens.map((one: any) => {
                return one.screenId;
            }),
        ).toEqual([1, 2]);
        expect(dataOf(0).stopwatchDataList).toEqual([]);
        expect(dataOf(1).stopwatchDataList).toHaveLength(1);
        expect(dataOf(2).stopwatchDataList).toHaveLength(1);
    });

    it('goes to the ticked screens when no number in the list is one', async () => {
        await ask({ widget: 'stopwatch', screens: ['projector'] });
        expect(dataOf(0).stopwatchDataList).toHaveLength(1);
        expect(dataOf(1).stopwatchDataList).toEqual([]);
        expect(dataOf(2).stopwatchDataList).toHaveLength(1);
    });

    it('names the screens there are for a number none of them has (EC-522)', async () => {
        // A model counting from one asked for screen 3 of screens 0..2: the
        // refusal said "No screen is chosen ... tick one", with one ticked,
        // and the model gave up.
        const result = await ask({ widget: 'stopwatch', screens: [3] });
        expect(result.reason).toContain('There is no screen 3');
        expect(result.reason).toContain(
            '0 (ticked, OFF), 1 (not ticked, OFF), 2 (ticked, OFF)',
        );
        expect(result.reason).toContain('Leave screens out');
        expect(result.reason).not.toContain('No screen is chosen');
        expect(dataOf(0).stopwatchDataList).toEqual([]);
    });

    it('reads every screen with a session, ticked or not (EC-522)', async () => {
        const result = await ask({ action: 'read', widget: 'countdown' });
        expect(result.screens).toEqual([
            { screenId: 0, isTicked: true, isShowing: false, isLocked: false },
            { screenId: 1, isTicked: false, isShowing: false, isLocked: false },
            { screenId: 2, isTicked: true, isShowing: false, isLocked: false },
        ]);
    });

    it('takes an extra off the screens named only', async () => {
        for (const index of [0, 1, 2]) {
            setData(index, 'countdownDataList', [{ dateTime: NOW }]);
        }
        await ask({ action: 'stop', widget: 'countdown', screens: [1] });
        expect(dataOf(0).countdownDataList).toHaveLength(1);
        expect(dataOf(1).countdownDataList).toEqual([]);
        expect(dataOf(2).countdownDataList).toHaveLength(1);
    });
});

describe('a whole component taken off', () => {
    it.each([
        ['message', 'messageDataList', { id: 'message-0', text: 'Hi' }],
        ['clock', 'timeDataList', { id: 'c1' }],
        ['video', 'videoDataList', { filePath: 'a.mp4' }],
        ['image', 'imageDataList', { filePath: 'a.jpg' }],
        ['web', 'webDataList', { filePath: 'a.html' }],
        ['camera', 'cameraDataList', { id: 'dev-a' }],
        ['screen', 'screenDataList', { id: 3 }],
        ['stopwatch', 'stopwatchDataList', { id: 's1' }],
        ['marquee-top', 'marqueeTopDataList', { text: 'Top' }],
        ['marquee-bottom', 'marqueeBottomDataList', { id: 's2', text: 'B' }],
        ['quick-text', 'quickTextDataList', { htmlText: 'Q' }],
    ])(
        '%s: every entry of it, every other component left up',
        async (widget, key, item) => {
            setData(0, key, [item]);
            // Something else up beside it, which the stop must not touch.
            const bystanderKey =
                key === 'stopwatchDataList'
                    ? 'quickTextDataList'
                    : 'countdownDataList';
            setData(0, bystanderKey, [{ id: 'kept', dateTime: NOW }]);
            const result = await ask({ action: 'stop', widget });
            expect(result.did).toBe('stopped');
            expect(result.note).toBeUndefined();
            expect(dataOf()[key]).toEqual([]);
            expect(dataOf()[bystanderKey]).toEqual([
                { id: 'kept', dateTime: NOW },
            ]);
        },
    );

    it('takes every Long Text Show session off the screen holding one', async () => {
        h.settings.set(
            'foreground-long-text-sessions',
            JSON.stringify([
                { id: '', name: 'Default' },
                { id: 's2', name: 'Hymn' },
            ]),
        );
        h.longTextShowing.set('long-text-s2', [[0]]);
        const result = await ask({ action: 'hide', widget: 'long-text' });
        expect(result.did).toBe('hidden');
        expect(h.longTextHidden).toEqual([
            ['long-text', 0],
            ['long-text-s2', 0],
        ]);
    });

    it('says nothing changed when nothing of it was up', async () => {
        h.managers = [genManager(0), genManager(1)];
        const result = await ask({ action: 'stop', widget: 'countdown' });
        expect(result.note).toBe(
            'There was no countdown on the screen, so nothing changed.',
        );
        expect(
            result.screens.map((one: any) => {
                return one.screenId;
            }),
        ).toEqual([0, 1]);
    });

    it('leaves a locked screen holding it as it was, and says so', async () => {
        h.managers = [genManager(0), genManager(1, { isLocked: true })];
        setData(0, 'countdownDataList', [{ dateTime: NOW }]);
        setData(1, 'countdownDataList', [{ dateTime: NOW }]);
        const result = await ask({ action: 'stop', widget: 'countdown' });
        expect(dataOf(0).countdownDataList).toEqual([]);
        expect(dataOf(1).countdownDataList).toHaveLength(1);
        expect(result.note).toBe('Screen 1 is locked and was left as it was.');
    });

    it('refuses a component it does not know, and a session there is not', async () => {
        const unknown = await ask({ action: 'stop', widget: 'fireworks' });
        expect(unknown.reason).toContain(
            'There is no foreground component called "fireworks"',
        );
        const nowhere = await ask({
            action: 'stop',
            widget: 'countdown',
            session: 'Nowhere',
        });
        expect(nowhere.reason).toContain('"Default"');
        const noScreen = await ask({
            action: 'stop',
            widget: 'screen',
            source: 7,
        });
        expect(noScreen.reason).toBe('There is no screen 7.');
    });
});

describe('what a start or a show refuses, putting nothing up', () => {
    it('a countdown outside a quarter of a minute to a day', async () => {
        const result = await ask({ widget: 'countdown', minutes: 0.1 });
        expect(result.reason).toContain('0.1 minutes is outside that');
        expect(dataOf().countdownDataList).toEqual([]);
    });

    it('a preset the component does not have', async () => {
        const result = await ask({
            widget: 'countdown',
            minutes: 5,
            preset: 'bible-verse',
        });
        expect(result.reason).toContain('preset is one of: top-right');
        expect(dataOf().countdownDataList).toEqual([]);
    });

    it('a session there is not', async () => {
        const result = await ask({ widget: 'countdown', session: 'Nowhere' });
        expect(result.reason).toContain(
            'There is no Countdown session called "Nowhere"',
        );
    });

    it('a look field there is not', async () => {
        const result = await ask({ widget: 'countdown', look: { bogus: 1 } });
        expect(result.reason).toContain('"bogus" is not a look field');
        expect(h.restoresList).toEqual([]);
    });

    it('a reference too long to be one', async () => {
        const result = await ask({
            widget: 'quick-text',
            ref: `John ${'3'.repeat(120)}`,
        });
        expect(result.reason).toBe('ref is a reference, e.g. "John 3:16".');
    });

    it('when the backup cannot be kept', async () => {
        h.backupError = new Error('The backup could not be saved.');
        const result = await ask({ widget: 'countdown', minutes: 10 });
        expect(result).toEqual({
            isError: true,
            reason: 'The backup could not be saved.',
        });
        expect(dataOf().countdownDataList).toEqual([]);
        expect(h.settings.has('foreground-countdown-sessions')).toBe(false);
    });

    it('a marquee with no words, the session kept and its undo named', async () => {
        const result = await ask({ action: 'show', widget: 'marquee-top' });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('That marquee has no words.');
        expect(result.reason).toContain('owa_undo with id "undo-1"');
        expect(dataOf().marqueeTopDataList).toEqual([]);
    });
});

describe('show: the session as its Show button puts it up', () => {
    it('a countdown waits for Start unless its Auto Start is on', async () => {
        const waiting = await ask({ action: 'show', widget: 'countdown' });
        expect(waiting.did).toBe('shown');
        expect(waiting.detail).toBe('a 5 minute countdown, waiting for Start');
        h.settings.set('foreground-countdown-auto-start-setting', 'true');
        const running = await ask({ action: 'show', widget: 'countdown' });
        expect(running.detail).toContain('a 5 minute countdown, ending at');
        expect(dataOf().countdownDataList).toHaveLength(1);
    });

    it('a stopwatch waits at zero unless its Auto Start is on', async () => {
        const waiting = await ask({ action: 'show', widget: 'stopwatch' });
        expect(waiting.detail).toBe('a stopwatch at zero, waiting for Start');
        h.settings.set('foreground-stopwatch-auto-start-setting', 'true');
        const running = await ask({ action: 'show', widget: 'stopwatch' });
        expect(running.detail).toContain('a stopwatch, started at');
    });

    it('puts it up on the unlocked ticked screen, and says the locked one was left', async () => {
        h.managers = [genManager(0), genManager(1, { isLocked: true })];
        const result = await ask({ widget: 'countdown', minutes: 5 });
        expect(result.did).toBe('started');
        expect(dataOf(0).countdownDataList).toHaveLength(1);
        expect(dataOf(1).countdownDataList).toEqual([]);
        expect(result.note).toContain(
            'Screen 1 is locked and was left as it was.',
        );
        expect(result.note).toContain('Screen 0 holds it but is turned off');
        // Plain words, or a model writes them in English after its own
        // (EC-620): "(OFF)", "show button".
        expect(result.note).not.toMatch(/\bOFF\b|show button/);
    });

    it('opens the panel by its setting when it cannot be opened at once', async () => {
        h.isPanelOpened = false;
        h.settings.set('foreground-open-panels', 'clock');
        await ask({ widget: 'countdown', minutes: 5 });
        expect(h.settings.get('foreground-open-panels')).toBe(
            'clock,countdown',
        );
    });
});

describe('a new quick text is timed like the one the panel was on', () => {
    it('takes its wait and its length', async () => {
        h.settings.set('foreground-quick-text-time-delay', '3');
        h.settings.set('foreground-quick-text-time-to-live', '20');
        const result = await ask({
            widget: 'quick-text',
            text: 'Coffee after the service',
        });
        const suffix = `-${result.session.id}`;
        expect(result.session.isNew).toBe(true);
        expect(
            h.settings.get(`foreground-quick-text-time-delay${suffix}`),
        ).toBe('3');
        expect(
            h.settings.get(`foreground-quick-text-time-to-live${suffix}`),
        ).toBe('20');
        expect(dataOf().quickTextDataList[0]).toMatchObject({
            timeSecondDelay: 3,
            timeSecondToLive: 20,
        });
        expect(result.detail).toBe(
            'a line of text for 20 seconds after 3 seconds, in the middle of ' +
                'the screen: "Coffee after the service"',
        );
    });

    it('stays until hidden when that one does, and its own seconds win', async () => {
        h.settings.set('foreground-quick-text-is-infinite', 'true');
        const until = await ask({ widget: 'quick-text', text: 'Welcome' });
        const suffix = `-${until.session.id}`;
        expect(
            h.settings.get(`foreground-quick-text-is-infinite${suffix}`),
        ).toBe('true');
        expect(
            h.settings.get(`foreground-quick-text-time-to-live${suffix}`),
        ).toBe('10');
        const timed = await ask({
            widget: 'quick-text',
            text: 'Parking',
            seconds: 15,
        });
        const timedSuffix = `-${timed.session.id}`;
        expect(
            h.settings.has(`foreground-quick-text-is-infinite${timedSuffix}`),
        ).toBe(false);
        expect(timed.detail).toContain('a line of text for 15 seconds');
    });

    it('goes up where it was asked to, in the same start (EC-532)', async () => {
        const result = await ask({
            action: 'start',
            widget: 'quick-text',
            text: 'The owner of car ABC 123, your lights are on',
            seconds: 15,
            look: { position: 'bottom' },
        });
        const suffix = result.session.id;
        expect(result).toMatchObject({
            did: 'started',
            isChanged: true,
            changed: ['position bottom'],
        });
        expect(result.undoId).toEqual(expect.any(String));
        expect(result.detail).toContain(
            'a line of text for 15 seconds, at the bottom of the screen',
        );
        expect(
            JSON.parse(
                h.settings.get(
                    `quick-text-${suffix}-setting-show-widget-alignment-data`,
                ) ?? '{}',
            ),
        ).toEqual({ horizontalAlignment: 'center', verticalAlignment: 'end' });
        expect(dataOf().quickTextDataList[0]).toMatchObject({
            timeSecondToLive: 15,
            extraStyle: { look: `quick-text-${suffix}` },
        });
    });
});

describe('a time the component has no place for (EC-538)', () => {
    it('is refused on a message, naming the quick text, and nothing is written', async () => {
        const before = [...h.settings.entries()];
        const result = await ask({
            action: 'start',
            widget: 'message',
            text: 'The owner of car ABC 123, your lights are on',
            seconds: 15,
            look: { position: 'bottom' },
        });
        expect(result.isError).toBe(true);
        expect(result.reason).toContain('stays until it is hidden');
        expect(result.reason).toContain('quick-text, with seconds');
        // It shows where its panel places it: said, when not where asked
        // (EC-591).
        expect(result.reason).toContain(
            'when that is not where they asked, tell them',
        );
        expect([...h.settings.entries()]).toEqual(before);
        expect(dataOf().messageDataList).toEqual([]);
    });

    it('says what each component takes instead', async () => {
        const countdown = await ask({ widget: 'countdown', seconds: 30 });
        expect(countdown.reason).toContain('minutes (0.5 is 30 seconds)');
        const quickText = await ask({
            widget: 'quick-text',
            text: 'Welcome',
            minutes: 2,
        });
        expect(quickText.reason).toContain('seconds is how long it stays');
        const marquee = await ask({
            action: 'set',
            widget: 'marquee-bottom',
            text: 'Welcome',
            interval: 5,
        });
        expect(marquee.reason).toContain("that is a Messages rotation's");
        const stopwatch = await ask({ widget: 'stopwatch', minutes: 10 });
        expect(stopwatch.reason).toContain('stays until it is hidden');
        expect(dataOf().countdownDataList ?? []).toEqual([]);
        expect(dataOf().quickTextDataList).toEqual([]);
    });
});

// EC-593: in French and Spanish a message at the bottom for 15 seconds was a
// marquee with seconds, refused, then a Quick Text in the middle -- the
// ordinary tool takes no place.
describe('a marquee put up with seconds', () => {
    it('is a Quick Text at its edge, for those seconds, said so', async () => {
        const result = await ask({
            widget: 'marquee-bottom',
            text: 'The owner of car ABC 123, your lights are on',
            seconds: 15,
        });
        expect(result).toMatchObject({
            did: 'started',
            widget: 'quick-text',
            isChanged: true,
            changed: ['position bottom'],
        });
        expect(result.detail).toContain(
            'a line of text for 15 seconds, at the bottom of the screen',
        );
        expect(result.note).toContain(
            'Marquee Bottom takes no seconds, so the words went up as a ' +
                'Quick Text at the bottom instead',
        );
        expect(result.undoId).toEqual(expect.any(String));
        const suffix = result.session.id;
        expect(
            JSON.parse(
                h.settings.get(
                    `quick-text-${suffix}-setting-show-widget-alignment-data`,
                ) ?? '{}',
            ),
        ).toEqual({ horizontalAlignment: 'center', verticalAlignment: 'end' });
        expect(dataOf().quickTextDataList[0]).toMatchObject({
            timeSecondToLive: 15,
        });
        expect(dataOf().marqueeBottomDataList).toEqual([]);
    });

    it('keeps a place it was given, and the top for a top marquee', async () => {
        const top = await ask({
            action: 'start',
            widget: 'marquee-top',
            text: 'Coffee is served in the hall',
            delay: 2,
        });
        expect(top.widget).toBe('quick-text');
        expect(top.detail).toContain('at the top of the screen');
        const placed = await ask({
            widget: 'marquee-bottom',
            text: 'Parking',
            seconds: 10,
            look: { position: 'bottom left' },
        });
        expect(placed.detail).toContain('at the bottom left of the screen');
    });

    // EC-597: Free put a message asked for at the bottom up as a Quick
    // Text in the middle, and said nothing about where.
    it('a Quick Text put up in the middle says how to have it at an edge', async () => {
        const middle = await ask({
            widget: 'quick-text',
            text: 'The owner of car ABC 123, your lights are on',
            seconds: 15,
        });
        expect(middle.detail).toContain(
            'a line of text for 15 seconds, in the middle of the screen',
        );
        expect(middle.note).toContain(
            'It is in the MIDDLE of the screen, where its panel places it.',
        );
        expect(middle.note).toContain('marquee-top or marquee-bottom');
        // Moved there, the same session at the bottom, and no such note.
        const moved = await ask({
            widget: 'marquee-bottom',
            text: 'The owner of car ABC 123, your lights are on',
            seconds: 15,
        });
        expect(moved.session.id).toBe(middle.session.id);
        expect(moved.detail).toContain('at the bottom of the screen');
        expect(moved.note).not.toContain('MIDDLE');
        expect(dataOf().quickTextDataList).toHaveLength(1);
        // A place given is no middle, and nothing is said about one.
        const placed = await ask({
            action: 'start',
            widget: 'quick-text',
            text: 'Parking',
            seconds: 10,
            look: { position: 'top' },
        });
        expect(placed.note ?? '').not.toContain('MIDDLE');
    });

    it('is still the marquee with no time, and refused with a session named or on set', async () => {
        const marquee = await ask({ widget: 'marquee-bottom', text: 'Hi' });
        expect(marquee.widget).toBe('marquee-bottom');
        const named = await ask({
            widget: 'marquee-bottom',
            text: 'Hi',
            seconds: 5,
            session: 'Welcome',
        });
        expect(named.isError).toBe(true);
        expect(named.reason).toContain('takes no seconds');
        const set = await ask({
            action: 'set',
            widget: 'marquee-bottom',
            text: 'Hi',
            seconds: 5,
        });
        expect(set.isError).toBe(true);
        expect(set.reason).toContain('takes no seconds');
    });
});

describe('a session already called after the words', () => {
    it('is reused and switched to, not made again', async () => {
        const first = await ask({ widget: 'countdown', minutes: 10 });
        // The operator goes back to Default (five minutes) in the panel.
        h.settings.set('foreground-countdown-active-session', '');
        const again = await ask({ widget: 'countdown', minutes: 10 });
        expect(again.session).toEqual({
            id: first.session.id,
            name: '10:00',
            isNew: false,
        });
        expect(readSessionList('countdown')).toHaveLength(2);
        expect(h.settings.get('foreground-countdown-active-session')).toBe(
            first.session.id,
        );
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(dataOf().countdownDataList[0].id).toBe(first.session.id);
    });
});

describe('set', () => {
    it('refuses an ask that changes nothing', async () => {
        const result = await ask({ action: 'set', widget: 'countdown' });
        expect(result.reason).toContain('Nothing to change');
        expect(h.restoresList).toEqual([]);
    });

    it('refuses a reference no Bible reads', async () => {
        const result = await ask({
            action: 'set',
            widget: 'marquee-top',
            ref: 'Hezekiah 9:9',
        });
        expect(result.reason).toContain('could not be read');
    });

    it('puts new numbers up again on the screen holding the session', async () => {
        await ask({ widget: 'countdown', minutes: 5 });
        const later = new Date(NOW.getTime() + 60_000);
        const result = await ask(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                minutes: 7,
            },
            later,
        );
        expect(result.detail).toBe(
            'Countdown › Default: 7 minutes. Screen 0 shows the change now.',
        );
        expect(h.settings.get('foreground-minutes-setting')).toBe('7');
        expect(dataOf().countdownDataList).toHaveLength(1);
        const countdown = dataOf().countdownDataList[0];
        expect(countdown.durationMillisecond).toBe(420_000);
        expect(countdown.dateTime.getTime()).toBe(later.getTime() + 420_000);
    });

    it('refuses the backup failing, the setting left as it was', async () => {
        h.backupError = new Error('No room for the backup.');
        const result = await ask({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            minutes: 7,
        });
        expect(result.reason).toBe('No room for the backup.');
        expect(h.settings.has('foreground-minutes-setting')).toBe(false);
    });

    it('refuses a look on a Long Text Show, which its own card styles', async () => {
        const result = await ask({
            action: 'set',
            widget: 'long-text',
            look: { size: 'larger' },
        });
        expect(result.reason).toContain(
            'A Long Text Show language is styled in its own card',
        );
    });

    it('says a clock session with no clock has no look yet', async () => {
        const result = await ask({
            action: 'set',
            widget: 'clock',
            look: { size: 80 },
        });
        expect(result.reason).toBe(
            'That session has nothing whose look can be changed yet.',
        );
    });

    describe('a clock on the wall', () => {
        async function startLondon() {
            const started = await ask({
                widget: 'clock',
                title: 'London',
                utcOffset: 0,
            });
            const [clockId] = JSON.parse(
                h.settings.get(
                    `foreground-time-id-list-${started.session.id}`,
                )!,
            );
            return clockId as string;
        }

        it('restyles the clock by its own Properties', async () => {
            const clockId = await startLondon();
            const result = await ask({
                action: 'set',
                widget: 'clock',
                session: 'London',
                look: { size: 80 },
            });
            expect(result.changed).toEqual(['size 100 → 80px']);
            expect(
                h.settings.get(`time-${clockId}-setting-show-widget-font-size`),
            ).toBe('80');
            expect(dataOf().timeDataList).toHaveLength(1);
            expect(dataOf().timeDataList[0]).toMatchObject({
                id: clockId,
                title: 'London',
                extraStyle: { look: `time-${clockId}`, fontSize: '80px' },
            });
        });

        it('puts a preset on each clock of the session', async () => {
            const clockId = await startLondon();
            const result = await ask({
                action: 'set',
                widget: 'clock',
                session: 'London',
                preset: 'center',
            });
            expect(result.changed).toEqual(['the center look']);
            expect(
                JSON.parse(
                    h.settings.get(
                        `time-${clockId}-setting-show-widget-alignment-data`,
                    )!,
                ),
            ).toEqual({
                horizontalAlignment: 'center',
                verticalAlignment: 'center',
            });
        });

        it("reads the first clock's look, and none for a session with no clock", async () => {
            const clockId = await startLondon();
            h.settings.set(
                `time-${clockId}-setting-show-widget-font-size`,
                '64',
            );
            const read = await ask({
                action: 'read',
                widget: 'clock',
                session: 'London',
            });
            expect(read.look.size).toBe('64px');
            const empty = await ask({
                action: 'read',
                widget: 'clock',
                session: 'Default',
            });
            expect(empty.look).toBeNull();
        });
    });

    describe('a colour any browser knows', () => {
        // Chromium's own reading of a colour: the canvas keeps what it
        // understands, as `#rrggbb` or `rgba(...)`, and ignores the rest.
        function stubCanvas(table: Record<string, string>) {
            let fill = '#000000';
            const context = {
                get fillStyle() {
                    return fill;
                },
                set fillStyle(value: string) {
                    if (value === '#010203') {
                        fill = value;
                    } else if (table[value] !== undefined) {
                        fill = table[value];
                    }
                },
            };
            vi.spyOn(
                HTMLCanvasElement.prototype,
                'getContext',
            ).mockImplementation((() => {
                return context;
            }) as any);
        }

        it('is written as the hex the panel stores', async () => {
            stubCanvas({
                rebeccapurple: '#663399',
                'rgba(255, 0, 0, 0.5)': 'rgba(255, 0, 0, 0.5)',
            });
            const result = await ask({
                action: 'set',
                widget: 'quick-text',
                look: {
                    color: 'RebeccaPurple',
                    background: 'rgba(255, 0, 0, 0.5)',
                },
            });
            expect(result.isError).toBeUndefined();
            expect(h.settings.get('quick-text-common-color')).toBe('#663399');
            expect(h.settings.get('quick-text-common-background-color')).toBe(
                '#FF000080',
            );
        });

        it('is refused when the browser does not know it', async () => {
            stubCanvas({ odd: 'color(srgb 1 0 0)' });
            const unknown = await ask({
                action: 'set',
                widget: 'quick-text',
                look: { color: 'blorange' },
            });
            expect(unknown.reason).toContain(
                'color "blorange" is not a colour',
            );
            const unread = await ask({
                action: 'set',
                widget: 'quick-text',
                look: { color: 'odd' },
            });
            expect(unread.reason).toContain('color "odd" is not a colour');
            expect(h.settings.has('quick-text-common-color')).toBe(false);
        });

        it('is refused when no canvas can read it', async () => {
            const spy = vi
                .spyOn(HTMLCanvasElement.prototype, 'getContext')
                .mockImplementation((() => {
                    return null;
                }) as any);
            const none = await ask({
                action: 'set',
                widget: 'quick-text',
                look: { color: 'peru' },
            });
            expect(none.reason).toContain('color "peru" is not a colour');
            spy.mockImplementation((() => {
                throw new Error('no canvas');
            }) as any);
            const thrown = await ask({
                action: 'set',
                widget: 'quick-text',
                look: { color: 'peru' },
            });
            expect(thrown.reason).toContain('color "peru" is not a colour');
        });
    });
});

describe("a session's look read back in words", () => {
    it('names the font, weight, layer, transition and Effects set', async () => {
        h.settings.set('quick-text-common-font-family', 'Sample Sans');
        h.settings.set('quick-text-common-font-weight', '700');
        h.settings.set('quick-text-setting-show-widget-is-behind', 'true');
        h.settings.set('quick-text-setting-show-widget-always-on-top', 'true');
        h.settings.set('quick-text-setting-show-widget-transition', 'fade');
        h.settings.set(
            'quick-text-setting-show-widget-decoration',
            JSON.stringify({
                borderStyle: 'dashed',
                shadow: 'soft',
                textAlign: 'left',
                padding: 2,
            }),
        );
        const result = await ask({ action: 'read', widget: 'quick-text' });
        expect(result.look).toMatchObject({
            font: 'Sample Sans',
            bold: true,
            behind: true,
            onTop: true,
            transition: 'fade',
            border: 'dashed',
            shadow: 'soft',
            textAlign: 'left',
        });
        expect(result.look.padding).toBeUndefined();
    });

    it('reads a broken Effects value as none set', async () => {
        h.settings.set('quick-text-setting-show-widget-decoration', '{broken');
        const result = await ask({ action: 'read', widget: 'quick-text' });
        expect(result.look.border).toBeUndefined();
        expect(result.look.size).toBe('100px');
    });

    it("a picture's blend mode, and a marquee's own size and speed", async () => {
        h.settings.set('video-show-setting-show-widget-blend-mode', 'multiply');
        const video = await ask({ action: 'read', widget: 'video' });
        expect(video.look.blend).toBe('multiply');
        expect(video.look.color).toBeUndefined();
        const auto = await ask({ action: 'read', widget: 'marquee-top' });
        expect(auto.look).toMatchObject({ size: 'auto', speed: '100%' });
        h.settings.set('foreground-marquee-top-font-size', '48');
        h.settings.set('foreground-marquee-top-speed-percentage', '150');
        const sized = await ask({ action: 'read', widget: 'marquee-top' });
        expect(sized.look).toMatchObject({ size: '48px', speed: '150%' });
    });

    it('names the sessions there are for one it cannot find', async () => {
        const result = await ask({
            action: 'read',
            widget: 'stopwatch',
            session: 'Lap 9',
        });
        expect(result.reason).toBe(
            'There is no Stopwatch session called "Lap 9". The sessions are ' +
                '"Default".',
        );
    });
});

describe('timer', () => {
    it('refuses a word that is not a timer press, and a session there is not', async () => {
        const word = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'explode',
        });
        expect(word.reason).toBe(
            'timer is start, pause, resume, reset or add.',
        );
        const nowhere = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'pause',
            session: 'Nowhere',
        });
        expect(nowhere.reason).toContain('"Default"');
    });

    it('says to put it up first when it is on no screen', async () => {
        const result = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'pause',
        });
        expect(result.reason).toBe(
            'That countdown is not on a screen, so there is nothing to ' +
                'pause. Put it up first (action "show").',
        );
    });

    it('pauses, resets and starts in place, a locked screen left alone', async () => {
        h.managers = [genManager(0), genManager(1)];
        await ask({ widget: 'countdown', minutes: 5 });
        h.managers[1].isLocked = true;
        const paused = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'pause',
        });
        expect(paused.detail).toBe('The countdown on screen 0 is paused.');
        expect(typeof dataOf(0).countdownDataList[0].pausedMillisecond).toBe(
            'number',
        );
        expect(
            dataOf(1).countdownDataList[0].pausedMillisecond,
        ).toBeUndefined();
        const reset = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'reset',
        });
        expect(reset.detail).toBe(
            'The countdown on screen 0 is back at its start, stopped.',
        );
        const resumed = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'resume',
        });
        expect(resumed.detail).toBe('The countdown on screen 0 is running.');
        expect(dataOf(0).countdownDataList).toHaveLength(1);
    });

    // EC-526: "add 2 more minutes" had been written as a new length.
    it('puts more time on a countdown that is up, and says where it cannot', async () => {
        // The timer reads the clock; the countdown went up at NOW.
        vi.useFakeTimers({ toFake: ['Date'], now: NOW });
        onTestFinished(() => {
            vi.useRealTimers();
        });
        await ask({ widget: 'countdown', minutes: 5 });
        const before = dataOf(0).countdownDataList[0];
        const added = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'add',
            minutes: 2,
        });
        expect(added.detail).toBe(
            'The countdown on screen 0 has 2 minutes more.',
        );
        const after = dataOf(0).countdownDataList[0];
        expect(after.dateTime.getTime() - before.dateTime.getTime()).toBe(
            120_000,
        );
        expect(dataOf(0).countdownDataList).toHaveLength(1);
        const none = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'add',
        });
        expect(none.reason).toContain('add takes the time to put on');
        await ask({ action: 'show', widget: 'stopwatch' });
        const stopwatch = await ask({
            action: 'timer',
            widget: 'stopwatch',
            timer: 'add',
            minutes: 1,
        });
        expect(stopwatch.reason).toContain('Only a countdown takes more time');
        await ask({ action: 'hide', widget: 'countdown' });
        const off = await ask({
            action: 'timer',
            widget: 'countdown',
            timer: 'add',
            seconds: 30,
        });
        expect(off.reason).toContain('"set" its minutes to the new length');
    });

    it('starts a stopwatch that was waiting', async () => {
        await ask({ action: 'show', widget: 'stopwatch' });
        const result = await ask({
            action: 'timer',
            widget: 'stopwatch',
            timer: 'start',
        });
        expect(result).toMatchObject({
            did: 'timer',
            component: 'Stopwatch',
            detail: 'The stopwatch on screen 0 is running.',
        });
    });
});

describe('the open panels', () => {
    it('says none is open', async () => {
        const result = await ask({ action: 'read', open: true });
        expect(result).toMatchObject({
            did: 'read',
            widget: null,
            detail: 'No foreground panel is open in the Presenter.',
            panels: [],
        });
    });

    it("says whether a panel without sessions has something up, and where each session's is", async () => {
        h.settings.set('foreground-open-panels', 'screen');
        setData(0, 'screenDataList', [{ id: 1 }]);
        const one = await ask({ action: 'read' });
        expect(one.detail).toBe('1 foreground panel is open.');
        expect(one.panels).toEqual([
            {
                widget: 'screen',
                component: 'Screen Show',
                sessions: [],
                isOnScreen: true,
            },
        ]);
        await ask({ widget: 'countdown', minutes: 5 });
        h.settings.set('foreground-open-panels', 'screen,countdown');
        const two = await ask({ action: 'read', open: true });
        expect(two.detail).toBe('2 foreground panels are open.');
        expect(two.panels[1].sessions).toEqual([
            { id: '', name: 'Default', isActive: true, onScreens: [0] },
        ]);
    });
});

describe('a new session asked for by name', () => {
    it('is refused for a component with no sessions, or with no good name', async () => {
        const camera = await ask({
            action: 'session',
            widget: 'camera',
            name: 'Pulpit',
        });
        expect(camera.reason).toBe('The Camera Show has no sessions.');
        const blank = await ask({
            action: 'session',
            widget: 'quick-text',
            name: '  ',
        });
        expect(blank.reason).toContain(
            'name is what the new session is called',
        );
        const long = await ask({
            action: 'session',
            widget: 'quick-text',
            name: 'n'.repeat(41),
        });
        expect(long.reason).toContain('40 letters at most');
        const taken = await ask({
            action: 'session',
            widget: 'quick-text',
            name: 'default',
        });
        expect(taken.reason).toContain(
            'A session called "Default" is already there',
        );
        expect(h.restoresList).toEqual([]);
    });

    it('is made like the one the panel is on, the panel opened on it, nothing put up', async () => {
        h.settings.set('quick-text-setting-show-widget-font-size', '60');
        const result = await ask({
            action: 'session',
            widget: 'quick-text',
            name: 'Youth',
        });
        expect(result).toMatchObject({
            did: 'created',
            component: 'Quick Text',
            name: 'Quick Text › Youth',
            session: { name: 'Youth', isNew: true },
            isChanged: true,
            undoId: 'undo-1',
        });
        const { id } = result.session;
        expect(readSessionList('quick-text')).toEqual([
            { id: '', name: 'Default' },
            { id, name: 'Youth' },
        ]);
        expect(h.settings.get('foreground-quick-text-active-session')).toBe(id);
        expect(
            h.settings.get(`quick-text-${id}-setting-show-widget-font-size`),
        ).toBe('60');
        expect(h.settings.get(`foreground-quick-text-time-to-live-${id}`)).toBe(
            '10',
        );
        expect(h.opened).toEqual(['quick-text']);
        expect(dataOf().quickTextDataList).toEqual([]);
        expect(
            h.restoresList[0].map((one: any) => {
                return one.key;
            }),
        ).toEqual(
            expect.arrayContaining([
                'foreground-quick-text-sessions',
                'foreground-quick-text-active-session',
            ]),
        );
    });

    it('is refused when its backup cannot be kept', async () => {
        h.backupError = new Error('Backup refused.');
        const result = await ask({
            action: 'session',
            widget: 'countdown',
            name: 'Break',
        });
        expect(result.reason).toBe('Backup refused.');
        expect(h.settings.has('foreground-countdown-sessions')).toBe(false);
    });
});

describe('refreshForegroundAfterUndo', () => {
    it('does nothing for a component it does not know', async () => {
        await refreshForegroundAfterUndo('fireworks');
        await refreshForegroundAfterUndo(undefined as any);
        expect(h.notified).toEqual([]);
    });

    it('tells the panel, and off the Presenter touches no screen', async () => {
        await ask({ widget: 'countdown', minutes: 5 });
        h.notified = [];
        h.isPagePresenter = false;
        h.settings.set('countdown-setting-show-widget-font-size', '70');
        await refreshForegroundAfterUndo('countdown');
        expect(h.notified).toEqual(['countdown']);
        expect(dataOf().countdownDataList[0].extraStyle.fontSize).toBe('100px');
    });

    it('dresses again what of each session is up, as the undone keys say', async () => {
        await ask({ widget: 'countdown', minutes: 5 });
        h.notified = [];
        h.settings.set('countdown-setting-show-widget-font-size', '70');
        await refreshForegroundAfterUndo('countdown');
        expect(h.notified).toEqual(['countdown']);
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(dataOf().countdownDataList[0].extraStyle.fontSize).toBe('70px');
    });

    it('dresses a camera again on an unlocked screen only', async () => {
        h.managers = [genManager(0), genManager(1, { isLocked: true })];
        const camera = {
            id: 'dev-a',
            label: 'Cam',
            extraStyle: { fontSize: '1px' },
        };
        setData(0, 'cameraDataList', [camera]);
        setData(1, 'cameraDataList', [camera]);
        h.settings.set('camera-dev-a-setting-show-widget-font-size', '33');
        await refreshForegroundAfterUndo('camera');
        expect(dataOf(0).cameraDataList[0].extraStyle).toEqual({
            look: 'camera-dev-a',
            fontSize: '33px',
        });
        expect(dataOf(1).cameraDataList[0]).toBe(camera);
    });
});
