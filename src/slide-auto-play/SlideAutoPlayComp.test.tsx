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

// A controlled number box takes a typed value through the native setter and
// an `input` event, as a keyboard would give it.
function typeInto(label: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    )!;
    expect(input, label).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function tick(label: string) {
    const input = container.querySelector<HTMLInputElement>(
        `input[aria-label="${label}"]`,
    )!;
    expect(input, label).not.toBeNull();
    act(() => input.click());
    return input;
}

const SETTING = 'background-images-slide-auto-play-';

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

    it('the seconds box writes the wait, never below zero, and says it changed', async () => {
        await render({ isInline: true });
        typeInto('Seconds', '9');
        expect(h.settings.get(`${SETTING}timer-seconds`)).toBe('9');
        expect(onStateChange).toHaveBeenCalledTimes(1);
        typeInto('Seconds', '-3');
        expect(h.settings.get(`${SETTING}timer-seconds`)).toBe('0');
        typeInto('Seconds', '');
        expect(h.settings.get(`${SETTING}timer-seconds`)).toBe('0');
        expect(onStateChange).toHaveBeenCalledTimes(3);
    });

    it('the options write each rule, keep the numbers in range, and say each change', async () => {
        await render({ isInline: true, canUntilMediaEnd: true });
        click('Slide Show Options');

        const repeatAll = tick('Repeat All');
        expect(repeatAll.checked).toBe(false);
        expect(h.settings.get(`${SETTING}repeat`)).toBe('none');
        tick('Repeat All');
        expect(h.settings.get(`${SETTING}repeat`)).toBe('all');

        typeInto('Jumping Step', '3');
        expect(h.settings.get(`${SETTING}step`)).toBe('3');
        // A step of 0 would never move.
        typeInto('Jumping Step', '0');
        expect(h.settings.get(`${SETTING}step`)).toBe('1');

        typeInto('Random Up To Seconds', '12');
        expect(h.settings.get(`${SETTING}timer-max-seconds`)).toBe('12');
        // A ceiling makes the seconds box show a drawn wait, not a typed one.
        expect(
            container.querySelector<HTMLInputElement>(
                'input.slide-auto-play-seconds',
            )?.readOnly,
        ).toBe(true);
        typeInto('Random Up To Seconds', '-1');
        expect(h.settings.get(`${SETTING}timer-max-seconds`)).toBe('0');

        tick('Wait Until The Video Ends');
        expect(h.settings.get(`${SETTING}until-media-end`)).toBe('true');
        // Waiting on the clip leaves no random ceiling to set.
        expect(
            container.querySelector('[aria-label="Random Up To Seconds"]'),
        ).toBeNull();
        expect(onStateChange).toHaveBeenCalledTimes(7);
    });

    it('a show stopped while its tick is still running schedules nothing more', async () => {
        let finishTick!: (canContinue: boolean) => void;
        onNext.mockImplementationOnce(() => {
            return new Promise<boolean>((resolve) => {
                finishTick = resolve;
            });
        });
        await render({ isInline: true });
        // The countdown's own once-a-second read.
        const idleTimerCount = vi.getTimerCount();
        click('Start Slide Show');
        await act(async () => vi.advanceTimersByTimeAsync(5000));
        expect(onNext).toHaveBeenCalledOnce();
        // Stopped while the slide is still going up.
        click('Stop Slide Show');
        await act(async () => {
            finishTick(true);
        });
        expect(
            getSlideAutoPlayRemainingSeconds('background-images'),
        ).toBeNull();
        await act(async () => vi.advanceTimersByTimeAsync(20_000));
        expect(onNext).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(idleTimerCount);
    });
});
