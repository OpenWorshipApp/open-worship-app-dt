// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    setProps: null as any,
    controller: null as any,
    canvasItems: [] as any[],
    selected: [] as any[],
    editing: null as any,
    setEditing: null as any,
    setSelected: null as any,
    showBibleLookup: null as any,
    cameras: [] as { deviceId: string; label: string }[],
    settings: new Map<string, string>(),
    scale: 1,
    transitionMap: null as any,
    commonEffect: 'fade',
    commonEffectCalls: 0,
    effectListeners: [] as (() => void)[],
    unregistered: [] as unknown[],
    colorPickerProps: [] as any[],
    insertHandle: null as any,
    handleError: null as any,
}));

vi.mock('../../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => true,
    isSupportedMimetype: () => true,
}));
vi.mock('../../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('../../../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.handleError(error),
}));
vi.mock('../../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (key: string) => h.settings.get(key) ?? null,
        setSetting: (key: string, value: string) => {
            h.settings.set(key, value);
        },
        useStateSettingString: (key: string, defaultValue: string) => {
            const [value, setValue] = useState(
                h.settings.get(key) ?? defaultValue,
            );
            return [
                value,
                (newValue: string) => {
                    h.settings.set(key, newValue);
                    setValue(newValue);
                },
            ] as const;
        },
    };
});
vi.mock('../CanvasItem', async () => {
    const { createContext } = await import('react');
    return {
        CanvasItemContext: createContext(null),
        checkCanvasItemsIncludes: (list: any[], item: any) =>
            list.some((other) => other.id === item.id),
        useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
        useCanvasItemsContext: () => h.canvasItems,
        useSelectedCanvasItemsAndSetterContext: () => ({
            canvasItems: h.selected,
        }),
        useEditingCanvasItemAndSetterContext: () => ({
            canvasItem: h.editing,
        }),
        useSetEditingCanvasItem: () => h.setEditing,
        useSetSelectedCanvasItems: () => h.setSelected,
    };
});
vi.mock('../CanvasController', () => ({
    defaultRangeSize: { size: 10, min: 1, max: 20, step: 1 },
    useCanvasControllerContext: () => h.controller,
}));
vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => h.scale,
}));
vi.mock('../../../helper/cameraHelpers', () => ({
    useCameraInfoList: () => h.cameras,
}));
vi.mock('../../CanvasItemRendererComp', async () => {
    const { use } = await import('react');
    const { CanvasItemContext } = await import('../CanvasItem');
    const { SlideThumbnailContext } =
        await import('../box/slideThumbnailContext');
    return {
        default: function CanvasItemRendererMockComp() {
            const canvasItem = use(CanvasItemContext as any) as any;
            const isThumbnail = use(SlideThumbnailContext);
            return (
                <i
                    className="item-render"
                    data-item={canvasItem?.id}
                    data-thumbnail={String(isThumbnail)}
                />
            );
        },
    };
});
vi.mock('../../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: function ContextMenuDotsMockComp() {
        return <i className="dots" />;
    },
}));
vi.mock('../../../others/commonButtons', () => ({
    useToggleBibleLookupPopupContext: () => h.showBibleLookup,
}));
vi.mock('../../../others/TabRenderComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: function TabRenderMockComp({
            tabs,
            activeTabs,
            setActiveTab,
        }: {
            tabs: { key: string; title: ReactNode }[];
            activeTabs: string[];
            setActiveTab: (key: string) => void;
        }) {
            return (
                <>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            className="tab"
                            data-tab={tab.key}
                            data-active={String(activeTabs.includes(tab.key))}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.title}
                        </button>
                    ))}
                </>
            );
        },
        genTabBody: (selected: string, [key, Element]: [string, any]) => (
            <Suspense key={`tab-${key}`} fallback={<i className="loading" />}>
                {selected === key ? <Element /> : null}
            </Suspense>
        ),
    };
});
vi.mock('./CanvasItemPropsEditorComp', () => ({
    default: function CanvasItemPropsEditorMockComp({
        canvasItem,
    }: {
        canvasItem: { id: number };
    }) {
        return <i className="item-props" data-item={canvasItem.id} />;
    },
}));
vi.mock('./SlidePropertyEditorComp', () => ({
    default: function SlidePropertyEditorMockComp() {
        return <i className="slide-props" />;
    },
}));
vi.mock('./DocumentFontEditorComp', () => ({
    default: function DocumentFontEditorMockComp() {
        return <i className="document-font" />;
    },
}));
vi.mock('../../../event/EventHandler', () => ({
    default: {
        registerEventListener: (events: string[], listener: () => void) => {
            h.effectListeners.push(listener);
            return { events, listener };
        },
        unregisterEventListener: (registered: unknown) => {
            h.unregistered.push(registered);
        },
    },
}));
vi.mock('../../../_screen/managers/ScreenEffectManager', () => ({
    SCREEN_EFFECT_CHANGED_EVENT: 'screen-effect-changed',
    default: {
        getCommonEffectType: (kind: string) => {
            h.commonEffectCalls++;
            return kind === 'vary-app-document' ? h.commonEffect : 'none';
        },
    },
}));
vi.mock('../../../others/TransitionOverrideComp', () => ({
    default: function TransitionOverrideMockComp({
        value,
        inherited,
        onChange,
        choicesClassName,
    }: {
        value?: string;
        inherited: { effect: string; sourceLabel: string };
        onChange: (value?: string) => void;
        choicesClassName: string;
    }) {
        return (
            <div
                className="transition"
                data-value={value ?? ''}
                data-effect={inherited.effect}
                data-source={inherited.sourceLabel}
                data-choices={choicesClassName}
            >
                <button className="pick" onClick={() => onChange('zoom')} />
                <button className="clear" onClick={() => onChange(undefined)} />
            </div>
        );
    },
}));
vi.mock('../../../others/slideTransitionMenuHelpers', () => ({
    useSlideTransitionMap: () => h.transitionMap,
}));
vi.mock('../../../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        toKey: (slideId?: number) =>
            slideId === undefined ? 'document' : `slide-${slideId}`,
    },
}));
vi.mock('../../../others/AppRangeComp', () => ({
    default: function AppRangeMockComp({
        value,
        title,
        setValue,
    }: {
        value: number;
        title: string;
        setValue: (value: number) => void;
    }) {
        return (
            <button
                className="range"
                data-value={value}
                title={title}
                onClick={() => setValue(15)}
            />
        );
    },
}));
vi.mock('../../../others/FontSizeControlComp', () => ({
    default: function FontSizeMockComp({
        fontSize,
        setFontSize,
    }: {
        fontSize: number;
        setFontSize: (size: number) => void;
    }) {
        return (
            <button
                className="font-size"
                data-size={fontSize}
                onClick={() => setFontSize(72)}
            />
        );
    },
}));
vi.mock('../../../others/FontFamilyControlComp', () => ({
    default: function FontFamilyMockComp({
        fontFamily,
        setFontFamily,
        fontWeight,
        setFontWeight,
    }: {
        fontFamily: string;
        setFontFamily: (family: string) => void;
        fontWeight: string;
        setFontWeight: (weight: string) => void;
    }) {
        return (
            <>
                <button
                    className="font-family"
                    data-family={fontFamily}
                    onClick={() => setFontFamily('Arial')}
                />
                <button
                    className="font-weight"
                    data-weight={fontWeight}
                    onClick={() => setFontWeight('bold')}
                />
            </>
        );
    },
}));
vi.mock('../../../others/color/ColorPicker', () => ({
    default: function ColorPickerMockComp(props: any) {
        h.colorPickerProps.push(props);
        return (
            <button
                className="color"
                onClick={() => props.onColorChange('#00FF00')}
            />
        );
    },
}));
vi.mock('../../../others/color/colorHelpers', () => ({
    HEX_COLOR_WHITE: '#FFFFFF',
}));
vi.mock('../canvasInsertActionHelpers', () => ({
    canvasInsertActionList: [
        {
            key: 'text',
            label: 'New',
            iconName: 'fonts',
            handle: (controller: unknown) => h.insertHandle('text', controller),
        },
        {
            key: 'image',
            label: 'Image',
            iconName: 'image',
            handle: (controller: unknown) =>
                h.insertHandle('image', controller),
        },
    ],
}));

