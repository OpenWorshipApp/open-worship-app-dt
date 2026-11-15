// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The Fills and Animations tabs' strip: the sessions, each keeping its own
// saved list and show, and the show once something is up.

const state = vi.hoisted(() => ({
    stripProps: null as any,
}));

vi.mock('../media-sessions/mediaSessionData', () => ({
    DEFAULT_SESSION_ID: '',
    toSessionSuffix: (sessionId: string) => {
        return sessionId === '' ? '' : `-${sessionId}`;
    },
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessionStrip: (props: any) => {
        state.stripProps = props;
        return { activeId: '', suffix: '', element: null };
    },
}));
vi.mock('./BackgroundPaintAutoPlayComp', () => ({
    default: ({ kind, sessionId }: any) => (
        <span data-auto-play={kind} data-session={sessionId} />
    ),
    toBackgroundPaintAutoPlayPrefix: (kind: string, suffix: string) => {
        return `background-${kind}${suffix}`;
    },
    toBackgroundPaintSessionTarget: (kind: string) => `background-${kind}`,
}));
vi.mock('../slide-auto-play/slideAutoPlayHelpers', () => ({
    genSlideAutoPlaySettingNames: (prefix: string) => [
        `${prefix}-slide-auto-play-playing`,
        `${prefix}-slide-auto-play-timer-seconds`,
    ],
}));

import PaintTabFrameComp, {
    genPaintSessionSettingNames,
    usePaintSessionStrip,
} from './PaintTabFrameComp';

describe('what a Fills or Animations session keeps', () => {
    it('is its saved list and its show, all forgotten with it', () => {
        expect(genPaintSessionSettingNames('animation', 's1')).toEqual([
            'background-animation-presets-s1',
            'background-animation-s1-slide-auto-play-playing',
            'background-animation-s1-slide-auto-play-timer-seconds',
        ]);
    });

    it("never the Default session's saved list, which the Foreground offers too", () => {
        expect(genPaintSessionSettingNames('fill', '')).toEqual([
            'background-fill-slide-auto-play-playing',
            'background-fill-slide-auto-play-timer-seconds',
        ]);
    });

    it('is named to the strip under its own list and show', () => {
        function StripStandInComp() {
            usePaintSessionStrip('fill');
            return null;
        }
        renderToStaticMarkup(<StripStandInComp />);
        expect(state.stripProps.target).toBe('background-fill');
        expect(state.stripProps.autoPlayPrefix).toBe('background-fill');
        expect(state.stripProps.genSessionSettingNames('s2')).toContain(
            'background-fill-presets-s2',
        );
    });
});

describe('the strip over the pickers', () => {
    it('draws the sessions, and the show only once one is up', () => {
        const session = {
            activeId: 's1',
            element: <span data-sessions="" />,
        };
        const idle = renderToStaticMarkup(
            <PaintTabFrameComp kind="fill" session={session} isShowing={false}>
                <i data-pickers="" />
            </PaintTabFrameComp>,
        );
        expect(idle).toContain('background-media-bar');
        expect(idle).toContain('data-sessions');
        expect(idle).toContain('data-pickers');
        expect(idle).not.toContain('data-auto-play');
        const showing = renderToStaticMarkup(
            <PaintTabFrameComp kind="animation" session={session} isShowing>
                <i />
            </PaintTabFrameComp>,
        );
        expect(showing).toContain('data-auto-play="animation"');
        expect(showing).toContain('data-session="s1"');
    });
});
