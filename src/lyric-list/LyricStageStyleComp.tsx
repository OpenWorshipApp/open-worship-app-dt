import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import AlignmentPadComp, {
    type AlignmentPadDataType,
} from '../others/AlignmentPadComp';
import AppRangeComp from '../others/AppRangeComp';
import PresetsRowComp from '../others/PresetsRowComp';
import {
    getLyricStageStyle,
    LYRIC_STAGE_STYLE_DEFAULT,
    LYRIC_STAGE_STYLE_RANGES,
    resetLyricStageStyle,
    setLyricStageStyle,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';
import {
    genLyricStageStylePresetPatch,
    LYRIC_STAGE_STYLE_PRESET_LIST,
    LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME,
    toLyricStageStyleSavedPreset,
    type LyricStageStylePresetIdType,
    type LyricStageStyleSavedPresetType,
} from './lyricStageStylePresetHelpers';

// Module-level so a fresh literal per render does not re-run `AppRangeComp`'s
// `[value, defaultSize, fixedSize]` effect on every keystroke elsewhere in the
// panel. `size` is what the slider starts at; the live value is `value`.
const MARGIN_HORIZONTAL_RANGE = {
    ...LYRIC_STAGE_STYLE_RANGES.marginHorizontalPercentage,
    size: LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage,
};
const MARGIN_VERTICAL_RANGE = {
    ...LYRIC_STAGE_STYLE_RANGES.marginVerticalPercentage,
    size: LYRIC_STAGE_STYLE_DEFAULT.marginVerticalPercentage,
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

// What the Custom CSS box shows when no stage document is at hand to say what
// the stage applies.
const CSS_PLACEHOLDER_EXAMPLE = '.ol-preview-line { letter-spacing: 0.02em; }';

/**
 * The stage css is written inside template literals, indented for the code
 * around it: the common indent and the runs of blank lines come off, so the
 * placeholder — and the copy a press puts in the box — reads like a style
 * sheet.
 */
export function toReadableCss(css: string) {
    const lines = css.split(/\r?\n/).map((line) => {
        return line.trimEnd();
    });
    const indentList = lines
        .filter((line) => {
            return line !== '';
        })
        .map((line) => {
            return line.length - line.trimStart().length;
        });
    const indent = indentList.length === 0 ? 0 : Math.min(...indentList);
    return lines
        .map((line) => {
            return line.slice(indent);
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * A stage look's name, translated in render. One literal per look so the key
 * coverage test can read every one of them.
 */
function toLyricStageStylePresetLabel(id: LyricStageStylePresetIdType) {
    switch (id) {
        case 'full-screen':
            return tran('Full Screen');
        case 'center':
            return tran('Center');
        case 'top-banner':
            return tran('Top Banner');
        case 'bottom-banner':
            return tran('Bottom Banner');
    }
}

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
 * Slide Margin as two sliders, horizontal over vertical, with the link
 * toggle beside them — linked by default, so one drag moves both.
 */
function RenderMarginRowComp({
    style,
    onHorizontalChange,
    onVerticalChange,
    onLinkToggle,
}: Readonly<{
    style: LyricStageStyleType;
    onHorizontalChange: (newValue: number) => void;
    onVerticalChange: (newValue: number) => void;
    onLinkToggle: () => void;
}>) {
    const isLinked = style.isMarginLinked;
    const linkTitle = tran('Link horizontal and vertical margin');
    // The link at the LEFT of the two sliders, centred between the rows it
    // ties, as the Quick Text panel's Margin has it (the user, 2026-11-09).
    return (
        <div className="d-flex align-items-center app-border-white-round m-1 px-2 gap-1">
            <div className="d-flex flex-column">
                <span className="d-flex align-items-center gap-1 text-nowrap">
                    <i className="bi bi-arrows-angle-contract" />
                    <small>{tran('Slide Margin (%)')}</small>
                </span>
                <div className="d-flex align-items-center gap-1">
                    <button
                        type="button"
                        className={
                            'btn btn-sm btn' +
                            (isLinked ? '' : '-outline') +
                            '-info'
                        }
                        title={linkTitle}
                        aria-label={linkTitle}
                        aria-pressed={isLinked}
                        onClick={onLinkToggle}
                    >
                        <i
                            className={
                                'bi bi-link' + (isLinked ? '-45deg' : '')
                            }
                        />
                    </button>
                    <div className="d-flex flex-column">
                        <div className="d-flex align-items-center gap-1 ps-1">
                            <i className="bi bi-arrows" />
                            <AppRangeComp
                                value={style.marginHorizontalPercentage}
                                title={tran('Horizontal Margin (%)')}
                                setValue={onHorizontalChange}
                                defaultSize={MARGIN_HORIZONTAL_RANGE}
                                isShowValue
                            />
                        </div>
                        <div className="d-flex align-items-center gap-1 ps-1">
                            <i className="bi bi-arrows-vertical" />
                            <AppRangeComp
                                value={style.marginVerticalPercentage}
                                title={tran('Vertical Margin (%)')}
                                setValue={onVerticalChange}
                                defaultSize={MARGIN_VERTICAL_RANGE}
                                isShowValue
                            />
                        </div>
                    </div>
                </div>
            </div>
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
    genStageBuiltInCss,
}: Readonly<{
    stage: number;
    onChanged: () => void;
    // The css the stage applies before the operator's own, read off its
    // document. Absent, the box shows a one-line example instead.
    genStageBuiltInCss?: (stage: number) => string;
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
    // Once per stage: the panel remounts per stage (`key`), and a drag
    // re-renders it per pixel, which must not rebuild the stage's options.
    const builtInCss = useMemo(() => {
        return toReadableCss(genStageBuiltInCss?.(stage) ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage]);
    const builtInCssRef = useAppCurrentRef(builtInCss);
    const cssBoxRef = useRef<HTMLTextAreaElement>(null);

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

    // The placeholder made real: what the stage applies, in the box to be
    // edited, written at once like a blur — the copy is appended after the
    // stage's own rules, so it changes nothing until it is edited.
    const handleEditBuiltInCss = useCallback(() => {
        const newStyle = {
            ...styleRef.current,
            customCss: builtInCssRef.current,
        };
        styleRef.current = newStyle;
        setStyle(newStyle);
        attemptCommitCss(() => {
            setLyricStageStyle(stageRef.current, styleRef.current);
            onChangedRef.current();
        }, true);
        cssBoxRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCssBlur = useCallback(() => {
        attemptCommitCss(() => {
            setLyricStageStyle(stageRef.current, styleRef.current);
            onChangedRef.current();
        }, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Linked, one patch moves BOTH sides, so the pair is written in the same
    // commit and the other slider follows the drag as it happens.
    const handleMarginHorizontalChange = useCallback((newValue: number) => {
        handleChangeRef.current(
            styleRef.current.isMarginLinked
                ? {
                      marginHorizontalPercentage: newValue,
                      marginVerticalPercentage: newValue,
                  }
                : { marginHorizontalPercentage: newValue },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMarginVerticalChange = useCallback((newValue: number) => {
        handleChangeRef.current(
            styleRef.current.isMarginLinked
                ? {
                      marginHorizontalPercentage: newValue,
                      marginVerticalPercentage: newValue,
                  }
                : { marginVerticalPercentage: newValue },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Linking evens the pair out to the HORIZONTAL value at once, so a linked
    // pair always reads the same number; unlinking keeps both as they are.
    const handleMarginLinkToggle = useCallback(() => {
        const { isMarginLinked, marginHorizontalPercentage } = styleRef.current;
        handleChangeRef.current(
            isMarginLinked
                ? { isMarginLinked: false }
                : {
                      isMarginLinked: true,
                      marginVerticalPercentage: marginHorizontalPercentage,
                  },
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // One cell is always lit; Middle center is the default, a margin a side.
    // Written at once, like the theme: a press is not a drag. The lit cell
    // pressed again changes nothing, so it writes and re-renders nothing.
    const handleBoxAlignmentChoose = useCallback(
        ({ verticalAlignment, horizontalAlignment }: AlignmentPadDataType) => {
            const current = styleRef.current;
            if (
                current.boxVerticalAlignment === verticalAlignment &&
                current.boxHorizontalAlignment === horizontalAlignment
            ) {
                return;
            }
            handleChangeRef.current(
                {
                    boxVerticalAlignment: verticalAlignment,
                    boxHorizontalAlignment: horizontalAlignment,
                },
                true,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleAlphaChange = useCallback((newValue: number) => {
        handleChangeRef.current({ backgroundAlphaPercentage: newValue });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFontSizeChange = useCallback((newValue: number) => {
        handleChangeRef.current({ extraFontSize: newValue });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A look a press: written at once, like the theme. One of the app's looks
    // moves only the layout; a saved one is the whole record, Custom CSS and
    // theme included.
    const handlePresetApplying = useCallback(
        (patch: Partial<LyricStageStyleType>) => {
            handleChangeRef.current(patch, true);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const readCurrentStyle = useCallback(() => {
        return { values: { ...styleRef.current } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSavedPresetApplying = useCallback(
        (preset: LyricStageStyleSavedPresetType) => {
            handleChangeRef.current({ ...preset.values }, true);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

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
                <div className="m-1 px-1">
                    <PresetsRowComp<LyricStageStyleSavedPresetType>
                        savedSettingName={
                            LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME
                        }
                        toSavedPreset={toLyricStageStyleSavedPreset}
                        builtIns={LYRIC_STAGE_STYLE_PRESET_LIST.map(
                            (preset) => {
                                return {
                                    id: preset.id,
                                    iconName: preset.iconName,
                                    label: toLyricStageStylePresetLabel(
                                        preset.id,
                                    ),
                                    onPick: () => {
                                        handlePresetApplying(
                                            genLyricStageStylePresetPatch(
                                                preset,
                                            ),
                                        );
                                    },
                                };
                            },
                        )}
                        readCurrent={readCurrentStyle}
                        onSavedPick={handleSavedPresetApplying}
                    />
                </div>
                <RenderMarginRowComp
                    style={style}
                    onHorizontalChange={handleMarginHorizontalChange}
                    onVerticalChange={handleMarginVerticalChange}
                    onLinkToggle={handleMarginLinkToggle}
                />
                <RenderStyleRowComp
                    iconClassName="bi bi-grid-3x3"
                    label={tran('Position')}
                >
                    <AlignmentPadComp
                        verticalAlignment={style.boxVerticalAlignment}
                        horizontalAlignment={style.boxHorizontalAlignment}
                        label={tran('Position')}
                        onChoose={handleBoxAlignmentChoose}
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
                    <div className="d-flex align-items-center gap-1 mb-1">
                        <label
                            className="form-label d-flex align-items-center gap-1 m-0"
                            htmlFor="lyric-stage-style-custom-css"
                        >
                            <i className="bi bi-code-slash" />
                            <small>{tran('Custom CSS')}</small>
                        </label>
                        {/* Only while the box is empty: it is the placeholder
                            that it makes real, and filled it would overwrite
                            the operator's own rules. */}
                        {builtInCss !== '' && style.customCss === '' ? (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-info py-0 px-1"
                                title={tran("Edit a copy of the stage's CSS")}
                                aria-label={tran(
                                    "Edit a copy of the stage's CSS",
                                )}
                                onClick={handleEditBuiltInCss}
                            >
                                <i className="bi bi-pencil-square" />
                            </button>
                        ) : null}
                    </div>
                    <textarea
                        ref={cssBoxRef}
                        id="lyric-stage-style-custom-css"
                        className="form-control form-control-sm"
                        rows={8}
                        spellCheck={false}
                        style={{ fontFamily: 'monospace' }}
                        placeholder={builtInCss || CSS_PLACEHOLDER_EXAMPLE}
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
