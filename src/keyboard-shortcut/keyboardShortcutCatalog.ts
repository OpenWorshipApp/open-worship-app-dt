import KeyboardEventListener, {
    PlatformEnum,
    toShortcutKey,
    type EventMapperType,
} from '../event/KeyboardEventListener';
import { KEY_LABEL_MAP } from '../event/keyboardKeyLabelHelpers';
import { drawShortcutMap } from '../_screen/managers/screenDrawShortcutHelpers';
import { presentingShortcutMap } from '../presenting-control/presentingControlShortcutHelpers';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { tran } from '../lang/langHelpers';
import {
    appAssistantEventMappers,
    clearAllEventMapper,
    clearBackgroundEventMapper,
    clearBibleEventMapper,
    clearForegroundEventMapper,
    clearSlideEventMapper,
    closeBibleLookupEventMapper,
    closeEventMapper,
    ctrlEnterEventMapper,
    ctrlShiftEnterEventMapper,
    lookupEnterEventMapper,
    lookupEscapeEventMapper,
    lookupRemoveAllEventMapper,
    lookupTabEventMapper,
    nextEditingBibleItemEventMappers,
    nextSlideEventMappers,
    openBibleLookupEventMappers,
    presentingControlEventMappers,
    presentingFlowNextEventMappers,
    previousSlideEventMappers,
    savingEventMapper,
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
    toggleMessagesEventMapper,
    toggleScreenEventMapper,
} from './appShortcutMappers';

// Help -> Keyboard Shortcuts: what each page of the app answers to.
//
// There is no registry of shortcuts at runtime -- keys are bound by hooks that
// exist only while their component is mounted, by inline `onKeyDown` handlers
// and by the main process's menu accelerators -- so this list is written out.
// Wherever a key has ONE declaration it is imported from there
// (`appShortcutMappers`, the draw and presenting-control maps) rather than
// copied, so the list cannot drift from the binding. The few written inline
// below are inline in their handlers too (`slideEditingKeyboardEventHelpers`,
// the canvas, the context menu).
//
// Everything a person reads goes through `tran()` INSIDE these functions, never
// at module scope: the locale is not known when this module loads, and the
// literal keys are what `tranKeyCoverage.test.ts` reads.

export type KeyboardShortcutPageType =
    | 'presenter'
    | 'reader'
    | 'appDocumentEditor'
    | 'bibleNote'
    | 'setting'
    | 'webEditor'
    | 'lyricEditor'
    | 'lwShare';

export type KeyboardShortcutEntryType = {
    id: string;
    keys: EventMapperType[];
    label: string;
    note?: string;
};

export type KeyboardShortcutGroupType = {
    id: string;
    title: string;
    note?: string;
    entries: KeyboardShortcutEntryType[];
};

// Ctrl, or ⌘ on a Mac -- the usual shape of an editing key here.
function toCtrlKey(key: string): EventMapperType {
    return {
        wControlKey: ['Ctrl'],
        lControlKey: ['Ctrl'],
        mControlKey: ['Meta'],
        key,
    };
}

function toCtrlShiftKey(key: string): EventMapperType {
    return {
        wControlKey: ['Ctrl', 'Shift'],
        lControlKey: ['Ctrl', 'Shift'],
        mControlKey: ['Meta', 'Shift'],
        key,
    };
}

// The slide list's and the canvas's undo / redo / save, as
// `slideEditingKeyboardEventHelpers.handleHistory` matches them.
const undoEventMappers: EventMapperType[] = [toCtrlKey('z')];
const redoEventMappers: EventMapperType[] = [
    toCtrlShiftKey('z'),
    { platform: PlatformEnum.Windows, wControlKey: ['Ctrl'], key: 'y' },
    { platform: PlatformEnum.Linux, lControlKey: ['Ctrl'], key: 'y' },
];
const deleteEventMappers: EventMapperType[] = [
    { key: 'Delete' },
    {
        platform: PlatformEnum.MacOS,
        mControlKey: ['Meta'],
        key: 'Backspace',
    },
];
const arrowEventMappers: EventMapperType[] = [
    { key: 'ArrowLeft' },
    { key: 'ArrowRight' },
    { key: 'ArrowUp' },
    { key: 'ArrowDown' },
];

