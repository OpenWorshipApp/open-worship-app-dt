import AppRangeComp, { type AppRangeDefaultType } from '../others/AppRangeComp';
import BlendModeSelectComp from '../others/BlendModeSelectComp';
import { toValidBlendMode } from '../helper/blendModeHelpers';
import { tran } from '../lang/langHelpers';
import {
    ChoiceRowComp,
    FillColorFieldComp,
    FillEditorRowComp,
} from './FillEditorComp';
import {
    tranAnimationLevel,
    tranAnimationSpeed,
    tranCssAnimationName,
    tranGlslAnimationName,
} from './animationLabelHelpers';
import {
    ANIMATION_LEVEL_LIST,
    ANIMATION_SPEED_LIST,
    CSS_ANIMATION_NAME_LIST,
    GLSL_ANIMATION_NAME_LIST,
    MAX_ANIMATION_COLOR_COUNT,
    MAX_ANIMATION_OPACITY,
    MIN_ANIMATION_COLOR_COUNT,
    MIN_ANIMATION_OPACITY,
    type AnimationLevelType,
    type AnimationType,
    type CssAnimationNameType,
    type GlslAnimationNameType,
} from './animationValueHelpers';

// Made once: a range re-reads its prop each time this object is a new one.
const OPACITY_RANGE: AppRangeDefaultType = {
    size: MAX_ANIMATION_OPACITY,
    min: MIN_ANIMATION_OPACITY,
    max: MAX_ANIMATION_OPACITY,
    step: 1,
};

const LEVEL_CHOICES = () => {
    return ANIMATION_LEVEL_LIST.map((level) => {
        return [level, tranAnimationLevel(level)] as [
            AnimationLevelType,
            string,
        ];
    });
};

function EffectSelectComp({
    animation,
    onChange,
}: Readonly<{
    animation: AnimationType;
    onChange: (animation: AnimationType) => void;
}>) {
    const label = tran('Effect');
    return (
        <FillEditorRowComp label={label}>
            <select
                className="form-select form-select-sm"
                aria-label={label}
                title={label}
                value={animation.name}
                onChange={(event) => {
                    const name = event.currentTarget.value;
                    if (animation.engine === 'css') {
                        onChange({
                            ...animation,
                            name: name as CssAnimationNameType,
                        });
                        return;
                    }
                    if (name === 'custom') {
                        return;
                    }
                    // A built-in again: a person's own code goes with it.
                    onChange({
                        ...animation,
                        name: name as GlslAnimationNameType,
                        code: null,
                    });
                }}
            >
                {animation.engine === 'css'
                    ? CSS_ANIMATION_NAME_LIST.map((name) => {
                          return (
                              <option key={name} value={name}>
                                  {tranCssAnimationName(name)}
                              </option>
                          );
                      })
                    : [
                          ...(animation.name === 'custom'
                              ? [
                                    <option key="custom" value="custom">
                                        {tranGlslAnimationName('custom')}
                                    </option>,
                                ]
                              : []),
                          ...GLSL_ANIMATION_NAME_LIST.map((name) => {
                              return (
                                  <option key={name} value={name}>
                                      {tranGlslAnimationName(name)}
                                  </option>
                              );
                          }),
                      ]}
            </select>
        </FillEditorRowComp>
    );
}

