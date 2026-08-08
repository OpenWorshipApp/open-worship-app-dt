// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getSettingMock, setSettingMock, removeSettingMock } = vi.hoisted(
    () => ({
        getSettingMock: vi.fn(),
        setSettingMock: vi.fn(),
        removeSettingMock: vi.fn(),
    }),
);

// Partial: only the three accessors are stubbed. The path→setting-name
// sanitizer is real, because the keys these tests assert on are the sanitized
// ones.
vi.mock('../helper/settingHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../helper/settingHelpers')>();
    return {
        ...actual,
        getSetting: getSettingMock,
        setSetting: setSettingMock,
        removeSetting: removeSettingMock,
    };
});

import PresentingFlowItem from './PresentingFlowItem';
import type { PresentingFlowActionIdType } from './presentingFlowActionHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import {
    checkIsPresentingFlowPreviewItemExpanded,
    checkIsPresentingFlowPreviewItemSelected,
    requestPresentingFlowPreviewChildEntry,
    clearPresentingFlowPreviewSelectedItem,
    findNextPresentingFlowPreviewChildIndex,
    findNextPresentingFlowPreviewIndex,
    registerPresentingFlowPreviewChildStepping,
    stepPresentingFlowPreviewChild,
    resolvePresentingFlowPreviewSelectedChildIndex,
    resolvePresentingFlowPreviewSelectedIndex,
    setAllPresentingFlowPreviewItemsCollapsed,
    setPresentingFlowPreviewFilePath,
    setPresentingFlowPreviewItemCollapsed,
    setPresentingFlowPreviewSelectedChild,
    setPresentingFlowPreviewSelectedItem,
    toPresentingFlowPreviewItemKey,
} from './presentingFlowPreviewFloatingHelpers';

const PRESENTING_FLOW_FILE_PATH = '/data/presenting-flows/pl2.owpf';
const SETTING_NAME =
    'presenting-flow-preview-collapsed-_data_presenting-flows_pl2_owpf';

function genActionItem(actionId: PresentingFlowActionIdType) {
    return PresentingFlowItem.fromJson(
        PRESENTING_FLOW_FILE_PATH,
        PresentingFlowItem.fromActionId(actionId),
    );
}

function genSlideItem(
    presentingFlowFilePath = PRESENTING_FLOW_FILE_PATH,
    id = 3,
) {
    return PresentingFlowItem.fromJson(presentingFlowFilePath, {
        type: DragTypeEnum.SLIDE,
        filePath: '/data/documents/aa.owj',
        id,
        title: `aa #${id}`,
    });
}

