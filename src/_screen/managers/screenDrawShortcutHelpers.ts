import KeyboardEventListener, {
    PlatformEnum,
    toShortcutKey,
    type EventMapperType,
} from '../../event/KeyboardEventListener';

// Quick-select keys for the draw panel (MiniScreenDrawHandlersComp). They live
// in this tiny non-React module, NOT in the panel, so ScreenDrawManager can
// consult them without importing the lazily-loaded panel component.
// The two +/- steppers name their four bindings by convention off a base, so a
// slider passes one `shortcutBase` instead of four separate ids.
export type DrawStepShortcutBaseType = 'size' | 'opacity' | 'blur';
type DrawStepShortcutIdType = `${DrawStepShortcutBaseType}${
    'Down' | 'Up' | 'DownBig' | 'UpBig'}`;

export type DrawShortcutIdType =
    | 'toggleEraser'
    | 'usePaint'
    | 'toggleContrast'
    | DrawStepShortcutIdType
    | 'toggleStraight'
    | 'toggle3D'
    | 'toggleDots'
    | 'toggleQuality'
    | 'resetSettings'
    | 'clearDrawing'
    | 'undo'
    | 'redo';

// Only plain (or Shift-only) keys are used for the tool palette: the app's own
// global shortcuts are function keys, arrows, space and Ctrl combos, so letters
// and bracket/dash punctuation are free.
export const drawShortcutMap: {
    [key in DrawShortcutIdType]: EventMapperType[];
} = {
    toggleEraser: [{ key: 'e' }],
    usePaint: [{ key: 'b' }],
    // Focus panel only: flip the mask between spotlight and contrast. `c` would
    // have read better but the draw panel already owns it for Clear.
    toggleContrast: [{ key: 'x' }],
    sizeDown: [{ key: '[' }],
    sizeUp: [{ key: ']' }],
    sizeDownBig: [{ allControlKey: ['Shift'], key: '{' }],
    sizeUpBig: [{ allControlKey: ['Shift'], key: '}' }],
    opacityDown: [{ key: '-' }],
    opacityUp: [{ key: '=' }],
    opacityDownBig: [{ allControlKey: ['Shift'], key: '_' }],
    opacityUpBig: [{ allControlKey: ['Shift'], key: '+' }],
    // Spotlight edge softness (focus panel only; the draw panel has no such
    // control). `,`/`.` sit next to the bracket/dash pairs above and were free.
    blurDown: [{ key: ',' }],
    blurUp: [{ key: '.' }],
    blurDownBig: [{ allControlKey: ['Shift'], key: '<' }],
    blurUpBig: [{ allControlKey: ['Shift'], key: '>' }],
    toggleStraight: [{ key: 's' }],
    toggle3D: [{ key: '3' }],
    toggleDots: [{ key: 'd' }],
    toggleQuality: [{ key: 'q' }],
    resetSettings: [{ key: 'r' }],
    clearDrawing: [{ key: 'c' }],
    undo: [
        {
            wControlKey: ['Ctrl'],
            lControlKey: ['Ctrl'],
            mControlKey: ['Meta'],
            key: 'z',
        },
    ],
    redo: [
        {
            wControlKey: ['Ctrl', 'Shift'],
            lControlKey: ['Ctrl', 'Shift'],
            mControlKey: ['Meta', 'Shift'],
            key: 'z',
        },
        { platform: PlatformEnum.Windows, wControlKey: ['Ctrl'], key: 'y' },
        { platform: PlatformEnum.Linux, lControlKey: ['Ctrl'], key: 'y' },
    ],
};

// Plain key nudges by one (same as the panel's +/- buttons); the Shift variant
// of the same key jumps by five.
export const STEP_SMALL = 1;
export const STEP_BIG = 5;

// Rendered key labels for one shortcut id, e.g. `Ctrl+Shift+Z / Ctrl+Y`.
// Memoized because `toShortcutKey` deep-clones (JSON round-trip) its argument
// and the panels re-render on every stroke commit and every slider tick — the
// labels are constant for the process, so pay for them once.
// `filterEventMappersByPlatform` FIRST is not optional: `toShortcutKey` throws
// when handed a foreign-platform mapper (redo's Linux Ctrl+Y on Windows), and a
// throw here would take the whole panel down mid-service.
const shortcutKeysCache = new Map<DrawShortcutIdType, string>();
export function toShortcutKeys(shortcutId: DrawShortcutIdType) {
    const cached = shortcutKeysCache.get(shortcutId);
    if (cached !== undefined) {
        return cached;
    }
    const keys = KeyboardEventListener.filterEventMappersByPlatform(
        drawShortcutMap[shortcutId],
    )
        .map(toShortcutKey)
        .filter(Boolean)
        .join(' / ');
    shortcutKeysCache.set(shortcutId, keys);
    return keys;
}

// `Size [ [ ]` reads badly, so titles get the keys in brackets at the end. Takes
// a list so every binding is discoverable — the Shift "big step" keys ({ } _ +)
// and the alternate redo key have no button of their own to advertise them.
export function toShortcutTitle(
    title: string,
    ...shortcutIds: DrawShortcutIdType[]
) {
    return `${title} [${shortcutIds.map(toShortcutKeys).join(', ')}]`;
}

function checkIsPlainEventMapper(eventMapper: EventMapperType) {
    const { allControlKey, wControlKey, lControlKey, mControlKey } =
        eventMapper as any;
    const controlKeyList: string[] = [
        ...(allControlKey ?? []),
        ...(wControlKey ?? []),
        ...(lControlKey ?? []),
        ...(mControlKey ?? []),
    ];
    // Shift only changes which character the key produces (`[` -> `{`), so a
    // Shift-only mapper is still reachable without Ctrl/Alt/Meta.
    return controlKeyList.every((controlKey) => {
        return controlKey === 'Shift';
    });
}

const plainShortcutKeySet = new Set(
    Object.values(drawShortcutMap)
        .flat()
        .filter(checkIsPlainEventMapper)
        .map((eventMapper) => {
            return eventMapper.key.toLowerCase();
        }),
);

// ScreenDrawManager's canvas keydown handler swallows every key so the app's
// global shortcuts (slide navigation, clearing, ...) can't fire mid-stroke.
// These have to keep bubbling to `document.onkeydown` or the palette shortcuts
// would be dead exactly when they are most useful: while the user is drawing.
export function checkIsDrawShortcutKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return false;
    }
    // Resolve the key exactly the way the dispatch side does. `document.onkeydown`
    // -> `KeyboardEventListener.fireEvent` matches on `toEnUsKey`, which maps the
    // physical `code` (KeyE, Digit3) back to en-US. Testing `event.key` here
    // instead would disagree on every non-US layout: on AZERTY the `Q` key
    // reports `event.key === 'a'`, so the letter/digit palette keys would be
    // swallowed as "not a shortcut" while the panel was still listening for them
    // — i.e. dead exactly where the canvas has focus, which is the only place
    // they are allowed to fire.
    return plainShortcutKeySet.has(
        KeyboardEventListener.toEnUsKey(event).toLowerCase(),
    );
}

// NOTE: there is deliberately no "is the user typing?" guard here. The panel
// acts on a shortcut only while its draw canvas holds focus
// (`ScreenDrawManager.isFocused`), so the key event's target is always that
// canvas — never a text field, a Monaco editor or anything else.
