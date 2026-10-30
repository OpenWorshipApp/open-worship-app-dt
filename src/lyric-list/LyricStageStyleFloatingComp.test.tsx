// @vitest-environment jsdom

import { act, createElement, Suspense, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The one widget host per previewer, over the REAL panel store. The widget,
// the theme and the (lazy) panel body are stand-ins; the body counts its own
// mounts, because a retarget MUST remount it (its `key`) or the new stage
// would show — and then write — the previous stage's values.
const h = vi.hoisted(() => ({
    widgetProps: null as any,
    bodyMounts: [] as number[],
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: any) =>
        createElement(Suspense, { fallback: null }, children),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        h.widgetProps = props;
        return createElement(
            'section',
            { className: 'widget' },
            createElement('h6', null, props.title),
            props.children,
        );
    },
}));
vi.mock('./LyricStageStyleComp', () => ({
    default: function BodyComp({
        stage,
        onChanged,
    }: {
        stage: number;
        onChanged: () => void;
    }) {
        useEffect(() => {
            h.bodyMounts.push(stage);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        return createElement(
            'button',
            { className: 'body', 'data-stage': stage, onClick: onChanged },
            'body',
        );
    },
}));

import LyricStageStyleFloatingComp from './LyricStageStyleFloatingComp';
import {
    genLyricStageStyleFloatingOwnerId,
    toggleLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';

let container: HTMLDivElement;
let root: Root;
let ownerId: string;
const onChanged = vi.fn();

async function settle(callback: () => void = () => {}) {
    await act(async () => {
        callback();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

function getPortal() {
    return document.body.querySelector<HTMLElement>(
        '.app-floating-widget-portal',
    );
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.widgetProps = null;
    h.bodyMounts = [];
    ownerId = genLyricStageStyleFloatingOwnerId();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root.render(
            createElement(LyricStageStyleFloatingComp, { ownerId, onChanged }),
        );
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('LyricStageStyleFloatingComp', () => {
    test('renders nothing until its own gear opens a stage', async () => {
        expect(getPortal()).toBeNull();
        // Another previewer's panel is not this host's to draw.
        const otherOwnerId = genLyricStageStyleFloatingOwnerId();
        await settle(() => {
            toggleLyricStageStyleFloatingStage(otherOwnerId, 1);
        });
        expect(getPortal()).toBeNull();
        await settle(() => {
            toggleLyricStageStyleFloatingStage(otherOwnerId, 1);
        });
    });

    test('opens on the body, themed and titled with its stage', async () => {
        await settle(() => {
            toggleLyricStageStyleFloatingStage(ownerId, 2);
        });
        const portal = getPortal()!;
        // Portaled out of the previewer card, so it cannot be clipped.
        expect(container.contains(portal)).toBe(false);
        expect(portal.getAttribute('data-bs-theme')).toBe('dark');
        expect(portal.querySelector('h6')!.textContent).toBe(
            'Stage Style · Stage 2',
        );
        expect(h.widgetProps.persistKey).toBe(
            'floating-widget-rect-lyric-stage-style',
        );
        const body = portal.querySelector<HTMLButtonElement>('.body')!;
        expect(body.getAttribute('data-stage')).toBe('2');
        body.click();
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    test('retargeting remounts the body for the new stage', async () => {
        await settle(() => {
            toggleLyricStageStyleFloatingStage(ownerId, 2);
        });
        await settle(() => {
            toggleLyricStageStyleFloatingStage(ownerId, 0);
        });
        expect(
            getPortal()!.querySelector('.body')!.getAttribute('data-stage'),
        ).toBe('0');
        expect(h.bodyMounts).toEqual([2, 0]);
    });

    test('its close button closes the panel', async () => {
        await settle(() => {
            toggleLyricStageStyleFloatingStage(ownerId, 1);
        });
        await settle(() => {
            h.widgetProps.onClose();
        });
        expect(getPortal()).toBeNull();
    });
});