describe('presenting flow preview collapsing', () => {
    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('an element with no stored state is expanded', () => {
        const presentingFlowItem = genSlideItem();
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                toPresentingFlowPreviewItemKey(presentingFlowItem),
            ),
        ).toBe(true);
    });

    test('collapsing stores the key under the presenting flow file', () => {
        const presentingFlowItem = genSlideItem();
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItem);
        setPresentingFlowPreviewItemCollapsed(
            presentingFlowItem.filePath,
            itemKey,
            true,
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify([itemKey]),
        );
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                itemKey,
            ),
        ).toBe(false);
    });

    test('expanding the last collapsed element removes the setting', () => {
        const presentingFlowItem = genSlideItem();
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItem);
        setPresentingFlowPreviewItemCollapsed(
            presentingFlowItem.filePath,
            itemKey,
            true,
        );
        setPresentingFlowPreviewItemCollapsed(
            presentingFlowItem.filePath,
            itemKey,
            false,
        );
        expect(removeSettingMock).toHaveBeenCalledWith(SETTING_NAME);
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                itemKey,
            ),
        ).toBe(true);
    });

    test('a stored state is read back for a presenting flow opened later', () => {
        const presentingFlowItem = genSlideItem();
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItem);
        // A different presenting flow is looked at in between, so the answer cannot
        // come from what the previous presenting flow left in memory.
        getSettingMock.mockReturnValue(JSON.stringify([itemKey]));
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                '/data/presenting-flows/pl1.owpf',
                itemKey,
            ),
        ).toBe(false);
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                itemKey,
            ),
        ).toBe(false);
        // Only the collapsed element is folded.
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                toPresentingFlowPreviewItemKey(
                    genSlideItem(PRESENTING_FLOW_FILE_PATH, 4),
                ),
            ),
        ).toBe(true);
    });

    test('a damaged setting reads as everything expanded', () => {
        getSettingMock.mockReturnValue('}{ not json');
        const presentingFlowItem = genSlideItem(
            '/data/presenting-flows/damaged.owpf',
        );
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                presentingFlowItem.filePath,
                toPresentingFlowPreviewItemKey(presentingFlowItem),
            ),
        ).toBe(true);
    });

    test('the same element in two presenting flows is remembered separately', () => {
        const presentingFlowItem = genSlideItem();
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItem);
        setPresentingFlowPreviewItemCollapsed(
            presentingFlowItem.filePath,
            itemKey,
            true,
        );
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                '/data/presenting-flows/pl1.owpf',
                itemKey,
            ),
        ).toBe(true);
    });

    test('collapsing all folds every listed element in one write', () => {
        const itemKeys = [3, 4, 5].map((id) => {
            return toPresentingFlowPreviewItemKey(
                genSlideItem(PRESENTING_FLOW_FILE_PATH, id),
            );
        });
        setAllPresentingFlowPreviewItemsCollapsed(
            PRESENTING_FLOW_FILE_PATH,
            itemKeys,
            true,
        );
        expect(setSettingMock).toHaveBeenCalledTimes(1);
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify(itemKeys),
        );
        for (const itemKey of itemKeys) {
            expect(
                checkIsPresentingFlowPreviewItemExpanded(
                    PRESENTING_FLOW_FILE_PATH,
                    itemKey,
                ),
            ).toBe(false);
        }
    });

    test('expanding all drops the setting rather than emptying it', () => {
        const itemKey = toPresentingFlowPreviewItemKey(genSlideItem());
        setAllPresentingFlowPreviewItemsCollapsed(
            PRESENTING_FLOW_FILE_PATH,
            [itemKey],
            true,
        );
        setAllPresentingFlowPreviewItemsCollapsed(
            PRESENTING_FLOW_FILE_PATH,
            [itemKey],
            false,
        );
        expect(removeSettingMock).toHaveBeenCalledWith(SETTING_NAME);
        expect(
            checkIsPresentingFlowPreviewItemExpanded(
                PRESENTING_FLOW_FILE_PATH,
                itemKey,
            ),
        ).toBe(true);
    });

    test('collapsing all forgets elements no longer in the presenting flow', () => {
        const goneItemKey = toPresentingFlowPreviewItemKey(
            genSlideItem(PRESENTING_FLOW_FILE_PATH, 9),
        );
        getSettingMock.mockReturnValue(JSON.stringify([goneItemKey]));
        const itemKey = toPresentingFlowPreviewItemKey(genSlideItem());
        setAllPresentingFlowPreviewItemsCollapsed(
            PRESENTING_FLOW_FILE_PATH,
            [itemKey],
            true,
        );
        expect(setSettingMock).toHaveBeenCalledWith(
            SETTING_NAME,
            JSON.stringify([itemKey]),
        );
    });

    test('the key follows the element, not its position', () => {
        expect(toPresentingFlowPreviewItemKey(genSlideItem())).toBe(
            toPresentingFlowPreviewItemKey(genSlideItem()),
        );
        expect(toPresentingFlowPreviewItemKey(genSlideItem())).not.toBe(
            toPresentingFlowPreviewItemKey(
                genSlideItem(PRESENTING_FLOW_FILE_PATH, 4),
            ),
        );
    });

    test("an action's key is its stored id, not its translated title", () => {
        const clearAll = genActionItem('clear-all');
        const clearSlide = genActionItem('clear-slide');
        expect(toPresentingFlowPreviewItemKey(clearAll)).toContain('clear-all');
        // The title is what the app has translated for the current language, so
        // a folded action would otherwise unfold itself when the language is
        // switched.
        expect(toPresentingFlowPreviewItemKey(clearAll)).not.toContain(
            clearAll.title,
        );
        expect(toPresentingFlowPreviewItemKey(clearAll)).not.toBe(
            toPresentingFlowPreviewItemKey(clearSlide),
        );
    });
});

