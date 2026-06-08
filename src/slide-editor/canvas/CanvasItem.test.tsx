// @vitest-environment jsdom

import { act, startTransition, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const startTransactionMock = vi.fn((callback: () => void) => {
    startTransition(callback);
});

vi.mock('../../helper/helpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../helper/helpers')>();
    return {
        ...actual,
        cloneJson: <T,>(value: T) => structuredClone(value),
    };
});

vi.mock('../../helper/debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../../progress-bar/ProgressBarComp', () => ({
    useProgressBarComp: () => ({
        startTransaction: startTransactionMock,
    }),
}));

import { HEX_COLOR_BLACK } from '../../others/color/colorHelpers';
import CanvasItem, {
    CanvasItemContext,
    CanvasItemError,
    CanvasItemPropsSetterContext,
    CanvasItemsContext,
    type CanvasItemPropsType,
    EditingCanvasItemAndSetterContext,
    SelectedCanvasItemsAndSetterContext,
    checkCanvasItemsIncludes,
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useCanvasItemPropsSetterContext,
    useCanvasItemsContext,
    useEditingCanvasItemAndSetterContext,
    useSelectedCanvasItemsAndSetterContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from './CanvasItem';

type TestCanvasItemProps = CanvasItemPropsType & {
    label?: string;
};

class TestCanvasItem extends CanvasItem<TestCanvasItemProps> {
    static fromJson(json: object) {
        return new TestCanvasItem(json as TestCanvasItemProps);
    }

    static genStyle(props: TestCanvasItemProps) {
        return {
            color: props.backgroundColor,
        };
    }

    getStyle() {
        return TestCanvasItem.genStyle(this.props);
    }
}

function createProps(
    overrides: Partial<TestCanvasItemProps> = {},
): TestCanvasItemProps {
    return {
        backgroundColor: '#112233',
        backdropFilter: 4,
        height: 100,
        id: 1,
        label: 'initial',
        left: 20,
        rotate: 15,
        roundSizePercentage: 0,
        roundSizePixel: 0,
        top: 10,
        type: 'text',
        width: 200,
        ...overrides,
    };
}

function SelectionHarness({
    onReady,
}: Readonly<{ onReady: (value: any) => void }>) {
    const canvasItems = useCanvasItemsContext();
    const selectedContext = useSelectedCanvasItemsAndSetterContext();
    const editingContext = useEditingCanvasItemAndSetterContext();
    const canvasItem = useCanvasItemContext();
    const setSelectedCanvasItems = useSetSelectedCanvasItems();
    const setEditingCanvasItem = useSetEditingCanvasItem();

    useEffect(() => {
        onReady({
            canvasItem,
            canvasItems,
            editingContext,
            selectedContext,
            setEditingCanvasItem,
            setSelectedCanvasItems,
        });
    }, [
        canvasItem,
        canvasItems,
        editingContext,
        onReady,
        selectedContext,
        setEditingCanvasItem,
        setSelectedCanvasItems,
    ]);

    return <div data-testid="selection" />;
}

function PropsHarness({
    onProps,
}: Readonly<{ onProps: (props: TestCanvasItemProps) => void }>) {
    const props = useCanvasItemPropsContext<TestCanvasItemProps>();

    useEffect(() => {
        onProps(props);
    }, [onProps, props]);

    return <div data-testid="props">{props.label}</div>;
}

function PropsSetterHarness({
    onReady,
}: Readonly<{ onReady: (value: any) => void }>) {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<TestCanvasItemProps>();

    useEffect(() => {
        onReady({ props, setProps });
    }, [onReady, props, setProps]);

    return <div data-testid="setter">{props.left}</div>;
}

describe('CanvasItem', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('normalizes props, computes styles, validates data, and clones items', () => {
        const item = new TestCanvasItem({
            id: 1,
            type: 'text',
            horizontalAlignment: 'center',
            verticalAlignment: 'end',
        } as any);

        expect(item.props.top).toBe(0);
        expect(item.props.left).toBe(0);
        expect(item.props.rotate).toBe(0);
        expect(item.props.width).toBe(0);
        expect(item.props.height).toBe(0);
        expect(item.props.backgroundColor).toBe(`${HEX_COLOR_BLACK}00`);
        expect('horizontalAlignment' in item.props).toBe(false);
        expect('verticalAlignment' in item.props).toBe(false);

        expect(
            CanvasItem.genShapeBoxStyle(
                createProps({ roundSizePixel: 18, backdropFilter: 8 }),
            ),
        ).toEqual(
            expect.objectContaining({
                backdropFilter: 'blur(8px)',
                borderRadius: 18,
                boxSizing: 'border-box',
                width: '200px',
            }),
        );
        expect(
            CanvasItem.genShapeBoxStyle(
                createProps({ roundSizePercentage: 40 }),
            ),
        ).toEqual(
            expect.objectContaining({
                borderRadius: '20%',
                boxSizing: 'border-box',
            }),
        );
        expect(CanvasItem.genBoxStyle(createProps())).toEqual(
            expect.objectContaining({
                display: 'flex',
                left: '20px',
                position: 'absolute',
                top: '10px',
                transform: 'rotate(15deg)',
            }),
        );

        const boxItem = new TestCanvasItem(createProps());
        boxItem.applyBoxData(
            { parentWidth: 1000, parentHeight: 800 },
            {
                backgroundColor: '#ffffff',
                horizontalAlignment: 'center',
                rotate: 45,
                verticalAlignment: 'end',
            },
        );
        expect(boxItem.props.left).toBe(400);
        expect(boxItem.props.top).toBe(700);
        expect(boxItem.props.rotate).toBe(45);
        expect(boxItem.props.backgroundColor).toBe('#ffffff');

        boxItem.applyProps({ label: 'changed' });
        expect(boxItem.toJson()).toEqual(
            expect.objectContaining({
                label: 'changed',
            }),
        );

        const clonedItem = boxItem.clone() as TestCanvasItem;
        expect(clonedItem).toBeInstanceOf(TestCanvasItem);
        expect(clonedItem.id).toBe(-1);
        expect(clonedItem.toJson()).toEqual(
            expect.objectContaining({
                label: 'changed',
            }),
        );
        expect(boxItem.clipboardSerialize()).toContain('"label":"changed"');
        expect(boxItem.checkIsSame(clonedItem)).toBe(false);

        expect(() => CanvasItem.validate(createProps())).not.toThrow();
        expect(() =>
            CanvasItem.validate({
                ...createProps(),
                width: 'bad',
            } as any),
        ).toThrow('Invalid canvas item data');

        const errorItem = CanvasItemError.fromJsonError({ broken: true });
        expect(errorItem.type).toBe('error');
        expect(errorItem.jsonError).toEqual({ broken: true });
        expect(errorItem.getStyle()).toEqual(
            expect.objectContaining({
                color: 'red',
                display: 'flex',
            }),
        );
    });

    test('reads selection and editing contexts and toggles selected and editing items', async () => {
        const targetItem = new TestCanvasItem(createProps({ id: 1 }));
        const otherItem = new TestCanvasItem(createProps({ id: 2 }));
        const setCanvasItems = vi.fn();
        const setCanvasItem = vi.fn();
        let latest: any = null;

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <CanvasItemsContext.Provider value={[targetItem, otherItem]}>
                    <SelectedCanvasItemsAndSetterContext.Provider
                        value={{
                            canvasItems: [targetItem],
                            setCanvasItems,
                        }}
                    >
                        <EditingCanvasItemAndSetterContext.Provider
                            value={{
                                canvasItem: targetItem,
                                setCanvasItem,
                            }}
                        >
                            <CanvasItemContext.Provider value={targetItem}>
                                <SelectionHarness
                                    onReady={(value) => {
                                        latest = value;
                                    }}
                                />
                            </CanvasItemContext.Provider>
                        </EditingCanvasItemAndSetterContext.Provider>
                    </SelectedCanvasItemsAndSetterContext.Provider>
                </CanvasItemsContext.Provider>,
            );
        });

        expect(latest.canvasItems).toEqual([targetItem, otherItem]);
        expect(latest.selectedContext.canvasItems).toEqual([targetItem]);
        expect(latest.editingContext.canvasItem).toBe(targetItem);
        expect(latest.canvasItem).toBe(targetItem);
        expect(checkCanvasItemsIncludes([targetItem], targetItem)).toBe(true);
        expect(checkCanvasItemsIncludes([targetItem], otherItem)).toBe(false);

        await act(async () => {
            latest.setSelectedCanvasItems(targetItem, false);
            latest.setSelectedCanvasItems(otherItem, false);
            latest.setEditingCanvasItem(targetItem, false);
            latest.setEditingCanvasItem(otherItem, false);
        });

        expect(setCanvasItems).toHaveBeenNthCalledWith(1, []);
        expect(setCanvasItems).toHaveBeenNthCalledWith(2, [otherItem]);
        expect(setCanvasItem).toHaveBeenNthCalledWith(1, null);
        expect(setCanvasItem).toHaveBeenNthCalledWith(2, targetItem);
    });

    test('updates optimistic props after edit events and exposes the props setter context', async () => {
        const targetItem = new TestCanvasItem(createProps({ label: 'before' }));
        const setProps = vi.fn();
        const observedProps: TestCanvasItemProps[] = [];
        let setterValue: any = null;

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <>
                    <CanvasItemContext.Provider value={targetItem}>
                        <PropsHarness
                            onProps={(props) => {
                                observedProps.push(props);
                            }}
                        />
                    </CanvasItemContext.Provider>
                    <CanvasItemPropsSetterContext.Provider
                        value={{
                            props: createProps({ id: 3, left: 44 }),
                            setProps,
                        }}
                    >
                        <PropsSetterHarness
                            onReady={(value) => {
                                setterValue = value;
                            }}
                        />
                    </CanvasItemPropsSetterContext.Provider>
                </>,
            );
        });

        await act(async () => {
            targetItem.applyProps({ label: 'after', left: 99 });
            targetItem.fireEditEvent();
        });

        expect(observedProps.at(0)?.label).toBe('before');
        expect(observedProps.at(-1)).toEqual(
            expect.objectContaining({
                label: 'after',
                left: 99,
            }),
        );
        expect(startTransactionMock).toHaveBeenCalled();
        expect(setterValue.props.left).toBe(44);

        await act(async () => {
            setterValue.setProps({ left: 55 });
        });

        expect(setProps).toHaveBeenCalledWith({ left: 55 });
    });
});
