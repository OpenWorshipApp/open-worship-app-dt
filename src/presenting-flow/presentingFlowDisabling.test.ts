// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES — see the note in `presentingFlowScreenIds.test.ts`.
vi.mock('../bible-list/Bible', () => ({
    default: class {
        static getDefault = vi.fn(async () => null);
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        static dragDeserialize = vi.fn(() => null);
    },
}));

const { default: PresentingFlowItem } = await import('./PresentingFlowItem');
const { default: PresentingFlow } = await import('./PresentingFlow');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-05',
};

/** The file layer stubbed on the instance, as `presentingFlowScreenIds.test.ts` does. */
function genPresentingFlow(items: any[]) {
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/parked-${items.length}.owpf`,
    );
    const jsonData = { items, metadata: METADATA };
    (presentingFlow as any).getJsonData = async () => {
        return jsonData;
    };
    (presentingFlow as any).setJsonData = (newJsonData: any) => {
        jsonData.items = newJsonData.items;
    };
    (presentingFlow as any).save = async () => {
        return true;
    };
    return { presentingFlow, jsonData };
}

describe('parking a presenting flow entry out of the run', () => {
    test('the flag round-trips, and putting it back removes the key', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            { type: 'bg-color', data: '#00FFFF', title: '#00FFFF' },
        ]);

        expect((await presentingFlow.getItems())?.[0].isDisabled).toBe(false);

        await presentingFlow.setItemDisabled(0, true);
        expect(jsonData.items[0].isDisabled).toBe(true);
        expect((await presentingFlow.getItems())?.[0].isDisabled).toBe(true);
        // Everything else on the entry survives the write.
        expect(jsonData.items[0].data).toBe('#00FFFF');

        // "In play" is the ABSENCE of the field, so a run sheet nothing was
        // ever parked in reads as one written before this existed.
        await presentingFlow.setItemDisabled(0, false);
        expect('isDisabled' in jsonData.items[0]).toBe(false);
    });

    test('an out-of-range index writes nothing', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            { type: 'bg-color', data: '#fff', title: '#fff' },
        ]);
        const before = JSON.stringify(jsonData.items);

        expect(await presentingFlow.setItemDisabled(3, true)).toBe(false);
        expect(JSON.stringify(jsonData.items)).toBe(before);
    });

    test('a slide is parked on its own, or by the document it belongs to', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            {
                type: 'appDocument',
                filePath: '/docs/a.ows',
                data: '/docs/a.ows',
                title: 'a',
            },
        ]);
        const readItem = async () => {
            return (await presentingFlow.getItems())![0];
        };

        expect((await readItem()).checkIsSlideDisabled(7)).toBe(false);

        await presentingFlow.setItemSlideDisabled(0, 7, true);
        const parked = await readItem();
        expect(parked.checkIsSlideDisabled(7)).toBe(true);
        expect(parked.checkIsOwnSlideDisabled(7)).toBe(true);
        // Its siblings carry on.
        expect(parked.checkIsSlideDisabled(8)).toBe(false);
        // Parking one slide does not park the document.
        expect(parked.isDisabled).toBe(false);

        // Setting it twice must not stack up duplicate ids.
        await presentingFlow.setItemSlideDisabled(0, 7, true);
        expect(jsonData.items[0].disabledSlideIds).toEqual([7]);

        // The last slide put back takes the list with it.
        await presentingFlow.setItemSlideDisabled(0, 7, false);
        expect((await readItem()).checkIsSlideDisabled(7)).toBe(false);
        expect('disabledSlideIds' in jsonData.items[0]).toBe(false);
    });

    test('parking a document parks every slide under it', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                type: 'appDocument',
                filePath: '/docs/b.ows',
                data: '/docs/b.ows',
                title: 'b',
            },
        ]);

        await presentingFlow.setItemDisabled(0, true);
        const parked = (await presentingFlow.getItems())![0];
        expect(parked.checkIsSlideDisabled(1)).toBe(true);
        // ...without pretending each slide is parked in its own right, which is
        // what the menu edits and the badge reads.
        expect(parked.checkIsOwnSlideDisabled(1)).toBe(false);
    });

    test('a nonsense stored value reads as "in play" rather than erroring', () => {
        const genItem = (json: any) => {
            return new (PresentingFlowItem as any)('/presenting-flows/a.owpf', {
                type: 'bg-color',
                data: '#fff',
                ...json,
            }) as InstanceType<typeof PresentingFlowItem>;
        };

        expect(genItem({}).isDisabled).toBe(false);
        expect(genItem({ isDisabled: 'yes' }).isDisabled).toBe(false);
        expect(genItem({ disabledSlideIds: 3 }).checkIsSlideDisabled(3)).toBe(
            false,
        );
        // A row with a broken flag must still be a normal, presentable row —
        // never an error row in the middle of a service.
        expect(genItem({ isDisabled: 'yes' }).isError).toBe(false);
    });
});