/**
 * The words a person sees for each binding of one shortcut, e.g.
 * `['Ctrl+Shift+Z', 'Ctrl+Y']` on Windows and `['⌘⇧ Z']` on a Mac.
 *
 * Bindings for another platform are dropped FIRST: `toShortcutKey` throws on a
 * mapper that only carries another platform's control keys. A key is renamed
 * before it is formatted, because `toShortcutKey` upper-cases a single
 * character and would print Space as a blank and an arrow as `ArrowUp`.
 */
export function formatShortcutKeys(keys: EventMapperType[]) {
    return KeyboardEventListener.filterEventMappersByPlatform(keys)
        .map((eventMapper) => {
            return toShortcutKey({
                ...eventMapper,
                key: KEY_LABEL_MAP[eventMapper.key] ?? eventMapper.key,
            });
        })
        .filter((text) => {
            return text.trim() !== '';
        });
}

export function getKeyboardShortcutPageLabel(
    page: KeyboardShortcutPageType | null,
) {
    switch (page) {
        case 'presenter':
            return tran('Presenter');
        case 'reader':
            return tran('Bible Reader');
        case 'appDocumentEditor':
            return tran('Slide Editor');
        case 'bibleNote':
            return tran('Bible Note');
        case 'setting':
            return tran('Setting');
        case 'webEditor':
            return tran('Web Editor');
        case 'lyricEditor':
            return tran('Lyric Editor');
        case 'lwShare':
            return tran('Local Web Share');
        default:
            return null;
    }
}

function checkIsMainWindowPage(page: KeyboardShortcutPageType | null) {
    return (
        page === 'presenter' ||
        page === 'reader' ||
        page === 'appDocumentEditor'
    );
}

function genEveryWindowGroup(
    page: KeyboardShortcutPageType | null,
): KeyboardShortcutGroupType {
    const entries: KeyboardShortcutEntryType[] = [
        {
            id: 'presenting-control',
            keys: presentingControlEventMappers,
            label: tran('Start or stop Presenting Control'),
        },
    ];
    // With the master switch off there is no assistant, and the key does
    // nothing (`AppAssistantComp` reads the same switch).
    if (getIsAIEnabled()) {
        entries.push({
            id: 'app-assistant',
            keys: appAssistantEventMappers,
            label: tran('App Assistant'),
        });
    }
    if (checkIsMainWindowPage(page) || page === 'bibleNote') {
        entries.push({
            id: 'find',
            keys: [toCtrlKey('f')],
            label: tran('Find'),
        });
    }
    if (checkIsMainWindowPage(page)) {
        entries.push({
            id: 'print',
            keys: [toCtrlKey('p')],
            label: tran('Print'),
        });
    }
    return { id: 'every-window', title: tran('Every window'), entries };
}

function genDialogGroup(): KeyboardShortcutGroupType {
    return {
        id: 'dialogs-menus',
        title: tran('Dialogs and menus'),
        entries: [
            {
                id: 'dialog-confirm',
                keys: [{ key: 'Enter' }],
                label: tran('Confirm the dialog'),
            },
            {
                id: 'dialog-cancel',
                keys: [{ key: 'Escape' }],
                label: tran('Cancel the dialog'),
            },
            {
                id: 'menu-move',
                keys: [
                    { key: 'ArrowUp' },
                    { key: 'ArrowDown' },
                    { key: 'Tab' },
                ],
                label: tran('Move through the right-click menu'),
            },
            {
                id: 'menu-choose',
                keys: [{ key: 'Enter' }],
                label: tran('Choose the highlighted menu item'),
            },
            {
                id: 'menu-letter',
                keys: [{ key: 'A–Z' }],
                label: tran('Jump to a menu item by its first letter'),
            },
        ],
    };
}

