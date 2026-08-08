// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES — see the note in `presentingFlowMediaControl.test.ts`.
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

const { toPresentingFlowCcActionArming } =
    await import('./presentingFlowCcHelpers');
const { default: PresentingFlowItem } = await import('./PresentingFlowItem');
const { default: PresentingFlow } = await import('./PresentingFlow');

const METADATA = {
    app: 'test',
    fileVersion: 1,
    initDate: '2026-08-08',
};

// `PresentingFlow.getInstance` caches by path, so each case needs its own.
let instanceCount = 0;

function genPresentingFlow(items: any[]) {
    instanceCount += 1;
    const presentingFlow = PresentingFlow.getInstance(
        `/presenting-flows/cc-arming-${instanceCount}.owpf`,
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

function genSlideItem(uuid = 'host-uuid', id = 3) {
    return {
        type: 'slide',
        uuid,
        filePath: '/documents/song.owdoc',
        id,
        data: { filePath: '/documents/song.owdoc', id },
        title: `song #${id}`,
    };
}

function genTimeoutItem(arming: any = { actionNumber: 10 }) {
    return {
        type: 'action',
        uuid: 'timeout-uuid',
        data: 'next-timeout',
        ...arming,
    };
}

/**
 * One timeout element, attached to two slides — the shape the whole feature is
 * for: one clock in the sheet, held for a different length under each line.
 */
function genTwoHostsSheet(ccArmings: any[]) {
    return genPresentingFlow([
        {
            ...genSlideItem('host-uuid-1', 3),
            ccItems: [{ uuid: 'timeout-uuid', ...ccArmings[0] }],
        },
        {
            ...genSlideItem('host-uuid-2', 4),
            ccItems: [{ uuid: 'timeout-uuid', ...ccArmings[1] }],
        },
        genTimeoutItem(),
    ]);
}

describe('reading a CC’s own arming', () => {
    test('only a real number of seconds or a real time answers with one', () => {
        expect(toPresentingFlowCcActionArming(null)).toBe(null);
        expect(toPresentingFlowCcActionArming(30)).toBe(null);
        expect(toPresentingFlowCcActionArming({})).toBe(null);
        expect(toPresentingFlowCcActionArming({ actionNumber: '30' })).toBe(
            null,
        );
        expect(toPresentingFlowCcActionArming({ actionTime: '25:00' })).toBe(
            null,
        );
        expect(toPresentingFlowCcActionArming({ actionNumber: 4 })).toEqual({
            actionNumber: 4,
        });
        expect(toPresentingFlowCcActionArming({ actionTime: '19:05' })).toEqual(
            { actionTime: '19:05' },
        );
    });

    test('a clock that has already run out is refused, not clamped', () => {
        // The very answers the question itself refuses. A `0` overlaid on the
        // element would be a follower whose clock is up the moment it is armed.
        expect(toPresentingFlowCcActionArming({ actionNumber: 0 })).toBe(null);
        expect(toPresentingFlowCcActionArming({ actionNumber: -5 })).toBe(null);
        expect(toPresentingFlowCcActionArming({ actionNumber: NaN })).toBe(
            null,
        );
    });

    test('a record carrying both is read as the time, and never as a key', () => {
        expect(
            toPresentingFlowCcActionArming({
                actionNumber: 30,
                actionTime: '07:05',
            }),
        ).toEqual({ actionTime: '07:05' });
        // A key-armed action may not be a follower at all, so a key written here
        // by hand names nothing this CC could ever fire.
        expect(
            toPresentingFlowCcActionArming({ actionKey: 'Ctrl+Shift+A' }),
        ).toBe(null);
    });
});

describe('a follower armed for itself', () => {
    test('its own clock beats the element’s, which is left alone', async () => {
        const { presentingFlow, jsonData } = genTwoHostsSheet([
            { actionArming: { actionNumber: 4 } },
            {},
        ]);

        const items = (await presentingFlow.getItems()) ?? [];
        const [firstCcItem] = items[0].ccItems;
        const [secondCcItem] = items[1].ccItems;

        expect(firstCcItem.actionNumber).toBe(4);
        expect(firstCcItem.hasOwnActionArming).toBe(true);
        expect(firstCcItem.title).toBe('Next: Timeout (4)');
        // The one with nothing of its own still reads the element, which is what
        // absence has always meant.
        expect(secondCcItem.actionNumber).toBe(10);
        expect(secondCcItem.hasOwnActionArming).toBe(false);
        // And the ELEMENT is untouched: overriding one attachment must not
        // re-arm the line every other attachment is reading.
        expect(items[2].actionNumber).toBe(10);
        expect((jsonData.items as any[])[2].actionNumber).toBe(10);
    });

    test('the same timeout attached twice counts two different lengths', async () => {
        const { presentingFlow } = genTwoHostsSheet([
            { actionArming: { actionNumber: 4 } },
            { actionArming: { actionTime: '19:05' } },
        ]);

        const items = (await presentingFlow.getItems()) ?? [];

        expect(items[0].ccItems[0].actionNumber).toBe(4);
        expect(items[0].ccItems[0].actionTime).toBe(null);
        expect(items[1].ccItems[0].actionTime).toBe('19:05');
        expect(items[1].ccItems[0].title).toBe('Next: Timeout (7:05 PM)');
    });

    test('a time of day written over seconds leaves no stale seconds behind', async () => {
        // The element counts SECONDS; this follower is told a time of day. The
        // number must go, or `actionTime` winning would leave a `10` that stopped
        // mattering without ever being removed.
        const { presentingFlow } = genTwoHostsSheet([
            { actionArming: { actionTime: '07:05' } },
            {},
        ]);

        const items = (await presentingFlow.getItems()) ?? [];
        const [ccItem] = items[0].ccItems;

        expect(ccItem.toJson().actionNumber).toBeUndefined();
        expect(ccItem.actionArming).toEqual({ actionTime: '07:05' });
    });

    test('re-arming the ELEMENT still moves every follower that has none', async () => {
        const { presentingFlow } = genTwoHostsSheet([
            { actionArming: { actionNumber: 4 } },
            {},
        ]);

        await presentingFlow.setItemActionArming(2, { actionNumber: 45 });

        const items = (await presentingFlow.getItems()) ?? [];
        // The one holding its own clock is the exception it was made to be...
        expect(items[0].ccItems[0].actionNumber).toBe(4);
        // ...and the other is still a reference, re-armed with the element.
        expect(items[1].ccItems[0].actionNumber).toBe(45);
    });
});

describe('what may hold a clock of its own', () => {
    test('the timeout, and nothing else that can be a follower', () => {
        expect(
            PresentingFlowItem.checkCanBeCcArmed(genTimeoutItem() as any),
        ).toBe(true);
        // Armed with nothing at all — there is no per-attachment answer to give.
        expect(
            PresentingFlowItem.checkCanBeCcArmed({
                type: 'action',
                data: 'next-clear-interval',
            } as any),
        ).toBe(false);
        // A screen action is not armed with anything, and an interval may not
        // follow a line at all.
        expect(
            PresentingFlowItem.checkCanBeCcArmed({
                type: 'action',
                data: 'clear-all',
            } as any),
        ).toBe(false);
        expect(
            PresentingFlowItem.checkCanBeCcArmed({
                type: 'action',
                data: 'next-interval',
            } as any),
        ).toBe(false);
        expect(
            PresentingFlowItem.checkCanBeCcArmed(genSlideItem() as any),
        ).toBe(false);
    });

    test('an arming on something that cannot hold one is ignored', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                ...genSlideItem(),
                ccItems: [
                    {
                        uuid: 'clear-uuid',
                        actionArming: { actionNumber: 4 },
                    },
                ],
            },
            { type: 'action', uuid: 'clear-uuid', data: 'clear-all' },
        ]);

        const items = (await presentingFlow.getItems()) ?? [];
        const [ccItem] = items[0].ccItems;

        expect(ccItem.canBeCcArmed).toBe(false);
        expect(ccItem.hasOwnActionArming).toBe(false);
        expect(ccItem.toJson().actionNumber).toBeUndefined();
    });

    test('a `Jump to`’s target is never fired, so it is never armed', async () => {
        const { presentingFlow } = genPresentingFlow([
            {
                type: 'action',
                uuid: 'jump-uuid',
                data: 'jump-to',
                ccItems: [
                    {
                        uuid: 'timeout-uuid',
                        actionArming: { actionNumber: 4 },
                    },
                ],
            },
            genTimeoutItem(),
        ]);

        const items = (await presentingFlow.getItems()) ?? [];
        const [ccItem] = items[0].ccItems;

        // The run lands on the ELEMENT and fires what the element is armed with,
        // so a clock on the pointer would be a row promising a duration nothing
        // ever counts.
        expect(ccItem.canBeCcArmed).toBe(false);
        expect(ccItem.actionNumber).toBe(10);
    });

    test('a LISTED element answers no to both, being re-armed on its own row', async () => {
        const { presentingFlow } = genTwoHostsSheet([{}, {}]);

        const items = (await presentingFlow.getItems()) ?? [];

        expect(items[2].canBeCcArmed).toBe(false);
        expect(items[2].hasOwnActionArming).toBe(false);
    });
});

