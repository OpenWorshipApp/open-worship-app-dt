import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    const nameRecord = { id: 'noah', name: 'ណូអេ', verses: ['GEN 8:1'] };
    const locationRecord = {
        id: 'ararat',
        name: 'អារ៉ារ៉ាត',
        verses: ['GEN 8:4'],
    };
    const managers = {
        namesLookupManager: {
            getRecordById: vi.fn((id: string) => {
                return id === nameRecord.id ? nameRecord : null;
            }),
        },
        locationsLookupManager: {
            getRecordById: vi.fn((id: string) => {
                return id === locationRecord.id ? locationRecord : null;
            }),
        },
    };
    return {
        nameRecord,
        locationRecord,
        managers,
        isAIEnabled: true,
        acquireLookupData: vi.fn(async (_langCode: string) => managers),
        releaseLookupData: vi.fn(),
        buildNameSummary: vi.fn((..._args: unknown[]) => ({
            plainText: 'name text',
            html: '<p>name</p>',
        })),
        buildLocationSummary: vi.fn((..._args: unknown[]) => ({
            plainText: 'place text',
            html: '<p>place</p>',
        })),
        copyRecordToClipboard: vi.fn(async (..._args: unknown[]) => {}),
        openDetailPanel: vi.fn(),
        openChatbotWithLookup: vi.fn(async (_ask: unknown) => true),
        showAppContextMenu: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
    };
});

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../graph-view/graphContextMenuHelpers', () => ({
    genGraphPreviewContextMenuItems: () => [
        { menuElement: 'Open Graph Preview' },
    ],
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithLookup: h.openChatbotWithLookup,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('./detailPanelHelpers', () => ({
    openDetailPanel: h.openDetailPanel,
}));
vi.mock('./lookupDataHelpers', () => ({
    acquireLookupData: h.acquireLookupData,
    releaseLookupData: h.releaseLookupData,
}));
vi.mock('./lookupLangHelpers', () => ({
    getSelectedLookupLangCode: () => 'km',
}));
vi.mock('./lookupRecordHelpers', () => ({
    buildNameSummary: h.buildNameSummary,
    buildLocationSummary: h.buildLocationSummary,
    copyRecordToClipboard: h.copyRecordToClipboard,
}));

import {
    copyLookupRecord,
    genLookupRecordContextMenuItems,
    showLookupRecordContextMenu,
} from './lookupRecordMenuHelpers';

const noahTarget = { kind: 'name', recordId: 'noah', name: 'ណូអេ' } as const;
const araratTarget = {
    kind: 'location',
    recordId: 'ararat',
    name: 'អារ៉ារ៉ាត',
} as const;

function findItem(label: string) {
    const item = genLookupRecordContextMenuItems(noahTarget).find((entry) => {
        return entry.menuElement === label;
    });
    if (item === undefined) {
        throw new Error(`No menu item: ${label}`);
    }
    return item;
}

beforeEach(() => {
    vi.clearAllMocks();
    h.isAIEnabled = true;
});

describe('a name or place row’s menu', () => {
    it('offers Open, Copy and Open in Chatbot ahead of the graph', () => {
        const items = genLookupRecordContextMenuItems(noahTarget);
        expect(items.map((item) => item.menuElement)).toEqual([
            'Open',
            'Copy',
            'Open in Chatbot',
            'Open Graph Preview',
        ]);
        expect(items.map((item) => item.childBefore)).toEqual([
            'icon:box-arrow-up-right',
            'icon:copy',
            'icon:robot',
            undefined,
        ]);
        // Nothing heavy is read to draw the menu.
        expect(h.acquireLookupData).not.toHaveBeenCalled();
    });

    it('leaves Open in Chatbot out while AI is off', () => {
        h.isAIEnabled = false;
        expect(
            genLookupRecordContextMenuItems(noahTarget).map((item) => {
                return item.menuElement;
            }),
        ).toEqual(['Open', 'Copy', 'Open Graph Preview']);
    });

    it('opens the record’s detail panel, as the row’s click does', () => {
        findItem('Open').onSelect!({} as any);
        expect(h.openDetailPanel).toHaveBeenCalledWith({
            kind: 'name',
            target: 'noah',
            name: 'ណូអេ',
        });
    });

    it('copies a name as its panel does, then lets the dataset go', async () => {
        findItem('Copy').onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.showSimpleToast).toHaveBeenCalledWith(
                'Copy',
                'Text has been copied to clipboard',
            );
        });
        expect(h.acquireLookupData).toHaveBeenCalledWith('km');
        expect(h.buildNameSummary).toHaveBeenCalledWith(
            h.managers,
            h.nameRecord,
            h.nameRecord.verses,
        );
        expect(h.copyRecordToClipboard).toHaveBeenCalledWith(
            'name text',
            '<p>name</p>',
        );
        expect(h.releaseLookupData).toHaveBeenCalledWith('km');
    });

    it('copies a place from the places manager', async () => {
        await expect(copyLookupRecord(araratTarget)).resolves.toBe(true);
        expect(h.buildLocationSummary).toHaveBeenCalledWith(
            h.managers.locationsLookupManager,
            h.locationRecord,
            h.locationRecord.verses,
        );
        expect(h.buildNameSummary).not.toHaveBeenCalled();
        expect(h.copyRecordToClipboard).toHaveBeenCalledWith(
            'place text',
            '<p>place</p>',
        );
        expect(h.releaseLookupData).toHaveBeenCalledTimes(1);
    });

    it('copies nothing for an id the dataset does not hold', async () => {
        await expect(
            copyLookupRecord({ ...noahTarget, recordId: 'gone' }),
        ).resolves.toBe(false);
        expect(h.copyRecordToClipboard).not.toHaveBeenCalled();
        expect(h.releaseLookupData).toHaveBeenCalledWith('km');
    });

    it('releases the dataset and reports a load that fails', async () => {
        const error = new Error('no lookup data');
        h.acquireLookupData.mockRejectedValueOnce(error);
        findItem('Copy').onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.handleError).toHaveBeenCalledWith(error);
        });
        expect(h.releaseLookupData).toHaveBeenCalledWith('km');
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    it('asks the assistant what the panel’s 🤖 would', async () => {
        findItem('Open in Chatbot').onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.openChatbotWithLookup).toHaveBeenCalledWith({
                kind: 'name',
                target: 'noah',
                title: 'ណូអេ',
                langCode: 'km',
                page: globalThis.location?.href ?? '',
            });
        });
    });

    it('shows the whole menu at the event', () => {
        const event = {} as MouseEvent;
        showLookupRecordContextMenu(event, araratTarget);
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [shownEvent, items] = h.showAppContextMenu.mock.calls[0];
        expect(shownEvent).toBe(event);
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Open',
            'Copy',
            'Open in Chatbot',
            'Open Graph Preview',
        ]);
    });
});
