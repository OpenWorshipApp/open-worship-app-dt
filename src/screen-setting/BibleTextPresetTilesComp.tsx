import { type MouseEvent, useMemo, useState } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import type { AnyObjectType } from '../helper/typeHelpers';
import { tran } from '../lang/langHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../popup-widget/popupWidgetHelpers';
import {
    genBibleTextStylePatch,
    genBibleTextViewCss,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import BibleTextLookTileComp from './BibleTextLookTileComp';
import {
    genBibleSampleStyle,
    toBibleBackdrop,
    toPreviewTextShadow,
} from './bibleTextLookHelpers';
import {
    MAX_BIBLE_TEXT_PRESET_COUNT,
    addBibleTextPreset,
    genBibleTextPresetName,
    getBibleTextPresets,
    removeBibleTextPreset,
    renameBibleTextPreset,
    replaceBibleTextPresetStyle,
    setBibleTextPresets,
    toBibleTextPresetView,
    type BibleTextPresetType,
} from './bibleTextPresetHelpers';

function genPresetNameInput(name: string, onChange: (name: string) => void) {
    return (
        <input
            type="text"
            autoFocus
            className="form-control"
            defaultValue={name}
            onFocus={(event) => {
                event.currentTarget.select();
            }}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
    );
}

async function askPresetName(title: string, suggestedName: string) {
    let name = suggestedName;
    const isOk = await showAppInput(
        title,
        genPresetNameInput(name, (newName) => {
            name = newName;
        }),
    );
    return isOk && name.trim() !== '' ? name : null;
}

/**
 * The looks somebody saved, as tiles after the app's own, and the tile that
 * saves another.
 *
 * Whatever is on the stage can be kept: one press on the last tile, a name,
 * and it is a tile like the rest -- drawn as itself, on the background its
 * own colour is meant for, lit while it is the look the screen is wearing.
 * A saved look is the WHOLE style, size and colour included, so pressing it
 * puts back exactly what was saved (`genBibleTextStylePatch`).
 */
export default function BibleTextPresetTilesComp({
    view,
    sample,
    applyStyle,
}: Readonly<{
    view: BibleTextStyleViewType;
    sample: string;
    applyStyle: (patch: AnyObjectType) => void;
}>) {
    // Read once, when the panel opens: this panel is the only thing that
    // writes them, and there is only ever one of it.
    const [presets, setPresets] = useState(() => {
        return getBibleTextPresets();
    });
    // A name is asked for in a dialog, and what comes back from one acts on
    // the list and the look as they are THEN, not as they were when it opened.
    const presetsRef = useAppCurrentRef(presets);
    const viewRef = useAppCurrentRef(view);
    const savePresets = (newPresets: BibleTextPresetType[]) => {
        presetsRef.current = newPresets;
        setPresets(newPresets);
        setBibleTextPresets(newPresets);
    };
    const tileList = useMemo(() => {
        return presets.map((preset) => {
            const presetView = toBibleTextPresetView(preset);
            return {
                preset,
                presetView,
                css: genBibleTextViewCss(presetView),
            };
        });
    }, [presets]);
    const currentCss = genBibleTextViewCss(view);
    const isFull = presets.length >= MAX_BIBLE_TEXT_PRESET_COUNT;
    const saveLabel = tran('Save as Preset');

    const handleSaving = async () => {
        const name = await askPresetName(
            saveLabel,
            genBibleTextPresetName(presets, tran('Preset')),
        );
        if (name === null) {
            return;
        }
        const newPresets = addBibleTextPreset(
            presetsRef.current,
            name,
            viewRef.current,
        );
        if (newPresets !== null) {
            savePresets(newPresets);
        }
    };
    const handleMenuOpening = (
        event: MouseEvent,
        preset: BibleTextPresetType,
    ) => {
        event.preventDefault();
        showAppContextMenu(event.nativeEvent, [
            {
                childBefore: genContextMenuItemIcon('pencil-square'),
                menuElement: tran('Rename Preset'),
                onSelect: async () => {
                    const name = await askPresetName(
                        tran('Rename Preset'),
                        preset.name,
                    );
                    if (name !== null) {
                        savePresets(
                            renameBibleTextPreset(
                                presetsRef.current,
                                preset.id,
                                name,
                            ),
                        );
                    }
                },
            },
            {
                childBefore: genContextMenuItemIcon('arrow-repeat'),
                menuElement: tran('Replace with Current Look'),
                onSelect: () => {
                    savePresets(
                        replaceBibleTextPresetStyle(
                            presetsRef.current,
                            preset.id,
                            viewRef.current,
                        ),
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('x-circle'),
                menuElement: tran('Remove Preset'),
                onSelect: async () => {
                    const isOk = await showAppConfirm(
                        tran('Remove Preset'),
                        `${tran('Remove')} "${preset.name}"?`,
                    );
                    if (isOk) {
                        savePresets(
                            removeBibleTextPreset(
                                presetsRef.current,
                                preset.id,
                            ),
                        );
                    }
                },
            },
        ]);
    };
    return (
        <>
            {tileList.map(({ preset, presetView, css }) => {
                return (
                    <BibleTextLookTileComp
                        key={preset.id}
                        label={preset.name}
                        sample={sample}
                        sampleStyle={{
                            ...genBibleSampleStyle(presetView),
                            textShadow: toPreviewTextShadow(
                                presetView.textShadow,
                                presetView.fontSize,
                            ),
                        }}
                        backdrop={toBibleBackdrop(presetView.color)}
                        isOn={css === currentCss}
                        onPick={() => {
                            applyStyle(genBibleTextStylePatch(presetView));
                        }}
                        onMenuOpening={(event) => {
                            handleMenuOpening(event, preset);
                        }}
                    />
                );
            })}
            <button
                type="button"
                className="bible-style-look bible-style-look-add"
                title={
                    isFull
                        ? tran('Remove a preset to save a new one')
                        : saveLabel
                }
                disabled={isFull}
                onClick={handleSaving}
            >
                <span className="bible-style-look-sample" aria-hidden="true">
                    <i className="bi bi-plus-lg" />
                </span>
                <span className="bible-style-look-name">{saveLabel}</span>
            </button>
        </>
    );
}