describe('writing a follower’s own clock', () => {
    test('it is stored on the ATTACHMENT, not on the element', async () => {
        const { presentingFlow, jsonData } = genTwoHostsSheet([{}, {}]);

        await presentingFlow.setItemCcItemActionArming(0, null, 0, {
            actionNumber: 4,
        });

        const items = jsonData.items as any[];
        expect(items[0].ccItems[0]).toEqual({
            uuid: 'timeout-uuid',
            actionArming: { actionNumber: 4 },
        });
        // Neither the element nor the other attachment moved.
        expect(items[1].ccItems[0].actionArming).toBeUndefined();
        expect(items[2].actionNumber).toBe(10);
    });

    test('a null answer deletes the key, handing the row back to the element', async () => {
        const { presentingFlow, jsonData } = genTwoHostsSheet([
            { actionArming: { actionNumber: 4 } },
            {},
        ]);

        await presentingFlow.setItemCcItemActionArming(0, null, 0, null);

        const items = jsonData.items as any[];
        expect('actionArming' in items[0].ccItems[0]).toBe(false);
        const readItems = (await presentingFlow.getItems()) ?? [];
        expect(readItems[0].ccItems[0].actionNumber).toBe(10);
        expect(readItems[0].ccItems[0].hasOwnActionArming).toBe(false);
    });

    test('an out-of-range host or CC writes nothing at all', async () => {
        const { presentingFlow, jsonData } = genTwoHostsSheet([{}, {}]);

        expect(
            await presentingFlow.setItemCcItemActionArming(9, null, 0, {
                actionNumber: 4,
            }),
        ).toBe(false);
        expect(
            await presentingFlow.setItemCcItemActionArming(0, null, 9, {
                actionNumber: 4,
            }),
        ).toBe(false);
        expect((jsonData.items as any[])[0].ccItems[0].actionArming).toBe(
            undefined,
        );
    });

    test('a duplicated host keeps the clock its attachment holds', async () => {
        const { presentingFlow, jsonData } = genTwoHostsSheet([
            { actionArming: { actionNumber: 4 } },
            {},
        ]);

        await presentingFlow.duplicateItemAtIndex(0);

        const items = jsonData.items as any[];
        // Re-keyed as its own line, but what it holds is per attachment and
        // travels with the copy — exactly as a media controller's settings do.
        expect(items[1].uuid).not.toBe(items[0].uuid);
        expect(items[1].ccItems[0]).toEqual({
            uuid: 'timeout-uuid',
            actionArming: { actionNumber: 4 },
        });
    });
});

describe('a document slide’s follower', () => {
    test('holds its own clock too, keyed by the slide it rides with', async () => {
        const { presentingFlow, jsonData } = genPresentingFlow([
            {
                type: 'appDocument',
                uuid: 'doc-uuid',
                filePath: '/documents/song.owdoc',
                data: '/documents/song.owdoc',
                title: 'song',
                slideCcItems: { '7': [{ uuid: 'timeout-uuid' }] },
            },
            genTimeoutItem(),
        ]);

        await presentingFlow.setItemCcItemActionArming(0, 7, 0, {
            actionNumber: 4,
        });

        const items = (await presentingFlow.getItems()) ?? [];
        expect(items[0].getSlideCcItems(7)[0].actionNumber).toBe(4);
        expect((jsonData.items as any[])[1].actionNumber).toBe(10);
    });
});