import SlideEditorToolsCameraComp from './SlideEditorToolsCameraComp';
import CanvasItemTransitionComp from './CanvasItemTransitionComp';
import ToolCanvasItemsComp from './ToolCanvasItemsComp';
import SlideEditorToolsComp from './SlideEditorToolsComp';
import SlideEditorToolAlignComp from './SlideEditorToolAlignComp';
import SlideEditorCanvasScalingComp from './SlideEditorCanvasScalingComp';
import ToolsTextFontControlComp from './ToolsTextFontControlComp';
import BoxPositionSizeComp from './BoxPositionSizeComp';
import SlideEditorToolsTextComp from './SlideEditorToolsTextComp';
import SlideEditorInsertToolbarComp from './SlideEditorInsertToolbarComp';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function query<T extends Element = HTMLElement>(selector: string) {
    const found = container.querySelector<T>(selector) as T | null;
    if (found === null) {
        throw new Error(`nothing matches ${selector}`);
    }
    return found;
}

async function click(element: Element, init: MouseEventInit = {}) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent('click', { bubbles: true, ...init }),
        );
    });
}

async function changeValue(
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    value: string,
    eventName = 'input',
) {
    const prototype = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
    await act(async () => {
        setter.call(element, value);
        element.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
}

beforeEach(() => {
    h.props = {};
    h.setProps = vi.fn();
    h.controller = {};
    h.canvasItems = [];
    h.selected = [];
    h.editing = null;
    h.setEditing = vi.fn();
    h.setSelected = vi.fn();
    h.showBibleLookup = vi.fn();
    h.cameras = [];
    h.settings.clear();
    h.scale = 1;
    h.transitionMap = null;
    h.commonEffect = 'fade';
    h.commonEffectCalls = 0;
    h.effectListeners.length = 0;
    h.unregistered.length = 0;
    h.colorPickerProps.length = 0;
    h.insertHandle = vi.fn();
    h.handleError = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('SlideEditorToolsCameraComp', () => {
    beforeEach(() => {
        h.cameras = [
            { deviceId: 'cam1', label: 'Front' },
            { deviceId: 'cam2', label: '' },
        ];
    });

    it('selects the stored camera and switches device id and label together', async () => {
        h.props = {
            deviceId: 'cam1',
            label: 'Front',
            isMirrored: false,
            objectFit: 'cover',
        };
        await render(<SlideEditorToolsCameraComp />);
        const select = query<HTMLSelectElement>('select');
        expect(select.value).toBe('cam1');
        expect(
            Array.from(select.options).map((option) => option.textContent),
        ).toEqual(['Front', 'Camera 2']);
        expect(
            Array.from(container.querySelectorAll('.app-tool-title')).map(
                (title) => title.textContent,
            ),
        ).toEqual(['Camera Device', 'Mirror', 'Object Fit']);
        await changeValue(select, 'cam2', 'change');
        expect(h.setProps).toHaveBeenCalledWith({
            deviceId: 'cam2',
            label: '',
        });
    });

    it('names a camera that is not plugged in and keeps it selected', async () => {
        h.props = {
            deviceId: 'gone',
            label: 'Old camera',
            isMirrored: true,
            objectFit: 'contain',
        };
        await render(<SlideEditorToolsCameraComp />);
        const select = query<HTMLSelectElement>('select');
        expect(select.value).toBe('__missing__');
        expect(select.options[0].textContent).toBe(
            'Old camera (Camera not found)',
        );
        expect(select.options[0].disabled).toBe(true);
        // choosing the placeholder itself writes nothing
        await changeValue(select, '__missing__', 'change');
        expect(h.setProps).not.toHaveBeenCalled();
        h.props = { ...h.props, label: '' };
        await render(<SlideEditorToolsCameraComp />);
        expect(query<HTMLSelectElement>('select').options[0].textContent).toBe(
            'gone (Camera not found)',
        );
    });

    it('toggles the mirror and picks the object fit', async () => {
        h.props = {
            deviceId: 'cam1',
            label: 'Front',
            isMirrored: false,
            objectFit: 'contain',
        };
        await render(<SlideEditorToolsCameraComp />);
        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('.btn-group button'),
        );
        expect(buttons.map((button) => button.textContent)).toEqual([
            'Cover',
            'Contain',
            'Fill',
        ]);
        expect(buttons.map((button) => button.className)).toEqual([
            'btn btn-sm btn-outline-info',
            'btn btn-sm btn-info',
            'btn btn-sm btn-outline-info',
        ]);
        await click(buttons[2]);
        expect(h.setProps).toHaveBeenCalledWith({ objectFit: 'fill' });
        await click(query('input[type="checkbox"]'));
        expect(h.setProps).toHaveBeenCalledWith({ isMirrored: true });
    });
});

describe('CanvasItemTransitionComp', () => {
    beforeEach(() => {
        h.controller = {
            canvas: { slide: { id: 3, filePath: '/docs/Sunday.slides' } },
        };
    });

    it('inherits the screen setting when nothing below it chose one', async () => {
        h.props = { transitionEffect: 'not-an-effect' };
        await render(<CanvasItemTransitionComp />);
        const transition = query('.transition');
        expect(transition.dataset.value).toBe('');
        expect(transition.dataset.effect).toBe('fade');
        expect(transition.dataset.source).toBe('Screen setting');
        expect(transition.dataset.choices).toBe('w-100');
        expect(query('.app-tool-title').textContent).toBe(
            'Canvas item transition',
        );
        expect(container.textContent).toContain('Used when changing slides.');
    });

    it('prefers the slide transition over the slides preview one', async () => {
        h.props = { transitionEffect: 'move' };
        h.transitionMap = { document: 'zoom' };
        await render(<CanvasItemTransitionComp />);
        expect(query('.transition').dataset.value).toBe('move');
        expect(query('.transition').dataset.effect).toBe('zoom');
        expect(query('.transition').dataset.source).toBe('Slides preview');
        h.transitionMap = { document: 'zoom', 'slide-3': 'none' };
        await render(<CanvasItemTransitionComp />);
        expect(query('.transition').dataset.effect).toBe('none');
        expect(query('.transition').dataset.source).toBe('Slide transition');
    });

    it('stores the chosen effect, or null to inherit again', async () => {
        h.props = {};
        await render(<CanvasItemTransitionComp />);
        await click(query('.pick'));
        expect(h.setProps).toHaveBeenLastCalledWith({
            transitionEffect: 'zoom',
        });
        await click(query('.clear'));
        expect(h.setProps).toHaveBeenLastCalledWith({ transitionEffect: null });
    });

    it('re-reads the screen setting when it changes and stops listening on unmount', async () => {
        h.props = {};
        await render(<CanvasItemTransitionComp />);
        expect(h.effectListeners).toHaveLength(1);
        h.commonEffect = 'move';
        const callsBefore = h.commonEffectCalls;
        await act(async () => {
            h.effectListeners[0]();
        });
        expect(h.commonEffectCalls).toBeGreaterThan(callsBefore);
        expect(query('.transition').dataset.effect).toBe('move');
        await act(async () => {
            root.unmount();
        });
        expect(h.unregistered).toEqual([
            {
                events: ['screen-effect-changed'],
                listener: h.effectListeners[0],
            },
        ]);
        root = createRoot(container);
    });
});

describe('ToolCanvasItemsComp', () => {
    let contextMenuCalls: any[];
    let openedMenus: Array<[id: number, event: unknown]>;

    beforeEach(() => {
        contextMenuCalls = [];
        openedMenus = [];
        h.controller = {
            genHandleContextMenuOpening: (...args: any[]) => {
                contextMenuCalls.push(args);
                return (event: unknown) => {
                    openedMenus.push([args[0].id, event]);
                };
            },
        };
        h.canvasItems = [
            { id: 1, props: { width: 1920, height: 1080 } },
            { id: 2, props: { width: 100, height: 300 } },
        ];
        h.selected = [{ id: 1 }];
    });

    it('draws a scaled thumbnail card per item and marks the selected one', async () => {
        await render(<ToolCanvasItemsComp />);
        const cards = container.querySelectorAll<HTMLElement>('.card');
        expect(cards).toHaveLength(2);
        expect(
            Array.from(cards).map(
                (card) => card.querySelector('.card-header span')?.textContent,
            ),
        ).toEqual(['1:1920x1080', '2:100x300']);
        expect(cards[0].style.border).toBe('2px dashed green');
        expect(cards[1].style.border).toBe('');
        const scaled = Array.from(
            container.querySelectorAll<HTMLElement>('.card-body > div'),
        );
        expect(scaled[0].style.transform).toBe(
            `scale(${Math.min(280 / 1920, 150 / 1080)})`,
        );
        expect(scaled[1].style.transform).toBe('scale(0.5)');
        expect(scaled[1].style.width).toBe('100px');
        expect(
            Array.from(container.querySelectorAll('.item-render')).map(
                (item) => [
                    item.getAttribute('data-item'),
                    item.getAttribute('data-thumbnail'),
                ],
            ),
        ).toEqual([
            ['1', 'true'],
            ['2', 'true'],
        ]);
        expect(container.querySelectorAll('.dots')).toHaveLength(2);
    });

    it('selects a card on click, appending with a modifier key', async () => {
        const outer = vi.fn();
        await render(
            <div onClick={outer}>
                <ToolCanvasItemsComp />
            </div>,
        );
        const cards = container.querySelectorAll('.card');
        await click(cards[1]);
        expect(h.setSelected).toHaveBeenLastCalledWith(h.canvasItems[1], {
            isAppend: false,
        });
        await click(cards[0], { ctrlKey: true });
        expect(h.setSelected).toHaveBeenLastCalledWith(h.canvasItems[0], {
            isAppend: true,
        });
        expect(outer).not.toHaveBeenCalled();
    });

    it('opens the item menu, whose edit entry edits that item', async () => {
        await render(<ToolCanvasItemsComp />);
        const [item, edit, isEditing, showBibleLookup] =
            contextMenuCalls.at(-1);
        expect(item).toBe(h.canvasItems[1]);
        expect(isEditing).toBe(false);
        expect(showBibleLookup).toBe(h.showBibleLookup);
        edit();
        expect(h.setEditing).toHaveBeenCalledWith(h.canvasItems[1]);
        await act(async () => {
            container
                .querySelectorAll('.card')[0]
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
        });
        expect(openedMenus.map(([id]) => id)).toEqual([1]);
    });
});

describe('SlideEditorToolsComp', () => {
    it('shows the empty properties panel when nothing is selected', async () => {
        await render(<SlideEditorToolsComp />);
        expect(
            Array.from(container.querySelectorAll('.tab')).map((tab) => [
                tab.getAttribute('data-tab'),
                tab.textContent,
                tab.getAttribute('data-active'),
            ]),
        ).toEqual([
            ['p', 'Properties', 'true'],
            ['c', 'Canvas Items', 'false'],
        ]);
        expect(container.querySelector('.slide-props')).not.toBe(null);
        expect(container.querySelector('.document-font')).not.toBe(null);
        expect(container.textContent).toContain('No canvas item selected');
        expect(container.textContent).toContain(
            'Please select an item to edit',
        );
        expect(container.querySelectorAll('.item-props')).toHaveLength(0);
    });

    it('edits the box being typed into when there is no selection', async () => {
        h.editing = { id: 9 };
        await render(<SlideEditorToolsComp />);
        expect(
            Array.from(container.querySelectorAll('.item-props')).map((item) =>
                item.getAttribute('data-item'),
            ),
        ).toEqual(['9']);
        expect(container.textContent).not.toContain('No canvas item selected');
        h.selected = [{ id: 1 }, { id: 2 }];
        await render(<SlideEditorToolsComp />);
        expect(
            Array.from(container.querySelectorAll('.item-props')).map((item) =>
                item.getAttribute('data-item'),
            ),
        ).toEqual(['1', '2']);
    });

    it('switches to the canvas items tab and remembers it', async () => {
        h.controller = { genHandleContextMenuOpening: () => () => {} };
        h.canvasItems = [{ id: 4, props: { width: 200, height: 100 } }];
        await render(<SlideEditorToolsComp />);
        await click(query('[data-tab="c"]'));
        await flush();
        await flush();
        expect(h.settings.get('editor-tools-tab')).toBe('c');
        expect(container.querySelector('.slide-props')).toBe(null);
        expect(query('[data-tab="c"]').getAttribute('data-active')).toBe(
            'true',
        );
        expect(query('.card-header span').textContent).toBe('4:200x100');
    });

    it('opens on the tab stored last time', async () => {
        h.settings.set('editor-tools-tab', 'c');
        h.controller = { genHandleContextMenuOpening: () => () => {} };
        await render(<SlideEditorToolsComp />);
        await flush();
        await flush();
        expect(container.querySelector('.slide-props')).toBe(null);
        expect(container.querySelector('.loading')).toBe(null);
        expect(query('[data-tab="c"]').getAttribute('data-active')).toBe(
            'true',
        );
    });
});

describe('SlideEditorToolAlignComp', () => {
    it('disables the current box alignment and reports a new one', async () => {
        const onData = vi.fn();
        await render(
            <SlideEditorToolAlignComp
                onData={onData}
                data={{
                    verticalAlignment: 'start',
                    horizontalAlignment: 'center',
                }}
            />,
        );
        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button'),
        );
        expect(
            buttons.map((button) => button.getAttribute('aria-label')),
        ).toEqual([
            'Align top',
            'Align middle',
            'Align bottom',
            'Align left',
            'Align center',
            'Align right',
        ]);
        expect(buttons.map((button) => button.disabled)).toEqual([
            true,
            false,
            false,
            false,
            true,
            false,
        ]);
        expect(buttons[0].className).toBe('btn btn-sm btn-info');
        expect(buttons[1].className).toBe('btn btn-sm btn-outline-info');
        expect(
            Array.from(container.querySelectorAll('[role="group"]')).map(
                (group) => group.getAttribute('aria-label'),
            ),
        ).toEqual(['Vertical alignment', 'Horizontal alignment']);
        await click(buttons[2]);
        expect(onData).toHaveBeenLastCalledWith({ verticalAlignment: 'end' });
        await click(buttons[5]);
        expect(onData).toHaveBeenLastCalledWith({
            horizontalAlignment: 'right',
        });
    });

    it('enables every button when no alignment is set', async () => {
        await render(<SlideEditorToolAlignComp onData={() => {}} />);
        expect(
            Array.from(
                container.querySelectorAll<HTMLButtonElement>('button'),
            ).every((button) => !button.disabled),
        ).toBe(true);
    });
});

describe('SlideEditorCanvasScalingComp', () => {
    it('shows the zoom as a percentage, centers and rescales the canvas', async () => {
        h.scale = 0.5;
        h.controller = { toCenterView: vi.fn(), scale: 0.5 };
        await render(<SlideEditorCanvasScalingComp />);
        expect(query('span[title="Canvas Scale"]').textContent).toBe('50%');
        expect(query('.range').getAttribute('data-value')).toBe('5');
        await click(query('button[aria-label="Center view"]'));
        expect(h.controller.toCenterView).toHaveBeenCalledTimes(1);
        await click(query('.range'));
        expect(h.controller.scale).toBe(1.5);
    });
});

describe('ToolsTextFontControlComp', () => {
    it('writes size, family and weight back to the item', async () => {
        h.props = { fontSize: 40, fontFamily: null, fontWeight: null };
        await render(<ToolsTextFontControlComp />);
        expect(query('.font-size').getAttribute('data-size')).toBe('40');
        expect(query('.font-family').getAttribute('data-family')).toBe('');
        expect(query('.font-weight').getAttribute('data-weight')).toBe('');
        await click(query('.font-size'));
        expect(h.setProps).toHaveBeenLastCalledWith({ fontSize: 72 });
        await click(query('.font-family'));
        expect(h.setProps).toHaveBeenLastCalledWith({ fontFamily: 'Arial' });
        await click(query('.font-weight'));
        expect(h.setProps).toHaveBeenLastCalledWith({ fontWeight: 'bold' });
        h.props = { fontSize: 40, fontFamily: 'Battambang', fontWeight: '700' };
        await render(<ToolsTextFontControlComp />);
        expect(query('.font-family').getAttribute('data-family')).toBe(
            'Battambang',
        );
        expect(query('.font-weight').getAttribute('data-weight')).toBe('700');
    });
});

describe('BoxPositionSizeComp', () => {
    beforeEach(() => {
        h.props = { left: 10.4, top: 20, width: 300, height: 200, rotate: 45 };
    });

    function input(label: string) {
        return query<HTMLInputElement>(`input[aria-label="${label}"]`);
    }

    it('shows rounded values with their units', async () => {
        await render(<BoxPositionSizeComp />);
        expect(input('Left').value).toBe('10');
        expect(input('Top').value).toBe('20');
        expect(input('Rotate:').value).toBe('45');
        expect(
            Array.from(container.querySelectorAll('.input-group-text')).map(
                (text) => text.textContent,
            ),
        ).toEqual([
            'X:',
            'px',
            'Y:',
            'px',
            'W:',
            'px',
            'H:',
            'px',
            'Rotate:',
            'deg',
        ]);
        expect(input('Left').closest('[title]')?.getAttribute('title')).toBe(
            'Left',
        );
    });

    it('keeps a size at least one pixel and a turn inside one circle', async () => {
        await render(<BoxPositionSizeComp />);
        await changeValue(input('Left'), '12.5');
        expect(h.setProps).toHaveBeenLastCalledWith({ left: 12.5 });
        await changeValue(input('Top'), '-4');
        expect(h.setProps).toHaveBeenLastCalledWith({ top: -4 });
        await changeValue(input('Width'), '0');
        expect(h.setProps).toHaveBeenLastCalledWith({ width: 1 });
        await changeValue(input('Height'), '-30');
        expect(h.setProps).toHaveBeenLastCalledWith({ height: 1 });
        await changeValue(input('Rotate:'), '-90');
        expect(h.setProps).toHaveBeenLastCalledWith({ rotate: 270 });
        const callCount = h.setProps.mock.calls.length;
        await changeValue(input('Width'), '');
        expect(h.setProps).toHaveBeenCalledTimes(callCount);
        await click(query('button[aria-label="Reset Rotate"]'));
        expect(h.setProps).toHaveBeenLastCalledWith({ rotate: 0 });
    });
});

describe('SlideEditorToolsTextComp', () => {
    beforeEach(() => {
        h.props = {
            text: 'Hi',
            color: '#FF0000',
            fontSize: 40,
            fontFamily: 'Battambang',
            fontWeight: 'bold',
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'center',
        };
    });

    it('edits color, text alignment and text of a text item', async () => {
        await render(<SlideEditorToolsTextComp />);
        const picker = h.colorPickerProps.at(-1);
        expect(picker).toMatchObject({
            color: '#FF0000',
            colorInputLabel: 'Text Color',
            defaultColor: '#FFFFFF',
            isCollapsable: true,
        });
        expect(picker.onNoColor).toBeUndefined();
        await click(query('.color'));
        expect(h.setProps).toHaveBeenLastCalledWith({ color: '#00FF00' });

        const alignLabels = Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                '[role="group"] button',
            ),
        ).map((button) => [button.getAttribute('aria-label'), button.disabled]);
        expect(alignLabels).toEqual([
            ['Text align top', false],
            ['Text align middle', true],
            ['Text align bottom', false],
            ['Text align left', true],
            ['Text align center', false],
            ['Text align right', false],
        ]);
        await click(query('button[aria-label="Text align bottom"]'));
        expect(h.setProps).toHaveBeenLastCalledWith({
            textHorizontalAlignment: 'left',
            textVerticalAlignment: 'end',
        });
        await click(query('button[aria-label="Text align right"]'));
        expect(h.setProps).toHaveBeenLastCalledWith({
            textHorizontalAlignment: 'right',
            textVerticalAlignment: 'center',
        });

        const textArea = query<HTMLTextAreaElement>('textarea');
        expect(textArea.value).toBe('Hi');
        expect(textArea.placeholder).toBe('Type the slide text here');
        expect(textArea.style.fontFamily).toBe('Battambang');
        expect(textArea.style.fontWeight).toBe('bold');
        await changeValue(textArea, 'Hello');
        expect(h.setProps).toHaveBeenLastCalledWith({ text: 'Hello' });
    });

    it('can leave out the alignment and the text box', async () => {
        h.props = { ...h.props, fontFamily: '', fontWeight: '' };
        await render(
            <SlideEditorToolsTextComp
                isAlignmentEnabled={false}
                isTextContentEnabled={false}
            />,
        );
        expect(container.querySelector('[role="group"]')).toBe(null);
        expect(container.querySelector('textarea')).toBe(null);
        expect(container.querySelector('.font-size')).not.toBe(null);
        await render(<SlideEditorToolsTextComp isAlignmentEnabled={false} />);
        expect(query<HTMLTextAreaElement>('textarea').style.fontFamily).toBe(
            '',
        );
    });
});

