// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { state, mocks } = vi.hoisted(() => ({
    state: { soundOn: false, volume: 100, settingText: null as string | null },
    mocks: { onChange: vi.fn(), setSoundOn: vi.fn(), setVolume: vi.fn() },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: <T,>(value: T) => ({ current: value }),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => {
        if (name.endsWith('-sound-on')) return state.soundOn ? 'true' : 'false';
        if (name.endsWith('-sound-volume')) return String(state.volume);
        return state.settingText;
    },
    useStateSettingBoolean: () => [state.soundOn, mocks.setSoundOn],
    useStateSettingNumber: () => [state.volume, mocks.setVolume],
}));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ setValue }: { setValue: (value: number) => void }) => (
        <button type="button" onClick={() => setValue(55)}>
            Volume range
        </button>
    ),
}));

import ForegroundPositionPadComp from './ForegroundPositionPadComp';
import ForegroundSoundControlComp, {
    DEFAULT_SOUND_VOLUME,
    getForegroundSoundData,
    toSoundSettingNames,
} from './ForegroundSoundControlComp';
import {
    DEFAULT_FOREGROUND_DECORATION,
    genDecorationDefault,
    genForegroundDecorationStyle,
    getForegroundDecoration,
    toForegroundDecoration,
} from './foregroundDecorationHelpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.clearAllMocks();
    state.soundOn = false;
    state.volume = 100;
    state.settingText = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('foreground basic controls', () => {
    test('reads sound settings with a safe default for a missing volume', () => {
        expect(toSoundSettingNames('video')).toEqual({
            isSoundOn: 'video-sound-on',
            soundVolume: 'video-sound-volume',
        });
        expect(getForegroundSoundData('video')).toEqual({
            isSoundOn: false,
            soundVolume: DEFAULT_SOUND_VOLUME,
        });
        state.soundOn = true;
        state.volume = 35;
        expect(getForegroundSoundData('video')).toEqual({
            isSoundOn: true,
            soundVolume: 35,
        });
    });

    test('changes sound state and exposes its volume control only when enabled', async () => {
        await act(async () => {
            root.render(
                <ForegroundSoundControlComp
                    prefix="video"
                    onChange={mocks.onChange}
                />,
            );
        });
        expect(container.textContent).not.toContain('Volume range');
        const checkbox = container.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        await act(async () => checkbox.click());
        expect(mocks.setSoundOn).toHaveBeenCalledWith(true);
        expect(mocks.onChange).toHaveBeenCalledOnce();

        state.soundOn = true;
        await act(async () => {
            root.render(
                <ForegroundSoundControlComp
                    prefix="video"
                    onChange={mocks.onChange}
                />,
            );
        });
        await act(async () =>
            (container.querySelector('button') as HTMLButtonElement).click(),
        );
        expect(mocks.setVolume).toHaveBeenCalledWith(55);
        expect(mocks.onChange).toHaveBeenCalledTimes(2);
    });

    test('chooses a nine-cell alignment and normalizes numeric offsets', async () => {
        const onData = vi.fn();
        const setOffsetX = vi.fn();
        const setOffsetY = vi.fn();
        await act(async () => {
            root.render(
                <ForegroundPositionPadComp
                    data={{
                        verticalAlignment: 'center',
                        horizontalAlignment: 'center',
                    }}
                    onData={onData}
                    offsetX={4}
                    setOffsetX={setOffsetX}
                    offsetY={-2}
                    setOffsetY={setOffsetY}
                />,
            );
        });
        const cells = container.querySelectorAll('.fg-pad-cell');
        expect(cells).toHaveLength(9);
        expect(cells[4].getAttribute('aria-pressed')).toBe('true');
        await act(async () => (cells[0] as HTMLButtonElement).click());
        expect(onData).toHaveBeenCalledWith({
            verticalAlignment: 'start',
            horizontalAlignment: 'left',
        });
        const inputs = container.querySelectorAll('input[type="number"]');
        await act(async () => {
            const setInputValue = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )?.set;
            setInputValue?.call(inputs[0], '18');
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            setInputValue?.call(inputs[1], '');
            inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(setOffsetX).toHaveBeenCalledWith(18);
        expect(setOffsetY).toHaveBeenCalledWith(0);
    });

    test('repairs malformed decoration fields independently and preserves chosen blending shadows', () => {
        const repaired = toForegroundDecoration(
            JSON.stringify({
                borderStyle: 'dashed',
                borderWidth: 99,
                borderColor: '#123456',
                shadow: 'glow',
                shadowColor: 'not-a-colour',
                padding: -1,
                textAlign: 'sideways',
                lineHeight: '2.5',
                letterSpacing: 9,
                textShadow: 'outline',
                textShadowColor: '#fff',
                isItalic: true,
            }),
        );
        expect(repaired).toMatchObject({
            borderStyle: 'dashed',
            borderWidth: 40,
            borderColor: '#123456',
            shadow: 'glow',
            shadowColor: DEFAULT_FOREGROUND_DECORATION.shadowColor,
            padding: 0,
            textAlign: 'left',
            lineHeight: 2.5,
            letterSpacing: 0.5,
            textShadow: 'outline',
            textShadowColor: '#fff',
            isItalic: true,
            isUnderline: false,
        });
        expect(toForegroundDecoration('{bad json')).toBe(
            DEFAULT_FOREGROUND_DECORATION,
        );
        expect(genDecorationDefault(false).padding).toBe(0);

        const style = genForegroundDecorationStyle(repaired, {
            isText: true,
            isBlending: true,
        });
        expect(style).toMatchObject({
            border: '40px dashed #123456',
            boxSizing: 'border-box',
            textAlign: 'left',
            lineHeight: 2.5,
            letterSpacing: '0.5em',
            fontStyle: 'italic',
        });
        expect(style.boxShadow).toContain('0 0 20px');

        state.settingText = JSON.stringify({ padding: 1 });
        expect(getForegroundDecoration('video', false).padding).toBe(1);
    });
});
