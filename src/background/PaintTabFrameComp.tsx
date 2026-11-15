import './BackgroundAutoPlayComp.scss';

import type { ReactNode } from 'react';

import {
    DEFAULT_SESSION_ID,
    toSessionSuffix,
} from '../media-sessions/mediaSessionData';
import { genSlideAutoPlaySettingNames } from '../slide-auto-play/slideAutoPlayHelpers';
import { useBackgroundSessionStrip } from './backgroundSessionHelpers';
import BackgroundPaintAutoPlayComp, {
    toBackgroundPaintAutoPlayPrefix,
    toBackgroundPaintSessionTarget,
} from './BackgroundPaintAutoPlayComp';
import {
    type PaintShowKindType,
    toPaintPresetSettingName,
} from './paintShowOrderHelpers';

/**
 * Every setting one session of the Fills or Animations tab keeps, for its
 * removal: its saved list and its slide show. Never the Default session's
 * saved list -- it is the one Fill Show and Animation Show offer too, and a
 * Background session removed must not empty the Foreground's.
 */
export function genPaintSessionSettingNames(
    kind: PaintShowKindType,
    sessionId: string,
) {
    const suffix = toSessionSuffix(sessionId);
    return [
        ...(sessionId === DEFAULT_SESSION_ID
            ? []
            : [toPaintPresetSettingName(kind, suffix)]),
        ...genSlideAutoPlaySettingNames(
            toBackgroundPaintAutoPlayPrefix(kind, suffix),
        ),
    ];
}

/** A Fills or Animations tab's sessions, each with its saved list and show. */
export function usePaintSessionStrip(kind: PaintShowKindType) {
    return useBackgroundSessionStrip({
        target: toBackgroundPaintSessionTarget(kind),
        autoPlayPrefix: toBackgroundPaintAutoPlayPrefix(kind, ''),
        genSessionSettingNames: (sessionId) => {
            return genPaintSessionSettingNames(kind, sessionId);
        },
    });
}

/**
 * The Fills or Animations tab: the strip over the pickers -- the sessions,
 * and the slide show once one of the tab's kind is up, a show needing
 * something to start from (the Images tab's own rule) -- and the pickers
 * scrolling under it.
 */
export default function PaintTabFrameComp({
    kind,
    session,
    isShowing,
    children,
}: Readonly<{
    kind: PaintShowKindType;
    session: { activeId: string; element: ReactNode };
    isShowing: boolean;
    children: ReactNode;
}>) {
    return (
        <div className="w-100 h-100 d-flex flex-column">
            <div className="background-media-bar d-flex align-items-center px-1">
                {session.element}
                {isShowing ? (
                    <BackgroundPaintAutoPlayComp
                        kind={kind}
                        sessionId={session.activeId}
                    />
                ) : null}
            </div>
            <div className="flex-fill" style={{ minHeight: 0 }}>
                {children}
            </div>
        </div>
    );
}
