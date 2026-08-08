import { lazy } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { tran } from '../lang/langHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useThemeSource } from '../others/themeHelpers';
import {
    closeLyricStageStyleFloating,
    useLyricStageStyleFloatingStage,
} from './lyricStageStyleFloatingHelpers';

const LazyLyricStageStyleComp = lazy(() => {
    return import('./LyricStageStyleComp');
});

/**
 * Single widget host for the per-stage style panel.
 *
 * Mounted once PER `LyricSlidesPreviewerComp`; every stage chip's gear flips the
 * shared store, so clicking another chip RETARGETS this one widget rather than
 * opening a second. Portaled to the body so the previewer card cannot clip it.
 *
 * `ownerId` is what keeps that true when several previewers are mounted at once
 * (a floating document preview of a `.owl` renders a second one) — only the host
 * whose own gear was clicked resolves to a stage, so the others render nothing
 * instead of stacking a duplicate widget on the shared `persistKey`.
 */
export default function LyricStageStyleFloatingComp({
    ownerId,
    onChanged,
}: Readonly<{
    ownerId: string;
    onChanged: () => void;
}>) {
    const stage = useLyricStageStyleFloatingStage(ownerId);
    const { theme } = useThemeSource();
    if (stage === null) {
        return null;
    }
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={`${tran('Stage Style')} · ${tran('Stage')} ${stage}`}
                persistKey="floating-widget-rect-lyric-stage-style"
                onClose={() => {
                    closeLyricStageStyleFloating(ownerId);
                }}
                options={{
                    width: 380,
                    height: 540,
                    minWidth: 300,
                    minHeight: 260,
                }}
            >
                <AppSuspenseComp>
                    {/*
                        `key` is load-bearing: retargeting to another stage
                        keeps this widget mounted, so without it the body would
                        keep its `useState` and show the PREVIOUS stage's values
                        under the new stage's title — and the first drag would
                        write them into the new stage's setting.
                    */}
                    <LazyLyricStageStyleComp
                        key={stage}
                        stage={stage}
                        onChanged={onChanged}
                    />
                </AppSuspenseComp>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
