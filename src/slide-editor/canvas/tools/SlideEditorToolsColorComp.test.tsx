// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    pickerProps: null as any,
}));

vi.mock('../../../others/color/colorHelpers', () => ({
    HEX_COLOR_WHITE: '#ffffff',
}));

vi.mock('../../../others/color/ColorPicker', () => ({
    default: (props: any) => {
        h.pickerProps = props;
        return <div data-picker="" />;
    },
}));

import SlideEditorToolsColorComp from './SlideEditorToolsColorComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.pickerProps = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorToolsColorComp', () => {
    test('hands its colour, label and handlers to a collapsable picker', async () => {
        const handleNoColoring = vi.fn();
        const handleColorChanging = vi.fn();
        await act(async () => {
            root.render(
                <SlideEditorToolsColorComp
                    color="#123456"
                    label="Background Color"
                    handleNoColoring={handleNoColoring}
                    handleColorChanging={handleColorChanging}
                />,
            );
        });

        expect(h.pickerProps).toMatchObject({
            color: '#123456',
            colorInputLabel: 'Background Color',
            defaultColor: '#ffffff',
            isCollapsable: true,
        });
        h.pickerProps.onColorChange('#abcdef');
        expect(handleColorChanging).toHaveBeenCalledWith('#abcdef');
        h.pickerProps.onNoColor();
        expect(handleNoColoring).toHaveBeenCalledOnce();
    });

    test('offers no "no colour" choice unless one is handled', async () => {
        await act(async () => {
            root.render(
                <SlideEditorToolsColorComp
                    color="#000000"
                    label="Text Color"
                    handleColorChanging={() => {}}
                />,
            );
        });

        expect(h.pickerProps.onNoColor).toBeUndefined();
    });
});
