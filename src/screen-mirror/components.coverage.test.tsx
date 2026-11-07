// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MirrorIntercomState } from '../../electron/screenMirrorProtocol';

// The Screen Mirror folder's small components on one mock surface: the
// floating Virtual Screens Manager (its two tabs and the lazy panel in view)
// and one connection's intercom controls.
const h = vi.hoisted(() => ({
    showing: false,
    tab: 'mirror' as 'mirror' | 'virtual',
    setShowing: vi.fn(),
    setTab: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('./mirrorConnectionHelpers', () => ({
    useMirrorPanelShowing: () => h.showing,
    useMirrorPanelTab: () => h.tab,
    setMirrorPanelShowing: h.setShowing,
    setMirrorPanelTab: h.setTab,
}));
// The widget frame stood in for: what the panel hands it, and its close.
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        children,
        title,
        widgetName,
        persistKey,
        options,
        onClose,
    }: {
        children: ReactNode;
        title: string;
        widgetName: string;
        persistKey: string;
        options: { width: number; height: number };
        onClose: () => void;
    }) => (
        <section
            data-testid="floating-widget"
            data-widget-name={widgetName}
            data-persist-key={persistKey}
            data-size={`${options.width}x${options.height}`}
        >
            <h1>{title}</h1>
            <button type="button" onClick={onClose}>
                Close widget
            </button>
            {children}
        </section>
    ),
}));
vi.mock('./ScreenMirrorConnectionComp', () => ({
    default: () => <p>Screen Mirror connection panel</p>,
}));
vi.mock('../virtual-display/VirtualDisplaysComp', () => ({
    default: () => <p>Virtual displays panel</p>,
}));

import ScreenMirrorFloatingComp from './ScreenMirrorFloatingComp';
import MirrorIntercomComp from './MirrorIntercomComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.showing = false;
    h.tab = 'mirror';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

// A lazy panel arrives a few turns of the event loop after the render.
async function settle() {
    for (let index = 0; index < 5; index++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

function buttonByText(text: string) {
    const found = [...document.body.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === text,
    );
    if (found === undefined) {
        throw new Error(`Button not found: ${text}`);
    }
    return found;
}

describe('ScreenMirrorFloatingComp', () => {
    test('draws nothing while the panel is closed', async () => {
        await act(async () => root.render(<ScreenMirrorFloatingComp />));
        expect(container.innerHTML).toBe('');
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();
    });

    test('opens over the page on the Screen Mirror tab, in the app theme', async () => {
        h.showing = true;
        await act(async () => root.render(<ScreenMirrorFloatingComp />));
        await settle();
        // Portalled to the body, not drawn where the component sits.
        expect(container.innerHTML).toBe('');
        const portal = document.body.querySelector<HTMLElement>(
            ':scope > .app-floating-widget-portal',
        )!;
        expect(portal.dataset.bsTheme).toBe('dark');
        const widget = portal.querySelector<HTMLElement>(
            '[data-testid="floating-widget"]',
        )!;
        expect(widget.querySelector('h1')!.textContent).toBe(
            'Virtual Screens Manager',
        );
        expect(widget.dataset.widgetName).toBe('Virtual Screens Manager');
        expect(widget.dataset.persistKey).toBe(
            'floating-widget-rect-screen-mirror',
        );
        expect(widget.dataset.size).toBe('460x600');

        const tablist = portal.querySelector('[role="tablist"]')!;
        expect(tablist.getAttribute('aria-label')).toBe(
            'Virtual Screens Manager',
        );
        const tabs = [...tablist.querySelectorAll('[role="tab"]')];
        expect(tabs.map((tab) => tab.textContent)).toEqual([
            'Screen Mirror Connection',
            'Virtual Displays',
        ]);
        expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
            'true',
            'false',
        ]);
        expect(tabs[0].className).toContain('btn-primary');
        expect(tabs[1].className).toContain('btn-outline-primary');
        expect(
            tabs.map((tab) => tab.querySelector('i')!.className.trim()),
        ).toEqual(['bi bi-pc-display me-1', 'bi bi-display me-1']);
        // Only the tab in view is mounted.
        const panel = portal.querySelector('[role="tabpanel"]')!;
        expect(panel.textContent).toBe('Screen Mirror connection panel');
    });

    test('a tab press switches the kept tab, and the close button closes the panel', async () => {
        h.showing = true;
        await act(async () => root.render(<ScreenMirrorFloatingComp />));
        await settle();
        await act(async () => buttonByText('Virtual Displays').click());
        expect(h.setTab).toHaveBeenCalledExactlyOnceWith('virtual');
        await act(async () => buttonByText('Screen Mirror Connection').click());
        expect(h.setTab).toHaveBeenLastCalledWith('mirror');
        expect(h.setShowing).not.toHaveBeenCalled();
        await act(async () => buttonByText('Close widget').click());
        expect(h.setShowing).toHaveBeenCalledExactlyOnceWith(false);
    });

    test('the Virtual Displays tab mounts its own panel instead', async () => {
        h.showing = true;
        h.tab = 'virtual';
        await act(async () => root.render(<ScreenMirrorFloatingComp />));
        await settle();
        const panel = document.body.querySelector('[role="tabpanel"]')!;
        expect(panel.textContent).toBe('Virtual displays panel');
        const selected = document.body.querySelector(
            '[role="tab"][aria-selected="true"]',
        )!;
        expect(selected.textContent).toBe('Virtual Displays');
    });
});

