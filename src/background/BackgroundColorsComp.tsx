import { type SyntheticEvent, useCallback, useRef, useState } from 'react';

import ColorPicker from '../others/color/ColorPicker';
import {
    HEX_COLOR_BLACK,
    type AppColorType,
} from '../others/color/colorHelpers';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';

// How long after a swatch press its focus may still be put back. The press and
// the re-render it causes are milliseconds apart; anything later is some other
// change to a screen, and that must never pull the keyboard into this panel.
const FOCUS_RESTORE_WINDOW_MS = 2000;

function RenderColorPickerPerScreenComp({
    screenId,
    backgroundSrc,
}: Readonly<{
    screenId: number;
    backgroundSrc: BackgroundSrcType;
}>) {
    const screenIdRef = useAppCurrentRef(screenId);
    const handleColorChanging = useCallback(
        async (newColor: AppColorType | null) => {
            const screenBackgroundManager = ScreenBackgroundManager.getInstance(
                screenIdRef.current,
            );
            if (screenBackgroundManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to apply to screen. Please make sure the screen is open.',
                    ),
                    'error',
                );
                return;
            }
            screenBackgroundManager.applyBackgroundSrc('color', {
                src: newColor,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="p-1 m-1 app-border-white-round">
            <ShowingScreenIcon screenId={screenId} />
            <ColorPicker
                color={backgroundSrc.src as AppColorType}
                defaultColor={backgroundSrc.src as AppColorType}
                onNoColor={() => {
                    handleColorChanging(null);
                }}
                onColorChange={handleColorChanging}
                isNoImmediate={true}
            />
        </div>
    );
}

export default function BackgroundColorsComp() {
    const [selectedBackgroundSrcList, setSelectedBackgroundSrcList] = useState<
        [string, BackgroundSrcType][] | null
    >(null);
    const initBackgroundSrcList = useCallback(async () => {
        setSelectedBackgroundSrcList(
            ScreenBackgroundManager.getBackgroundSrcListByType('color'),
        );
    }, []);
    useAppEffect(() => {
        if (selectedBackgroundSrcList === null) {
            initBackgroundSrcList();
        }
    }, [selectedBackgroundSrcList, initBackgroundSrcList]);
    useScreenBackgroundManagerEvents(
        ['update'],
        undefined,
        initBackgroundSrcList,
    );
    const handleBackgroundSelecting = useCallback(
        (newColor: AppColorType, event: any) => {
            ScreenBackgroundManager.handleBackgroundSelecting(event, 'color', {
                src: newColor,
            });
        },
        [],
    );
    const containerRef = useRef<HTMLDivElement | null>(null);
    // The swatch a press landed on, by its name. Choosing the first colour --
    // or No Color -- swaps this panel between the one picker for the selected
    // screens and a picker per screen, which unmounts the very swatch that had
    // the keyboard: focus fell to the page and the next Tab started over at the
    // top of the panel. Mouse and keyboard presses both arrive here as a click
    // (`pressElementLikeButton` turns Enter/Space into one).
    const pressedSwatchRef = useRef<{ label: string; at: number } | null>(null);
    const handleSwatchPressing = useCallback((event: SyntheticEvent) => {
        const target = event.target as HTMLElement;
        const label = target.classList?.contains('color-item')
            ? target.getAttribute('aria-label')
            : null;
        pressedSwatchRef.current =
            label === null ? null : { label, at: Date.now() };
    }, []);
    useAppEffect(() => {
        const pressed = pressedSwatchRef.current;
        const container = containerRef.current;
        if (pressed === null || container === null) {
            return;
        }
        if (Date.now() - pressed.at > FOCUS_RESTORE_WINDOW_MS) {
            pressedSwatchRef.current = null;
            return;
        }
        // Still where it was (the picker stayed mounted), or moved on by the
        // user: nothing to put back. The record is kept for the rest of the
        // window, because the re-render that swaps the pickers can arrive
        // after one that did not.
        const activeElement = document.activeElement;
        if (activeElement !== null && activeElement !== document.body) {
            return;
        }
        pressedSwatchRef.current = null;
        const swatch = Array.from(
            container.querySelectorAll<HTMLElement>('.color-item'),
        ).find((element) => {
            return element.getAttribute('aria-label') === pressed.label;
        });
        swatch?.focus();
    }, [selectedBackgroundSrcList]);
    if (selectedBackgroundSrcList === null) {
        return null;
    }
    return (
        <div
            ref={containerRef}
            className={'d-flex align-content-start flex-wrap w-100 h-100'}
            style={{
                overflowY: 'auto',
            }}
            onClickCapture={handleSwatchPressing}
        >
            {selectedBackgroundSrcList.length === 0 ? (
                <ColorPicker
                    color={null}
                    defaultColor={HEX_COLOR_BLACK}
                    onColorChange={handleBackgroundSelecting}
                    isNoImmediate={true}
                />
            ) : (
                selectedBackgroundSrcList.map(([key, backgroundSrc]) => {
                    const screenId = Number.parseInt(key);
                    return (
                        <RenderColorPickerPerScreenComp
                            // Keyed by the SCREEN. The colour used to be part
                            // of the key, so every colour change threw the
                            // whole picker away -- and the keyboard focus with
                            // it -- only to build the same picker again.
                            key={key}
                            screenId={screenId}
                            backgroundSrc={backgroundSrc}
                        />
                    );
                })
            )}
        </div>
    );
}
