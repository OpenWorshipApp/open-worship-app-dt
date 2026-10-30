// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import FileReadErrorComp from './FileReadErrorComp';

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

function getButton(text: string) {
    return Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === text,
    );
}

function rightClick(element: Element) {
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
    });
    element.dispatchEvent(event);
    return event;
}

describe('FileReadErrorComp', () => {
    test('names the unreadable file and offers to reload or trash it', async () => {
        const trash = vi.fn();
        const reload = vi.fn();
        const fileSource = { fullName: 'Amazing Grace.ows', trash } as any;
        await act(async () =>
            root.render(
                <FileReadErrorComp fileSource={fileSource} reload={reload} />,
            ),
        );
        expect(host.querySelector('.alert')!.textContent).toBe(
            'Fail to read file data: Amazing Grace.ows',
        );
        await act(async () => getButton('Reload')!.click());
        expect(reload).toHaveBeenCalledOnce();
        await act(async () => getButton('Move to Trash')!.click());
        // Trash asks first: a read error is no reason to lose the file.
        expect(trash).toHaveBeenCalledExactlyOnceWith('ask');
    });

    test('with nothing to act on, it only reports the failure', async () => {
        await act(async () => root.render(<FileReadErrorComp />));
        expect(host.querySelector('.alert')!.textContent).toBe(
            'Fail to read file data',
        );
        expect(host.querySelectorAll('button')).toHaveLength(0);
    });

    test('a context menu is reachable from a right-click and from the dots', async () => {
        const onContextMenu = vi.fn();
        await act(async () =>
            root.render(<FileReadErrorComp onContextMenu={onContextMenu} />),
        );
        await act(async () => {
            rightClick(host.querySelector('.card')!);
        });
        expect(onContextMenu).toHaveBeenCalledOnce();
        const dots = host.querySelector<HTMLButtonElement>('button')!;
        expect(dots.getAttribute('aria-label')).toBe('More Options');
        await act(async () => dots.click());
        expect(onContextMenu).toHaveBeenCalledTimes(2);
    });
});
