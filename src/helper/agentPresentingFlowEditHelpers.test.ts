import { beforeEach, describe, expect, test, vi } from 'vitest';

// The worker behind `owa_presenting_flow_edit`, against a sheet held in
// memory: which file it reaches, what `lines` reads, and that a batch is ONE
// write and ONE backup -- or, refused, none of either. The batch rules have
// their own test (`agentFlowEditRules.test.ts`) and are stood in for here.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        files: new Set<string>(),
        items: [] as any[],
        writtenJson: null as any[] | null,
        liveJson: null as any[] | null,
    },
    mocks: {
        handleError: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        updateItemsJson: vi.fn(),
        applyAgentFlowChanges: vi.fn(),
        applyAgentFlowRemoval: vi.fn(),
        findFlow: vi.fn(),
        findDocumentPath: vi.fn(),
        fromDroppedData: vi.fn(),
        loadSlides: vi.fn(),
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DragInf', () => ({
    DragTypeEnum: { APP_DOCUMENT: 'appDocument', BIBLE_ITEM: 'bibleItem' },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => state.files.has(filePath),
    fsListFilesWithMimetype: async (_dir: string, mimetypeName: string) =>
        mimetypeName === 'lyric' ? ['/documents/Amazing Grace.owl'] : [],
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
    readAgentFlowChangeNeeds: (changes: any[], count: number) => {
        if (!Array.isArray(changes)) {
            return { reason: 'changes is a list' };
        }
        const documentMap = new Map<number, string>();
        changes.forEach((change, index) => {
            if (change.add?.document) {
                documentMap.set(index, change.add.document);
            }
        });
        return {
            documentMap,
            referenceMap: new Map(),
            slideLineSet: new Set(
                changes
                    .filter((change) => {
                        return (
                            change.slides !== undefined && change.line <= count
                        );
                    })
                    .map((change) => {
                        return change.line;
                    }),
            ),
        };
    },
    toAgentFlowColorName: (value: unknown) =>
        typeof value === 'string' ? `name-of-${value}` : null,
}));
vi.mock('./agentFlowForegroundRules', () => ({
    AGENT_FLOW_FOREGROUND_FIELD_TEXT_LIST: ['countdown: seconds'],
}));
vi.mock('./agentPresentingFlowHelpers', () => ({
    getPlace: () => ({ dirPath: '/flows', extension: 'owpf' }),
    checkIsPlace: () => true,
    findFlow: (...args: any[]) => mocks.findFlow(...args),
    checkIsFlowFound: (value: any) => value?.isError !== true,
    findDocumentPath: (...args: any[]) => mocks.findDocumentPath(...args),
    checkIsRefusal: (value: any) => value?.isError === true,
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
    default: { getDirPathBySettingName: () => '/documents' },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('../media-sessions/folderSessionHelpers', () => ({
    getActiveDirSourceSettingName: (name: string) => name,
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getScreenManagersInstanceSetting: () => [{ screenId: 1 }, { screenId: 0 }],
}));
vi.mock('../presenting-flow/presentingFlowActionHelpers', () => ({
    presentingFlowActionList: [
        { id: 'clear-all', label: 'Clear All', target: 'screen' },
        {
            id: 'next-timeout',
            label: 'Next: Timeout',
            target: 'run',
            number: { label: 'Seconds', defaultValue: 10 },
            canBeTimeArmed: true,
            canBeKeyArmed: false,
            canBeCcItem: true,
            ccItemsAreTargets: false,
        },
        { id: 'clear-foreground-countdown', label: 'Clear FG Countdown' },
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

function genItem(json: any, extra: Record<string, unknown> = {}) {
    return {
        uuid: json.uuid ?? null,
        title: json.title ?? json.data,
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

beforeEach(() => {
    vi.clearAllMocks();
    state.files = new Set([FLOW, '/documents/Amazing Grace.owl']);
    state.items = [
        genItem({
            type: 'appDocument',
            uuid: 'song',
            filePath: '/documents/Amazing Grace.owl',
            title: 'Amazing Grace',
            colorNote: '#0000FF',
            ccItems: [{ uuid: 'wait', actionArming: { actionNumber: 4 } }],
        }),
        genItem(
            {
                type: 'action',
                uuid: 'wait',
                data: 'next-timeout',
                title: 'Next: Timeout (8)',
                actionNumber: 8,
            },
            {
                runAction: {
                    number: { label: 'Seconds', defaultValue: 10 },
                    canBeKeyArmed: false,
                    ccItemsAreTargets: false,
                },
                actionNumber: 8,
            },
        ),
        genItem({
            type: 'appDocument',
            uuid: 'gone',
            filePath: '/documents/Old Song.owl',
            title: 'Old Song',
        }),
    ];
    state.liveJson = null;
    state.writtenJson = null;
    mocks.snapshotAgentEditing.mockResolvedValue({ type: 'editing' });
    mocks.runWithAgentBackup.mockImplementation(
        async (_summary: string, _restores: any[], change: () => any) => {
            return { meta: { id: 'backup-id' }, value: await change() };
        },
    );
    mocks.updateItemsJson.mockImplementation(async (handler: any) => {
        const list = structuredClone(
            state.liveJson ??
                state.items.map((item) => {
                    return item.toJson();
                }),
        );
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
});

describe('the sheet a request names', () => {
    test('a whole .owpf path that is there', async () => {
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'lines',
            filePath: FLOW,
        });
        expect(result.name).toBe('Sunday');
    });

    test('never a partial path, a climb out, another kind or a missing file', async () => {
        for (const filePath of [
            'Sunday.owpf',
            'C:\\flows\\..\\secret\\Sunday.owpf',
            'C:\\flows\\setting.json',
            'C:\\flows\\Missing.owpf',
        ]) {
            const result: any = await handleAgentPresentingFlowEditRequest({
                action: 'lines',
                filePath,
            });
            expect(result.isError).toBe(true);
        }
    });

    test('a name goes to the Presenting Flows folder', async () => {
        mocks.findFlow.mockResolvedValue({ name: 'Sunday', filePath: FLOW });
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'lines',
            name: 'Sunday',
        });
        expect(mocks.findFlow).toHaveBeenCalledWith(
            { dirPath: '/flows', extension: 'owpf' },
            'Sunday',
        );
        expect(result.count).toBe(3);
    });

    test('an unknown action is refused before anything is read', async () => {
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'delete',
            filePath: FLOW,
        });
        expect(result).toEqual({
            isError: true,
            reason: expect.stringContaining('lines, update-lines'),
        });
    });
});

describe('`lines`', () => {
    test('every line whole, with its problems and the choices', async () => {
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'lines',
            filePath: FLOW,
        });
        expect(result.lines[0]).toEqual({
            n: 1,
            title: 'Amazing Grace',
            kind: 'document',
            document: 'Amazing Grace',
            color: 'name-of-#0000FF',
            cc: [{ n: 1, follows: 2, title: 'Next: Timeout (8)', seconds: 4 }],
        });
        expect(result.lines[1]).toMatchObject({
            kind: 'action:next-timeout',
            seconds: 8,
            // The element of line 1's CC, said on the line itself.
            ccOf: [1],
        });
        expect(result.lines[2].problems).toEqual([
            'its file is missing -- it was renamed, moved or deleted',
        ]);
        expect(result.screens).toEqual([0, 1]);
        expect(result.documentChoices).toEqual(['Amazing Grace']);
        expect(result.actions).toEqual([
            'clear-all: Clear All',
            'next-timeout: Next: Timeout (seconds or time (HH:mm); can ride along with a line as a CC)',
            expect.stringContaining('clear-foreground-<widget>'),
        ]);
        // No document's slides are read unless asked for.
        expect(mocks.loadSlides).not.toHaveBeenCalled();
    });

    test("with `line`, that document's slides", async () => {
        mocks.loadSlides.mockResolvedValue([
            { id: 11, name: 'Verse 1' },
            { id: 12, name: '' },
        ]);
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'lines',
            filePath: FLOW,
            line: 1,
        });
        expect(mocks.loadSlides).toHaveBeenCalledTimes(1);
        expect(result.lines[0].slides).toEqual({
            count: 2,
            list: ['1: Verse 1', '2'],
        });
    });
});

describe('`update-lines` and `remove-lines`', () => {
    test('a batch is ONE backup and ONE write', async () => {
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'update-lines',
            filePath: FLOW,
            changes: [{ add: { actionId: 'clear-all' } }],
        });
        expect(mocks.runWithAgentBackup).toHaveBeenCalledTimes(1);
        expect(mocks.updateItemsJson).toHaveBeenCalledTimes(1);
        expect(state.writtenJson).toHaveLength(4);
        expect(result).toEqual({
            sheet: 'Sunday',
            count: 4,
            changed: ['added "Clear All" at the end'],
            didChange: true,
            note: 'Kept at once -- a presenting flow has no Save.',
            undoId: 'backup-id',
        });
    });

    test('a refused batch takes no backup and writes nothing', async () => {
        mocks.applyAgentFlowChanges.mockReturnValue({
            reason: 'Change 1: nope.',
        });
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'update-lines',
            filePath: FLOW,
            changes: [{ line: 1, park: true }],
        });
        expect(result).toEqual({
            isError: true,
            reason:
                'Nothing was changed -- the whole call was refused: ' +
                'Change 1: nope. Leave that change out or fix it, then ' +
                'call again with the rest.',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(state.writtenJson).toBeNull();
    });

    test('a sheet that changed in between is not written over', async () => {
        state.liveJson = [{ type: 'action', data: 'clear-all' }];
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'update-lines',
            filePath: FLOW,
            changes: [{ line: 1, park: true }],
        });
        expect(result).toEqual({
            isError: true,
            reason: expect.stringContaining('changed while it was being'),
        });
        expect(state.writtenJson).toBeNull();
    });

    test('a document added by name is the drop a document makes', async () => {
        mocks.findDocumentPath.mockResolvedValue('/documents/Welcome.ows');
        mocks.fromDroppedData.mockResolvedValue({
            type: 'appDocument',
            title: 'Welcome',
        });
        await handleAgentPresentingFlowEditRequest({
            action: 'update-lines',
            filePath: FLOW,
            changes: [{ add: { document: 'Welcome' } }],
        });
        expect(mocks.fromDroppedData).toHaveBeenCalledWith(
            {
                type: 'appDocument',
                item: { filePath: '/documents/Welcome.ows' },
            },
            { type: 'appDocument', data: '/documents/Welcome.ows' },
        );
        const prepared = mocks.applyAgentFlowChanges.mock.calls[0][2];
        expect(prepared.addedItemJsonMap.get(0)).toEqual({
            type: 'appDocument',
            title: 'Welcome',
        });
        expect(prepared.screenIdList).toEqual([0, 1]);
    });

    test('a document that is not in Documents is said so', async () => {
        mocks.findDocumentPath.mockResolvedValue({
            isError: true,
            reason: 'There is no document called "Nope".',
        });
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'update-lines',
            filePath: FLOW,
            changes: [{ add: { document: 'Nope' } }],
        });
        expect(result).toEqual({
            isError: true,
            reason: expect.stringContaining(
                'Nothing was changed -- the whole call was refused: Change 1: ' +
                    'There is no document called "Nope".',
            ),
        });
    });

    test('remove-lines is one write too', async () => {
        const result: any = await handleAgentPresentingFlowEditRequest({
            action: 'remove-lines',
            filePath: FLOW,
            lines: [1],
        });
        expect(mocks.applyAgentFlowRemoval).toHaveBeenCalledWith(
            expect.any(Array),
            [1],
            ['Amazing Grace', 'Next: Timeout (8)', 'Old Song'],
        );
        expect(result.changed).toEqual(['removed line 1 "Amazing Grace"']);
        expect(state.writtenJson).toHaveLength(2);
    });
});