function genScreenGroup(): KeyboardShortcutGroupType {
    return {
        id: 'screens',
        title: tran('Screens'),
        entries: [
            {
                id: 'screen-toggle',
                keys: [toggleScreenEventMapper],
                label: tran('Show or hide the screen'),
            },
            {
                id: 'screen-clear-all',
                keys: [clearAllEventMapper],
                label: tran('Clear All'),
            },
            {
                id: 'screen-clear-background',
                keys: [clearBackgroundEventMapper],
                label: tran('Clear Background'),
            },
            {
                id: 'screen-clear-slide',
                keys: [clearSlideEventMapper],
                label: tran('Clear Slide'),
            },
            {
                id: 'screen-clear-bible',
                keys: [clearBibleEventMapper],
                label: tran('Clear Bible'),
            },
            {
                id: 'screen-clear-foreground',
                keys: [clearForegroundEventMapper],
                label: tran('Clear Foreground'),
            },
            {
                id: 'screen-messages',
                keys: [toggleMessagesEventMapper],
                label: tran('Show or take down Messages'),
                note: tran('While the Messages panel is open'),
            },
            {
                id: 'open-bible-lookup',
                keys: openBibleLookupEventMappers,
                label: tran('Open bible lookup popup'),
            },
        ],
    };
}

function genSlideListGroup(
    page: KeyboardShortcutPageType,
): KeyboardShortcutGroupType {
    const entries: KeyboardShortcutEntryType[] = [];
    if (page === 'presenter') {
        entries.push(
            {
                id: 'slide-next',
                keys: nextSlideEventMappers,
                label: tran('Next slide'),
            },
            {
                id: 'slide-previous',
                keys: previousSlideEventMappers,
                label: tran('Previous slide'),
            },
        );
    }
    entries.push(
        {
            id: 'slides-select-all',
            keys: [toCtrlKey('a')],
            label: tran('Select all slides'),
        },
        {
            id: 'slides-copy',
            keys: [toCtrlKey('c')],
            label: tran('Copy the selected slides'),
        },
        {
            id: 'slides-paste',
            keys: [toCtrlKey('v')],
            label: tran('Paste slides'),
        },
        {
            id: 'slides-duplicate',
            keys: [toCtrlShiftKey('d')],
            label: tran('Duplicate the selected slides'),
        },
        {
            id: 'slides-delete',
            keys: deleteEventMappers,
            label: tran('Delete the selected slides'),
        },
        {
            id: 'slides-deselect',
            keys: [{ key: 'Escape' }],
            label: tran('Clear the slide selection'),
        },
        {
            id: 'slides-undo',
            keys: undoEventMappers,
            label: tran('Undo'),
        },
        {
            id: 'slides-redo',
            keys: redoEventMappers,
            label: tran('Redo'),
        },
        {
            id: 'slides-save',
            keys: [toCtrlKey('s')],
            label: tran('Save'),
        },
    );
    return {
        id: 'slides',
        title: tran('Slides'),
        note: tran('While the slides panel has focus'),
        entries,
    };
}

function genPresentingFlowGroup(): KeyboardShortcutGroupType {
    return {
        id: 'presenting-flow',
        title: tran('Presenting Flow'),
        note: tran('While a Presenting Flow preview has focus'),
        entries: [
            {
                id: 'presenting-flow-next',
                keys: presentingFlowNextEventMappers,
                label: tran('Go to the next item'),
            },
        ],
    };
}

