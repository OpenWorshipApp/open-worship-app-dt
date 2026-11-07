import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        documents: new Map<string, any>(),
        instances: new Map<string, any>(),
        nextDropped: null as any,
        throwDropped: null as Error | null,
        throwActionId: null as Error | null,
        throwReadPaths: new Set<string>(),
        uuidIndex: 0,
    },
    mocks: {
        appError: vi.fn(),
        handleError: vi.fn(),
        showSimpleToast: vi.fn(),
    },
}));

vi.mock('../helper/AppEditableDocumentSourceAbs', () => ({
    default: class MockEditableDocument {
        filePath: string;
        constructor(filePath: string) {
            this.filePath = filePath;
        }
        async getJsonData() {
            if (state.throwReadPaths.has(this.filePath)) {
                throw new Error('read failed');
            }
            const value = state.documents.get(this.filePath);
            return value === null || value === undefined
                ? (value ?? null)
                : structuredClone(value);
        }
        async setJsonData(value: any) {
            state.documents.set(this.filePath, structuredClone(value));
        }
        async save() {
            return true;
        }
        static async create(dir: string, name: string, extra: any) {
            return { dir, name, extra };
        }
        static _getInstance(filePath: string, create: () => any) {
            if (!state.instances.has(filePath)) {
                state.instances.set(filePath, create());
            }
            return state.instances.get(filePath);
        }
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/helpers', () => ({
    cloneJson: (value: unknown) => structuredClone(value),
}));
vi.mock('../helper/loggerHelpers', () => ({ appError: mocks.appError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => unknown) => callback(),
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('./presentingFlowActionHelpers', () => ({
    PRESENTING_FLOW_ACTION_TYPE: 'action',
}));
vi.mock('./presentingFlowCcHelpers', () => ({
    checkIsValidPresentingFlowItemUuid: (value: unknown) =>
        typeof value === 'string' && value.length > 0,
    genPresentingFlowItemUuid: () => `generated-${++state.uuidIndex}`,
}));

vi.mock('./PresentingFlowItem', () => ({
    default: class MockItem {
        filePath: string;
        json: any;
        isError = false;
        constructor(filePath: string, json: any) {
            this.filePath = filePath;
            this.json = structuredClone(json);
            this.isError = json.type === 'error';
        }
        toJson() {
            return structuredClone(this.json);
        }
        static bindCcSources(items: any[]) {
            return items;
        }
        static fromJson(filePath: string, json: any) {
            if (json.type === 'bad') throw new Error('bad row');
            return new this(filePath, json);
        }
        static fromJsonError(filePath: string, json: any) {
            const item = new this(filePath, { ...json, type: 'error' });
            item.json = structuredClone(json);
            item.isError = true;
            return item;
        }
        static async fromDroppedData() {
            if (state.throwDropped !== null) throw state.throwDropped;
            return state.nextDropped === null
                ? null
                : structuredClone(state.nextDropped);
        }
        static fromActionId(
            actionId: string,
            arming: Record<string, unknown> = {},
            screenIds: number[] = [],
        ) {
            if (state.throwActionId !== null) throw state.throwActionId;
            return {
                type: 'action',
                uuid: `generated-${++state.uuidIndex}`,
                data: actionId,
                ...arming,
                ...(screenIds.length > 0 ? { screenIds } : {}),
            };
        }
        static readCcItemRefList(json: any) {
            return [
                ...(Array.isArray(json.ccItems) ? json.ccItems : []),
                ...Object.values(json.slideCcItems ?? {}).flatMap((one: any) =>
                    Array.isArray(one) ? one : [],
                ),
            ];
        }
        static getMaxCcItemCount(json: any) {
            if (json.data === 'none') return 0;
            if (json.data === 'jump') return 1;
            return Infinity;
        }
        static checkIsCcTargetHost(json: any) {
            return json.data === 'jump';
        }
        static resolveCcItemJson(json: any, isTarget = false) {
            if (json.type === 'refused' && !isTarget) return null;
            if (json.type === 'error') return null;
            return structuredClone(json);
        }
    },
    applyPresentingFlowActionArming: (json: any, arming: any) => {
        delete json.actionNumber;
        delete json.actionTime;
        delete json.actionKey;
        Object.assign(json, arming);
    },
}));

import PresentingFlow from './PresentingFlow';

function itemsOf(filePath = '/flow.owapf') {
    return state.documents.get(filePath)?.items ?? [];
}

beforeEach(() => {
    vi.clearAllMocks();
    state.documents.clear();
    state.instances.clear();
    state.nextDropped = null;
    state.throwDropped = null;
    state.throwActionId = null;
    state.throwReadPaths.clear();
    state.uuidIndex = 0;
});

describe('PresentingFlow mutations', () => {
    test('normalizes data, builds error rows, creates and caches documents', async () => {
        state.documents.set('/flow.owapf', {
            metadata: { name: 'Sunday' },
            items: [{ type: 'slide', uuid: 'one' }, { type: 'bad' }],
        });
        const flow = new PresentingFlow('/flow.owapf');

        expect(await flow.getItems()).toMatchObject([
            { json: { type: 'slide', uuid: 'one' }, isError: false },
            { json: { type: 'bad' }, isError: true },
        ]);
        // Logged with the file and the entry as TEXT, and announced once.
        expect(mocks.appError).toHaveBeenCalledWith(
            expect.any(Error),
            'in /flow.owapf:',
            JSON.stringify({ type: 'bad' }),
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
        // Read again -- after a write, or by the run player -- it says nothing
        // more: the error row is still there to see.
        await flow.getItems();
        expect(mocks.appError).toHaveBeenCalledOnce();
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();

        state.documents.set('/not-array', { metadata: {}, items: 'bad' });
        await expect(
            new PresentingFlow('/not-array').getJsonData(),
        ).resolves.toMatchObject({ items: [] });
        await expect(
            new PresentingFlow('/missing').getJsonData(),
        ).resolves.toBeNull();
        expect(PresentingFlow.genNewExtraJsonData()).toEqual({ items: [] });
        await expect(PresentingFlow.create('/runs', 'Sunday')).resolves.toEqual(
            {
                dir: '/runs',
                name: 'Sunday',
                extra: { items: [] },
            },
        );
        expect(PresentingFlow.getInstance('/same')).toBe(
            PresentingFlow.getInstance('/same'),
        );
    });

    test('adds dropped items and actions at bounded positions and reports refusals', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'slide', uuid: 'one' }],
        });
        const flow = new PresentingFlow('/flow.owapf');
        state.nextDropped = { type: 'background', uuid: 'two' };

        await expect(flow.addItem({} as any, {} as any, -5)).resolves.toBe(
            true,
        );
        expect(itemsOf()[0].uuid).toBe('two');
        await flow.addActionItem(
            'next-timeout' as any,
            { actionNumber: 5 },
            99,
            [2],
        );
        expect(itemsOf().at(-1)).toMatchObject({
            data: 'next-timeout',
            actionNumber: 5,
            screenIds: [2],
        });

        state.nextDropped = null;
        await expect(flow.addItem({} as any, {} as any)).resolves.toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Adding Presenting Flow Item',
            'This item type cannot be added to a presenting flow',
        );

        state.throwDropped = new Error('drop failed');
        await expect(flow.addItem({} as any, {} as any)).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('removes followers, duplicates, moves, clears, and guards bad indexes', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                { type: 'slide', uuid: 'source', actionKey: 'Ctrl+A' },
                {
                    type: 'slide',
                    uuid: 'host',
                    ccItems: [{ uuid: 'source' }, { uuid: 'keep' }],
                    slideCcItems: {
                        1: [{ uuid: 'source' }],
                        2: [{ uuid: 'keep' }],
                    },
                },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(flow.removeItemAtIndex(99)).resolves.toBe(false);
        await expect(flow.removeItemAtIndex(0)).resolves.toBe(true);
        expect(itemsOf()[0]).toMatchObject({
            ccItems: [{ uuid: 'keep' }],
            slideCcItems: { 2: [{ uuid: 'keep' }] },
        });
        await expect(flow.duplicateItemAtIndex(0)).resolves.toBe(true);
        expect(itemsOf()).toHaveLength(2);
        expect(itemsOf()[1].uuid).not.toBe(itemsOf()[0].uuid);
        expect(itemsOf()[1]).not.toHaveProperty('actionKey');
        await expect(flow.duplicateItemAtIndex(99)).resolves.toBe(false);
        await expect(flow.moveItemToIndex(1, -10)).resolves.toBe(true);
        await expect(flow.moveItemToIndex(99, 0)).resolves.toBe(false);
        await expect(flow.clearItems()).resolves.toBe(true);
        expect(itemsOf()).toEqual([]);
    });

    test('rearms uniquely and writes item pins, colors, and disabled flags', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                { type: 'action', uuid: 'one', actionKey: 'Ctrl+A' },
                { type: 'action', uuid: 'two', actionKey: 'Ctrl+B' },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(
            flow.setItemActionArming(1, { actionKey: 'Ctrl+A' }),
        ).resolves.toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Keyboard Event',
            expect.stringContaining('Ctrl+A'),
        );
        await flow.setItemActionArming(1, { actionTime: '19:30' });
        await flow.setItemColorNote(1, 'red');
        await flow.setItemScreenIds(1, [2, 3]);
        await flow.setItemSlideScreenIds(1, 7, [4]);
        await flow.setItemDisabled(1, true);
        await flow.setItemSlideDisabled(1, 7, true);
        expect(itemsOf()[1]).toMatchObject({
            actionTime: '19:30',
            colorNote: 'red',
            screenIds: [2, 3],
            slideScreenIds: { 7: [4] },
            isDisabled: true,
            disabledSlideIds: [7],
        });

        await flow.setItemScreenIds(1, []);
        await flow.setItemSlideScreenIds(1, 7, []);
        await flow.setItemDisabled(1, false);
        await flow.setItemSlideDisabled(1, 7, false);
        expect(itemsOf()[1]).not.toHaveProperty('screenIds');
        expect(itemsOf()[1]).not.toHaveProperty('slideScreenIds');
        expect(itemsOf()[1]).not.toHaveProperty('isDisabled');
        expect(itemsOf()[1]).not.toHaveProperty('disabledSlideIds');
        await expect(flow.setItemColorNote(99, null)).resolves.toBe(false);
    });

    test('adds, orders, updates, and removes entry and per-slide CC references', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                { type: 'slide', uuid: 'host' },
                { type: 'slide', uuid: 'source' },
                {
                    type: 'action',
                    uuid: 'full',
                    data: 'jump',
                    ccItems: [{ uuid: 'source' }],
                },
                { type: 'action', uuid: 'none', data: 'none' },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(flow.addItemCcItem(0, null, 'source')).resolves.toBe(true);
        await expect(flow.addItemCcItem(0, null, 'missing')).resolves.toBe(
            false,
        );
        await expect(flow.addItemCcItem(0, null, 'host')).resolves.toBe(false);
        await expect(flow.addItemCcItem(2, null, 'source')).resolves.toBe(
            false,
        );
        await expect(flow.addItemCcItem(3, null, 'source')).resolves.toBe(
            false,
        );
        await expect(
            flow.addItemCcAction(
                0,
                3,
                'slide-media-control' as any,
                {
                    mediaControl: { mode: 'pause' },
                } as any,
            ),
        ).resolves.toBe(true);

        await flow.setItemCcItemScreenIds(0, null, 0, [5]);
        await flow.setItemCcItemActionArming(0, null, 0, { actionNumber: 4 });
        await flow.setItemCcItemMediaControl(
            0,
            null,
            0,
            { mode: 'play' } as any,
            [6],
        );
        expect(itemsOf()[0].ccItems[0]).toMatchObject({
            uuid: 'source',
            screenIds: [6],
            actionArming: { actionNumber: 4 },
            mediaControl: { mode: 'play' },
        });
        await flow.setItemCcItemScreenIds(0, null, 0, []);
        await flow.setItemCcItemActionArming(0, null, 0, null);
        await flow.setItemCcItemMediaControl(0, null, 0, null, []);
        await flow.moveItemCcItemToIndex(0, null, 0, 10);
        await expect(flow.moveItemCcItemToIndex(0, null, 99, 0)).resolves.toBe(
            false,
        );
        await expect(flow.removeItemCcItemAtIndex(0, null, 99)).resolves.toBe(
            false,
        );
        await expect(flow.removeItemCcItemAtIndex(0, null, 0)).resolves.toBe(
            true,
        );
        expect(itemsOf()[0]).not.toHaveProperty('ccItems');

        await expect(flow.removeItemCcItemAtIndex(99, null, 0)).resolves.toBe(
            false,
        );
    });

    test('attaches dropped and cross-sheet rows while stripping copied identity state', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'slide', uuid: 'host' }],
        });
        state.documents.set('/other.owapf', {
            metadata: {},
            items: [
                {
                    type: 'slide',
                    uuid: 'other',
                    ccItems: [{ uuid: 'nested' }],
                    slideCcItems: { 1: [{ uuid: 'nested' }] },
                    actionKey: 'Ctrl+O',
                },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');
        state.nextDropped = { type: 'background', uuid: 'dropped' };
        await expect(
            flow.addItemCcFromDroppedData(0, null, {} as any, {} as any),
        ).resolves.toBe(true);
        expect(itemsOf()).toHaveLength(2);
        expect(itemsOf()[0].ccItems).toEqual([{ uuid: 'dropped' }]);

        await expect(
            flow.addItemCcFromItemIndex(0, 2, '/other.owapf', 0),
        ).resolves.toBe(true);
        const copied = itemsOf().at(-1);
        expect(copied.uuid).not.toBe('other');
        expect(copied).not.toHaveProperty('ccItems');
        expect(copied).not.toHaveProperty('slideCcItems');
        expect(copied).not.toHaveProperty('actionKey');

        state.nextDropped = { type: 'refused', uuid: 'nope' };
        await expect(
            flow.addItemCcFromDroppedData(0, null, {} as any, {} as any),
        ).resolves.toBe(false);
        await expect(
            flow.addItemCcFromItemIndex(0, null, '/other.owapf', 99),
        ).resolves.toBe(false);
    });
});

