import { useState } from 'react';

import { getAllDisplays } from '../_screen/managers/screenHelpers';
import { isVirtualDisplayId } from '../../electron/virtualDisplayProtocol';
import { tran } from '../lang/langHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import {
    ANIMATION_EXPORT_FRAME_RATE_LIST,
    listAnimationExportSizes,
    MAX_ANIMATION_EXPORT_EDGE,
    MAX_ANIMATION_EXPORT_SECONDS,
    MIN_ANIMATION_EXPORT_EDGE,
    MIN_ANIMATION_EXPORT_SECONDS,
    toValidAnimationExportOptions,
    type AnimationExportKindType,
    type AnimationExportOptionsType,
    type AnimationExportSizeType,
} from './animationExportOptionHelpers';

const CUSTOM_VALUE = 'custom';

function toSizeValue(size: AnimationExportSizeType) {
    return `${size.width}x${size.height}`;
}

/** The sizes of the monitors this computer has, a screen's likely size. */
function readDisplaySizes(): AnimationExportSizeType[] {
    try {
        return getAllDisplays()
            .displays.filter((display) => {
                return !isVirtualDisplayId(display.id);
            })
            .map((display) => {
                return {
                    width: display.bounds.width,
                    height: display.bounds.height,
                };
            });
    } catch {
        return [];
    }
}

function NumberFieldComp({
    label,
    value,
    min,
    max,
    onChange,
}: Readonly<{
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}>) {
    return (
        <label className="input-group input-group-sm">
            <span className="input-group-text">{label}</span>
            <input
                type="number"
                className="form-control"
                aria-label={label}
                title={label}
                min={min}
                max={max}
                value={value}
                onChange={(event) => {
                    onChange(Number(event.currentTarget.value));
                }}
            />
        </label>
    );
}

export function AnimationExportDialogBodyComp({
    kind,
    initialOptions,
    sizes,
    onChange,
}: Readonly<{
    kind: AnimationExportKindType;
    initialOptions: AnimationExportOptionsType;
    sizes: AnimationExportSizeType[];
    onChange: (options: AnimationExportOptionsType) => void;
}>) {
    const [options, setOptions] = useState(initialOptions);
    const [isCustom, setIsCustom] = useState(() => {
        return !sizes.some((size) => {
            return toSizeValue(size) === toSizeValue(initialOptions);
        });
    });
    const change = (newOptions: AnimationExportOptionsType) => {
        setOptions(newOptions);
        onChange(newOptions);
    };
    const resolutionLabel = tran('Resolution');
    const frameRateLabel = tran('Frame Rate');
    return (
        <div className="d-flex flex-column gap-2 p-2">
            <label className="input-group input-group-sm">
                <span className="input-group-text">{resolutionLabel}</span>
                <select
                    className="form-select form-select-sm"
                    aria-label={resolutionLabel}
                    title={resolutionLabel}
                    value={isCustom ? CUSTOM_VALUE : toSizeValue(options)}
                    onChange={(event) => {
                        const value = event.currentTarget.value;
                        if (value === CUSTOM_VALUE) {
                            setIsCustom(true);
                            return;
                        }
                        const size = sizes.find((item) => {
                            return toSizeValue(item) === value;
                        });
                        if (size !== undefined) {
                            setIsCustom(false);
                            change({ ...options, ...size });
                        }
                    }}
                >
                    {sizes.map((size) => {
                        const value = toSizeValue(size);
                        return (
                            <option key={value} value={value}>
                                {size.width} × {size.height}
                            </option>
                        );
                    })}
                    <option value={CUSTOM_VALUE}>{tran('Custom')}</option>
                </select>
            </label>
            {isCustom ? (
                <div className="d-flex gap-2">
                    <NumberFieldComp
                        label={tran('Width')}
                        value={options.width}
                        min={MIN_ANIMATION_EXPORT_EDGE}
                        max={MAX_ANIMATION_EXPORT_EDGE}
                        onChange={(width) => {
                            change({ ...options, width });
                        }}
                    />
                    <NumberFieldComp
                        label={tran('Height')}
                        value={options.height}
                        min={MIN_ANIMATION_EXPORT_EDGE}
                        max={MAX_ANIMATION_EXPORT_EDGE}
                        onChange={(height) => {
                            change({ ...options, height });
                        }}
                    />
                </div>
            ) : null}
            {kind === 'video' ? (
                <>
                    <NumberFieldComp
                        label={`${tran('Duration')} (${tran('Seconds')})`}
                        value={options.seconds}
                        min={MIN_ANIMATION_EXPORT_SECONDS}
                        max={MAX_ANIMATION_EXPORT_SECONDS}
                        onChange={(seconds) => {
                            change({ ...options, seconds });
                        }}
                    />
                    <label className="input-group input-group-sm">
                        <span className="input-group-text">
                            {frameRateLabel}
                        </span>
                        <select
                            className="form-select form-select-sm"
                            aria-label={frameRateLabel}
                            title={frameRateLabel}
                            value={options.frameRate}
                            onChange={(event) => {
                                change({
                                    ...options,
                                    frameRate: Number(
                                        event.currentTarget.value,
                                    ),
                                });
                            }}
                        >
                            {ANIMATION_EXPORT_FRAME_RATE_LIST.map(
                                (frameRate) => {
                                    return (
                                        <option
                                            key={frameRate}
                                            value={frameRate}
                                        >
                                            {frameRate}
                                        </option>
                                    );
                                },
                            )}
                        </select>
                    </label>
                </>
            ) : null}
        </div>
    );
}

/**
 * The size of a saved picture -- and for a video how long and how many
 * frames a second -- asked in the app's own popup, last time's answer
 * first. Null when cancelled. Whatever is typed is made valid: an edge
 * whole and even within 16-4096, seconds within 1-300.
 */
export async function askAnimationExportOptions(
    kind: AnimationExportKindType,
    initialOptions: AnimationExportOptionsType,
): Promise<AnimationExportOptionsType | null> {
    let chosen = initialOptions;
    const isOk = await showAppInput(
        kind === 'image'
            ? `${tran('Save as image')} (PNG)`
            : `${tran('Save as video')} (MP4)`,
        <AnimationExportDialogBodyComp
            kind={kind}
            initialOptions={initialOptions}
            sizes={listAnimationExportSizes(readDisplaySizes())}
            onChange={(options) => {
                chosen = options;
            }}
        />,
        { escToCancel: true, enterToOk: true },
    );
    if (!isOk) {
        return null;
    }
    return toValidAnimationExportOptions(chosen);
}
