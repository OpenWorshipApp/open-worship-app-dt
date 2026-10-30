// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    cameras: [] as { deviceId: string; label: string }[],
    setProps: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./SlideEditorToolTitleComp', () => ({
    default: ({ title, children }: { title: string; children: ReactNode }) => (
        <section data-title={title}>{children}</section>
    ),
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));

vi.mock('../../../helper/cameraHelpers', () => ({
    useCameraInfoList: () => h.cameras,
}));

// `canvasHelpers` stays real for its object-fit list; only the file helpers it
// reaches for media checks are cut off.
vi.mock('../../../server/fileHelpers', () => ({
    isSupportedExt: () => false,
    isSupportedMimetype: () => false,
}));

import SlideEditorToolsCameraComp from './SlideEditorToolsCameraComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<SlideEditorToolsCameraComp />));
}

function select() {
    return container.querySelector('select')!;
}

async function chooseDevice(value: string) {
    await act(async () => {
        select().value = value;
        select().dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function optionTexts() {
    return Array.from(select().options).map((option) => option.textContent);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.cameras = [
        { deviceId: 'cam-a', label: 'Front camera' },
        { deviceId: 'cam-b', label: '' },
    ];
    h.props = {
        deviceId: 'cam-a',
        label: 'Front camera',
        isMirrored: false,
        objectFit: 'cover',
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorToolsCameraComp', () => {
    test('lists the cameras of this machine with the stored one chosen', async () => {
        await render();

        expect(
            Array.from(container.querySelectorAll('section')).map(
                (section) => section.dataset.title,
            ),
        ).toEqual(['Camera Device', 'Mirror', 'Object Fit']);
        // An unnamed camera is numbered by its place in the list.
        expect(optionTexts()).toEqual(['Front camera', 'Camera 2']);
        expect(select().value).toBe('cam-a');
    });

    test('names a stored camera that is not plugged in instead of picking another', async () => {
        h.props = { ...h.props, deviceId: 'cam-gone', label: 'Old webcam' };
        await render();

        expect(select().value).toBe('__missing__');
        const missing = select().options[0];
        expect(missing.textContent).toBe('Old webcam (Camera not found)');
        expect(missing.disabled).toBe(true);
        // Opening the panel must not rewrite the item to another camera.
        expect(h.setProps).not.toHaveBeenCalled();
    });

    test('a missing camera without a label is named by its id', async () => {
        h.props = { ...h.props, deviceId: 'cam-gone', label: '' };
        await render();

        expect(select().options[0].textContent).toBe(
            'cam-gone (Camera not found)',
        );
    });

    test('choosing a camera stores its id together with its label', async () => {
        await render();

        await chooseDevice('cam-b');

        expect(h.setProps).toHaveBeenCalledExactlyOnceWith({
            deviceId: 'cam-b',
            label: '',
        });
    });

    test('a choice that matches no camera stores nothing', async () => {
        h.props = { ...h.props, deviceId: 'cam-gone' };
        await render();

        await chooseDevice('__missing__');

        expect(h.setProps).not.toHaveBeenCalled();
    });

    test('the mirror switch stores the mirrored flag', async () => {
        await render();
        const checkbox = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        expect(checkbox.checked).toBe(false);

        await act(async () => checkbox.click());

        expect(h.setProps).toHaveBeenCalledWith({ isMirrored: true });
    });

    test('marks the current object fit and stores a new one', async () => {
        h.props = { ...h.props, objectFit: 'contain' };
        await render();
        const buttons = Array.from(container.querySelectorAll('button'));

        expect(buttons.map((button) => button.textContent)).toEqual([
            'Cover',
            'Contain',
            'Fill',
        ]);
        expect(
            buttons.map((button) => button.classList.contains('btn-info')),
        ).toEqual([false, true, false]);

        await act(async () => buttons[2].click());
        expect(h.setProps).toHaveBeenCalledWith({ objectFit: 'fill' });
    });
});