function genDocumentItem() {
    return PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
        type: DragTypeEnum.APP_DOCUMENT,
        filePath: '/data/documents/bb.owj',
        data: '/data/documents/bb.owj',
        title: 'bb',
    });
}

function genDisabledSlideItem() {
    return PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
        type: DragTypeEnum.SLIDE,
        filePath: '/data/documents/aa.owj',
        id: 5,
        title: 'aa #5',
        isDisabled: true,
    });
}

function genDisabledDocumentItem() {
    return PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
        type: DragTypeEnum.APP_DOCUMENT,
        filePath: '/data/documents/cc.owj',
        data: '/data/documents/cc.owj',
        title: 'cc',
        isDisabled: true,
    });
}

function genAudioItem() {
    return PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
        type: DragTypeEnum.BACKGROUND_AUDIO,
        data: { src: 'file:///data/audios/cc.mp3' },
        title: 'cc.mp3',
    });
}

function select(presentingFlowItems: PresentingFlowItem[], index: number) {
    setPresentingFlowPreviewSelectedItem(
        PRESENTING_FLOW_FILE_PATH,
        toPresentingFlowPreviewItemKey(presentingFlowItems[index]),
        index,
    );
}

describe('presenting flow preview next-element stepping', () => {
    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
        clearPresentingFlowPreviewSelectedItem();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    test('nothing selected reads as "before the first element"', () => {
        const presentingFlowItems = [genSlideItem()];
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                presentingFlowItems,
            ),
        ).toBe(-1);
        expect(
            findNextPresentingFlowPreviewIndex(presentingFlowItems, -1),
        ).toBe(0);
    });

    test('the remembered element is found again', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genSlideItem(undefined, 4),
        ];
        select(presentingFlowItems, 1);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                presentingFlowItems,
            ),
        ).toBe(1);
    });

    test('another presenting flow does not inherit the selection', () => {
        const presentingFlowItems = [genSlideItem()];
        select(presentingFlowItems, 0);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                '/data/presenting-flows/pl1.owpf',
                presentingFlowItems,
            ),
        ).toBe(-1);
    });

    test('two identical entries are told apart by position', () => {
        const presentingFlowItems = [genSlideItem(), genSlideItem()];
        select(presentingFlowItems, 1);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                presentingFlowItems,
            ),
        ).toBe(1);
    });

    test('a reordered element is followed to its new position', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genSlideItem(undefined, 4),
        ];
        select(presentingFlowItems, 1);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                [presentingFlowItems[1], presentingFlowItems[0]],
            ),
        ).toBe(0);
    });

    test('only ONE of two identical entries is marked', () => {
        const presentingFlowItems = [genSlideItem(), genSlideItem()];
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItems[1]);
        select(presentingFlowItems, 1);
        // They share a key, so the position is the only thing telling them
        // apart — marking both would show two cursors for one run.
        expect(
            checkIsPresentingFlowPreviewItemSelected(
                PRESENTING_FLOW_FILE_PATH,
                itemKey,
                1,
            ),
        ).toBe(true);
        expect(
            checkIsPresentingFlowPreviewItemSelected(
                PRESENTING_FLOW_FILE_PATH,
                itemKey,
                0,
            ),
        ).toBe(false);
    });

    test('a reorder repairs the stored position, so the mark comes back', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genSlideItem(undefined, 4),
        ];
        const itemKey = toPresentingFlowPreviewItemKey(presentingFlowItems[1]);
        select(presentingFlowItems, 1);
        resolvePresentingFlowPreviewSelectedIndex(PRESENTING_FLOW_FILE_PATH, [
            presentingFlowItems[1],
            presentingFlowItems[0],
        ]);
        expect(
            checkIsPresentingFlowPreviewItemSelected(
                PRESENTING_FLOW_FILE_PATH,
                itemKey,
                0,
            ),
        ).toBe(true);
    });

    test('a removed element reads as nothing selected', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genSlideItem(undefined, 4),
        ];
        select(presentingFlowItems, 1);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                [presentingFlowItems[0]],
            ),
        ).toBe(-1);
    });

    test('nothing is stepped over for being unshowable', () => {
        // PARKED is the only reason to pass a line by. Everything else takes the
        // cursor — including the two that do nothing when reached (an audio
        // track, which is played from its own panel, and a damaged entry), so
        // the operator can see where the run has got to.
        const presentingFlowItems = [
            genSlideItem(),
            genDocumentItem(),
            genAudioItem(),
            PresentingFlowItem.fromJsonError(PRESENTING_FLOW_FILE_PATH, {}),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 0)).toBe(
            1,
        );
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 1)).toBe(
            2,
        );
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 2)).toBe(
            3,
        );
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 3)).toBe(
            4,
        );
    });

    test('a document is stopped on whether or not it is unfolded', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genDocumentItem(),
            genSlideItem(undefined, 4),
        ];
        // Being folded is how the operator READS the sheet — it says nothing
        // about what is in the run, and the landing unfolds it.
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 0)).toBe(
            1,
        );
    });

    test('the last element is the end — it does not wrap', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 1)).toBe(
            -1,
        );
        expect(
            findNextPresentingFlowPreviewIndex(
                [...presentingFlowItems, genAudioItem()],
                2,
            ),
        ).toBe(-1);
    });

    test('an element walks its own slides before the run leaves it', () => {
        const varySlides = [
            { isDisabled: false },
            { isDisabled: true },
            { isDisabled: false },
        ];
        // Nothing of it showing yet: it opens at its first slide.
        expect(findNextPresentingFlowPreviewChildIndex(varySlides, -1)).toBe(0);
        // A disabled slide is passed over, exactly as the presenter passes it.
        expect(findNextPresentingFlowPreviewChildIndex(varySlides, 0)).toBe(2);
        // Its last slide is showing — the run may now move to the next element.
        expect(findNextPresentingFlowPreviewChildIndex(varySlides, 2)).toBe(-1);
    });

    test('an element whose only remaining slides are disabled is finished', () => {
        expect(
            findNextPresentingFlowPreviewChildIndex(
                [{ isDisabled: false }, { isDisabled: true }],
                0,
            ),
        ).toBe(-1);
    });

    test('a slide the RUN SHEET parked is skipped like a document-disabled one', () => {
        const varySlides = [
            { isDisabled: false },
            { isDisabled: false },
            { isDisabled: false },
        ];
        // The slide itself says nothing — only the presenting flow knows it is parked.
        const checkIsDisabled = (index: number) => {
            return index === 1;
        };
        expect(
            findNextPresentingFlowPreviewChildIndex(
                varySlides,
                0,
                checkIsDisabled,
            ),
        ).toBe(2);
        expect(
            findNextPresentingFlowPreviewChildIndex(
                varySlides,
                2,
                checkIsDisabled,
            ),
        ).toBe(-1);
    });

    test('a parked element is stepped over', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genDisabledSlideItem(),
            genSlideItem(undefined, 4),
        ];
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 0)).toBe(
            2,
        );
    });

    test('a parked document is stepped over, slides or no slides', () => {
        const presentingFlowItems = [
            genSlideItem(),
            genDisabledDocumentItem(),
            genSlideItem(undefined, 4),
        ];
        // A document is otherwise always stopped on now, so parked is the one
        // thing still keeping the run off it.
        expect(findNextPresentingFlowPreviewIndex(presentingFlowItems, 0)).toBe(
            2,
        );
    });

    test('a run sheet parked to its end does not wrap', () => {
        expect(
            findNextPresentingFlowPreviewIndex(
                [genSlideItem(), genDisabledSlideItem()],
                0,
            ),
        ).toBe(-1);
    });

    test('a registered stepping is reachable and drops on cleanup', () => {
        const stepping = vi.fn().mockReturnValue(true);
        const unregister = registerPresentingFlowPreviewChildStepping(
            2,
            stepping,
        );
        const mouseEvent = new MouseEvent('click');
        expect(stepPresentingFlowPreviewChild(2, mouseEvent, false)).toBe(true);
        expect(stepping).toHaveBeenCalledWith(mouseEvent, false);
        // An element with nothing registered simply has nothing to walk.
        expect(stepPresentingFlowPreviewChild(3, mouseEvent, false)).toBe(
            false,
        );
        unregister();
        expect(stepPresentingFlowPreviewChild(2, mouseEvent, false)).toBe(
            false,
        );
    });

    test('crossing into an element is told apart from walking it', () => {
        const stepping = vi.fn().mockReturnValue(true);
        registerPresentingFlowPreviewChildStepping(4, stepping);
        const mouseEvent = new MouseEvent('click');
        stepPresentingFlowPreviewChild(4, mouseEvent, true);
        expect(stepping).toHaveBeenCalledWith(mouseEvent, true);
    });

    test('a re-registered position is not dropped by the old cleanup', () => {
        const oldStepping = vi.fn().mockReturnValue(true);
        const newStepping = vi.fn().mockReturnValue(true);
        const unregisterOld = registerPresentingFlowPreviewChildStepping(
            1,
            oldStepping,
        );
        registerPresentingFlowPreviewChildStepping(1, newStepping);
        unregisterOld();
        expect(
            stepPresentingFlowPreviewChild(1, new MouseEvent('click'), false),
        ).toBe(true);
        expect(oldStepping).not.toHaveBeenCalled();
        expect(newStepping).toHaveBeenCalled();
    });

    test('an element landed on while still loading is entered when it can be', async () => {
        const mouseEvent = new MouseEvent('click');
        requestPresentingFlowPreviewChildEntry(7, mouseEvent);
        const stepping = vi.fn().mockReturnValue(true);

        // Nothing happens until the slides actually arrive...
        expect(stepping).not.toHaveBeenCalled();
        registerPresentingFlowPreviewChildStepping(7, stepping);
        // ...and then a macrotask later, not inside the mount that registered it.
        expect(stepping).not.toHaveBeenCalled();
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(stepping).toHaveBeenCalledWith(mouseEvent, true);

        // Spent: a later re-register must not enter it all over again.
        const laterStepping = vi.fn().mockReturnValue(true);
        registerPresentingFlowPreviewChildStepping(7, laterStepping);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(laterStepping).not.toHaveBeenCalled();
    });

    test('the run moving on drops an entry that had not happened yet', async () => {
        const presentingFlowItems = [genSlideItem(), genDocumentItem()];
        requestPresentingFlowPreviewChildEntry(8, new MouseEvent('click'));
        // The operator stepped somewhere else while the document was loading.
        select(presentingFlowItems, 0);

        const stepping = vi.fn().mockReturnValue(true);
        registerPresentingFlowPreviewChildStepping(8, stepping);
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        expect(stepping).not.toHaveBeenCalled();
    });

    test('closing the widget forgets where the run had got to', () => {
        const presentingFlowItems = [genSlideItem()];
        setPresentingFlowPreviewFilePath(PRESENTING_FLOW_FILE_PATH);
        select(presentingFlowItems, 0);
        setPresentingFlowPreviewFilePath(null);
        expect(
            resolvePresentingFlowPreviewSelectedIndex(
                PRESENTING_FLOW_FILE_PATH,
                presentingFlowItems,
            ),
        ).toBe(-1);
    });
});

