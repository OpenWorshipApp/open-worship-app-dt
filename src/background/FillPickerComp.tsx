import './FillPickerComp.scss';

import {
    type MouseEvent,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';

import ColorPicker from '../others/color/ColorPicker';
import {
    type AppColorType,
    HEX_COLOR_BLACK,
} from '../others/color/colorValueHelpers';
import type { ColorModeType } from '../others/color/colorContrastHelpers';
import ColorModeSwitchComp from '../others/ColorModeSwitchComp';
import PresetsRowComp from '../others/PresetsRowComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';
import FillTileComp, { FILL_TILE_SCALE } from './FillTileComp';
import { genFillCopyCssMenuItems } from './fillCssMenuHelpers';
import FillEditorComp, { type EditableFillType } from './FillEditorComp';
import { genFillLabel } from './fillLabelHelpers';
import {
    FILL_BUILT_IN_GRADIENT_MAP,
    FILL_BUILT_IN_PATTERN_MAP,
    findFillTone,
    toInitialFillTone,
} from './fillBuiltInHelpers';
import {
    FILL_PRESET_SETTING_NAME,
    type SavedFillPresetType,
    toSavedFillPreset,
} from './fillPresetHelpers';
import {
    checkIsFillDark,
    compareFillSrc,
    genFillBackground,
    parseFill,
    toFillSrc,
    type FillType,
} from './fillValueHelpers';

function toEditableFill(fill: FillType | null): EditableFillType | null {
    return fill === null || fill.kind === 'solid' ? null : fill;
}

// A saved fill copies its CSS as a tile does.
function genSavedMenuItems(preset: SavedFillPresetType) {
    return genFillCopyCssMenuItems(preset.src);
}

function genSavedChipColors(preset: SavedFillPresetType) {
    const fill = parseFill(preset.src);
    if (fill === null) {
        return null;
    }
    return {
        color: checkIsFillDark(fill) ? '#FFFFFF' : '#000000',
        backgroundColor: genFillBackground(fill, FILL_TILE_SCALE),
    };
}

function FillTileGridComp({
    iconName,
    label,
    srcList,
    heldSrc,
    onPick,
    headEnd,
}: Readonly<{
    iconName: string;
    label: string;
    srcList: string[];
    heldSrc: string | null;
    onPick: (src: string, event: MouseEvent) => void;
    /** At the far end of the name's line. */
    headEnd?: ReactNode;
}>) {
    return (
        <div className="fill-picker-section" role="group" aria-label={label}>
            <div className="fill-picker-head">
                <i className={`bi bi-${iconName}`} aria-hidden="true" />
                <span>{label}</span>
                {headEnd}
            </div>
            <div className="fill-picker-grid">
                {srcList.map((src) => {
                    const fill = parseFill(src);
                    if (fill === null) {
                        return null;
                    }
                    return (
                        <FillTileComp
                            key={src}
                            src={src}
                            fill={fill}
                            label={genFillLabel(fill)}
                            isSelected={compareFillSrc(src, heldSrc)}
                            onPick={onPick}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/** How one screen's picker is laid out, remembered for that screen. */
export type FillPickerScreenViewType = Readonly<{
    screenId: number;
    isFolded: boolean;
    onFoldToggle: () => void;
    isCustomizeClosed: boolean;
    onCustomizeToggle: () => void;
}>;

/**
 * A screen's fold: the chevron alone, in the screen's own colour -- the one
 * its badge wears -- so which screen it folds reads before the number does
 * (2026-11-14, the user: _make the collapsing icon colored follow screen
 * color_).
 */
export function FillPickerFoldComp({
    screenView: { screenId, isFolded, onFoldToggle },
}: Readonly<{ screenView: FillPickerScreenViewType }>) {
    const screenLabel = `${tran('Screen')} ${screenId}`;
    const label = `${isFolded ? tran('Expand') : tran('Collapse')}: ${screenLabel}`;
    return (
        <button
            type="button"
            className="fill-picker-fold"
            style={{ color: genColorFromScreenId(screenId) }}
            aria-expanded={!isFolded}
            aria-label={label}
            title={label}
            onClick={onFoldToggle}
        >
            <i
                className={`bi bi-chevron-${isFolded ? 'right' : 'down'}`}
                aria-hidden="true"
            />
        </button>
    );
}

/** What a folded picker's screen holds: a still tile and its name. */
function FillHeldComp({ fill }: Readonly<{ fill: FillType }>) {
    const label = genFillLabel(fill);
    return (
        <span className="fill-picker-held" title={label}>
            <span
                className="fill-picker-held-tile"
                style={{ background: genFillBackground(fill, FILL_TILE_SCALE) }}
                aria-hidden="true"
            />
            <span className="fill-picker-held-label">{label}</span>
        </span>
    );
}

/**
 * Opens and closes Customize from the gradients' line (2026-11-14, the user:
 * _add a toggle icon somewhere in the gradient|pattern panel to open/close
 * the customizing panel_). Closed, its box is gone and the tiles take the
 * row.
 */
export function FillCustomizeToggleComp({
    isOpen,
    onToggle,
}: Readonly<{ isOpen: boolean; onToggle: () => void }>) {
    const label = tran('Customize');
    return (
        <button
            type="button"
            className={'fill-picker-customize' + (isOpen ? ' is-on' : '')}
            aria-pressed={isOpen}
            aria-label={label}
            title={label}
            onClick={onToggle}
        >
            <i className="bi bi-sliders" aria-hidden="true" />
        </button>
    );
}

/**
 * The Background panel's Fills for one screen -- or for whichever screens a
 * press is sent to, while none holds a fill: the colours (the colour picker
 * everywhere else in the app), then gradients and patterns on the same side
 * of ONE Dark / Light switch with the fills somebody saved under them, then
 * Customize for a held gradient or pattern -- boxes side by side across the
 * panel. One screen's picker folds to its first line (_make each section
 * collapsible_): its fold, its badge and what it holds, the rest unmounted;
 * and its Customize closes from the gradients' line.
 *
 * A press (a swatch, a tile, a saved fill, No Color) goes up at once, as a
 * colour always did -- pressing what is up takes it down. Customize goes up
 * after a pause (`genTimeoutAttempt`, this picker's own: every screen with a
 * fill has a picker, and each must put up its own last change), so a drag
 * along a slider is one screen change, not one a frame.
 */
export default function FillPickerComp({
    screenView,
    heldSrc,
    onPick,
    onEdit,
}: Readonly<{
    /**
     * The screen a picker is ONE screen's: its fold before the Dark / Light
     * switch, its badge after it -- folded or not -- and whether its
     * Customize is closed. Without it nothing folds or closes.
     */
    screenView?: FillPickerScreenViewType;
    /** The fill this picker's screen holds; null when it holds none. */
    heldSrc: string | null;
    /** A press; `null` is No Color, offered only beside `onEdit`. */
    onPick: (src: string | null, event: MouseEvent) => void;
    /** A change made in Customize; without it there is nothing to change. */
    onEdit?: (src: string) => void;
}>) {
    const heldFill = useMemo(() => {
        return parseFill(heldSrc);
    }, [heldSrc]);
    const [tone, setTone] = useState<ColorModeType>(() => {
        return toInitialFillTone(heldSrc);
    });
    // As the colour tones: the switch moves only when what is held is one of
    // the OTHER side's -- a press on it is never undone by a re-render.
    const heldTone = findFillTone(heldSrc);
    useAppEffect(() => {
        if (heldTone !== null) {
            setTone(heldTone);
        }
    }, [heldTone]);

    const [draft, setDraft] = useState<EditableFillType | null>(() => {
        return toEditableFill(heldFill);
    });
    // The change waiting to go up, if one is.
    const pendingSrcRef = useRef<string | null>(null);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const onEditRef = useAppCurrentRef(onEdit);
    const onPickRef = useAppCurrentRef(onPick);
    const flushEdit = useCallback(() => {
        const src = pendingSrcRef.current;
        pendingSrcRef.current = null;
        if (src !== null) {
            onEditRef.current?.(src);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // What the screen holds now is what Customize shows -- unless a change
    // is still on its way up, which that would undo under the pointer.
    useAppEffect(() => {
        if (pendingSrcRef.current === null) {
            setDraft(toEditableFill(heldFill));
        }
    }, [heldFill]);
    // A change still waiting when the picker goes (the tab closed) goes up
    // now rather than never; `onEdit` itself decides whether it still can.
    useAppEffect(() => {
        return () => {
            attemptTimeout(flushEdit, true);
        };
    }, []);
    const handleEditing = useCallback((fill: EditableFillType) => {
        setDraft(fill);
        pendingSrcRef.current = toFillSrc(fill);
        attemptTimeout(flushEdit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePicking = useCallback(
        (src: string | null, event: MouseEvent) => {
            // A press wins over a change still waiting: put up later, the
            // change would take the press's fill straight back down.
            pendingSrcRef.current = null;
            attemptTimeout(() => {}, true);
            onPickRef.current(src, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const currentSrc =
        draft === null
            ? heldFill === null
                ? null
                : toFillSrc(heldFill)
            : toFillSrc(draft);
    const currentSrcRef = useAppCurrentRef(currentSrc);
    const readCurrent = useCallback(() => {
        return { src: currentSrcRef.current ?? '' };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const heldColor =
        heldFill?.kind === 'solid' ? (heldSrc as AppColorType) : null;
    const isEditable = onEdit !== undefined;
    const isFolded = screenView?.isFolded === true;
    // Offered for a held gradient or pattern on a screen's own picker; open
    // unless that screen's was closed.
    const isCustomizeOffered = isEditable && draft !== null;
    const isCustomizeOpen =
        isCustomizeOffered && screenView?.isCustomizeClosed !== true;
    return (
        <div className="fill-picker">
            <div className="fill-picker-bar">
                {screenView === undefined ? null : (
                    <FillPickerFoldComp screenView={screenView} />
                )}
                {isFolded ? null : (
                    <ColorModeSwitchComp
                        mode={tone}
                        onChange={setTone}
                        groupLabel={tran('Fills')}
                        darkTitle={tran('Dark')}
                        lightTitle={tran('Light')}
                    />
                )}
                {screenView === undefined ? null : (
                    <ShowingScreenIcon screenId={screenView.screenId} />
                )}
                {isFolded && heldFill !== null ? (
                    <FillHeldComp fill={heldFill} />
                ) : null}
            </div>
            {isFolded ? null : (
                // Folded, none of this is mounted: a folded screen costs
                // its line alone.
                <>
                    <ColorPicker
                        color={heldColor}
                        defaultColor={heldColor ?? HEX_COLOR_BLACK}
                        onColorChange={(color, event) => {
                            handlePicking(color, event as any);
                        }}
                        onNoColor={
                            isEditable
                                ? (_color, event) => {
                                      handlePicking(null, event as any);
                                  }
                                : undefined
                        }
                        isNoImmediate={true}
                        tone={tone}
                        isOtherValueHeld={
                            heldFill !== null && heldColor === null
                        }
                    />
                    <div className="fill-picker-box">
                        <FillTileGridComp
                            iconName="rainbow"
                            label={tran('Gradients')}
                            srcList={FILL_BUILT_IN_GRADIENT_MAP[tone]}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                            headEnd={
                                isCustomizeOffered &&
                                screenView !== undefined ? (
                                    <FillCustomizeToggleComp
                                        isOpen={isCustomizeOpen}
                                        onToggle={screenView.onCustomizeToggle}
                                    />
                                ) : null
                            }
                        />
                        <FillTileGridComp
                            iconName="grid-3x3"
                            label={tran('Patterns')}
                            srcList={FILL_BUILT_IN_PATTERN_MAP[tone]}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                        />
                        {/* The saved fills are picked as the tiles above
                            them are (_the preset section should be part of
                            gradient|pattern_). */}
                        <PresetsRowComp<SavedFillPresetType>
                            savedSettingName={FILL_PRESET_SETTING_NAME}
                            toSavedPreset={toSavedFillPreset}
                            builtIns={[]}
                            readCurrent={readCurrent}
                            onSavedPick={(preset, event) => {
                                handlePicking(preset.src, event);
                            }}
                            genSavedChipColors={genSavedChipColors}
                            genSavedMenuItems={genSavedMenuItems}
                            canSave={currentSrc !== null}
                        />
                    </div>
                    {isCustomizeOpen && draft !== null ? (
                        <div className="fill-picker-box">
                            <FillEditorComp
                                fill={draft}
                                onChange={handleEditing}
                            />
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
