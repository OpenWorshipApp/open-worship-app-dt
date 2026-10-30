// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        tooling2BoxProps: vi.fn(),
    },
}));

vi.mock('./canvasHelpers', () => ({
    tooling2BoxProps: mocks.tooling2BoxProps,
    canvasItemList: ['text', 'error'],
    genTextDefaultBoxStyle: () => ({ id: -1, type: 'text' }),
    cleanupProps: vi.fn(),
}));
vi.mock('../../helper/helpers', () => ({ cloneJson: structuredClone }));
vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));
vi.mock('../../server/appProvider', () => ({
    default: { pathUtils: { sep: '/' }, systemUtils: { isDev: false } },
}));
vi.mock('../../helper/appHooks', () => ({ useAppEffect: useEffect }));
vi.mock('../../progress-bar/ProgressBarComp', () => ({
    useProgressBarComp: () => ({
        startTransaction: (callback: () => void) => callback(),
    }),
}));

import CanvasItem, {
    CanvasItemContext,
    CanvasItemError,
    CanvasItemPropsSetterContext,
    CanvasItemsContext,
    EditingCanvasItemAndSetterContext,
    SelectedCanvasItemsAndSetterContext,
    checkCanvasItemsIncludes,
    cleanupBlendMode,
    genBoxBorderRadius,
    useCanvasItemContext,
    useCanvasItemEditEvent,
    useCanvasItemPropsContext,
    useCanvasItemPropsSetterContext,
    useCanvasItemsContext,
    useEditingCanvasItemAndSetterContext,
    useIsCanvasItemSelected,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
    useSelectedCanvasItemsAndSetterContext,
    type CanvasItemPropsType,
} from './CanvasItem';

class TestCanvasItem extends CanvasItem<CanvasItemPropsType> {
    getStyle() {
        return this.getBoxStyle();
    }

    static fromJson(json: object) {
        return new TestCanvasItem(json as CanvasItemPropsType);
    }
}

