import { useAppCurrentRef } from '../../../helper/appHooks';
import { tran } from '../../../lang/langHelpers';
import ColorModeSwitchComp from '../../../others/ColorModeSwitchComp';
import {
    type ColorModeType,
    genContrastColors,
    toColorMode,
} from '../../../others/color/colorContrastHelpers';
import PresetsRowComp from '../../../others/PresetsRowComp';
import {
    useCanvasItemContext,
    useCanvasItemPropsSetterContext,
} from '../CanvasItem';
import {
    CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME,
    checkIsCanvasItemPresetFor,
    genCanvasItemLookPatch,
    genCanvasItemPresetColors,
    genCanvasItemPresetPatch,
    genCanvasItemPresetTarget,
    getCanvasItemPresetList,
    readCanvasItemLook,
    toCanvasItemSavedPreset,
    type CanvasItemPresetIdType,
    type CanvasItemSavedPresetType,
} from './canvasItemPresetHelpers';

/**
 * One of the app's looks, translated in render. One literal per look so the
 * key coverage test can read every one of them.
 */
function toCanvasItemPresetLabel(id: CanvasItemPresetIdType) {
    switch (id) {
        case 'plain':
            return tran('Plain');
        case 'shadow':
            return tran('Shadow');
        case 'glass-effect':
            return tran('Glass Effect');
        case 'highlight':
            return tran('Highlight');
        case 'urgent-alert':
            return tran('Urgent Alert');
    }
}

/**
 * The first group of a slide box's properties: the app's looks for a box,
 * the looks somebody saved from one, and Save as Preset (`PresetsRowComp`).
 *
 * A box of words carries Dark / Light at the right of the name, as a
 * foreground component's Presets do: the side is read off the words' colour,
 * never stored; pressing the other side makes the box darker or lighter and
 * the words the other way until they read (`genContrastColors`), and one of
 * the app's looks goes on in the side the switch is on. A picture has words
 * nowhere, so no switch.
 *
 * Every press is ONE `setProps` patch: it rides the panel's pending-patch
 * queue, its debounce and the flush before save / undo, exactly as a field
 * changed by hand does -- so one Ctrl+Z takes the whole look back off.
 */
export default function CanvasItemPresetsComp() {
    const canvasItem = useCanvasItemContext();
    const [props, setProps] = useCanvasItemPropsSetterContext<any>();
    const target = genCanvasItemPresetTarget(canvasItem.type);
    const mode: ColorModeType | null = target.hasTextProps
        ? toColorMode(props.color)
        : null;
    const stateRef = useAppCurrentRef({ props, setProps, target, mode });
    const handleModeChange = (newMode: ColorModeType) => {
        const current = stateRef.current;
        const { color, backgroundColor } = current.props;
        const next = genContrastColors({ color, backgroundColor }, newMode);
        if (next.color === color && next.backgroundColor === backgroundColor) {
            return;
        }
        current.setProps(next);
    };
    return (
        <PresetsRowComp<CanvasItemSavedPresetType>
            savedSettingName={CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME}
            toSavedPreset={toCanvasItemSavedPreset}
            builtIns={getCanvasItemPresetList(target).map((preset) => {
                return {
                    id: preset.id,
                    iconName: preset.iconName,
                    label: toCanvasItemPresetLabel(preset.id),
                    chipColors:
                        mode === null
                            ? null
                            : genCanvasItemPresetColors(preset, mode),
                    onPick: () => {
                        const current = stateRef.current;
                        current.setProps(
                            genCanvasItemPresetPatch(
                                preset,
                                current.target,
                                current.mode,
                            ),
                        );
                    },
                };
            })}
            readCurrent={() => {
                const current = stateRef.current;
                return readCanvasItemLook(current.props, current.target);
            }}
            onSavedPick={(preset) => {
                const current = stateRef.current;
                current.setProps(
                    genCanvasItemLookPatch(preset, current.target),
                );
            }}
            filterSaved={(preset) => {
                return checkIsCanvasItemPresetFor(preset, target);
            }}
            genSavedChipColors={(preset) => {
                return mode !== null && preset.text !== undefined
                    ? {
                          color: preset.text.color,
                          backgroundColor: preset.box.backgroundColor,
                      }
                    : null;
            }}
            headEnd={
                mode === null ? null : (
                    <ColorModeSwitchComp
                        mode={mode}
                        onChange={handleModeChange}
                    />
                )
            }
        />
    );
}
