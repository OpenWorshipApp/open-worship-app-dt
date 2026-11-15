import type { ReactNode } from 'react';

import AppRangeComp, { type AppRangeDefaultType } from '../others/AppRangeComp';
import { colorToTransparent } from '../others/color/colorValueHelpers';
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
const INK_ALPHA_RANGE: AppRangeDefaultType = {
    size: 32,
    min: 1,
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

/** A colour from a well, with the alpha it had before. */
function withAlpha(wellColor: string, oldColor: string) {
    const alpha = (toFillHexColor(oldColor) ?? '').slice(7);
    return `${wellColor.toUpperCase()}${alpha}` as `#${string}`;
}

function toAlphaHex(alpha: number) {
    return Math.round(Math.min(255, Math.max(0, alpha)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
}

function FillEditorRowComp({
    label,
    children,
}: Readonly<{ label: string; children: ReactNode }>) {
    return (
        <div className="fill-editor-row">
            <span className="fill-editor-label">{label}</span>
            <div className="fill-editor-value">{children}</div>
        </div>
    );
}

function ColorWellComp({
    color,
    label,
    onChange,
}: Readonly<{
    color: string;
    label: string;
    onChange: (wellColor: string) => void;
}>) {
    return (
        <input
            type="color"
            className="pointer color-picker-mix-input"
            aria-label={label}
            title={label}
            value={toWellColor(color)}
            onChange={(event) => {
                onChange(event.currentTarget.value);
            }}
        />
    );
}

/** Buttons of which one is on, as the screens' own pickers draw them. */
function ChoiceRowComp<T extends string>({
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
            <FillEditorRowComp label={tran('Colors')}>
                <div className="fill-editor-colors">
                    {fill.colors.map((color, index) => {
                        const label = `${colorLabel} ${index + 1}`;
                        return (
                            // By place: two stops may hold the same colour.
                            <span key={index} className="fill-editor-color">
                                <ColorWellComp
                                    color={color}
                                    label={label}
                                    onChange={(wellColor) => {
                                        const colors = [...fill.colors];
                                        colors[index] = withAlpha(
                                            wellColor,
                                            color,
                                        );
                                        onChange({ ...fill, colors });
                                    }}
                                />
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
                            </span>
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
    const opacityLabel = tran('Opacity');
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
                <ColorWellComp
                    color={fill.base}
                    label={backgroundColorLabel}
                    onChange={(wellColor) => {
                        onChange({
                            ...fill,
                            base: withAlpha(wellColor, fill.base),
                        });
                    }}
                />
            </FillEditorRowComp>
            <FillEditorRowComp label={colorLabel}>
                <ColorWellComp
                    color={fill.ink}
                    label={colorLabel}
                    onChange={(wellColor) => {
                        onChange({
                            ...fill,
                            ink: withAlpha(wellColor, fill.ink),
                        });
                    }}
                />
            </FillEditorRowComp>
            <FillEditorRowComp label={opacityLabel}>
                <AppRangeComp
                    value={colorToTransparent(fill.ink)}
                    title={opacityLabel}
                    setValue={(alpha) => {
                        onChange({
                            ...fill,
                            ink: `${fill.ink.slice(0, 7)}${toAlphaHex(alpha)}` as `#${string}`,
                        });
                    }}
                    defaultSize={INK_ALPHA_RANGE}
                    isShowValue
                    isCompact
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
