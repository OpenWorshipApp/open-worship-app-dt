// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({ settings: new Map<string, string>() }));
vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    const useSetting = <T,>(
        name: string,
        fallback: T,
        parse: (text: string) => T,
    ) => {
        const [value, setValue] = react.useState<T>(() =>
            h.settings.has(name) ? parse(h.settings.get(name)!) : fallback,
        );
        const valueRef = react.useRef(value);
        valueRef.current = value;
        const save: typeof setValue = (next) => {
            const newValue =
                typeof next === 'function'
                    ? (next as (old: T) => T)(valueRef.current)
                    : next;
            valueRef.current = newValue;
            h.settings.set(name, String(newValue));
            setValue(newValue);
        };
        return [value, save] as const;
    };
    return {
        getSetting: (name: string) => h.settings.get(name) ?? null,
        setSetting: (name: string, value: string) =>
            h.settings.set(name, value),
        useStateSettingBoolean: (name: string, fallback: boolean) =>
            useSetting(name, fallback, (text) => text === 'true'),
        useStateSettingNumber: (name: string, fallback: number) =>
            useSetting(name, fallback, Number),
        useStateSettingString: (name: string, fallback: string) =>
            useSetting(name, fallback, (text) => text),
    };
});
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
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import SlideAutoPlayComp, { type NextDataType } from './SlideAutoPlayComp';
import {
    getSlideAutoPlayDrawnSeconds,
    getSlideAutoPlayRemainingSeconds,
    setSlideAutoPlayDrawnSeconds,
} from './slideAutoPlayHelpers';

let root: Root;
let container: HTMLDivElement;
let onNext: Mock<(data: NextDataType) => boolean | Promise<boolean>>;
let onStateChange: Mock<() => void>;

async function render(
    props: {
        isInline?: boolean;
        isTimerExternal?: boolean;
        canUntilMediaEnd?: boolean;
    } = {},
) {
    await act(async () =>
        root.render(
            createElement(SlideAutoPlayComp, {
                prefix: 'background-images',
                onNext,
                onStateChange,
                ...props,
            }),
        ),
    );
}

function click(label: string) {
    const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )!;
    expect(button).not.toBeNull();
    act(() => button.click());
}

beforeEach(() => {
    h.settings.clear();
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onNext = vi
        .fn<(data: NextDataType) => boolean | Promise<boolean>>()
        .mockReturnValue(true);
    onStateChange = vi.fn<() => void>();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    setSlideAutoPlayDrawnSeconds('background-images', null);
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('slide-show controls', () => {
    it('starts a timed show and schedules the next tick only after it runs', async () => {
        await render({ isInline: true });
        expect(
            container
                .querySelector('input[aria-label="Seconds"]')
                ?.getAttribute('value'),
        ).toBe('5');
        click('Start Slide Show');
        expect(
            container.querySelector('[aria-label="Stop Slide Show"]'),
        ).not.toBeNull();
        expect(getSlideAutoPlayRemainingSeconds('background-images')).toBe(5);
        expect(getSlideAutoPlayDrawnSeconds('background-images')).toBe(5);
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(onNext).toHaveBeenCalledWith({
            isNext: true,
            options: expect.objectContaining({
                seconds: 5,
                repeatKind: 'all',
                step: 1,
            }),
        });
        expect(getSlideAutoPlayRemainingSeconds('background-images')).toBe(5);
        click('Stop Slide Show');
        expect(
            container.querySelector('[aria-label="Start Slide Show"]'),
        ).not.toBeNull();
        expect(
            getSlideAutoPlayRemainingSeconds('background-images'),
        ).toBeNull();
    });

    it('stops automatically when a no-repeat show runs out', async () => {
        h.settings.set('background-images-slide-auto-play-repeat', 'none');
        onNext.mockResolvedValue(false);
        await render({ isInline: true });
        click('Start Slide Show');
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(onNext).toHaveBeenCalledOnce();
        expect(
            h.settings.get('background-images-slide-auto-play-playing'),
        ).toBe('false');
        expect(
            container.querySelector('[aria-label="Start Slide Show"]'),
        ).not.toBeNull();
        expect(
            getSlideAutoPlayRemainingSeconds('background-images'),
        ).toBeNull();
        expect(getSlideAutoPlayDrawnSeconds('background-images')).toBeNull();
        expect(onStateChange).toHaveBeenCalled();
    });

    it('leaves the clock to an external runner while keeping play controls', async () => {
        await render({ isInline: true, isTimerExternal: true });
        click('Start Slide Show');
        await act(async () => vi.advanceTimersByTimeAsync(10_000));
        expect(onNext).not.toHaveBeenCalled();
        expect(
            container.querySelector('[aria-label="Stop Slide Show"]'),
        ).not.toBeNull();
    });

    it('opens options in place and shows a drawn wait instead of an editable value', async () => {
        h.settings.set(
            'background-images-slide-auto-play-timer-max-seconds',
            '8',
        );
        setSlideAutoPlayDrawnSeconds('background-images', 3);
        await render({ isInline: true, canUntilMediaEnd: true });
        const seconds = container.querySelector<HTMLInputElement>(
            'input.slide-auto-play-seconds',
        )!;
        expect(seconds.readOnly).toBe(true);
        expect(seconds.value).toBe('3');
        expect(seconds.title).toBe('The Wait Drawn For This Slide');
        click('Slide Show Options');
        expect(
            container.querySelector(
                '[role="group"][aria-label="Slide Show Options"]',
            ),
        ).not.toBeNull();
        expect(
            container.querySelector('[aria-label="Random Up To Seconds"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[aria-label="Wait Until The Video Ends"]'),
        ).not.toBeNull();
        click('Close Slide Show Options');
        expect(container.querySelector('[role="group"]')).toBeNull();
    });

    it('reveals and hides the floating controls', async () => {
        await render();
        expect(
            container.querySelector('[aria-label="Slide Show"]'),
        ).not.toBeNull();
        click('Slide Show');
        expect(
            container.querySelector('[aria-label="Start Slide Show"]'),
        ).not.toBeNull();
        click('Hide Slide Show Controls');
        expect(
            container.querySelector('[aria-label="Start Slide Show"]'),
        ).toBeNull();
    });
});
