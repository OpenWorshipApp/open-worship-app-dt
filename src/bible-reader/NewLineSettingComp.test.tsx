// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    viewController: { shouldNewLine: false, shouldModelNewLine: false },
}));

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => h.viewController,
}));

import NewLineSettingComp from './NewLineSettingComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.viewController.shouldNewLine = false;
    h.viewController.shouldModelNewLine = false;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<NewLineSettingComp />);
    });
    return {
        newLine: host.querySelector<HTMLInputElement>('#new-line-setting')!,
        modelNewLine: host.querySelector<HTMLInputElement>(
            '#use-model-new-line-setting',
        )!,
    };
}

function getModelLabel() {
    return host.querySelector<HTMLLabelElement>(
        'label[for="use-model-new-line-setting"]',
    )!;
}

describe('NewLineSettingComp', () => {
    test('starts from what the controller holds', async () => {
        h.viewController.shouldNewLine = true;
        h.viewController.shouldModelNewLine = true;
        const { newLine, modelNewLine } = await render();
        expect(newLine.checked).toBe(true);
        expect(newLine.getAttribute('aria-label')).toBe('Should New Lines');
        expect(modelNewLine.checked).toBe(true);
        expect(modelNewLine.disabled).toBe(false);
        expect(getModelLabel().style.opacity).toBe('1');
        expect(
            host
                .querySelector('label[for="new-line-setting"]')!
                .getAttribute('title'),
        ).toBe('Should New Lines — Break lines following bible info');
    });

    test("the model's line breaks wait on new lines being on", async () => {
        const { newLine, modelNewLine } = await render();
        expect(newLine.checked).toBe(false);
        expect(modelNewLine.disabled).toBe(true);
        expect(getModelLabel().style.opacity).toBe('0.5');

        await act(async () => {
            newLine.click();
        });
        expect(h.viewController.shouldNewLine).toBe(true);
        expect(newLine.checked).toBe(true);
        expect(modelNewLine.disabled).toBe(false);
        expect(getModelLabel().style.opacity).toBe('1');
    });

    test("turning the model's line breaks on and off reaches the controller", async () => {
        h.viewController.shouldNewLine = true;
        const { newLine, modelNewLine } = await render();
        await act(async () => {
            modelNewLine.click();
        });
        expect(h.viewController.shouldModelNewLine).toBe(true);
        expect(modelNewLine.checked).toBe(true);
        await act(async () => {
            modelNewLine.click();
        });
        expect(h.viewController.shouldModelNewLine).toBe(false);

        await act(async () => {
            newLine.click();
        });
        expect(h.viewController.shouldNewLine).toBe(false);
        expect(modelNewLine.disabled).toBe(true);
    });
});