function AnimationColorsComp({
    animation,
    onChange,
}: Readonly<{
    animation: AnimationType;
    onChange: (animation: AnimationType) => void;
}>) {
    const colorLabel = tran('Color');
    const canRemove = animation.colors.length > MIN_ANIMATION_COLOR_COUNT;
    return (
        <FillEditorRowComp label={tran('Colors')} isTop>
            <div className="fill-editor-colors">
                {animation.colors.map((color, index) => {
                    // The first is the ground the others move over.
                    const label =
                        index === 0
                            ? tran('Background Color')
                            : `${colorLabel} ${index}`;
                    return (
                        // By place: two may hold the same colour.
                        <FillColorFieldComp
                            key={index}
                            color={color}
                            label={label}
                            onChange={(newColor) => {
                                const colors = [...animation.colors];
                                colors[index] = newColor;
                                onChange({ ...animation, colors });
                            }}
                        >
                            {canRemove && index > 0 ? (
                                <button
                                    type="button"
                                    className="btn btn-sm fill-editor-remove"
                                    title={`${tran('Remove')}: ${label}`}
                                    aria-label={`${tran('Remove')}: ${label}`}
                                    onClick={() => {
                                        onChange({
                                            ...animation,
                                            colors: animation.colors.filter(
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
                {animation.colors.length < MAX_ANIMATION_COLOR_COUNT ? (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary fill-editor-add"
                        title={`${tran('Add')}: ${colorLabel}`}
                        aria-label={`${tran('Add')}: ${colorLabel}`}
                        onClick={() => {
                            onChange({
                                ...animation,
                                colors: [
                                    ...animation.colors,
                                    animation.colors.at(-1)!,
                                ],
                            });
                        }}
                    >
                        <i className="bi bi-plus-lg" />
                    </button>
                ) : null}
            </div>
        </FillEditorRowComp>
    );
}

/**
 * Customize: a held animation changed part by part (2026-11-15, the user:
 * _have to allow customizing and preset_) -- its effect, colours (each
 * with its own see-through), speed, how much of it there is (a CSS one) or
 * how finely it is drawn (a shader), how solid the whole is and how it
 * blends with what is under it. A shader's code opens in Edit Code. It only
 * says what changed: the picker around it keeps the draft and puts it up,
 * after a pause, on the screen it belongs to.
 */
export default function AnimationEditorComp({
    animation,
    onChange,
    onCodeEditing,
}: Readonly<{
    animation: AnimationType;
    onChange: (animation: AnimationType) => void;
    /** Opens the shader's code; a CSS animation has none. */
    onCodeEditing?: () => void;
}>) {
    const label = tran('Customize');
    const speedLabel = tran('Speed');
    const opacityLabel = tran('Opacity');
    const blendLabel = tran('Blend Mode');
    return (
        <div className="fill-editor" role="group" aria-label={label}>
            <div className="fill-picker-head">
                <i className="bi bi-sliders" aria-hidden="true" />
                <span>{label}</span>
            </div>
            <EffectSelectComp animation={animation} onChange={onChange} />
            <AnimationColorsComp animation={animation} onChange={onChange} />
            <FillEditorRowComp label={speedLabel}>
                <ChoiceRowComp
                    label={speedLabel}
                    value={animation.speed}
                    choices={ANIMATION_SPEED_LIST.map((speed) => {
                        return [speed, tranAnimationSpeed(speed)];
                    })}
                    onChange={(speed) => {
                        onChange({ ...animation, speed });
                    }}
                />
            </FillEditorRowComp>
            {animation.engine === 'css' ? (
                <FillEditorRowComp label={tran('Density')}>
                    <ChoiceRowComp
                        label={tran('Density')}
                        value={animation.density}
                        choices={LEVEL_CHOICES()}
                        onChange={(density) => {
                            onChange({ ...animation, density });
                        }}
                    />
                </FillEditorRowComp>
            ) : (
                <FillEditorRowComp label={tran('Quality')}>
                    <ChoiceRowComp
                        label={tran('Quality')}
                        value={animation.quality}
                        choices={LEVEL_CHOICES()}
                        onChange={(quality) => {
                            onChange({ ...animation, quality });
                        }}
                    />
                </FillEditorRowComp>
            )}
            <FillEditorRowComp label={opacityLabel}>
                <AppRangeComp
                    value={animation.opacity}
                    title={opacityLabel}
                    setValue={(opacity) => {
                        onChange({
                            ...animation,
                            opacity: Math.round(opacity),
                        });
                    }}
                    defaultSize={OPACITY_RANGE}
                    isShowValue
                    isCompact
                />
            </FillEditorRowComp>
            <FillEditorRowComp label={blendLabel}>
                <BlendModeSelectComp
                    className="form-select form-select-sm"
                    blendMode={animation.blend}
                    setBlendMode={(blend) => {
                        onChange({
                            ...animation,
                            blend: toValidBlendMode(blend),
                        });
                    }}
                />
            </FillEditorRowComp>
            {onCodeEditing === undefined ? null : (
                <div className="fill-editor-row">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        onClick={onCodeEditing}
                    >
                        <i className="bi bi-code-slash" aria-hidden="true" />{' '}
                        {tran('Edit Code')}
                    </button>
                </div>
            )}
        </div>
    );
}
