// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('../../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        persistKey,
        onClose,
        children,
    }: {
        title: string;
        persistKey: string;
        onClose: () => void;
        children: ReactNode;
    }) => (
        <section data-persist-key={persistKey}>
            <h2>{title}</h2>
            <button type="button" onClick={onClose}>
                close
            </button>
            {children}
        </section>
    ),
}));
vi.mock('./SongSelectSearchPanelComp', () => ({
    default: ({ dirPath }: { dirPath: string }) => (
        <p className="panel">{dirPath}</p>
    ),
}));

import SongSelectSearchPopupComp from './SongSelectSearchPopupComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('SongSelect search popup', () => {
    test('floats over the page in the app theme and loads the search panel for the folder only when opened', async () => {
        const onClose = vi.fn();

        await act(async () => {
            root.render(
                <SongSelectSearchPopupComp
                    dirPath="/data/Lyrics"
                    onClose={onClose}
                />,
            );
        });
        await vi.waitFor(() => {
            expect(document.body.querySelector('.panel')).not.toBeNull();
        });

        const portal = document.body.querySelector(
            '.app-floating-widget-portal',
        )!;
        expect(host.contains(portal)).toBe(false);
        expect(portal.getAttribute('data-bs-theme')).toBe('light');
        expect(portal.querySelector('h2')?.textContent).toBe(
            'Import From SongSelect',
        );
        expect(
            portal.querySelector('section')?.getAttribute('data-persist-key'),
        ).toBe('floating-widget-rect-song-select-import');
        expect(portal.querySelector('.panel')?.textContent).toBe(
            '/data/Lyrics',
        );

        act(() => {
            portal.querySelector<HTMLButtonElement>('button')!.click();
        });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
