// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settingName: '',
    storedTab: null as string | null,
    viewController: null as any,
    setBibleSearchingTabType: vi.fn(),
}));

vi.mock('../others/TabRenderComp', async () => {
    const { Suspense } = await import('react');
    return {
        genTabBody: (selected: string, [type, Target]: [string, any]) => (
            <Suspense key={`tab-${type}`} fallback={null}>
                {selected === type ? <Target /> : null}
            </Suspense>
        ),
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (settingName: string, defaultValue: string) => {
            h.settingName = settingName;
            return useState(h.storedTab ?? defaultValue);
        },
    };
});
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => h.viewController,
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: () => <div className="scrolling-handler" />,
}));
vi.mock('../others/labelIconHelpers', () => ({
    genLabelIcon: (labelKey: string, className: string) => (
        <i className={`label-icon ${className}`} data-label={labelKey} />
    ),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./bibleFindHelpers', () => ({
    BIBLE_SEARCH_SETTING_NAME: 'bible-search-tab',
    setBibleSearchingTabType: h.setBibleSearchingTabType,
}));
vi.mock('./BibleFindBodyPreviewerComp', () => ({
    default: () => <div className="tab-body">Find body</div>,
}));
vi.mock('./BibleCrossReferencePreviewerComp', () => ({
    default: () => <div className="tab-body">Cross reference body</div>,
}));
vi.mock('./BibleLocationNamePreviewerComp', () => ({
    default: () => <div className="tab-body">Location body</div>,
}));
vi.mock('../resources/ResourcesPreviewerComp', () => ({
    default: () => <div className="tab-body">Resources body</div>,
}));

import BibleFindPreviewerComp from './BibleFindPreviewerComp';

let host: HTMLDivElement;
let root: Root;

async function renderPreviewer() {
    await act(async () => {
        root.render(<BibleFindPreviewerComp />);
    });
}

function getSelect() {
    return host.querySelector<HTMLSelectElement>('select')!;
}

async function waitForBody(text: string) {
    await vi.waitFor(() => {
        expect(host.querySelector('.tab-body')?.textContent).toBe(text);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.storedTab = null;
    h.settingName = '';
    h.viewController = { openBibleSearch: null };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the Bible Online Lookup panel', () => {
    test('opens on Find, remembered under its own setting', async () => {
        await renderPreviewer();
        expect(h.settingName).toBe('bible-search-tab');
        const select = getSelect();
        expect(select.value).toBe('s');
        expect(select.title).toBe('Find');
        expect(select.getAttribute('aria-label')).toBe('Bible Online Lookup');
        expect([...select.options].map((option) => option.text)).toEqual([
            'Find',
            'Cross Reference',
            'Location-Name (KJV)',
            'Resources',
        ]);
        expect(
            host.querySelector<HTMLElement>('.label-icon')!.dataset.label,
        ).toBe('Find');
        await waitForBody('Find body');
        expect(host.querySelectorAll('.tab-body')).toHaveLength(1);
        expect(host.querySelector('.scrolling-handler')).not.toBeNull();
    });

    test('the picker switches the tab, its icon and its title', async () => {
        await renderPreviewer();
        await act(async () => {
            getSelect().value = 'c';
            getSelect().dispatchEvent(new Event('change', { bubbles: true }));
        });
        await waitForBody('Cross reference body');
        expect(getSelect().title).toBe('Cross Reference');
        expect(
            host.querySelector<HTMLElement>('.label-icon')!.dataset.label,
        ).toBe('Cross Reference');
    });

    test('the reader can open a tab by name while the panel is up, and gets its default back after', async () => {
        await renderPreviewer();
        expect(h.viewController.openBibleSearch).toBeTypeOf('function');
        await act(async () => h.viewController.openBibleSearch('r'));
        await waitForBody('Resources body');
        expect(getSelect().value).toBe('r');
        await act(async () => h.viewController.openBibleSearch('l'));
        await waitForBody('Location body');

        await act(async () => root.unmount());
        expect(h.viewController.openBibleSearch).toBe(
            h.setBibleSearchingTabType,
        );
        root = createRoot(host);
    });

    test('a stored tab that no longer exists is labelled Find', async () => {
        h.storedTab = 'x';
        await renderPreviewer();
        expect(getSelect().title).toBe('Find');
        expect(
            host.querySelector<HTMLElement>('.label-icon')!.dataset.label,
        ).toBe('Find');
        expect(host.querySelector('.tab-body')).toBeNull();
    });
});
