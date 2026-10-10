// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    collapsedMap: new Map<string, boolean>(),
    saveMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('./settingSectionFoldHelpers', () => ({
    getIsSettingSectionCollapsed: (foldName: string) => {
        return h.collapsedMap.get(foldName) ?? false;
    },
    saveIsSettingSectionCollapsed: (foldName: string, isCollapsed: boolean) => {
        h.collapsedMap.set(foldName, isCollapsed);
        h.saveMock(foldName, isCollapsed);
    },
}));

import SettingOthersSectionComp from './SettingOthersSectionComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function renderSection(
    props: { openToken?: number; onCollapse?: () => void } = {},
) {
    await act(async () => {
        root ??= createRoot(container);
        root.render(
            <SettingOthersSectionComp
                foldName="ai"
                iconClassName="bi-robot"
                title="AI Providers"
                description="Add a key"
                state="ready"
                stateLabel="Key set"
                headerActions={<button type="button">Refresh</button>}
                {...props}
            >
                <input id="inside" />
            </SettingOthersSectionComp>,
        );
    });
}

function getFoldButton() {
    return container.querySelector(
        'h2 button[aria-expanded]',
    ) as HTMLButtonElement;
}

function checkIsBodyMounted() {
    return container.querySelector('#inside') !== null;
}

describe('SettingOthersSectionComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.collapsedMap.clear();
        h.saveMock.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('is open until it is folded, and the heading is what folds it', async () => {
        await renderSection();

        const button = getFoldButton();
        expect(button.textContent).toBe('AI Providers');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.title).toBe('Collapse');
        expect(checkIsBodyMounted()).toBe(true);
        expect(container.textContent).toContain('Add a key');
        // Nothing is written by merely being shown.
        expect(h.saveMock).not.toHaveBeenCalled();
    });

    test('folded, only the header row is left and nothing inside is mounted', async () => {
        await renderSection();

        await act(async () => getFoldButton().click());

        expect(getFoldButton().getAttribute('aria-expanded')).toBe('false');
        expect(getFoldButton().title).toBe('Expand');
        expect(checkIsBodyMounted()).toBe(false);
        expect(container.textContent).not.toContain('Add a key');
        // What says "is it wired up?" and what changes that both stay.
        expect(container.textContent).toContain('AI Providers');
        expect(container.textContent).toContain('Key set');
        expect(container.textContent).toContain('Refresh');
        expect(h.saveMock).toHaveBeenCalledWith('ai', true);

        await act(async () => getFoldButton().click());

        expect(checkIsBodyMounted()).toBe(true);
        expect(h.saveMock).toHaveBeenLastCalledWith('ai', false);
    });

    test('opens the way it was left', async () => {
        h.collapsedMap.set('ai', true);

        await renderSection();

        expect(getFoldButton().getAttribute('aria-expanded')).toBe('false');
        expect(checkIsBodyMounted()).toBe(false);
    });

    // Another window sent the user to something inside: a folded header is
    // nowhere to be sent.
    test('a new open token opens a folded section and remembers it open', async () => {
        h.collapsedMap.set('ai', true);
        await renderSection();
        expect(checkIsBodyMounted()).toBe(false);

        await renderSection({ openToken: 1 });

        expect(checkIsBodyMounted()).toBe(true);
        expect(h.saveMock).toHaveBeenCalledWith('ai', false);

        // Folded again by hand, the SAME token must not open it back.
        await act(async () => getFoldButton().click());
        await renderSection({ openToken: 1 });
        expect(checkIsBodyMounted()).toBe(false);

        await renderSection({ openToken: 2 });
        expect(checkIsBodyMounted()).toBe(true);
    });

    test('an open token writes nothing for a section already open', async () => {
        await renderSection({ openToken: 1 });

        expect(checkIsBodyMounted()).toBe(true);
        expect(h.saveMock).not.toHaveBeenCalled();
    });

    test('tells its caller about a fold by hand, never about an opening', async () => {
        const onCollapse = vi.fn();
        await renderSection({ onCollapse });

        await act(async () => getFoldButton().click());
        expect(onCollapse).toHaveBeenCalledTimes(1);

        await act(async () => getFoldButton().click());
        expect(onCollapse).toHaveBeenCalledTimes(1);
    });
});
