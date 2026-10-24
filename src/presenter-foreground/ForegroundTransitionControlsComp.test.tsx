// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    component: undefined as string | undefined,
    session: undefined as string | undefined,
    listeners: [] as (() => void)[],
    dialog: vi.fn(),
    setComponent: vi.fn(),
    setSession: vi.fn(),
    commonEffect: 'fade',
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../event/EventHandler', () => ({
    default: {
        registerEventListener: (_names: string[], listener: () => void) => {
            h.listeners.push(listener);
            return ['registered'];
        },
        unregisterEventListener: vi.fn(),
    },
}));
vi.mock('../_screen/managers/ScreenEffectManager', () => ({
    default: { getCommonEffectType: () => h.commonEffect },
    SCREEN_EFFECT_CHANGED_EVENT: 'screen-effect-changed',
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    FOREGROUND_TRANSITION_CHANGED_EVENT: 'foreground-transition-changed',
    getForegroundComponentTransition: () => h.component,
    getForegroundSessionTransition: () => h.session,
    setForegroundComponentTransition: h.setComponent,
    setForegroundSessionTransition: h.setSession,
}));
vi.mock('../others/TransitionOverrideComp', () => ({
    default: ({
        value,
        inherited,
        onChange,
    }: {
        value?: string;
        inherited: { effect: string };
        onChange: (value: string | undefined) => void;
    }) => (
        <div data-own={value ?? ''} data-inherited={inherited.effect}>
            <button type="button" onClick={() => onChange('wipe')}>
                Set session wipe
            </button>
            <button type="button" onClick={() => onChange(undefined)}>
                Inherit session
            </button>
        </div>
    ),
    getTransitionIconName: (effect: string) => effect,
    showTransitionOverrideDialog: h.dialog,
    toTransitionLabel: (effect: string) => effect,
}));
vi.mock('./ForegroundPropRowComp', () => ({
    default: ({
        title,
        children,
    }: {
        title?: string;
        children: React.ReactNode;
    }) => <div data-row-title={title ?? ''}>{children}</div>,
}));

import {
    ForegroundComponentTransitionButtonComp,
    ForegroundTransitionPropComp,
    genForegroundComponentInherited,
    genForegroundSessionInherited,
} from './ForegroundTransitionControlsComp';

describe('foreground transition controls', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function click(label: string) {
        const button = [...container.querySelectorAll('button')].find((item) =>
            item.textContent?.includes(label),
        );
        if (!button) throw new Error(`Missing button: ${label}`);
        await act(async () => button.click());
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.component = undefined;
        h.session = undefined;
        h.listeners.length = 0;
        h.dialog.mockReset();
        h.setComponent.mockClear();
        h.setSession.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('marquee inherits motion while other widgets inherit the screen', () => {
        expect(genForegroundComponentInherited('marquee-top')).toEqual({
            effect: 'move',
            sourceLabel: 'Marquee default',
        });
        expect(genForegroundComponentInherited('message')).toEqual({
            effect: 'fade',
            sourceLabel: 'Screen setting',
        });
        h.component = 'wipe';
        expect(genForegroundSessionInherited('message')).toEqual({
            effect: 'wipe',
            sourceLabel: 'All sessions',
        });
    });

    test('session row writes an override and can restore inheritance', async () => {
        await act(async () =>
            root.render(
                <ForegroundTransitionPropComp
                    prefix="message-1"
                    widgetKey="message"
                />,
            ),
        );
        expect(
            container
                .querySelector('[data-inherited]')
                ?.getAttribute('data-inherited'),
        ).toBe('fade');
        expect(
            container
                .querySelector('[data-row-title]')
                ?.getAttribute('data-row-title'),
        ).toBe('Follows: Screen setting');
        await click('Set session wipe');
        expect(h.setSession).toHaveBeenLastCalledWith('message-1', 'wipe');
        await click('Inherit session');
        expect(h.setSession).toHaveBeenLastCalledWith('message-1', undefined);
        h.session = 'wipe';
        await act(async () => h.listeners.forEach((listener) => listener()));
        expect(
            container.querySelector('[data-own]')?.getAttribute('data-own'),
        ).toBe('wipe');
    });

    test('component button shows inheritance and saves a dialog choice', async () => {
        h.dialog
            .mockResolvedValueOnce({ value: 'wipe' })
            .mockResolvedValueOnce(null);
        await act(async () =>
            root.render(
                <ForegroundComponentTransitionButtonComp
                    widgetKey="message"
                    widgetLabel="Message"
                />,
            ),
        );
        const button = container.querySelector<HTMLButtonElement>('button')!;
        expect(button.title).toContain('fade (Screen setting)');
        await act(async () => button.click());
        expect(h.dialog).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Transition for all sessions: Message',
                inherited: { effect: 'fade', sourceLabel: 'Screen setting' },
            }),
        );
        expect(h.setComponent).toHaveBeenLastCalledWith('message', 'wipe');
        await act(async () => button.click());
        expect(h.setComponent).toHaveBeenCalledTimes(1);
        h.component = 'wipe';
        await act(async () => h.listeners.forEach((listener) => listener()));
        expect(button.title).toContain('wipe');
    });
});