function intercom(
    extra: Partial<MirrorIntercomState> = {},
): MirrorIntercomState {
    return {
        mic: false,
        speaker: false,
        volume: 1,
        remoteMic: false,
        ...extra,
    };
}

function byLabel(label: string) {
    return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

// React reads a dragged value through the native setter.
function drag(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

describe('MirrorIntercomComp', () => {
    test('the microphone button sends this computer microphone, or stops it', () => {
        const onChange = vi.fn();
        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom()}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        const mic = byLabel('Send my microphone') as HTMLButtonElement;
        expect(mic.title).toBe('Send my microphone');
        expect(mic.getAttribute('aria-pressed')).toBe('false');
        expect(mic.className).toContain('btn-outline-secondary');
        expect(mic.querySelector('i')!.className).toContain('bi-mic-mute');
        act(() => mic.click());
        expect(onChange).toHaveBeenLastCalledWith({ mic: true });

        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ mic: true })}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        expect(mic.title).toBe('Stop sending my microphone');
        expect(mic.getAttribute('aria-pressed')).toBe('true');
        expect(mic.className).toContain('btn-danger');
        expect(mic.querySelector('i')!.className).toContain('bi-mic-fill');
        act(() => mic.click());
        expect(onChange).toHaveBeenLastCalledWith({ mic: false });
        // No camera offered: no camera button.
        expect(byLabel('Share my cameras')).toBeNull();
    });

    test('the speaker shows when the other side talks, and plays it on a press', () => {
        const onChange = vi.fn();
        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ remoteMic: false })}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        const speaker = byLabel('Play their microphone') as HTMLButtonElement;
        expect(speaker.title).toBe('Play their microphone');
        expect(speaker.querySelector('.bg-success')).toBeNull();
        // Off: no volume to drag.
        expect(byLabel('Speaker volume')).toBeNull();

        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ remoteMic: true })}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        expect(speaker.title).toBe('Their microphone is on');
        expect(speaker.querySelector('.bg-success')).not.toBeNull();
        expect(speaker.querySelector('i')!.className).toContain(
            'bi-volume-mute',
        );
        act(() => speaker.click());
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ speaker: true });

        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ speaker: true })}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        expect(speaker.className).toContain('btn-primary');
        expect(speaker.getAttribute('aria-pressed')).toBe('true');
        expect(speaker.querySelector('i')!.className).toContain(
            'bi-volume-up-fill',
        );
        act(() => speaker.click());
        expect(onChange).toHaveBeenLastCalledWith({ speaker: false });
    });

    test('a volume drag shows at once and sends one volume after it stops', async () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        const draw = (volume: number) => {
            act(() =>
                root.render(
                    <MirrorIntercomComp
                        intercom={intercom({ speaker: true, volume })}
                        busy={false}
                        onChange={onChange}
                    />,
                ),
            );
        };
        draw(0.42);
        const slider = byLabel('Speaker volume') as HTMLInputElement;
        expect(slider.value).toBe('42');
        expect(slider.title).toBe('42%');

        drag(slider, '60');
        drag(slider, '75');
        // The dragged value is drawn before the state answers.
        expect(slider.value).toBe('75');
        expect(slider.title).toBe('75%');
        await vi.advanceTimersByTimeAsync(149);
        expect(onChange).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        // One volume for the whole drag: the last one.
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ volume: 0.75 });

        // The state says a new volume: the dragged value is let go.
        draw(0.3);
        expect(slider.value).toBe('30');
        expect(slider.title).toBe('30%');
    });

    test('a volume that did not take effect leaves the slider once its command settles', async () => {
        vi.useFakeTimers();
        const answers: (() => void)[] = [];
        const onChange = vi.fn(
            (_change: unknown) =>
                new Promise<void>((resolve) => {
                    answers.push(resolve);
                }),
        );
        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ speaker: true, volume: 0.42 })}
                    busy={false}
                    onChange={onChange}
                />,
            ),
        );
        const slider = byLabel('Speaker volume') as HTMLInputElement;

        drag(slider, '75');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(150);
        });
        expect(onChange).toHaveBeenCalledExactlyOnceWith({ volume: 0.75 });
        // Still on its way: the dragged value stays.
        expect(slider.value).toBe('75');
        // Answered, and the state never said 75 (refused, or a failure the
        // caller swallowed): the volume in effect shows again.
        await act(async () => {
            answers[0]();
        });
        expect(slider.value).toBe('42');

        // A command that throws does the same.
        onChange.mockImplementationOnce(async () => {
            throw new Error('Connection failed');
        });
        drag(slider, '60');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(150);
        });
        expect(slider.value).toBe('42');

        // A new drag while an earlier volume is on its way keeps its value.
        drag(slider, '80');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(150);
        });
        drag(slider, '90');
        await act(async () => {
            answers[1]();
        });
        expect(slider.value).toBe('90');
    });

    test('a busy connection takes no presses', () => {
        act(() =>
            root.render(
                <MirrorIntercomComp
                    intercom={intercom({ speaker: true })}
                    busy={true}
                    onChange={vi.fn()}
                    camera={{ isShared: false, onToggle: vi.fn() }}
                />,
            ),
        );
        const buttons = [...container.querySelectorAll('button')];
        expect(buttons).toHaveLength(3);
        expect(buttons.every((button) => button.disabled)).toBe(true);
    });

    test('a media player gets no speaker, and the camera button offers or stops the cameras', () => {
        const onToggle = vi.fn();
        const draw = (isShared: boolean) => {
            act(() =>
                root.render(
                    <MirrorIntercomComp
                        intercom={intercom({ speaker: true })}
                        busy={false}
                        onChange={vi.fn()}
                        camera={{ isShared, onToggle }}
                        isSpeakerShown={false}
                    />,
                ),
            );
        };
        draw(false);
        expect(byLabel('Play their microphone')).toBeNull();
        expect(byLabel('Speaker volume')).toBeNull();
        const camera = byLabel('Share my cameras') as HTMLButtonElement;
        expect(camera.title).toBe('Share my cameras');
        expect(camera.getAttribute('aria-pressed')).toBe('false');
        expect(camera.querySelector('i')!.className).toContain(
            'bi-camera-video-off',
        );
        act(() => camera.click());
        expect(onToggle).toHaveBeenCalledOnce();

        draw(true);
        expect(camera.title).toBe('Stop sharing my cameras');
        expect(camera.getAttribute('aria-pressed')).toBe('true');
        expect(camera.className).toContain('btn-primary');
        expect(camera.querySelector('i')!.className).toContain(
            'bi-camera-video-fill',
        );
    });
});