describe('PresentingFlow edge and failure paths', () => {
    test('announces a damaged entry again once its minute is over, as text even when unserialisable', async () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
            state.documents.set('/expire.owapf', {
                metadata: {},
                items: [{ type: 'bad' }],
            });
            const flow = new PresentingFlow('/expire.owapf');
            await flow.getItems();
            vi.setSystemTime(new Date('2030-01-01T00:00:30Z'));
            await flow.getItems();
            expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
            // Past the minute the notice is pruned, so it is said once more.
            vi.setSystemTime(new Date('2030-01-01T00:01:31Z'));
            await flow.getItems();
            expect(mocks.showSimpleToast).toHaveBeenCalledTimes(2);
            expect(mocks.appError).toHaveBeenCalledTimes(2);

            // JSON cannot carry a BigInt: the entry is still logged, as text.
            state.documents.set('/bigint.owapf', {
                metadata: {},
                items: [{ type: 'bad', size: 1n }],
            });
            const items = await new PresentingFlow('/bigint.owapf').getItems();
            expect(items?.[0].isError).toBe(true);
            expect(mocks.appError).toHaveBeenLastCalledWith(
                expect.any(Error),
                'in /bigint.owapf:',
                '[object Object]',
            );
        } finally {
            vi.useRealTimers();
        }
    });

    test('answers null or false, writing nothing, when the document is gone', async () => {
        const flow = new PresentingFlow('/missing.owapf');
        await expect(flow.getItems()).resolves.toBeNull();
        await expect(flow.clearItems()).resolves.toBe(false);
        await expect(flow.removeItemAtIndex(0)).resolves.toBe(false);
        expect(state.documents.has('/missing.owapf')).toBe(false);
    });

    test('refuses a new action whose shortcut is taken and takes a free one', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'action', uuid: 'one', actionKey: 'Ctrl+A' }],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(
            flow.addActionItem('keyboard-event' as any, {
                actionKey: 'Ctrl+A',
            }),
        ).resolves.toBe(false);
        expect(itemsOf()).toHaveLength(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Keyboard Event',
            'This shortcut is already used in this presenting flow: Ctrl+A',
        );

        await expect(
            flow.addActionItem('keyboard-event' as any, {
                actionKey: 'Ctrl+B',
            }),
        ).resolves.toBe(true);
        expect(itemsOf().map((itemJson: any) => itemJson.actionKey)).toEqual([
            'Ctrl+A',
            'Ctrl+B',
        ]);
        // Re-arming a line with the key it already holds is not a clash.
        await expect(
            flow.setItemActionArming(0, { actionKey: 'Ctrl+A' }),
        ).resolves.toBe(true);
        await expect(
            flow.setItemActionArming(9, { actionNumber: 3 }),
        ).resolves.toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
    });

    test('reports an action that cannot be built instead of throwing', async () => {
        state.documents.set('/flow.owapf', { metadata: {}, items: [] });
        state.throwActionId = new Error('unknown action');
        const flow = new PresentingFlow('/flow.owapf');
        await expect(flow.addActionItem('nope' as any)).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledWith(state.throwActionId);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Adding Presenting Flow Action',
            'unknown action',
        );
        expect(itemsOf()).toEqual([]);
    });

    test('removing a line drops only the followers naming it, and the emptied lists with them', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                { type: 'slide' },
                { type: 'slide', uuid: 'source' },
                {
                    type: 'slide',
                    uuid: 'host',
                    ccItems: [{ uuid: 'source' }],
                    slideCcItems: { 3: [{ uuid: 'source' }] },
                },
                { type: 'slide', uuid: 'bystander', ccItems: [{ uuid: 'x' }] },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        // A line with no identity has no followers to drop.
        await expect(flow.removeItemAtIndex(0)).resolves.toBe(true);
        expect(itemsOf()[1]).toMatchObject({ ccItems: [{ uuid: 'source' }] });

        await expect(flow.removeItemAtIndex(0)).resolves.toBe(true);
        expect(itemsOf()).toEqual([
            { type: 'slide', uuid: 'host' },
            { type: 'slide', uuid: 'bystander', ccItems: [{ uuid: 'x' }] },
        ]);
    });

    test('a slide CC list emptied away takes its map along, and a bad CC index is refused', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                {
                    type: 'slide',
                    uuid: 'host',
                    slideCcItems: { 3: [{ uuid: 'source' }] },
                },
                { type: 'slide', uuid: 'source' },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(flow.setItemCcItemScreenIds(0, 3, 5, [1])).resolves.toBe(
            false,
        );
        expect(itemsOf()[0].slideCcItems).toEqual({ 3: [{ uuid: 'source' }] });
        await expect(flow.removeItemCcItemAtIndex(0, 3, 0)).resolves.toBe(true);
        expect(itemsOf()[0]).toEqual({ type: 'slide', uuid: 'host' });
    });

    test('reports a dropped CC payload that cannot be read', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'slide', uuid: 'host' }],
        });
        state.throwDropped = new Error('drop failed');
        const flow = new PresentingFlow('/flow.owapf');
        await expect(
            flow.addItemCcFromDroppedData(0, null, {} as any, {} as any),
        ).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledWith(state.throwDropped);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Adding CC Element',
            'drop failed',
        );
        expect(itemsOf()).toHaveLength(1);
    });

    test('a row of the same sheet is followed where it is, by uuid or by position', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [
                { type: 'slide', uuid: 'host' },
                { type: 'slide', uuid: 'listed' },
                { type: 'slide' },
            ],
        });
        const flow = new PresentingFlow('/flow.owapf');

        await expect(
            flow.addItemCcFromItemIndex(0, null, '/flow.owapf', 1),
        ).resolves.toBe(true);
        expect(itemsOf()).toHaveLength(3);
        expect(itemsOf()[0].ccItems).toEqual([{ uuid: 'listed' }]);

        // No uuid to find it by: found at its position and given one, so the
        // CC and the line it names agree — and nothing is appended.
        await expect(
            flow.addItemCcFromItemIndex(0, null, '/flow.owapf', 2),
        ).resolves.toBe(true);
        expect(itemsOf()).toHaveLength(3);
        expect(itemsOf()[2]).toEqual({ type: 'slide', uuid: 'generated-1' });
        expect(itemsOf()[0].ccItems).toEqual([
            { uuid: 'listed' },
            { uuid: 'generated-1' },
        ]);
    });

    test('a dropped payload with no uuid is given one before it is followed', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'slide', uuid: 'host' }],
        });
        state.nextDropped = { type: 'background' };
        const flow = new PresentingFlow('/flow.owapf');
        await expect(
            flow.addItemCcFromDroppedData(0, null, {} as any, {} as any),
        ).resolves.toBe(true);
        expect(itemsOf()[1]).toEqual({
            type: 'background',
            uuid: 'generated-1',
        });
        expect(itemsOf()[0].ccItems).toEqual([{ uuid: 'generated-1' }]);
    });

    test('reports a source sheet that cannot be read', async () => {
        state.documents.set('/flow.owapf', {
            metadata: {},
            items: [{ type: 'slide', uuid: 'host' }],
        });
        state.throwReadPaths.add('/broken.owapf');
        const flow = new PresentingFlow('/flow.owapf');
        await expect(
            flow.addItemCcFromItemIndex(0, null, '/broken.owapf', 0),
        ).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'read failed' }),
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Adding CC Element',
            'read failed',
        );
        expect(itemsOf()).toEqual([{ type: 'slide', uuid: 'host' }]);
    });
});