function props(id = 1): CanvasItemPropsType {
    return {
        id,
        type: 'text',
        top: 10,
        left: 20,
        rotate: 15,
        width: 100,
        height: 50,
        backgroundColor: '#000000',
        backdropFilter: 2,
        roundSizePercentage: 20,
        roundSizePixel: 0,
    };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('CanvasItem core', () => {
    it('normalizes style fields without adding legacy default blend and shadow keys', () => {
        const input = { ...props(), blendMode: 'normal', shadow: null } as any;
        const item = new TestCanvasItem(input);
        expect(item.uuid).toBeTruthy();
        expect(item.isLocked).toBe(false);
        expect(item.shouldLockAspectRatio).toBe(false);
        expect(item.toJson()).not.toHaveProperty('blendMode');
        expect(item.toJson()).not.toHaveProperty('shadow');
        expect(genBoxBorderRadius(item.props)).toBe('10%');
        expect(
            genBoxBorderRadius({ roundSizePixel: 8, roundSizePercentage: 20 }),
        ).toBe(8);
        expect(genBoxBorderRadius({})).toBeUndefined();
        expect(item.getBoxStyle()).toMatchObject({
            position: 'absolute',
            top: '10px',
            left: '20px',
            transform: 'rotate(15deg)',
            borderRadius: '10%',
            boxSizing: 'border-box',
            backdropFilter: 'blur(2px)',
        });
        expect(item.getBoxStyle()).not.toHaveProperty('mixBlendMode');

        item.applyProps({
            blendMode: 'multiply',
            locked: true,
            roundSizePixel: 8,
        });
        expect(item.isLocked).toBe(true);
        expect(item.getBoxStyle()).toMatchObject({
            mixBlendMode: 'multiply',
            borderRadius: 8,
        });
        item.applyProps({
            blendMode: 'normal',
            backdropFilter: 0,
            roundSizePixel: 0,
            roundSizePercentage: 0,
        });
        expect(item.toJson()).not.toHaveProperty('blendMode');
        expect(item.getBoxStyle()).not.toHaveProperty('borderRadius');
        expect(item.getBoxStyle()).toHaveProperty('backdropFilter', undefined);

        const invalid = { blendMode: 'unsupported' };
        cleanupBlendMode(invalid);
        expect(invalid).toEqual({});
    });

    it('applies box edits, preserves identity, clones as a new item, and fires edit events', async () => {
        const item = new TestCanvasItem(props());
        const originalUuid = item.uuid;
        const onEdit = vi.fn();
        item.registerEventListener(['edit'], onEdit);
        mocks.tooling2BoxProps.mockReturnValue({
            top: 30,
            left: 40,
            width: 120,
            height: 60,
        });
        item.applyBoxData({ parentWidth: 800, parentHeight: 600 }, {
            rotate: 45,
            backgroundColor: '#ffffff',
        } as any);
        expect(mocks.tooling2BoxProps).toHaveBeenCalledWith(
            expect.objectContaining({ rotate: 45, backgroundColor: '#ffffff' }),
            { width: 100, height: 50, parentWidth: 800, parentHeight: 600 },
        );
        expect(item.toJson()).toMatchObject({
            top: 30,
            left: 40,
            width: 120,
            height: 60,
            rotate: 45,
            backgroundColor: '#ffffff',
        });
        item.applyProps({ uuid: 'replace-me', left: 90 });
        expect(item.uuid).toBe(originalUuid);
        expect(item.props.left).toBe(90);
        item.fireEditEvent();
        await vi.waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
        expect(item.clipboardSerialize()).toBe(JSON.stringify(item.toJson()));

        const copy = item.clone();
        expect(copy.id).toBe(-1);
        expect(copy.uuid).not.toBe(originalUuid);
        expect(copy.checkIsSame(item)).toBe(false);
        expect(
            item.checkIsSame(new TestCanvasItem({ ...props(), uuid: 'new' })),
        ).toBe(true);
        expect(checkCanvasItemsIncludes([item], copy)).toBe(false);
        expect(
            checkCanvasItemsIncludes([item], new TestCanvasItem(props())),
        ).toBe(true);
    });

    it('rejects malformed serialized boxes and retains the bad source for error items', () => {
        expect(() => CanvasItem.validate(props())).not.toThrow();
        for (const change of [
            { id: 'one' },
            { width: 'large' },
            { locked: 'yes' },
            { blendMode: 12 },
            { shadow: null },
            { type: 'unknown' },
        ]) {
            expect(() =>
                CanvasItem.validate({ ...props(), ...change }),
            ).toThrow('Invalid canvas item data');
        }
        const broken = { type: 'unrecognized', data: 123 };
        const error = CanvasItemError.fromJsonError(broken);
        expect(error.type).toBe('error');
        expect(error.jsonError).toBe(broken);
        expect(error.getStyle()).toMatchObject({
            color: 'red',
            display: 'flex',
        });
        expect(() => CanvasItem.genStyle(props())).toThrow('not implemented');
        expect(() => CanvasItem.fromJson(props())).toThrow('not implemented');
    });

    it('uses independent selection and editing contexts', async () => {
        const first = new TestCanvasItem(props(1));
        const second = new TestCanvasItem(props(2));
        const setSelected = vi.fn();
        const setEditing = vi.fn();
        const setProps = vi.fn();
        let choose!: ReturnType<typeof useSetSelectedCanvasItems>;
        let edit!: ReturnType<typeof useSetEditingCanvasItem>;
        function HarnessComp() {
            choose = useSetSelectedCanvasItems();
            edit = useSetEditingCanvasItem();
            const all = useCanvasItemsContext();
            const current = useCanvasItemContext();
            const selected = useIsCanvasItemSelected();
            const [currentProps, updateProps] =
                useCanvasItemPropsSetterContext();
            const selectedContext = useSelectedCanvasItemsAndSetterContext();
            const editingContext = useEditingCanvasItemAndSetterContext();
            return (
                <button onClick={() => updateProps({ left: 50 })}>
                    {`${all.length}:${current.id}:${selected}:${currentProps.left}:${selectedContext.canvasItems.length}:${editingContext.canvasItem?.id}`}
                </button>
            );
        }
        await act(async () =>
            root.render(
                <CanvasItemsContext value={[first, second]}>
                    <SelectedCanvasItemsAndSetterContext
                        value={{
                            canvasItems: [first],
                            setCanvasItems: setSelected,
                        }}
                    >
                        <EditingCanvasItemAndSetterContext
                            value={{
                                canvasItem: first,
                                setCanvasItem: setEditing,
                            }}
                        >
                            <CanvasItemContext value={first}>
                                <CanvasItemPropsSetterContext
                                    value={{ props: first.props, setProps }}
                                >
                                    <HarnessComp />
                                </CanvasItemPropsSetterContext>
                            </CanvasItemContext>
                        </EditingCanvasItemAndSetterContext>
                    </SelectedCanvasItemsAndSetterContext>
                </CanvasItemsContext>,
            ),
        );
        expect(container.textContent).toBe('2:1:true:20:1:1');
        await act(async () => container.querySelector('button')!.click());
        expect(setProps).toHaveBeenCalledWith({ left: 50 });
        choose(second, { isAppend: true });
        expect(setSelected).toHaveBeenCalledWith([first, second]);
        choose(first, { isAppend: true });
        expect(setSelected).toHaveBeenCalledWith([]);
        choose(second);
        expect(setSelected).toHaveBeenCalledWith([second]);
        edit(first, false);
        expect(setEditing).toHaveBeenCalledWith(null);
        edit(second, false);
        expect(setEditing).toHaveBeenCalledWith(first);
        edit(second);
        expect(setEditing).toHaveBeenCalledWith(second);
    });
});

describe('CanvasItem hooks', () => {
    it('reads its kind from its props', () => {
        expect(new TestCanvasItem(props()).type).toBe('text');
        expect(new TestCanvasItem({ ...props(), type: 'error' }).type).toBe(
            'error',
        );
    });

    it('refuses to run any context hook outside its provider', () => {
        const cases: [() => unknown, string][] = [
            [useCanvasItemsContext, 'CanvasItemsContext not found'],
            [
                useSelectedCanvasItemsAndSetterContext,
                'SelectedCanvasItemsAndSetterContext not found',
            ],
            [
                useEditingCanvasItemAndSetterContext,
                'EditingCanvasItemAndSetterContext not found',
            ],
            [useCanvasItemContext, 'CanvasItem not provided in context'],
            [
                useCanvasItemPropsSetterContext,
                'CanvasItem not provided in context',
            ],
        ];
        for (const [hook, message] of cases) {
            function OrphanComp() {
                hook();
                return null;
            }
            expect(() => renderToStaticMarkup(<OrphanComp />)).toThrow(message);
        }
    });

    it('re-reads the item props when the item fires an edit, and stops after unmount', async () => {
        const item = new TestCanvasItem(props());
        const unregister = vi.spyOn(item, 'unregisterEventListener');
        let renderedProps: CanvasItemPropsType | null = null;
        function PropsComp() {
            renderedProps = useCanvasItemPropsContext();
            return <span>{renderedProps.left}</span>;
        }
        await act(async () =>
            root.render(
                <CanvasItemContext value={item}>
                    <PropsComp />
                </CanvasItemContext>,
            ),
        );
        expect(container.textContent).toBe('20');
        // A copy, never the item's own object: editing it must not reach the
        // item behind the controller's back.
        expect(renderedProps).not.toBe(item.props);

        item.applyProps({ left: 75 });
        await act(async () => {
            item.fireEditEvent();
            await vi.waitFor(() => expect(container.textContent).toBe('75'));
        });

        await act(async () => root.unmount());
        root = createRoot(container);
        expect(unregister).toHaveBeenCalledOnce();
    });

    it('moves its edit listener to a new item and drops the old one', async () => {
        const first = new TestCanvasItem(props(1));
        const second = new TestCanvasItem(props(2));
        const onEdit = vi.fn();
        function ListenerComp({ item }: { item: TestCanvasItem }) {
            useCanvasItemEditEvent(item, () => onEdit(item.id));
            return null;
        }
        await act(async () => root.render(<ListenerComp item={first} />));
        await act(async () => root.render(<ListenerComp item={second} />));

        first.fireEditEvent();
        second.fireEditEvent();
        await vi.waitFor(() => expect(onEdit).toHaveBeenCalledWith(2));
        expect(onEdit).toHaveBeenCalledOnce();
    });
});
