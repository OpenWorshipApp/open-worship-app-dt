// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import RenderPaginationComp from './RenderPaginationComp';

let host: HTMLDivElement;
let root: Root;
let setPage: Mock<(page: number) => void>;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    setPage = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function renderPagination(safePage: number, totalPages = 12) {
    await act(async () =>
        root.render(
            <RenderPaginationComp
                safePage={safePage}
                totalPages={totalPages}
                totalRecords={230}
                setPage={setPage}
            />,
        ),
    );
}

function getInput() {
    return host.querySelector<HTMLInputElement>('input')!;
}

function getButton(label: string) {
    return host.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )!;
}

async function typeInto(value: string) {
    const input = getInput();
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function pressKey(key: string) {
    const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
    });
    await act(async () => {
        getInput().dispatchEvent(event);
    });
    return event;
}

describe('RenderPaginationComp', () => {
    test('shows the page, the page count and the record count', async () => {
        await renderPagination(3);
        expect(getInput().value).toBe('3');
        // Wide enough for the longest page number, plus room.
        expect(getInput().style.width).toBe('5ch');
        expect(host.querySelector('span')!.textContent).toBe('/ 12 · 230');
    });

    test('the arrows step one page and stop at either end', async () => {
        await renderPagination(1);
        expect(getButton('Previous').disabled).toBe(true);
        expect(getButton('Next').disabled).toBe(false);
        await act(async () => getButton('Next').click());
        expect(setPage).toHaveBeenLastCalledWith(2);

        await renderPagination(12);
        expect(getButton('Next').disabled).toBe(true);
        await act(async () => getButton('Previous').click());
        expect(setPage).toHaveBeenLastCalledWith(11);
    });

    test('only digits can be typed', async () => {
        await renderPagination(3);
        await typeInto('1a2-');
        expect(getInput().value).toBe('12');
        expect(setPage).not.toHaveBeenCalled();
    });

    test('Enter jumps once, clamped to the pages there are', async () => {
        await renderPagination(3);
        await act(async () => getInput().focus());
        await typeInto('99');
        const event = await pressKey('Enter');
        expect(event.defaultPrevented).toBe(true);
        // The blur Enter causes does not commit a second time.
        expect(setPage).toHaveBeenCalledExactlyOnceWith(12);
        expect(document.activeElement).not.toBe(getInput());

        await act(async () => getInput().focus());
        await typeInto('0');
        await pressKey('Enter');
        expect(setPage).toHaveBeenLastCalledWith(1);
        expect(setPage).toHaveBeenCalledTimes(2);
    });

    test('Escape throws the draft away', async () => {
        await renderPagination(4);
        await act(async () => getInput().focus());
        await typeInto('9');
        await pressKey('Escape');
        expect(getInput().value).toBe('4');
        expect(setPage).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(getInput());
    });

    test('leaving the field commits what was typed', async () => {
        await renderPagination(4);
        await act(async () => getInput().focus());
        await typeInto('7');
        await act(async () => getInput().blur());
        expect(setPage).toHaveBeenCalledExactlyOnceWith(7);
    });

    test('leaving an empty field puts the page back', async () => {
        await renderPagination(4);
        await act(async () => getInput().focus());
        await typeInto('');
        expect(getInput().value).toBe('');
        await act(async () => getInput().blur());
        expect(setPage).not.toHaveBeenCalled();
        expect(getInput().value).toBe('4');
    });

    test('other keys leave the draft alone', async () => {
        await renderPagination(4);
        await typeInto('5');
        const event = await pressKey('ArrowUp');
        expect(event.defaultPrevented).toBe(false);
        expect(getInput().value).toBe('5');
        expect(setPage).not.toHaveBeenCalled();
    });

    test('focusing selects the number, ready to be replaced', async () => {
        await renderPagination(10);
        await act(async () => getInput().focus());
        expect(getInput().selectionStart).toBe(0);
        expect(getInput().selectionEnd).toBe(2);
    });

    test('a page changed from outside is mirrored into the field', async () => {
        await renderPagination(4);
        await typeInto('8');
        await renderPagination(6);
        expect(getInput().value).toBe('6');
    });
});