describe('presenting flow preview slide cursor', () => {
    const VARY_SLIDES = [
        { id: 1, isDisabled: false },
        { id: 5, isDisabled: false },
        { id: 9, isDisabled: false },
    ];

    beforeEach(() => {
        getSettingMock.mockReturnValue(null);
        clearPresentingFlowPreviewSelectedItem();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    function selectChild(
        presentingFlowItems: PresentingFlowItem[],
        index: number,
        childId: number,
    ) {
        select(presentingFlowItems, index);
        setPresentingFlowPreviewSelectedChild(
            PRESENTING_FLOW_FILE_PATH,
            toPresentingFlowPreviewItemKey(presentingFlowItems[index]),
            index,
            childId,
        );
    }

    function resolveChild(
        presentingFlowItems: PresentingFlowItem[],
        index: number,
        varySlides = VARY_SLIDES,
    ) {
        return resolvePresentingFlowPreviewSelectedChildIndex(
            PRESENTING_FLOW_FILE_PATH,
            toPresentingFlowPreviewItemKey(presentingFlowItems[index]),
            index,
            varySlides,
        );
    }

    test('nothing on the cursor reads as "before the first slide"', () => {
        const presentingFlowItems = [genDocumentItem()];
        select(presentingFlowItems, 0);
        expect(resolveChild(presentingFlowItems, 0)).toBe(-1);
        expect(findNextPresentingFlowPreviewChildIndex(VARY_SLIDES, -1)).toBe(
            0,
        );
    });

    test('the remembered slide is found again by its id', () => {
        const presentingFlowItems = [genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        expect(resolveChild(presentingFlowItems, 0)).toBe(1);
    });

    test('a slide inserted ahead of it does not shift the cursor', () => {
        const presentingFlowItems = [genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        expect(
            resolveChild(presentingFlowItems, 0, [
                { id: 2, isDisabled: false },
                ...VARY_SLIDES,
            ]),
        ).toBe(2);
    });

    test('a slide edited away reads as nothing on the cursor', () => {
        const presentingFlowItems = [genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        expect(
            resolveChild(presentingFlowItems, 0, [
                { id: 1, isDisabled: false },
                { id: 9, isDisabled: false },
            ]),
        ).toBe(-1);
    });

    test('moving the run to another element forgets the slide', () => {
        const presentingFlowItems = [genDocumentItem(), genSlideItem()];
        selectChild(presentingFlowItems, 0, 9);
        select(presentingFlowItems, 1);
        select(presentingFlowItems, 0);
        expect(resolveChild(presentingFlowItems, 0)).toBe(-1);
    });

    test('an element the run is not on cannot move the cursor', () => {
        const presentingFlowItems = [genDocumentItem(), genSlideItem()];
        selectChild(presentingFlowItems, 0, 5);
        // A re-render of the other element, while the run sits on the first:
        // refused, or the cursor would move out from under the operator.
        setPresentingFlowPreviewSelectedChild(
            PRESENTING_FLOW_FILE_PATH,
            toPresentingFlowPreviewItemKey(presentingFlowItems[1]),
            1,
            9,
        );
        expect(resolveChild(presentingFlowItems, 0)).toBe(1);
    });

    test('the second copy of a twice-listed document is not the first', () => {
        const presentingFlowItems = [genDocumentItem(), genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        // Same key, different position — the cursor belongs to the copy that
        // was clicked, and only that one may answer for it or write to it.
        expect(resolveChild(presentingFlowItems, 1)).toBe(-1);
        setPresentingFlowPreviewSelectedChild(
            PRESENTING_FLOW_FILE_PATH,
            toPresentingFlowPreviewItemKey(presentingFlowItems[1]),
            1,
            9,
        );
        expect(resolveChild(presentingFlowItems, 0)).toBe(1);
    });

    test('another presenting flow does not inherit the slide cursor', () => {
        const presentingFlowItems = [genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        expect(
            resolvePresentingFlowPreviewSelectedChildIndex(
                '/data/presenting-flows/pl1.owpf',
                toPresentingFlowPreviewItemKey(presentingFlowItems[0]),
                0,
                VARY_SLIDES,
            ),
        ).toBe(-1);
    });

    test('closing the widget forgets the slide too', () => {
        const presentingFlowItems = [genDocumentItem()];
        setPresentingFlowPreviewFilePath(PRESENTING_FLOW_FILE_PATH);
        selectChild(presentingFlowItems, 0, 5);
        setPresentingFlowPreviewFilePath(null);
        expect(resolveChild(presentingFlowItems, 0)).toBe(-1);
    });

    test('the cursor is what the next slide is found from', () => {
        const presentingFlowItems = [genDocumentItem()];
        selectChild(presentingFlowItems, 0, 5);
        const fromIndex = resolveChild(presentingFlowItems, 0);
        expect(
            findNextPresentingFlowPreviewChildIndex(VARY_SLIDES, fromIndex),
        ).toBe(2);
    });
});
