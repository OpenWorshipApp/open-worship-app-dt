import type { ReactNode } from 'react';

import AppRangeComp, { type AppRangeDefaultType } from '../others/AppRangeComp';
import {
    type AppColorType,
    colorToTransparent,
} from '../others/color/colorValueHelpers';
import { tran } from '../lang/langHelpers';
import { tranFillMotion, tranFillPatternName } from './fillLabelHelpers';
import {
    FILL_MOTION_LIST,
    FILL_PATTERN_LIST,
    MAX_FILL_GRADIENT_COLOR_COUNT,
    MAX_FILL_PATTERN_SIZE,
    MIN_FILL_GRADIENT_COLOR_COUNT,
    MIN_FILL_PATTERN_SIZE,
    type FillGradientType,
    type FillPatternNameType,
    type FillPatternType,
    toFillHexColor,
} from './fillValueHelpers';

export type EditableFillType = FillGradientType | FillPatternType;

// Made once: a range re-reads its prop each time this object is a new one.
const ANGLE_RANGE: AppRangeDefaultType = {
    size: 180,
    min: 0,
    max: 359,
    step: 1,
};
// 0 to 255, as the colour picker's own Opacity counts; 0 is allowed here: a
// gradient fading to nothing lets the screen behind show through.
const OPACITY_RANGE: AppRangeDefaultType = {
    size: 255,
    min: 0,
    max: 255,
    step: 1,
};
const PATTERN_SIZE_RANGE: AppRangeDefaultType = {
    size: 24,
    min: MIN_FILL_PATTERN_SIZE,
    max: MAX_FILL_PATTERN_SIZE,
    step: 1,
};

/** The six digits a colour well takes; its alpha is kept apart. */
function toWellColor(color: string) {
    return (toFillHexColor(color) ?? '#000000').slice(0, 7).toLowerCase();
}

/** How solid a colour is: 0 (not at all) to 255 (six digits). */
function toAlpha(color: string) {
    return colorToTransparent(toFillHexColor(color) ?? '#000000');
}

/**
 * A colour's six digits with `alpha` as its see-through; a solid one is
 * written with six digits alone, so it stays equal to the same colour
 * written without one.
 */
function toFillColorWithAlpha(color: string, alpha: number): AppColorType {
    const rgb = toWellColor(color).toUpperCase() as AppColorType;
    const rounded = Math.round(Math.min(255, Math.max(0, alpha)));
    if (rounded >= 255) {
        return rgb;
    }
    return `${rgb}${rounded.toString(16).padStart(2, '0').toUpperCase()}`;
}

export function FillEditorRowComp({
    label,
    isTop = false,
    children,
}: Readonly<{ label: string; isTop?: boolean; children: ReactNode }>) {
    return (
        <div className={'fill-editor-row' + (isTop ? ' is-top' : '')}>
            <span className="fill-editor-label">{label}</span>
            <div className="fill-editor-value">{children}</div>
        </div>
    );
}

/**
 * One colour of a fill, see-through included (2026-11-14, the user: _make
 * all color in customizing panel support transparency setting_): the well
 * picks its six digits, the range beside it how solid it is. A native well
 * shows six digits only, so it is drawn at the colour's own opacity over a
 * checkerboard -- a faint colour reads as one, as the foreground's swatches
 * do (`.fg-swatch`).
 */
