// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => `[${key}]`,
}));

import AiCautionBodyComp from './AiCautionBodyComp';

let container: HTMLDivElement;
let root: Root;
const onHideChange = vi.fn();

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('AiCautionBodyComp', () => {
    test('shows the warning above an unticked box in the app language', async () => {
        await act(async () => {
            root.render(
                <AiCautionBodyComp
                    text="AI can be confidently wrong."
                    onHideChange={onHideChange}
                />,
            );
        });
        expect(container.querySelector('p')!.textContent).toBe(
            'AI can be confidently wrong.',
        );
        const checkbox = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        expect(checkbox.checked).toBe(false);
        expect(container.querySelector('label span')!.textContent).toBe(
            '[Do not show this again for 30 days]',
        );
        expect(onHideChange).not.toHaveBeenCalled();
    });

    test('ticking and unticking the box says so each time', async () => {
        await act(async () => {
            root.render(
                <AiCautionBodyComp
                    text="Careful"
                    onHideChange={onHideChange}
                />,
            );
        });
        const checkbox = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        act(() => {
            checkbox.click();
        });
        expect(checkbox.checked).toBe(true);
        expect(onHideChange).toHaveBeenLastCalledWith(true);

        act(() => {
            checkbox.click();
        });
        expect(checkbox.checked).toBe(false);
        expect(onHideChange).toHaveBeenLastCalledWith(false);
        expect(onHideChange).toHaveBeenCalledTimes(2);
    });
});
