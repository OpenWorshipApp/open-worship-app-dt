// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The worker behind `owa_presenting_flow_edit`, past what
// `agentPresentingFlowEditHelpers.test.ts` reads: every kind of line and
// every problem `lines` names, a document's slide settings read back by
// number, the choices when the disk or the screens fail, a passage added by
// reference, and every way a batch ends with NOTHING written. The same
// stand-ins as that file, each one settable per test.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        files: new Set<string>(),
        items: [] as any[] | null,
        writtenJson: null as any[] | null,
        documentDir: '/documents' as string | null,
        documentFiles: {} as Record<string, string[]>,
    },
    mocks: {
        handleError: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        updateItemsJson: vi.fn(),
        applyAgentFlowChanges: vi.fn(),
        applyAgentFlowRemoval: vi.fn(),
        readAgentFlowChangeNeeds: vi.fn(),
        getPlace: vi.fn(),
        findFlow: vi.fn(),
        findDocumentPath: vi.fn(),
        fromDroppedData: vi.fn(),
        loadSlides: vi.fn(),
        getScreenSetting: vi.fn(),
        fsCheckFileExist: vi.fn(),
        listFiles: vi.fn(),
        resolveVersionOrder: vi.fn(),
        resolveBibleItem: vi.fn(),
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DragInf', () => ({
    DragTypeEnum: { APP_DOCUMENT: 'appDocument', BIBLE_ITEM: 'bibleItem' },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: (filePath: string) => mocks.fsCheckFileExist(filePath),
    fsListFilesWithMimetype: (dir: string, mimetypeName: string) =>
        mocks.listFiles(dir, mimetypeName),
    getMimetypeExtensions: () => ['owpf'],
}));
vi.mock('./agentBackupHelpers', () => ({
    AGENT_DOCUMENT_MIMETYPE_NAMES: ['appDocument', 'lyric'],
    NoBackupError: class NoBackupError extends Error {},
    genUndoField: () => ({ undoId: 'backup-id' }),
    runWithAgentBackup: (...args: any[]) => mocks.runWithAgentBackup(...args),
    snapshotAgentEditing: (...args: any[]) =>
        mocks.snapshotAgentEditing(...args),
}));
vi.mock('./agentFlowEditRules', () => ({
    applyAgentFlowChanges: (...args: any[]) =>
        mocks.applyAgentFlowChanges(...args),
    applyAgentFlowRemoval: (...args: any[]) =>
        mocks.applyAgentFlowRemoval(...args),
    readAgentFlowChangeNeeds: (...args: any[]) =>
        mocks.readAgentFlowChangeNeeds(...args),
    toAgentFlowColorName: (value: unknown) =>
        typeof value === 'string' ? `name-of-${value}` : null,
}));
vi.mock('./agentFlowForegroundRules', () => ({
    AGENT_FLOW_FOREGROUND_FIELD_TEXT_LIST: ['countdown: seconds'],
}));
vi.mock('./agentPresentingFlowHelpers', () => ({
    getPlace: () => mocks.getPlace(),
    checkIsPlace: (value: any) => value?.isError !== true,
    findFlow: (...args: any[]) => mocks.findFlow(...args),
    checkIsFlowFound: (value: any) => value?.isError !== true,
    findDocumentPath: (...args: any[]) => mocks.findDocumentPath(...args),
    checkIsRefusal: (value: any) => value?.isError === true,
}));
vi.mock('./agentBibleHelpers', () => ({
    MAX_REFERENCE_LENGTH: 80,
    resolveVersionOrder: (...args: any[]) => mocks.resolveVersionOrder(...args),
    resolveBibleItem: (...args: any[]) => mocks.resolveBibleItem(...args),
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            return {
                name: (filePath.split(/[\\/]/).at(-1) ?? '').replace(
                    /\.[^.]+$/,
                    '',
                ),
            };
        },
    },
}));
vi.mock('./DirSource', () => ({
    default: { getDirPathBySettingName: () => state.documentDir },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('../media-sessions/folderSessionHelpers', () => ({
    getActiveDirSourceSettingName: (name: string) => name,
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getScreenManagersInstanceSetting: () => mocks.getScreenSetting(),
}));
// Entries shaped as the registry's (`presentingFlowActionHelpers.ts`).
vi.mock('../presenting-flow/presentingFlowActionHelpers', () => ({
    presentingFlowActionList: [
        {
            id: 'screen-show',
            label: 'Screen: Show',
            target: 'screen',
            requiresScreenIds: true,
        },
        {
            id: 'slide-media-control',
            label: 'Slide: Media Control',
            target: 'screen',
            requiresScreenIds: false,
        },
        {
            id: 'next-interval',
            label: 'Next: Interval',
            target: 'run',
            number: { label: 'Seconds', defaultValue: 10 },
            canBeTimeArmed: false,
            canBeKeyArmed: false,
            canBeCcItem: false,
            ccItemsAreTargets: false,
        },
        {
            id: 'jump-to',
            label: 'Jump to',
            target: 'run',
            number: null,
            canBeTimeArmed: false,
            canBeKeyArmed: false,
            canBeCcItem: false,
            ccItemsAreTargets: true,
        },
        {
            id: 'keyboard-event',
            label: 'Keyboard Event',
            target: 'run',
            number: null,
            canBeTimeArmed: false,
            canBeKeyArmed: true,
            canBeCcItem: false,
            ccItemsAreTargets: false,
        },
        {
            id: 'clear-all',
            label: 'Clear All',
            target: 'screen',
            requiresScreenIds: false,
        },
    ],
}));
vi.mock('../presenting-flow/presentingFlowDocumentHelpers', () => ({
    loadVaryAppDocumentSlides: (...args: any[]) => mocks.loadSlides(...args),
}));
vi.mock('../presenting-flow/presentingFlowCcHelpers', () => ({
    genPresentingFlowItemUuid: () => 'new-uuid',
}));
vi.mock('../presenting-flow/PresentingFlowItem', () => ({
    default: {
        fromDroppedData: (...args: any[]) => mocks.fromDroppedData(...args),
    },
}));
vi.mock('../presenting-flow/PresentingFlow', () => ({
    default: {
        getInstance: () => ({
            getItems: async () => state.items,
            updateItemsJson: (handler: (list: any[]) => boolean | void) =>
                mocks.updateItemsJson(handler),
        }),
    },
}));

import { handleAgentPresentingFlowEditRequest } from './agentPresentingFlowEditHelpers';

const FLOW = 'C:\\flows\\Sunday.owpf';
const SONG_PATH = '/documents/Amazing Grace.owl';

const RUN_KEY = {
    number: null,
    canBeKeyArmed: true,
    ccItemsAreTargets: false,
};
const RUN_TIMEOUT = {
    number: { label: 'Seconds', defaultValue: 10 },
    canBeKeyArmed: false,
    ccItemsAreTargets: false,
};
const RUN_JUMP = {
    number: null,
    canBeKeyArmed: false,
    ccItemsAreTargets: true,
};

/** A line as `PresentingFlow.getItems` hands it over: the item's getters. */
function genItem(json: any, extra: Record<string, unknown> = {}) {
    return {
        uuid: json.uuid ?? null,
        title: json.title ?? String(json.data),
        type: json.type,
        data: json.data,
        isError: json.type === 'error',
        isAction: json.type === 'action',
        isForeground: json.type === 'foreground',
        isAppDocument: json.type === 'appDocument',
        isBibleItem: json.type === 'bibleItem',
        isSlide: false,
        isAudio: false,
        isBackground: false,
        itemFilePath: json.filePath ?? '',
        isDisabled: json.isDisabled === true,
        colorNote: json.colorNote ?? null,
        screenIds: json.screenIds ?? [],
        runAction: null,
        actionKey: null,
        actionTime: null,
        actionNumber: 0,
        toJson: () => structuredClone(json),
        ...extra,
    };
}

function genSong(json: Record<string, unknown> = {}) {
    return genItem({
        type: 'appDocument',
        uuid: 'song',
        filePath: SONG_PATH,
        title: 'Amazing Grace',
        ...json,
    });
}

function genWait() {
    return genItem(
        {
            type: 'action',
            uuid: 'wait',
            data: 'next-timeout',
            title: 'Next: Timeout (8)',
        },
        { runAction: RUN_TIMEOUT, actionNumber: 8 },
    );
}

async function askLines(line?: number): Promise<any> {
    return await handleAgentPresentingFlowEditRequest({
        action: 'lines',
        filePath: FLOW,
        ...(line === undefined ? {} : { line }),
    });
}

async function askUpdate(changes: unknown): Promise<any> {
    return await handleAgentPresentingFlowEditRequest({
        action: 'update-lines',
        filePath: FLOW,
        changes,
    });
}

function expectNothingWritten() {
    expect(state.writtenJson).toBeNull();
}

function setNeeds(needs: {
    documentMap?: [number, string][];
    referenceMap?: [number, { reference: string; version: string | null }][];
    slideLineSet?: number[];
}) {
    mocks.readAgentFlowChangeNeeds.mockReturnValue({
        documentMap: new Map(needs.documentMap ?? []),
        referenceMap: new Map(needs.referenceMap ?? []),
        slideLineSet: new Set(needs.slideLineSet ?? []),
    });
}

beforeEach(() => {
    state.files = new Set([FLOW, SONG_PATH]);
    state.items = [genSong(), genWait()];
    state.writtenJson = null;
    state.documentDir = '/documents';
    state.documentFiles = { lyric: [SONG_PATH] };
    mocks.fsCheckFileExist.mockImplementation(async (filePath: string) => {
        return state.files.has(filePath);
    });
    mocks.listFiles.mockImplementation(
        async (_dir: string, mimetypeName: string) => {
            return state.documentFiles[mimetypeName] ?? null;
        },
    );
    mocks.getPlace.mockReturnValue({ dirPath: '/flows', extension: 'owpf' });
    mocks.getScreenSetting.mockReturnValue([{ screenId: 0 }]);
    mocks.snapshotAgentEditing.mockResolvedValue({ type: 'editing' });
    mocks.runWithAgentBackup.mockImplementation(
        async (_summary: string, _restores: any[], change: () => any) => {
            return { meta: { id: 'backup-id' }, value: await change() };
        },
    );
    mocks.updateItemsJson.mockImplementation(async (handler: any) => {
        const list = (state.items ?? []).map((item) => {
            return item.toJson();
        });
        if (handler(list) === false) {
            return false;
        }
        state.writtenJson = list;
        return true;
    });
    mocks.applyAgentFlowChanges.mockImplementation((list: any[]) => {
        list.push({ type: 'action', data: 'clear-all' });
        return { changed: ['added "Clear All" at the end'] };
    });
    mocks.applyAgentFlowRemoval.mockImplementation((list: any[]) => {
        list.splice(0, 1);
        return { changed: ['removed line 1 "Amazing Grace"'] };
    });
    setNeeds({});
});

describe('the sheet a request names', () => {
    test('a name with no Presenting Flows folder answers that refusal', async () => {
        const noFolder = { isError: true, reason: 'No folder is set.' };
        mocks.getPlace.mockReturnValue(noFolder);
        expect(
            await handleAgentPresentingFlowEditRequest({
                action: 'lines',
                name: 'Sunday',
            }),
        ).toEqual(noFolder);
        expect(mocks.findFlow).not.toHaveBeenCalled();
    });

    test('a name the folder does not have answers that refusal', async () => {
        const notFound = { isError: true, reason: 'There is no "Nope".' };
        mocks.findFlow.mockResolvedValue(notFound);
        expect(
            await handleAgentPresentingFlowEditRequest({
                action: 'update-lines',
                name: 'Nope',
                changes: [{ line: 1, park: true }],
            }),
        ).toEqual(notFound);
        expect(mocks.findFlow).toHaveBeenCalledWith(
            { dirPath: '/flows', extension: 'owpf' },
            'Nope',
        );
        expect(mocks.updateItemsJson).not.toHaveBeenCalled();
    });

    test('a failure reaching the disk is an answer, not a throw', async () => {
        mocks.fsCheckFileExist.mockRejectedValue(new Error('disk gone'));
        expect(await askLines()).toEqual({
            isError: true,
            reason: 'disk gone',
        });
        expect(mocks.handleError).toHaveBeenCalledTimes(1);
    });

    test('no request at all is an unknown action', async () => {
        expect(
            await handleAgentPresentingFlowEditRequest(undefined as any),
        ).toEqual({
            isError: true,
            reason: 'Unknown action. Use lines, update-lines or remove-lines.',
        });
    });
});

describe('`lines`: what each line is and what is wrong with it', () => {
    test('every kind of line by its kind', async () => {
        state.items = [
            genItem({ type: 'error', uuid: 'e', title: 'Invalid' }),
            genItem({
                type: 'foreground',
                uuid: 'fg',
                data: { target: 'countdown' },
                title: 'Countdown: 5m',
            }),
            genItem({ type: 'foreground', uuid: 'fg2', data: null }),
            genItem({ type: 'bibleItem', uuid: 'v', title: 'John 3:16' }),
            genItem(
                {
                    type: 'slide',
                    uuid: 's',
                    filePath: SONG_PATH,
                    title: 'Slide 3',
                },
                { isSlide: true },
            ),
            genItem(
                { type: 'bg-audio', uuid: 'a', title: 'Hymn.mp3' },
                { isAudio: true },
            ),
            genItem(
                { type: 'bg-image', uuid: 'b', title: 'Sky.jpg' },
                { isBackground: true },
            ),
            genItem({ type: 'mystery', uuid: 'm', title: 'Later' }),
        ];
        const result = await askLines();
        expect(
            result.lines.map((line: any) => {
                return line.kind;
            }),
        ).toEqual([
            'invalid',
            'foreground:countdown',
            'foreground:',
            'passage',
            'slide',
            'audio',
            'background:image',
            'mystery',
        ]);
        expect(result.lines[0].problems).toEqual([
            'it could not be read -- remove it, or add it again',
        ]);
        // A slide is not a document: no `document`, and its file is there.
        expect(result.lines[4]).toEqual({
            n: 5,
            title: 'Slide 3',
            kind: 'slide',
        });
    });

    test('a slide whose file is gone, parked and pinned lines', async () => {
        state.items = [
            genItem(
                { type: 'slide', uuid: 's', title: 'Slide 1' },
                { isSlide: true },
            ),
            genSong({ isDisabled: true, screenIds: [0, 1] }),
        ];
        const result = await askLines();
        expect(result.lines[0].problems).toEqual([
            'its file is missing -- it was renamed, moved or deleted',
        ]);
        expect(result.lines[1]).toEqual({
            n: 2,
            title: 'Amazing Grace',
            kind: 'document',
            document: 'Amazing Grace',
            isParked: true,
            screenIds: [0, 1],
        });
    });

    test('shortcuts: none yet, one, and one used twice', async () => {
        const genKeyLine = (uuid: string, actionKey: string | null) => {
            return genItem(
                { type: 'action', uuid, data: 'keyboard-event' },
                { runAction: RUN_KEY, actionKey },
            );
        };
        state.items = [
            genKeyLine('k0', null),
            genKeyLine('k1', 'Ctrl+A'),
            genKeyLine('k2', 'Ctrl+A'),
            genKeyLine('k3', 'Shift+B'),
        ];
        const result = await askLines();
        expect(result.lines[0].problems).toEqual(['it has no shortcut yet']);
        expect(result.lines[1]).toMatchObject({
            key: 'Ctrl+A',
            problems: ['its shortcut is used by another line'],
        });
        expect(result.lines[2].problems).toEqual([
            'its shortcut is used by another line',
        ]);
        expect(result.lines[3]).toEqual({
            n: 4,
            title: 'keyboard-event',
            kind: 'action:keyboard-event',
            key: 'Shift+B',
        });
    });

    test('a timeout at a time of day, and a Jump to with and without a target', async () => {
        state.items = [
            genSong(),
            genItem(
                { type: 'action', uuid: 't', data: 'next-timeout' },
                { runAction: RUN_TIMEOUT, actionTime: '19:30' },
            ),
            genItem(
                {
                    type: 'action',
                    uuid: 'j1',
                    data: 'jump-to',
                    ccItems: [{ uuid: 'song' }],
                },
                { runAction: RUN_JUMP },
            ),
            genItem(
                { type: 'action', uuid: 'j2', data: 'jump-to' },
                { runAction: RUN_JUMP },
            ),
        ];
        const result = await askLines();
        expect(result.lines[1]).toMatchObject({ time: '19:30' });
        expect(result.lines[1]).not.toHaveProperty('seconds');
        // A Jump to's CC is where it goes, never a follower.
        expect(result.lines[2]).toEqual({
            n: 3,
            title: 'jump-to',
            kind: 'action:jump-to',
            goesTo: 1,
        });
        expect(result.lines[3].problems).toEqual([
            'it goes nowhere yet -- give it a target',
        ]);
        // The song is the element of the jump's CC.
        expect(result.lines[0].ccOf).toEqual([3]);
    });

    test("a CC's pin, time and media settings, and one following a gone line", async () => {
        state.items = [
            genSong({
                ccItems: [
                    {
                        uuid: 'wait',
                        screenIds: [1],
                        actionArming: { actionTime: '07:00' },
                        mediaControl: { mode: 'play' },
                    },
                    { uuid: 'ghost', screenIds: [] },
                    { uuid: 5 },
                    null,
                ],
            }),
            genWait(),
        ];
        const result = await askLines();
        expect(result.lines[0].cc).toEqual([
            {
                n: 1,
                follows: 2,
                title: 'Next: Timeout (8)',
                screenIds: [1],
                time: '07:00',
                mediaControl: { mode: 'play' },
            },
            { n: 2, follows: null, title: 'a line that is gone' },
            { n: 3, follows: null, title: 'a line that is gone' },
            { n: 4, follows: null, title: 'a line that is gone' },
        ]);
        expect(result.lines[0].problems).toEqual([
            'a CC follows a line that is gone',
        ]);
        expect(result.lines[1].ccOf).toEqual([1]);
    });

    test("a line used by a document's slides is the element of that line once", async () => {
        state.items = [
            genSong({
                ccItems: [{ uuid: 'wait' }],
                slideCcItems: {
                    '11': [{ uuid: 'wait' }],
                    '12': 'not a list',
                },
            }),
            genWait(),
        ];
        mocks.loadSlides.mockResolvedValue(null);
        const result = await askLines();
        expect(result.lines[1].ccOf).toEqual([1]);
        // Its slides could not be read: nothing is said about them.
        expect(result.lines[0]).not.toHaveProperty('slides');
    });

    test('more lines than a question carries are cut and said so', async () => {
        state.items = Array.from({ length: 201 }, (_value, index) => {
            return genItem({
                type: 'bibleItem',
                uuid: `v${index}`,
                title: `Verse ${index + 1}`,
            });
        });
        const result = await askLines();
        expect(result.count).toBe(201);
        expect(result.lines).toHaveLength(200);
        expect(result.lines.at(-1).n).toBe(200);
        expect(result.isTruncated).toBe(true);
    });

    test('a sheet that cannot be read is said so, for every action', async () => {
        state.items = null;
        const reason = 'The presenting flow "Sunday" could not be read.';
        expect(await askLines()).toEqual({ isError: true, reason });
        expect(await askUpdate([{ line: 1, park: true }])).toEqual({
            isError: true,
            reason,
        });
        expect(
            await handleAgentPresentingFlowEditRequest({
                action: 'remove-lines',
                filePath: FLOW,
                lines: [1],
            }),
        ).toEqual({ isError: true, reason });
        expect(mocks.updateItemsJson).not.toHaveBeenCalled();
    });
});

describe("`lines`: a document's slides by number", () => {
    test('parked, pinned and CC slides are read even when not asked for', async () => {
        state.items = [
            genSong({
                disabledSlideIds: [12, 99],
                slideScreenIds: { '11': [0], '99': [1] },
                slideCcItems: {
                    '12': [{ uuid: 'wait', actionArming: { actionNumber: 3 } }],
                    '99': [{ uuid: 'wait' }],
                    '11': [],
                },
            }),
            genWait(),
        ];
        mocks.loadSlides.mockResolvedValue([
            { id: 11, name: 'Verse 1' },
            { id: 12 },
        ]);
        const result = await askLines();
        expect(mocks.loadSlides).toHaveBeenCalledWith(SONG_PATH);
        // A slide no longer in the document is left out.
        expect(result.lines[0].slides).toEqual({
            count: 2,
            parked: [2],
            pinned: [{ slide: 1, screenIds: [0] }],
            cc: [
                {
                    slide: 2,
                    cc: [
                        {
                            n: 1,
                            follows: 2,
                            title: 'Next: Timeout (8)',
                            seconds: 3,
                        },
                    ],
                },
            ],
        });
    });

    test('slide settings naming no slide that is there say nothing but the count', async () => {
        state.items = [genSong({ disabledSlideIds: [99] })];
        mocks.loadSlides.mockResolvedValue([{ id: 11, name: 'Verse 1' }]);
        expect((await askLines()).lines[0].slides).toEqual({ count: 1 });
    });

    test('slides that throw on reading are reported, and the line read without them', async () => {
        state.items = [genSong()];
        mocks.loadSlides.mockRejectedValue(new Error('bad file'));
        const result = await askLines(1);
        expect(mocks.handleError).toHaveBeenCalledWith(new Error('bad file'));
        expect(result.lines[0]).not.toHaveProperty('slides');
    });

    test('a line number past the sheet asks for no slides', async () => {
        state.items = [genSong()];
        await askLines(5);
        expect(mocks.loadSlides).not.toHaveBeenCalled();
    });
});

describe('`lines`: the choices around the sheet', () => {
    test('the actions, said once each with what arms them', async () => {
        const result = await askLines();
        expect(result.actions).toEqual([
            'screen-show: Screen: Show (screenIds required)',
            'slide-media-control: Slide: Media Control (only as a CC of a ' +
                'slide or document, with mediaControl)',
            'next-interval: Next: Interval (seconds)',
            'jump-to: Jump to (target: the line it goes to)',
            'keyboard-event: Keyboard Event (key (a shortcut))',
            'clear-all: Clear All',
        ]);
        expect(result.foregroundWidgets).toEqual(['countdown: seconds']);
    });

    test('the Documents names: sorted, once each, 60 at most', async () => {
        const names = Array.from({ length: 61 }, (_value, index) => {
            return `/documents/Song ${String(index).padStart(2, '0')}.owl`;
        });
        state.documentFiles = {
            lyric: [...names].reverse(),
            appDocument: ['/documents/Song 00.ows'],
        };
        const result = await askLines();
        expect(result.documentChoices).toHaveLength(60);
        expect(result.documentChoices[0]).toBe('Song 00');
        expect(result.documentChoices[59]).toBe('Song 59');
        expect(result.isDocumentChoicesTruncated).toBe(true);
    });

    test('no Documents folder is no choices', async () => {
        state.documentDir = null;
        const result = await askLines();
        expect(result.documentChoices).toEqual([]);
        expect(mocks.listFiles).not.toHaveBeenCalled();
        expect(result).not.toHaveProperty('isDocumentChoicesTruncated');
    });

    test('a Documents folder or a screen list that fails is none, reported', async () => {
        mocks.listFiles.mockRejectedValue(new Error('no access'));
        mocks.getScreenSetting.mockImplementation(() => {
            throw new Error('no screens');
        });
        const result = await askLines();
        expect(result.documentChoices).toEqual([]);
        expect(result.screens).toEqual([]);
        expect(mocks.handleError).toHaveBeenCalledWith(new Error('no access'));
        expect(mocks.handleError).toHaveBeenCalledWith(new Error('no screens'));
    });
});

describe('`update-lines`: nothing written when refused', () => {
    test('a batch refused for its shape takes no backup', async () => {
        mocks.readAgentFlowChangeNeeds.mockReturnValue({
            reason: 'Change 1 is not an object.',
        });
        expect(await askUpdate([5])).toEqual({
            isError: true,
            reason:
                'Nothing was changed -- the whole call was refused: Change 1 ' +
                'is not an object. Leave that change out or fix it, then call ' +
                'again with the rest.',
        });
        expect(mocks.readAgentFlowChangeNeeds).toHaveBeenCalledWith([5], 2);
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a document that cannot be dropped in is refused', async () => {
        setNeeds({ documentMap: [[0, 'Welcome']] });
        mocks.findDocumentPath.mockResolvedValue('/documents/Welcome.ows');
        mocks.fromDroppedData.mockResolvedValue(null);
        expect(await askUpdate([{ add: { document: 'Welcome' } }])).toEqual({
            isError: true,
            reason: expect.stringContaining(
                'refused: Change 1: "Welcome" cannot be added.',
            ),
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a passage longer than a reference is refused unread', async () => {
        const reference = 'John 3:16 '.repeat(9);
        setNeeds({ referenceMap: [[2, { reference, version: null }]] });
        expect(await askUpdate([{}, {}, { add: { reference } }])).toEqual({
            isError: true,
            reason: expect.stringContaining(
                'Change 3: that is longer than a reference -- the book, ' +
                    'chapter and verse only, such as "John 3:16".',
            ),
        });
        expect(mocks.resolveVersionOrder).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a version not installed is refused with its reason', async () => {
        setNeeds({
            referenceMap: [[0, { reference: 'John 3:16', version: 'XYZ' }]],
        });
        mocks.resolveVersionOrder.mockResolvedValue({
            isError: true,
            reason: 'There is no Bible "XYZ".',
        });
        expect(await askUpdate([{ add: { reference: 'John 3:16' } }])).toEqual({
            isError: true,
            reason: expect.stringContaining(
                'refused: Change 1: There is no Bible "XYZ".',
            ),
        });
        expect(mocks.resolveVersionOrder).toHaveBeenCalledWith('XYZ');
        expectNothingWritten();
    });

    test('a passage that cannot be read names the version, or any', async () => {
        mocks.resolveVersionOrder.mockResolvedValue({ order: ['KJV'] });
        mocks.resolveBibleItem.mockResolvedValue(null);
        setNeeds({
            referenceMap: [[0, { reference: 'Hezekiah 1:1', version: 'KJV' }]],
        });
        expect(
            (await askUpdate([{ add: { reference: 'Hezekiah 1:1' } }])).reason,
        ).toContain(
            'Change 1: "Hezekiah 1:1" could not be read as a passage in KJV. ' +
                "Write it as the version's full book name, chapter and verse " +
                '-- "John 3:16", "Psalm 23:1-6".',
        );
        expect(mocks.resolveBibleItem).toHaveBeenCalledWith('Hezekiah 1:1', [
            'KJV',
        ]);
        setNeeds({
            referenceMap: [[0, { reference: 'Hezekiah 1:1', version: null }]],
        });
        expect(
            (await askUpdate([{ add: { reference: 'Hezekiah 1:1' } }])).reason,
        ).toContain('as a passage in any installed version.');
        expectNothingWritten();
    });

    test('a passage read but not droppable is refused', async () => {
        mocks.resolveVersionOrder.mockResolvedValue({ order: ['KJV'] });
        mocks.resolveBibleItem.mockResolvedValue({
            dragSerialize: () => ({ type: 'bibleItem', data: 'x' }),
        });
        mocks.fromDroppedData.mockResolvedValue(null);
        setNeeds({
            referenceMap: [[0, { reference: 'John 3:16', version: null }]],
        });
        expect(
            (await askUpdate([{ add: { reference: 'John 3:16' } }])).reason,
        ).toContain('Change 1: "John 3:16" cannot be added.');
        expectNothingWritten();
    });

    test('a sheet that cannot be snapshotted is not changed', async () => {
        mocks.snapshotAgentEditing.mockResolvedValue(null);
        expect(await askUpdate([{ add: { actionId: 'clear-all' } }])).toEqual({
            isError: true,
            reason:
                'The presenting flow "Sunday" could not be read, so it was ' +
                'not changed.',
        });
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledWith(
            'presentingFlow',
            FLOW,
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expectNothingWritten();
    });
});

describe('`update-lines`: what reaches the batch', () => {
    test('a passage is dropped in as a passage drop writes it', async () => {
        const bibleItem = {
            dragSerialize: () => ({ type: 'bibleItem', data: 'JHN 3:16' }),
        };
        mocks.resolveVersionOrder.mockResolvedValue({ order: ['KJV', 'NIV'] });
        mocks.resolveBibleItem.mockResolvedValue(bibleItem);
        mocks.fromDroppedData.mockResolvedValue({
            type: 'bibleItem',
            title: 'John 3:16',
        });
        setNeeds({
            referenceMap: [[0, { reference: 'John 3:16', version: null }]],
        });
        const result = await askUpdate([{ add: { reference: 'John 3:16' } }]);
        expect(mocks.fromDroppedData).toHaveBeenCalledWith(
            { type: 'bibleItem', item: bibleItem },
            { type: 'bibleItem', data: 'JHN 3:16' },
        );
        const prepared = mocks.applyAgentFlowChanges.mock.calls[0][2];
        expect(prepared.addedItemJsonMap.get(0)).toEqual({
            type: 'bibleItem',
            title: 'John 3:16',
        });
        expect(prepared.titles).toEqual(['Amazing Grace', 'Next: Timeout (8)']);
        expect(prepared.screenIdList).toEqual([0]);
        expect(prepared.genId()).toBe('new-uuid');
        expect(result.changed).toEqual(['added "Clear All" at the end']);
    });

    test("only a document's slides are read, and only when they read", async () => {
        state.items = [
            genSong(),
            genWait(),
            genSong({ uuid: 'song-2', filePath: '/documents/Gone.owl' }),
        ];
        mocks.loadSlides.mockImplementation(async (filePath: string) => {
            return filePath === SONG_PATH ? [{ id: 11 }, { id: 12 }] : null;
        });
        setNeeds({ slideLineSet: [1, 2, 3, 9] });
        await askUpdate([{ line: 1, slides: [{ slide: 1, park: true }] }]);
        expect(mocks.loadSlides).toHaveBeenCalledTimes(2);
        const prepared = mocks.applyAgentFlowChanges.mock.calls[0][2];
        expect(prepared.slideIdListMap).toEqual(new Map([[1, [11, 12]]]));
    });
});

describe('`update-lines`: a write that fails', () => {
    test('a write the app could not make is said so, with the undo', async () => {
        mocks.updateItemsJson.mockResolvedValue(false);
        const result = await askUpdate([{ add: { actionId: 'clear-all' } }]);
        expect(result).toEqual({
            isError: true,
            reason:
                'Changed the presenting flow “Sunday” could not be finished: ' +
                'the app could not write the presenting flow. Anything it did ' +
                'get to do can be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledTimes(1);
    });

    test('no backup is said in its own words, unreported', async () => {
        const { NoBackupError } = (await import('./agentBackupHelpers')) as any;
        mocks.runWithAgentBackup.mockRejectedValue(
            new NoBackupError('The backup folder is full.'),
        );
        expect(await askUpdate([{ add: { actionId: 'clear-all' } }])).toEqual({
            isError: true,
            reason: 'The backup folder is full.',
        });
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a thrown non-Error is written as its own words', async () => {
        mocks.runWithAgentBackup.mockRejectedValue('lock lost');
        const result = await handleAgentPresentingFlowEditRequest({
            action: 'remove-lines',
            filePath: FLOW,
            lines: [1],
        });
        expect(result).toEqual({
            isError: true,
            reason:
                'Changed the presenting flow “Sunday” could not be finished: ' +
                'lock lost Anything it did get to do can be put back with ' +
                'owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledWith('lock lost');
    });
});
