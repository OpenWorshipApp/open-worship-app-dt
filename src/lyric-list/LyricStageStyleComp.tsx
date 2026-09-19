import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import AppRangeComp from '../others/AppRangeComp';
import {
    getLyricStageStyle,
    LYRIC_STAGE_STYLE_DEFAULT,
    LYRIC_STAGE_STYLE_RANGES,
    resetLyricStageStyle,
    setLyricStageStyle,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';

// Module-level so a fresh literal per render does not re-run `AppRangeComp`'s
// `[value, defaultSize, fixedSize]` effect on every keystroke elsewhere in the
// panel. `size` is what the slider starts at; the live value is `value`.
const PADDING_RANGE = {
    ...LYRIC_STAGE_STYLE_RANGES.paddingPercentage,
    size: LYRIC_STAGE_STYLE_DEFAULT.paddingPercentage,
};
const ALPHA_RANGE = {
    ...LYRIC_STAGE_STYLE_RANGES.backgroundAlphaPercentage,
    size: LYRIC_STAGE_STYLE_DEFAULT.backgroundAlphaPercentage,
};
const FONT_RANGE = {
    ...LYRIC_STAGE_STYLE_RANGES.extraFontSize,
    size: LYRIC_STAGE_STYLE_DEFAULT.extraFontSize,
};

// A slider drag fires `onChange` per pixel and every commit is a synchronous
// file write PLUS a whole-song re-render, so only the trailing one runs.
const COMMIT_DELAY_MILLISECOND = 500;
// The CSS box is slower on purpose: each commit re-renders the whole song and,
// on stage 1, re-rasterizes the title PNG, so a 500ms timer would fire on every
// mid-thought pause. Blur commits immediately.
const COMMIT_CSS_DELAY_MILLISECOND = 1500;

function RenderStyleRowComp({
    iconClassName,
    label,
    children,
}: Readonly<{
    iconClassName: string;
    label: string;
    children: ReactNode;
}>) {
    return (
        <div className="d-flex align-items-center app-border-white-round m-1 px-2 gap-1">
            <span className="d-flex align-items-center gap-1 text-nowrap">
                <i className={iconClassName} />
                <small>{label}</small>
            </span>
            {children}
        </div>
    );
}

/**
 * The per-stage slide style panel — what the Stage Previewer's gear opens.
 *
 * The controls render from local state, so they stay responsive while the
 * commit (setting write + previewer refresh) is debounced behind them.
 */
export default function LyricStageStyleComp({
    stage,
    onChanged,
}: Readonly<{
    stage: number;
    onChanged: () => void;
}>) {
    const [style, setStyle] = useState(() => {
        return getLyricStageStyle(stage);
    });
    const styleRef = useAppCurrentRef(style);
    const stageRef = useAppCurrentRef(stage);
    const onChangedRef = useAppCurrentRef(onChanged);
    // PER-INSTANCE timers (`useMemo`), never module-level: this body remounts
    // when the gear retargets to another stage, and a shared timer would let a
    // dead panel `clearTimeout` a live one's pending write.
    // No `useAppCurrentRef` around these: `useMemo` with empty deps already makes
    // them stable for this instance's whole life, so the callbacks below can
    // close over them directly.
    const attemptCommit = useMemo(() => {
        return genTimeoutAttempt(COMMIT_DELAY_MILLISECOND);
    }, []);
    const attemptCommitCss = useMemo(() => {
        return genTimeoutAttempt(COMMIT_CSS_DELAY_MILLISECOND);
    }, []);

    const handleChange = useCallback(
        (patch: Partial<LyricStageStyleType>, isImmediate = false) => {
            // Computed here and written to the ref rather than inside a
            // `setState` updater, so the TRAILING commit writes the LAST value
            // of a drag instead of whatever the ref held when it was armed.
            const newStyle = { ...styleRef.current, ...patch };
            styleRef.current = newStyle;
            setStyle(newStyle);
            attemptCommit(() => {
                setLyricStageStyle(stageRef.current, styleRef.current);
                onChangedRef.current();
            }, isImmediate);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleChangeRef = useAppCurrentRef(handleChange);

    const handleCssChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const newStyle = {
                ...styleRef.current,
                customCss: event.target.value,
            };
            styleRef.current = newStyle;
            setStyle(newStyle);
            attemptCommitCss(() => {
                setLyricStageStyle(stageRef.current, styleRef.current);
                onChangedRef.current();
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleCssBlur = useCallback(() => {
        attemptCommitCss(() => {
            setLyricStageStyle(stageRef.current, styleRef.current);
            onChangedRef.current();
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePaddingChange = useCallback((newValue: number) => {
        handleChangeRef.current({ paddingPercentage: newValue });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleAlphaChange = useCallback((newValue: number) => {
        handleChangeRef.current({ backgroundAlphaPercentage: newValue });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFontSizeChange = useCallback((newValue: number) => {
        handleChangeRef.current({ extraFontSize: newValue });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReset = useCallback(() => {
        const newStyle = { ...LYRIC_STAGE_STYLE_DEFAULT };
        styleRef.current = newStyle;
        setStyle(newStyle);
        // Immediate, which also cancels a slider write still in flight.
        attemptCommit(() => {
            resetLyricStageStyle(stageRef.current);
            onChangedRef.current();
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-100 h-100 app-overflow-hidden d-flex flex-column p-1">
            <div
                className="flex-fill app-overflow-hidden-x"
                style={{ overflowY: 'auto' }}
            >
                <div className="px-1">
                    <small className="text-muted">
                        <i className="bi bi-info-circle me-1" />
                        {tran('Applies to every song')}
                    </small>
                </div>
                <RenderStyleRowComp
                    iconClassName="bi bi-arrows-angle-contract"
                    label={tran('Slide Padding (%)')}
                >
                    <AppRangeComp
                        value={style.paddingPercentage}
                        title={tran('Slide Padding (%)')}
                        setValue={handlePaddingChange}
                        defaultSize={PADDING_RANGE}
                        isShowValue
                    />
                </RenderStyleRowComp>
                <RenderStyleRowComp
                    iconClassName="bi bi-square-half"
                    label={tran('Background Opacity (%)')}
                >
                    <AppRangeComp
                        value={style.backgroundAlphaPercentage}
                        title={tran('Background Opacity (%)')}
                        setValue={handleAlphaChange}
                        defaultSize={ALPHA_RANGE}
                        isShowValue
                    />
                </RenderStyleRowComp>
                <RenderStyleRowComp
                    iconClassName="bi bi-fonts"
                    label={tran('Extra Font Size')}
                >
                    <AppRangeComp
                        value={style.extraFontSize}
                        title={tran('Extra Font Size')}
                        setValue={handleFontSizeChange}
                        defaultSize={FONT_RANGE}
                        isShowValue
                    />
                </RenderStyleRowComp>
                <RenderStyleRowComp
                    iconClassName="bi bi-circle-half"
                    label={tran('Theme')}
                >
                    {/*
                        Only the plain `light`/`dark` pair, NOT open-lyric's
                        `-bs` variants the live previewer uses: those are
                        different themes with their own palettes, and the
                        exported slide has never rendered in one.
                    */}
                    <div className="btn-group btn-group-sm" role="group">
                        {(['light', 'dark'] as const).map((theme) => {
                            const isActive = style.theme === theme;
                            const label = theme === 'light' ? 'Light' : 'Dark';
                            return (
                                <button
                                    key={theme}
                                    type="button"
                                    className={
                                        'btn btn-sm btn' +
                                        (isActive ? '' : '-outline') +
                                        '-info'
                                    }
                                    aria-pressed={isActive}
                                    onClick={() => {
                                        handleChange({ theme }, true);
                                    }}
                                >
                                    {tran(label)}
                                </button>
                            );
                        })}
                    </div>
                </RenderStyleRowComp>
                <div className="m-1 px-1">
                    <label
                        className="form-label d-flex align-items-center gap-1 mb-1"
                        htmlFor="lyric-stage-style-custom-css"
                    >
                        <i className="bi bi-code-slash" />
                        <small>{tran('Custom CSS')}</small>
                    </label>
                    <textarea
                        id="lyric-stage-style-custom-css"
                        className="form-control form-control-sm"
                        rows={8}
                        spellCheck={false}
                        style={{ fontFamily: 'monospace' }}
                        placeholder=".ol-preview-line { letter-spacing: 0.02em; }"
                        value={style.customCss}
                        onChange={handleCssChange}
                        onBlur={handleCssBlur}
                    />
                    <small className="text-muted">
                        {tran('Custom CSS is added after this stage own style')}
                    </small>
                </div>
            </div>
            <div className="d-flex justify-content-end p-1">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    title={tran('Reset Stage Style')}
                    onClick={handleReset}
                >
                    <i className="bi bi-arrow-counterclockwise me-1" />
                    {tran('Reset')}
                </button>
            </div>
        </div>
    );
}