function genDrawingGroup(): KeyboardShortcutGroupType {
    return {
        id: 'drawing',
        title: tran('Drawing'),
        note: tran("While a mini screen's Drawing panel has focus"),
        entries: [
            {
                id: 'draw-eraser',
                keys: [...drawShortcutMap.toggleEraser],
                label: tran('Manual eraser'),
            },
            {
                id: 'draw-paint',
                keys: [...drawShortcutMap.usePaint],
                label: tran('Back to painting'),
            },
            {
                id: 'draw-size',
                keys: [
                    ...drawShortcutMap.sizeDown,
                    ...drawShortcutMap.sizeUp,
                    ...drawShortcutMap.sizeDownBig,
                    ...drawShortcutMap.sizeUpBig,
                ],
                label: tran('Size'),
            },
            {
                id: 'draw-opacity',
                keys: [
                    ...drawShortcutMap.opacityDown,
                    ...drawShortcutMap.opacityUp,
                    ...drawShortcutMap.opacityDownBig,
                    ...drawShortcutMap.opacityUpBig,
                ],
                label: tran('Opacity'),
            },
            {
                id: 'draw-straight',
                keys: [...drawShortcutMap.toggleStraight],
                label: tran('Straight'),
            },
            {
                id: 'draw-3d',
                keys: [...drawShortcutMap.toggle3D],
                label: tran('3D'),
            },
            {
                id: 'draw-dots',
                keys: [...drawShortcutMap.toggleDots],
                label: tran('Dots'),
            },
            {
                id: 'draw-quality',
                keys: [...drawShortcutMap.toggleQuality],
                label: tran('Toggle drawing quality'),
            },
            {
                id: 'draw-reset',
                keys: [...drawShortcutMap.resetSettings],
                label: tran('Reset settings'),
            },
            {
                id: 'draw-clear',
                keys: [...drawShortcutMap.clearDrawing],
                label: tran('Clear drawing'),
            },
            {
                id: 'draw-undo',
                keys: [...drawShortcutMap.undo],
                label: tran('Undo'),
            },
            {
                id: 'draw-redo',
                keys: [...drawShortcutMap.redo],
                label: tran('Redo'),
            },
        ],
    };
}

function genFocusingGroup(): KeyboardShortcutGroupType {
    return {
        id: 'focusing',
        title: tran('Focusing'),
        note: tran("While a mini screen's Focusing panel has focus"),
        entries: [
            {
                id: 'focus-contrast',
                keys: [...drawShortcutMap.toggleContrast],
                label: tran('Contrast'),
            },
            {
                id: 'focus-size',
                keys: [
                    ...drawShortcutMap.sizeDown,
                    ...drawShortcutMap.sizeUp,
                    ...drawShortcutMap.sizeDownBig,
                    ...drawShortcutMap.sizeUpBig,
                ],
                label: tran('Spotlight size'),
            },
            {
                id: 'focus-opacity',
                keys: [
                    ...drawShortcutMap.opacityDown,
                    ...drawShortcutMap.opacityUp,
                    ...drawShortcutMap.opacityDownBig,
                    ...drawShortcutMap.opacityUpBig,
                ],
                label: tran('Opacity'),
            },
            {
                id: 'focus-blur',
                keys: [
                    ...drawShortcutMap.blurDown,
                    ...drawShortcutMap.blurUp,
                    ...drawShortcutMap.blurDownBig,
                    ...drawShortcutMap.blurUpBig,
                ],
                label: tran('Spotlight edge blur (0 = hard edge)'),
            },
            {
                id: 'focus-reset',
                keys: [...drawShortcutMap.resetSettings],
                label: tran('Reset settings'),
            },
        ],
    };
}

function genPresentingControlGroup(): KeyboardShortcutGroupType {
    return {
        id: 'presenting-control-tools',
        title: tran('Presenting Control'),
        note: tran('While Presenting Control is open'),
        entries: [
            {
                id: 'control-interact',
                keys: [...presentingShortcutMap.useInteract],
                label: tran('Use the app (drawing stays on top)'),
            },
            {
                id: 'control-paint',
                keys: [...presentingShortcutMap.usePaint],
                label: tran('Draw on the app'),
            },
            {
                id: 'control-eraser',
                keys: [...presentingShortcutMap.useEraser],
                label: tran('Erase parts of the drawing'),
            },
            {
                id: 'control-focus',
                keys: [...presentingShortcutMap.useFocus],
                label: tran('Spotlight part of the app'),
            },
            {
                id: 'control-screencast',
                keys: [...presentingShortcutMap.toggleScreencast],
                label: tran('Show the keys being pressed'),
            },
            {
                id: 'control-hold',
                keys: [...presentingShortcutMap.toggleHold],
                label: tran('Hold to spotlight'),
            },
            {
                id: 'control-exit-tool',
                keys: [...presentingShortcutMap.exitTool],
                label: tran('Back to using the app'),
                note: tran('While a drawing tool is in use'),
            },
            {
                id: 'control-clear',
                keys: [...drawShortcutMap.clearDrawing],
                label: tran('Clear drawing'),
                note: tran('While a drawing tool is in use'),
            },
            {
                id: 'control-undo',
                keys: [...drawShortcutMap.undo],
                label: tran('Undo'),
                note: tran('While a drawing tool is in use'),
            },
            {
                id: 'control-redo',
                keys: [...drawShortcutMap.redo],
                label: tran('Redo'),
                note: tran('While a drawing tool is in use'),
            },
        ],
    };
}

