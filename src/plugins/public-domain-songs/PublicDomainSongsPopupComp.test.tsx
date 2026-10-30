// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
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
vi.mock('./PublicDomainSongsPanelComp', () => ({
    default: ({ dirPath }: { dirPath: string }) => (
        <p className="panel">{dirPath}</p>
    ),
}));

import PublicDomainSongsPopupComp from './PublicDomainSongsPopupComp';

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

describe('Public Domain Songs popup', () => {
    test('floats over the page in the app theme and loads the panel for the folder only when opened', async () => {
        const onClose = vi.fn();

        await act(async () => {
            root.render(
                <PublicDomainSongsPopupComp
                    dirPath="/data/Documents"
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
        // Portalled to the body, not drawn inside the caller's tree.
        expect(host.contains(portal)).toBe(false);
        expect(portal.getAttribute('data-bs-theme')).toBe('dark');
        expect(portal.querySelector('h2')?.textContent).toBe(
            'Import From Public Domain Songs',
        );
        expect(
            portal.querySelector('section')?.getAttribute('data-persist-key'),
        ).toBe('floating-widget-rect-public-domain-songs-import');
        expect(portal.querySelector('.panel')?.textContent).toBe(
            '/data/Documents',
        );

        act(() => {
            portal.querySelector<HTMLButtonElement>('button')!.click();
        });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