export function FillColorFieldComp({
    color,
    label,
    onChange,
    children,
}: Readonly<{
    color: AppColorType;
    label: string;
    onChange: (color: AppColorType) => void;
    /** What else this colour's line holds: its Remove button. */
    children?: ReactNode;
}>) {
    const alpha = toAlpha(color);
    const opacityLabel = `${tran('Opacity')}: ${label}`;
    return (
        <span className="fill-editor-color">
            <span className="fill-editor-well">
                <input
                    type="color"
                    className="pointer fill-editor-well-input"
                    aria-label={label}
                    title={label}
                    value={toWellColor(color)}
                    style={{ opacity: alpha / 255 }}
                    onChange={(event) => {
                        onChange(
                            toFillColorWithAlpha(
                                event.currentTarget.value,
                                alpha,
                            ),
                        );
                    }}
                />
            </span>
            <AppRangeComp
                value={alpha}
                title={opacityLabel}
                setValue={(newAlpha) => {
                    onChange(toFillColorWithAlpha(color, newAlpha));
                }}
                defaultSize={OPACITY_RANGE}
                isShowValue
                isCompact
            />
            {children}
        </span>
    );
}

/** Buttons of which one is on, as the screens' own pickers draw them. */
export function ChoiceRowComp<T extends string>({
    label,
    value,
    choices,
    onChange,
}: Readonly<{
    label: string;
    value: T;
    choices: [T, string][];
    onChange: (value: T) => void;
}>) {
    return (
        <div className="fill-editor-choices" role="group" aria-label={label}>
            {choices.map(([choice, choiceLabel]) => {
                const isOn = choice === value;
                return (
                    <button
                        key={choice}
                        type="button"
                        className={
                            'btn btn-sm ' +
                            (isOn ? 'btn-info' : 'btn-outline-secondary')
                        }
                        aria-pressed={isOn}
                        onClick={() => {
                            if (!isOn) {
                                onChange(choice);
                            }
                        }}
                    >
                        {choiceLabel}
                    </button>
                );
            })}
        </div>
    );
}

function GradientFieldsComp({
    fill,
    onChange,
}: Readonly<{
    fill: FillGradientType;
    onChange: (fill: FillGradientType) => void;
}>) {
    const colorLabel = tran('Color');
    const typeLabel = tran('Type');
    const angleLabel = tran('Angle');
    const canRemove = fill.colors.length > MIN_FILL_GRADIENT_COLOR_COUNT;
    return (
        <>
            <FillEditorRowComp label={tran('Colors')} isTop>
                <div className="fill-editor-colors">
                    {fill.colors.map((color, index) => {
                        const label = `${colorLabel} ${index + 1}`;
                        return (
                            // By place: two stops may hold the same colour.
                            <FillColorFieldComp
                                key={index}
                                color={color}
                                label={label}
                                onChange={(newColor) => {
                                    const colors = [...fill.colors];
                                    colors[index] = newColor;
                                    onChange({ ...fill, colors });
                                }}
                            >
                                {canRemove ? (
                                    <button
                                        type="button"
                                        className="btn btn-sm fill-editor-remove"
                                        title={`${tran('Remove')}: ${label}`}
                                        aria-label={`${tran('Remove')}: ${label}`}
                                        onClick={() => {
                                            onChange({
                                                ...fill,
                                                colors: fill.colors.filter(
                                                    (_, i) => {
                                                        return i !== index;
                                                    },
                                                ),
                                            });
                                        }}
                                    >
                                        <i className="bi bi-x" />
                                    </button>
                                ) : null}
                            </FillColorFieldComp>
                        );
                    })}
                    {fill.colors.length < MAX_FILL_GRADIENT_COLOR_COUNT ? (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary fill-editor-add"
                            title={`${tran('Add')}: ${colorLabel}`}
                            aria-label={`${tran('Add')}: ${colorLabel}`}
                            onClick={() => {
                                onChange({
                                    ...fill,
                                    colors: [
                                        ...fill.colors,
                                        fill.colors.at(-1)!,
                                    ],
                                });
                            }}
                        >
                            <i className="bi bi-plus-lg" />
                        </button>
                    ) : null}
                </div>
            </FillEditorRowComp>
            <FillEditorRowComp label={typeLabel}>
                <ChoiceRowComp
                    label={typeLabel}
                    value={fill.shape}
                    choices={[
                        ['linear', tran('Linear')],
                        ['radial', tran('Radial')],
                    ]}
                    onChange={(shape) => {
                        onChange({ ...fill, shape });
                    }}
                />
            </FillEditorRowComp>
            {fill.shape === 'linear' ? (
                <FillEditorRowComp label={angleLabel}>
                    <AppRangeComp
                        value={fill.angle}
                        title={angleLabel}
                        setValue={(angle) => {
                            onChange({ ...fill, angle: Math.round(angle) });
                        }}
                        defaultSize={ANGLE_RANGE}
                        isShowValue
                        isCompact
                    />
                </FillEditorRowComp>
            ) : null}
        </>
    );
}