function genBibleLookupGroup(
    page: KeyboardShortcutPageType,
): KeyboardShortcutGroupType {
    const entries: KeyboardShortcutEntryType[] = [];
    // The popup's Ctrl+Q: the Reader shows the lookup inline, with nothing to
    // close.
    if (page !== 'reader') {
        entries.push({
            id: 'lookup-close',
            keys: [closeBibleLookupEventMapper],
            label: tran('Close the Bible Lookup popup'),
        });
    }
    entries.push(
        {
            id: 'lookup-enter',
            keys: [lookupEnterEventMapper],
            label: tran('Open the typed reference'),
        },
        {
            id: 'lookup-tab',
            keys: [lookupTabEventMapper],
            label: tran('Complete the typed reference'),
        },
        {
            id: 'lookup-escape',
            keys: [lookupEscapeEventMapper],
            label: tran('Remove the last part of the reference'),
        },
        {
            id: 'lookup-remove-all',
            keys: [lookupRemoveAllEventMapper],
            label: tran('Clear the reference'),
        },
        {
            id: 'lookup-arrows',
            keys: arrowEventMappers,
            label: tran('Move through the books and chapters'),
        },
        {
            id: 'lookup-save',
            keys: [ctrlEnterEventMapper],
            label: tran('Save bible item'),
        },
    );
    if (page === 'presenter') {
        entries.push({
            id: 'lookup-save-show',
            keys: [ctrlShiftEnterEventMapper],
            label: tran('Save bible item and show on screen'),
        });
    }
    if (page === 'appDocumentEditor') {
        entries.push({
            id: 'lookup-insert-slide',
            keys: [ctrlShiftEnterEventMapper],
            label: tran('Insert bible item into selected slide'),
        });
    }
    entries.push(
        {
            id: 'lookup-split-horizontal',
            keys: [splitHorizontalEventMapper],
            label: tran('Split horizontal'),
        },
        {
            id: 'lookup-split-vertical',
            keys: [splitVerticalEventMapper],
            label: tran('Split vertical'),
        },
        {
            id: 'lookup-next-split',
            keys: nextEditingBibleItemEventMappers,
            label: tran('Move between split passages'),
        },
        {
            id: 'lookup-close-split',
            keys: [closeEventMapper],
            label: tran('Close the selected split passage'),
        },
    );
    return { id: 'bible-lookup', title: tran('Bible Lookup'), entries };
}

function genSlideEditorGroup(): KeyboardShortcutGroupType {
    return {
        id: 'slide-editor',
        title: tran('Slide Editor'),
        entries: [
            {
                id: 'editor-open-bible-lookup',
                keys: openBibleLookupEventMappers,
                label: tran('Open bible lookup popup'),
            },
            {
                id: 'editor-focus-canvas',
                keys: [ctrlEnterEventMapper],
                label: tran('Focus the slide canvas'),
            },
            {
                id: 'editor-save',
                keys: [savingEventMapper],
                label: tran('Save'),
            },
        ],
    };
}