describe('SlideEditorInsertToolbarComp', () => {
    it('runs each insert action on the canvas and reports a failure', async () => {
        const controller = { id: 'controller' } as any;
        await render(
            <SlideEditorInsertToolbarComp canvasController={controller} />,
        );
        const buttons = Array.from(container.querySelectorAll('button'));
        expect(
            buttons.map((button) => [button.title, button.textContent]),
        ).toEqual([
            ['New', 'New'],
            ['Image', 'Image'],
        ]);
        expect(buttons[1].querySelector('i')?.className).toBe('bi bi-image');
        h.insertHandle.mockImplementation(async () => {});
        await click(buttons[0]);
        expect(h.insertHandle).toHaveBeenCalledWith('text', controller);
        expect(h.handleError).not.toHaveBeenCalled();
        const error = new Error('no file chosen');
        h.insertHandle.mockImplementation(async () => {
            throw error;
        });
        await click(buttons[1]);
        await flush();
        expect(h.insertHandle).toHaveBeenLastCalledWith('image', controller);
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('SlideEditorToolTitleComp', () => {
    it('draws a plain section with or without a title', async () => {
        await render(
            <SlideEditorToolTitleComp title="Font" isInline>
                <span className="child" />
            </SlideEditorToolTitleComp>,
        );
        expect(query('.app-tool').className).toBe('app-tool app-tool-inline');
        expect(query('.app-tool-title').textContent).toBe('Font');
        await render(
            <SlideEditorToolTitleComp isCollapsible>
                <span className="child" />
            </SlideEditorToolTitleComp>,
        );
        expect(query('.app-tool').className).toBe('app-tool');
        expect(container.querySelector('.app-tool-title')).toBe(null);
        expect(container.querySelector('.child')).not.toBe(null);
    });

    it('collapses and expands a section and remembers it', async () => {
        await render(
            <SlideEditorToolTitleComp
                title="Shadow"
                isCollapsible
                persistingKey="shadow-tool"
            >
                <span className="child" />
            </SlideEditorToolTitleComp>,
        );
        const header = query('.app-tool-title-collapsible');
        expect(header.getAttribute('role')).toBe('button');
        expect(header.title).toBe('Collapse');
        expect(header.querySelector('i')?.className).toBe('bi bi-chevron-down');
        await click(header);
        expect(container.querySelector('.child')).toBe(null);
        expect(query('.app-tool-title-collapsible').title).toBe('Expand');
        expect(h.settings.get('shadow-tool')).toBe('false');
        await click(query('.app-tool-title-collapsible'));
        expect(container.querySelector('.child')).not.toBe(null);
        expect(h.settings.get('shadow-tool')).toBe('true');
    });

    it('opens collapsed when that was stored, and persists nothing without a key', async () => {
        h.settings.set('media-tool', 'false');
        await render(
            <SlideEditorToolTitleComp
                title="Media"
                isCollapsible
                persistingKey="media-tool"
            >
                <span className="child" />
            </SlideEditorToolTitleComp>,
        );
        expect(container.querySelector('.child')).toBe(null);
        expect(query('.app-tool-title-collapsible i').className).toBe(
            'bi bi-chevron-right',
        );
        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        h.settings.clear();
        await render(
            <SlideEditorToolTitleComp
                title="Media"
                isCollapsible
                isInitiallyExpanded={false}
                persistingKey=""
            >
                <span className="child" />
            </SlideEditorToolTitleComp>,
        );
        expect(container.querySelector('.child')).toBe(null);
        await click(query('.app-tool-title-collapsible'));
        expect(container.querySelector('.child')).not.toBe(null);
        expect(h.settings.size).toBe(0);
    });
});
