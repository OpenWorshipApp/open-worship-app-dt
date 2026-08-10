// @vitest-environment jsdom
// jsdom, and the real `appProvider`: `canvasHelpers` reaches it through
// `helpers` -> `langHelpers`, and stubbing it just moves the failure deeper
// (`appUtils.base64Encode`, `systemUtils.isDev`, ...).

import { describe, expect, test, vi } from 'vitest';

const { BaseCanvasItemMock } = vi.hoisted(() => {
    class BaseCanvasItemMock<T> {
        props: T;
        constructor(props: T) {
            this.props = { ...props };
        }
        static validate() {}
        toJson() {
            return this.props;
        }
    }
    return { BaseCanvasItemMock };
});

vi.mock('./CanvasItem', () => ({
    default: BaseCanvasItemMock,
    CanvasItemError: { fromJsonError: vi.fn() },
}));

import CanvasItemText from './CanvasItemText';
import { genTextDefaultProps } from './CanvasItemText';

describe('CanvasItemText.genColorBoxItem', () => {
    test('centers an empty box of the default size on the point', () => {
        const item = CanvasItemText.genColorBoxItem(500, 400, '#123456' as any);

        // The same 700x400 the "New" insert action uses, centered on the drop.
        expect(item.props.width).toBe(700);
        expect(item.props.height).toBe(400);
        expect(item.props.left).toBe(150);
        expect(item.props.top).toBe(200);
        expect(item.props.backgroundColor).toBe('#123456');
        expect(item.props.type).toBe('text');
        // Empty on purpose: it is a colored rectangle until the operator types
        // in it, not a box pre-filled with the app title.
        expect(item.props.text).toBe('');
    });

    test('leaves the default text item untouched', () => {
        const item = CanvasItemText.genDefaultItem();

        expect(item.props.text).toBe(genTextDefaultProps().text);
        expect(item.props.backgroundColor).toBe('#0000008b');
    });
});