function genCanvasGroup(): KeyboardShortcutGroupType {
    return {
        id: 'canvas',
        title: tran('Canvas'),
        note: tran('While the slide canvas has focus'),
        entries: [
            {
                id: 'canvas-escape',
                keys: [{ key: 'Escape' }],
                label: tran('Deselect the boxes'),
            },
            {
                id: 'canvas-next-box',
                keys: [{ key: 'Tab' }],
                label: tran('Select the next box'),
            },
            {
                id: 'canvas-previous-box',
                keys: [{ allControlKey: ['Shift'], key: 'Tab' }],
                label: tran('Select the previous box'),
            },
            {
                id: 'canvas-move-box',
                keys: arrowEventMappers,
                label: tran('Move the selected box'),
                note: tran('Hold Shift to move further, Ctrl to move less'),
            },
            {
                id: 'canvas-copy',
                keys: [toCtrlKey('c')],
                label: tran('Copy the selected boxes'),
            },
            {
                id: 'canvas-paste',
                keys: [toCtrlKey('v')],
                label: tran('Paste boxes or a copied Bible passage'),
            },
            {
                id: 'canvas-duplicate',
                keys: [toCtrlShiftKey('d')],
                label: tran('Duplicate the selected boxes'),
            },
            {
                id: 'canvas-delete',
                keys: deleteEventMappers,
                label: tran('Delete the selected boxes'),
            },
            {
                id: 'canvas-undo',
                keys: undoEventMappers,
                label: tran('Undo'),
            },
            {
                id: 'canvas-redo',
                keys: redoEventMappers,
                label: tran('Redo'),
            },
            {
                id: 'canvas-text-done',
                keys: [ctrlEnterEventMapper],
                label: tran('Finish editing the text'),
                note: tran('While typing in a text box'),
            },
            {
                id: 'canvas-text-cancel',
                keys: [{ key: 'Escape' }],
                label: tran('Cancel editing the text'),
                note: tran('While typing in a text box'),
            },
        ],
    };
}

function genBibleNoteGroup(): KeyboardShortcutGroupType {
    return {
        id: 'bible-note',
        title: tran('Bible Note'),
        entries: [
            {
                id: 'note-save',
                keys: [savingEventMapper],
                label: tran('Save'),
            },
            {
                // `bible-note`'s footer reads `Ctrl` as Ctrl on a Mac too.
                id: 'note-open-bible-lookup',
                keys: [{ allControlKey: ['Ctrl', 'Shift'], key: 'b' }],
                label: tran('Open Bible Lookup'),
            },
            {
                id: 'note-insert-bible-text',
                keys: [ctrlEnterEventMapper],
                label: tran('Insert Bible Text'),
                note: tran('While the Bible Lookup is open'),
            },
            {
                id: 'note-on-top',
                keys: [
                    {
                        wControlKey: ['Ctrl', 'Shift', 'Alt'],
                        lControlKey: ['Ctrl', 'Shift', 'Alt'],
                        mControlKey: ['Ctrl', 'Shift', 'Option'],
                        key: 't',
                    },
                ],
                label: tran('Toggle Always On Top'),
            },
        ],
    };
}

/**
 * The keys that work while the Bible Lookup popup is open over the Presenter
 * or the Slide Editor. The popup holds the keyboard (`MODAL_KEYBOARD_LAYER`):
 * the page's own keys -- F5-F10, the slide arrows, Ctrl+Shift+P -- are silent
 * behind it, so listing them would be listing keys that do nothing.
 */
export function getBibleLookupShortcutGroups(
    page: KeyboardShortcutPageType | null,
): KeyboardShortcutGroupType[] {
    return [
        genBibleLookupGroup(
            page === 'appDocumentEditor' ? 'appDocumentEditor' : 'presenter',
        ),
        genDialogGroup(),
    ];
}

/**
 * The shortcut groups to list for a page, most-used first. `null` is a window
 * this list has no page for (the experiments page): it gets the keys every
 * window shares and nothing else.
 */
export function getKeyboardShortcutGroups(
    page: KeyboardShortcutPageType | null,
): KeyboardShortcutGroupType[] {
    const groups: KeyboardShortcutGroupType[] = [];
    if (page === 'presenter') {
        groups.push(
            genScreenGroup(),
            genSlideListGroup(page),
            genBibleLookupGroup(page),
            genPresentingFlowGroup(),
            genDrawingGroup(),
            genFocusingGroup(),
        );
    } else if (page === 'reader') {
        groups.push(genBibleLookupGroup(page));
    } else if (page === 'appDocumentEditor') {
        groups.push(
            genSlideEditorGroup(),
            genCanvasGroup(),
            genSlideListGroup(page),
            genBibleLookupGroup(page),
        );
    } else if (page === 'bibleNote') {
        groups.push(genBibleNoteGroup());
    }
    groups.push(
        genEveryWindowGroup(page),
        genPresentingControlGroup(),
        genDialogGroup(),
    );
    return groups.filter((group) => {
        return group.entries.length > 0;
    });
}
