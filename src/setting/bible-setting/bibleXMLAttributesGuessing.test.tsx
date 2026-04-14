// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getLangCodeMock } = vi.hoisted(() => ({
    getLangCodeMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    getLangCode: getLangCodeMock,
    tran: (text: string) => text,
}));

import {
    genBibleKeyXMLInput,
    genBibleNumbersMapXMLInput,
    xmlFormatExample,
} from './bibleXMLAttributesGuessing';

function changeInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('bibleXMLAttributesGuessing', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        getLangCodeMock.mockReturnValue('km');
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

    test('renders bible key input, filters guessing keys, and reports duplicate keys', async () => {
        const onChange = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                genBibleKeyXMLInput(
                    'ABC',
                    onChange,
                    ['kjv', 'web'],
                    ['KJV', 'ESV', 'ABC'],
                ),
            );
        });

        const input = container?.querySelector<HTMLInputElement>('input');
        const buttons = Array.from(container?.querySelectorAll('button') ?? []);

        expect(container?.textContent).toContain('Define a Bible key');
        expect(buttons.map((button) => button.textContent?.trim())).toEqual([
            'ESV',
        ]);

        await act(async () => {
            buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(onChange).toHaveBeenLastCalledWith('ESV');
        expect(input?.value).toBe('ESV');

        await act(async () => {
            if (!input) {
                throw new Error('Missing input');
            }
            changeInputValue(input, 'KJV');
        });

        expect(onChange).toHaveBeenLastCalledWith('KJV');
        expect(input?.className).toContain('is-invalid');
        expect(container?.querySelector('.input-group')?.getAttribute('title')).toBe(
            'Key is already taken',
        );
    });

    test('renders bible numbers map input with locale-aware link and validation', async () => {
        const onChange = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                genBibleNumbersMapXMLInput(
                    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
                    'km-KH' as any,
                    onChange,
                ),
            );
        });

        const input = container?.querySelector<HTMLInputElement>('input');
        const link = container?.querySelector<HTMLAnchorElement>('a');

        expect(input?.value).toBe('0 1 2 3 4 5 6 7 8 9');
        expect(link?.href).toContain('tl=km');
        expect(container?.querySelector('.input-group')?.getAttribute('title')).toBe(
            '',
        );

        await act(async () => {
            if (!input) {
                throw new Error('Missing input');
            }
            changeInputValue(input, '០ ១ ២');
        });

        expect(onChange).toHaveBeenLastCalledWith(['០', '១', '២']);
        expect(input?.className).toContain('is-invalid');
        expect(container?.querySelector('.input-group')?.getAttribute('title')).toBe(
            'Must have 10 numbers',
        );

        getLangCodeMock.mockReturnValueOnce(null);

        await act(async () => {
            root?.render(
                genBibleNumbersMapXMLInput(
                    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
                    'unknown-locale' as any,
                    onChange,
                ),
            );
        });

        expect(container?.querySelector<HTMLAnchorElement>('a')?.href).toContain(
            'tl=en',
        );
        expect(xmlFormatExample).toContain('<bible');
        expect(xmlFormatExample).toContain('<custom-verses-map>');
    });
});
