import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
import AppRangeComp from '../../../others/AppRangeComp';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { useAppCurrentRef } from '../../../helper/appHooks';
import BlendModeSelectComp from '../../../others/BlendModeSelectComp';
import {
    checkIsBlending,
    toValidBlendMode,
} from '../../../helper/blendModeHelpers';
import ColorPickerComp from '../../../others/color/ColorPicker';
import type { AppColorType } from '../../../others/color/colorHelpers';
import BoxNumberFieldComp from './BoxNumberFieldComp';
import type {
    CanvasItemShadowType,
    CanvasShadowKindType,
} from '../canvasShadowHelpers';
import {
    CANVAS_SHADOW_BLUR_LIMIT,
    CANVAS_SHADOW_OFFSET_LIMIT,
    DEFAULT_CANVAS_SHADOW,
    toValidCanvasShadow,
} from '../canvasShadowHelpers';

// The `<select>` value for "casts none". It is never stored -- a box with no
// shadow carries no `shadow` key at all -- so it lives here, in the one place
// that has to show the operator something.
const SHADOW_NONE_VALUE = 'none';

/**
 * The shadow rows: the kind, how far it falls, how soft it is and what colour.
 *
 * Only the kind is shown while a box casts none. Four controls for a property
 * most boxes never use would be four rows of a 280px column spent on nothing,
 * and the three that are hidden are exactly the three that mean nothing until
 * there is a shadow to describe.
 */
function ShadowPropertiesComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    // Read back through the validator rather than off the panel's own state:
    // it clamps and rounds, so a typed 9999 shows as the 200 that will be
    // stored instead of a number the box will not honour.
    const shadow = toValidCanvasShadow(props.shadow);
    const setPropsRef = useAppCurrentRef(setProps);
    const shadowRef = useAppCurrentRef(shadow);
    const applyShadowChange = useCallback(
        (patch: Partial<CanvasItemShadowType>) => {
            setPropsRef.current({
                shadow: {
                    ...(shadowRef.current ?? DEFAULT_CANVAS_SHADOW),
                    ...patch,
                },
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const applyShadowChangeRef = useAppCurrentRef(applyShadowChange);
    const handleKindChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const kind = event.target.value;
            if (kind === SHADOW_NONE_VALUE) {
                // `null` is what `cleanupCanvasShadow` takes the key off for:
                // picking None back leaves no trace in the document.
                setPropsRef.current({ shadow: null });
                return;
            }
            applyShadowChangeRef.current({
                kind: kind as CanvasShadowKindType,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleNumberChange = useCallback(
        (key: 'offsetX' | 'offsetY' | 'blur', value: number) => {
            applyShadowChangeRef.current({ [key]: value });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleColorChange = useCallback((color: AppColorType) => {
        applyShadowChangeRef.current({ color });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const shadowLabel = tran('Shadow');
    return (
        <>
            <div
                className="d-flex input-group input-group-sm"
                title={tran(
                    'A box shadow follows the box, a drop shadow the ' +
                        'letters or picture',
                )}
            >
                <div className="input-group-text">
                    <i
                        className={
                            'bi bi-shadows' + (shadow ? ' text-info' : '')
                        }
                    />
                    <span className="ps-1">{shadowLabel}</span>
                </div>
                <select
                    className="form-select form-select-sm"
                    aria-label={shadowLabel}
                    value={shadow?.kind ?? SHADOW_NONE_VALUE}
                    onChange={handleKindChange}
                >
                    <option value={SHADOW_NONE_VALUE}>
                        {tran('No Shadow')}
                    </option>
                    <option value="box">{tran('Box Shadow')}</option>
                    <option value="drop">{tran('Drop Shadow')}</option>
                </select>
            </div>
            {shadow === null ? null : (
                <>
                    <div className="d-flex gap-1">
                        <BoxNumberFieldComp
                            name="X:"
                            title={tran('Shadow Offset X')}
                            value={shadow.offsetX}
                            min={-CANVAS_SHADOW_OFFSET_LIMIT}
                            max={CANVAS_SHADOW_OFFSET_LIMIT}
                            onChange={(value) => {
                                handleNumberChange('offsetX', value);
                            }}
                        />
                        <BoxNumberFieldComp
                            name="Y:"
                            title={tran('Shadow Offset Y')}
                            value={shadow.offsetY}
                            min={-CANVAS_SHADOW_OFFSET_LIMIT}
                            max={CANVAS_SHADOW_OFFSET_LIMIT}
                            onChange={(value) => {
                                handleNumberChange('offsetY', value);
                            }}
                        />
                    </div>
                    <BoxNumberFieldComp
                        name={tran('Blur:')}
                        title={tran('Shadow Blur')}
                        value={shadow.blur}
                        min={0}
                        max={CANVAS_SHADOW_BLUR_LIMIT}
                        onChange={(value) => {
                            handleNumberChange('blur', value);
                        }}
                    />
                    <div
                        className="app-border-white-round"
                        title={tran('Shadow Color')}
                    >
                        <ColorPickerComp
                            color={shadow.color}
                            defaultColor={DEFAULT_CANVAS_SHADOW.color}
                            onColorChange={handleColorChange}
                            isCollapsable
                        />
                    </div>
                </>
            )}
        </>
    );
}

export default function ShapePropertiesComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const roundSizePixel = props.roundSizePixel ?? 0;
    const roundSizePercentage =
        roundSizePixel > 0 ? 0 : (props.roundSizePercentage ?? 0);
    const setPropsRef = useAppCurrentRef(setProps);
    const handleBackdropFilterChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setPropsRef.current({
                backdropFilter: Number.parseInt(e.target.value, 10),
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleRoundPercentageChange = useCallback((value: number) => {
        setPropsRef.current({ roundSizePercentage: value });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRoundPixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const value = Number.parseInt(event.target.value, 10) || 0;
            setPropsRef.current({
                roundSizePixel: value,
                roundSizePercentage: 0,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleBlendModeChange = useCallback((value: string) => {
        // `normal` is written straight back: `applyProps` drops the key rather
        // than storing it, so an item put back to Normal leaves no trace in
        // the document.
        setPropsRef.current({ blendMode: value });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const blendMode = toValidBlendMode(props.blendMode);
    return (
        <div className="d-flex flex-column gap-1" style={{ maxWidth: '280px' }}>
            <div className="d-flex input-group input-group-sm">
                <div className="input-group-text">{tran('Glass Effect')}</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    min={0}
                    value={props.backdropFilter}
                    onChange={handleBackdropFilterChange}
                />
                <div className="input-group-text">px</div>
            </div>
            <div
                className="d-flex align-items-center gap-1"
                title={tran('Round Size %:')}
            >
                <span className="text-nowrap small">{tran('Round:')}</span>
                <div
                    className="flex-grow-1"
                    style={
                        roundSizePixel > 0
                            ? { opacity: 0.5, pointerEvents: 'none' }
                            : {}
                    }
                >
                    <AppRangeComp
                        value={roundSizePercentage}
                        title={
                            roundSizePixel > 0
                                ? tran('Set round size pixel to 0 to use this')
                                : tran('Round (%)')
                        }
                        setValue={handleRoundPercentageChange}
                        defaultSize={{
                            size: roundSizePercentage,
                            min: 0,
                            max: 100,
                            step: 1,
                        }}
                        isShowValue
                    />
                </div>
                <div
                    className="d-flex input-group input-group-sm flex-nowrap"
                    style={{ width: '90px', flexShrink: 0 }}
                    title={tran('Round Size Pixel:')}
                >
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        value={roundSizePixel}
                        min={0}
                        onChange={handleRoundPixelChange}
                    />
                    <div className="input-group-text">px</div>
                </div>
            </div>
            <ShadowPropertiesComp />
            <div
                className="d-flex input-group input-group-sm"
                title={tran('Blends this box with the items under it')}
            >
                <div className="input-group-text">
                    <i
                        className={
                            'bi bi-layers-half' +
                            (checkIsBlending(blendMode) ? ' text-info' : '')
                        }
                    />
                    <span className="ps-1">{tran('Blend Mode')}</span>
                </div>
                <BlendModeSelectComp
                    className="form-select form-select-sm"
                    blendMode={blendMode}
                    setBlendMode={handleBlendModeChange}
                />
            </div>
        </div>
    );
}