function PatternFieldsComp({
    fill,
    onChange,
}: Readonly<{
    fill: FillPatternType;
    onChange: (fill: FillPatternType) => void;
}>) {
    const patternsLabel = tran('Patterns');
    const backgroundColorLabel = tran('Background Color');
    const colorLabel = tran('Color');
    const sizeLabel = tran('Size');
    return (
        <>
            <FillEditorRowComp label={patternsLabel}>
                <select
                    className="form-select form-select-sm"
                    aria-label={patternsLabel}
                    title={patternsLabel}
                    value={fill.name}
                    onChange={(event) => {
                        onChange({
                            ...fill,
                            name: event.currentTarget
                                .value as FillPatternNameType,
                        });
                    }}
                >
                    {FILL_PATTERN_LIST.map((name) => {
                        return (
                            <option key={name} value={name}>
                                {tranFillPatternName(name)}
                            </option>
                        );
                    })}
                </select>
            </FillEditorRowComp>
            <FillEditorRowComp label={backgroundColorLabel}>
                <FillColorFieldComp
                    color={fill.base}
                    label={backgroundColorLabel}
                    onChange={(base) => {
                        onChange({ ...fill, base });
                    }}
                />
            </FillEditorRowComp>
            <FillEditorRowComp label={colorLabel}>
                <FillColorFieldComp
                    color={fill.ink}
                    label={colorLabel}
                    onChange={(ink) => {
                        onChange({ ...fill, ink });
                    }}
                />
            </FillEditorRowComp>
            <FillEditorRowComp label={sizeLabel}>
                <AppRangeComp
                    value={fill.size}
                    title={sizeLabel}
                    setValue={(size) => {
                        onChange({ ...fill, size: Math.round(size) });
                    }}
                    defaultSize={PATTERN_SIZE_RANGE}
                    isShowValue
                    isCompact
                />
            </FillEditorRowComp>
        </>
    );
}

/**
 * Customize: a held gradient or pattern changed part by part (2026-11-14,
 * the user: _should allow customizing and saving preset_), and how fast it
 * moves (_`Fills` should support css pattern animation as well_). It only
 * says what changed: the picker around it keeps the draft and puts it up,
 * after a pause, on the screen it belongs to.
 */
export default function FillEditorComp({
    fill,
    onChange,
}: Readonly<{
    fill: EditableFillType;
    onChange: (fill: EditableFillType) => void;
}>) {
    const label = tran('Customize');
    return (
        <div className="fill-editor" role="group" aria-label={label}>
            <div className="fill-picker-head">
                <i className="bi bi-sliders" aria-hidden="true" />
                <span>{label}</span>
            </div>
            {fill.kind === 'gradient' ? (
                <GradientFieldsComp fill={fill} onChange={onChange} />
            ) : (
                <PatternFieldsComp fill={fill} onChange={onChange} />
            )}
            <FillEditorRowComp label={tran('Speed')}>
                <ChoiceRowComp
                    label={tran('Speed')}
                    value={fill.motion}
                    choices={FILL_MOTION_LIST.map((motion) => {
                        return [motion, tranFillMotion(motion)];
                    })}
                    onChange={(motion) => {
                        onChange({ ...fill, motion });
                    }}
                />
            </FillEditorRowComp>
        </div>
    );
}
