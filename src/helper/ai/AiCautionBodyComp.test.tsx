// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import AiCautionBodyComp from './AiCautionBodyComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('AiCautionBodyComp', () => {
    test('shows the warning with the 30-day box unticked', async () => {
        const onHideChange = vi.fn();
        await act(async () =>
            root.render(
                <AiCautionBodyComp
                    text="An AI can be wrong."
                    onHideChange={onHideChange}
                />,
            ),
        );
        expect(host.querySelector('p')?.textContent).toBe(
            'An AI can be wrong.',
        );
        expect(host.querySelector('label')?.textContent).toBe(
            'Do not show this again for 30 days',
        );
        const checkbox = host.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        expect(checkbox.checked).toBe(false);
        expect(onHideChange).not.toHaveBeenCalled();
    });

    test('ticking and unticking the box says each choice', async () => {
        const onHideChange = vi.fn();
        await act(async () =>
            root.render(
                <AiCautionBodyComp
                    text="An AI can be wrong."
                    onHideChange={onHideChange}
                />,
            ),
        );
        const checkbox = host.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        await act(async () => checkbox.click());
        expect(checkbox.checked).toBe(true);
        expect(onHideChange).toHaveBeenLastCalledWith(true);

        await act(async () => checkbox.click());
        expect(checkbox.checked).toBe(false);
        expect(onHideChange).toHaveBeenLastCalledWith(false);
        expect(onHideChange).toHaveBeenCalledTimes(2);
    });
});
