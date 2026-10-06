import type {
    EventMapperType,
    KeyboardType,
    PlatformEnum,
} from '../event/KeyboardEventListener';

// The keys behind the app's shortcuts, declared ONCE so the feature that binds
// a key and Help -> Keyboard Shortcuts that lists it read the same object. The
// written list of shortcuts drifted from the code before (it said Ctrl+Escape
// for a key bound to Shift+Escape); a list that imports the binding cannot.
//
// Type-only imports and nothing else on purpose: the components that bind
// these keys sit in every renderer's startup path, and the panel that lists
// them is a lazy chunk -- this module must cost neither of them a dependency.
// `PlatformEnum.MacOS` is used as a TYPE below for the same reason (its value
// is the string `'MacOS'`), and it also keeps a test that mocks the keyboard
// module without the enum from failing at import time.

const MAC_OS = 'MacOS' as PlatformEnum.MacOS;

// Ctrl+B on every platform, plus ⌘B on a Mac.
export const openBibleLookupEventMappers: EventMapperType[] = [
    { allControlKey: ['Ctrl'], key: 'b' },
    { platform: MAC_OS, mControlKey: ['Meta'], key: 'b' },
];
export const closeBibleLookupEventMapper: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export const toggleScreenEventMapper: EventMapperType = { key: 'F5' };
export const clearAllEventMapper: EventMapperType = { key: 'F6' };
export const clearBackgroundEventMapper: EventMapperType = { key: 'F7' };
export const clearSlideEventMapper: EventMapperType = { key: 'F8' };
export const clearBibleEventMapper: EventMapperType = { key: 'F9' };
export const clearForegroundEventMapper: EventMapperType = { key: 'F10' };
export const toggleMessagesEventMapper: EventMapperType = { key: 'F4' };

const slideMovingKeys: KeyboardType[] = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'PageUp',
    'PageDown',
    ' ',
];
// Registered as one list; which way it moves is read off the pressed key.
export const slideMovingEventMappers: EventMapperType[] = [
    ...slideMovingKeys.map((key) => {
        return { key };
    }),
    { allControlKey: ['Shift'], key: ' ' },
];
export const nextSlideEventMappers: EventMapperType[] = [
    { key: 'ArrowRight' },
    { key: 'ArrowDown' },
    { key: 'PageDown' },
    { key: ' ' },
];
export const previousSlideEventMappers: EventMapperType[] = [
    { key: 'ArrowLeft' },
    { key: 'ArrowUp' },
    { key: 'PageUp' },
    { allControlKey: ['Shift'], key: ' ' },
];

// The same keys that advance the presenter's own slide list, forward only --
// a run sheet is walked from where it is to its end.
export const presentingFlowNextEventMappers: EventMapperType[] = [
    { key: ' ' },
    { key: 'ArrowDown' },
    { key: 'ArrowRight' },
    { key: 'PageDown' },
];

// Every platform is spelled out because `toShortcutKey` THROWS on a mapper that
// carries another platform's control keys and none of its own.
export const presentingControlEventMappers: EventMapperType[] = [
    {
        key: 'P',
        mControlKey: ['Meta', 'Shift'],
        wControlKey: ['Ctrl', 'Shift'],
        lControlKey: ['Ctrl', 'Shift'],
    },
];
export const appAssistantEventMappers: EventMapperType[] = [
    {
        key: 'A',
        mControlKey: ['Meta', 'Shift'],
        wControlKey: ['Ctrl', 'Shift'],
        lControlKey: ['Ctrl', 'Shift'],
    },
];

export const lookupEnterEventMapper: EventMapperType = { key: 'Enter' };
export const lookupTabEventMapper: EventMapperType = { key: 'Tab' };
export const lookupEscapeEventMapper: EventMapperType = { key: 'Escape' };
export const lookupRemoveAllEventMapper: EventMapperType = {
    allControlKey: ['Shift'],
    key: 'Escape',
};
export const ctrlEnterEventMapper: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 'Enter',
};
export const ctrlShiftEnterEventMapper: EventMapperType = {
    allControlKey: ['Ctrl', 'Shift'],
    key: 'Enter',
};

export const closeEventMapper: EventMapperType = {
    wControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    mControlKey: ['Meta'],
    key: 'w',
};
export const ctrlShiftMetaKeys: any = {
    wControlKey: ['Ctrl', 'Shift'],
    lControlKey: ['Ctrl', 'Shift'],
    mControlKey: ['Meta', 'Shift'],
};
export const splitHorizontalEventMapper: EventMapperType = {
    ...ctrlShiftMetaKeys,
    key: 's',
};
export const splitVerticalEventMapper: EventMapperType = {
    ...ctrlShiftMetaKeys,
    key: 'v',
};
export const nextEditingBibleItemEventMappers: EventMapperType[] = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
].map((key) => {
    return { ...ctrlShiftMetaKeys, key };
});

export const savingEventMapper: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 's',
};
