// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../context-menu/AppContextMenuComp', () => ({
    default: () => <i data-host="context-menu" />,
}));
vi.mock('../popup-widget/HandleAlertComp', () => ({
    default: () => <i data-host="alerts" />,
}));
vi.mock('../toast/ToastComp', () => ({
    default: () => <i data-host="toast" />,
}));
vi.mock('../progress-bar/TopProgressBarComp', () => ({
    default: () => <i data-host="progress" />,
}));

import PopupLayoutComp from './PopupLayoutComp';

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

describe('PopupLayoutComp', () => {
    test('wraps the page and hosts the progress bar, toasts, menus and alerts', async () => {
        await act(async () =>
            root.render(
                <PopupLayoutComp>
                    <p className="page">Settings</p>
                </PopupLayoutComp>,
            ),
        );
        const wrapper = host.firstElementChild as HTMLElement;
        expect(wrapper.className).toBe('w-100 h-100 app-overflow-hidden');
        expect(wrapper.querySelector('.page')!.textContent).toBe('Settings');
        expect(
            Array.from(host.querySelectorAll('[data-host]')).map((element) =>
                element.getAttribute('data-host'),
            ),
        ).toEqual(['progress', 'toast', 'context-menu', 'alerts']);
    });
});
