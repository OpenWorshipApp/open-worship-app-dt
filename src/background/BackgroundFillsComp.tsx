import {
    type MouseEvent,
    type SyntheticEvent,
    useCallback,
    useRef,
    useState,
} from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import {
    BACKGROUND_FILL_CUSTOMIZE_CLOSED_SETTING_PREFIX,
    BACKGROUND_FILL_FOLDED_SETTING_PREFIX,
} from '../_screen/managers/screenSettingKeyHelpers';
import { ColorSwatchExtraMenuContext } from '../others/color/colorSwatchMenuHelpers';
import { genBackgroundItemTransitionMenuItems } from './backgroundTransitionMenuHelpers';
import FillPickerComp from './FillPickerComp';

function genFillTransitionMenuItems(fillSrc: string) {
    return genBackgroundItemTransitionMenuItems('fill', fillSrc);
}

// How long after a swatch press its focus may still be put back. The press and
// the re-render it causes are milliseconds apart; anything later is some other
// change to a screen, and that must never pull the keyboard into this panel.
const FOCUS_RESTORE_WINDOW_MS = 2000;

// What can be pressed and then unmounted by its own press: a colour swatch,
// No Color among them, and a gradient or pattern tile.
const PRESSABLE_SELECTOR = '.color-item, .fill-tile';

function getScreenBackgroundManager(screenId: number) {
    const screenBackgroundManager =
        ScreenBackgroundManager.getInstance(screenId);
    if (screenBackgroundManager === null) {
        showSimpleToast(
            tran(
                'Failed to apply to screen. Please make sure the screen is open.',
            ),
            tran('Error'),
        );
    }
    return screenBackgroundManager;
}

function RenderFillPickerPerScreenComp({
    screenId,
    backgroundSrc,
}: Readonly<{
    screenId: number;
    backgroundSrc: BackgroundSrcType;
}>) {
    const screenIdRef = useAppCurrentRef(screenId);
    // Both remembered for this screen -- and dropped with it, since a deleted
    // screen's id goes to the next one made (`previewerSettingPrefixList`).
    const [isFolded, setIsFolded] = useStateSettingBoolean(
        `${BACKGROUND_FILL_FOLDED_SETTING_PREFIX}${screenId}`,
    );
    const [isCustomizeClosed, setIsCustomizeClosed] = useStateSettingBoolean(
        `${BACKGROUND_FILL_CUSTOMIZE_CLOSED_SETTING_PREFIX}${screenId}`,
    );
    // A press: what was pressed goes up, and pressing what is up takes it
    // down (`applyBackgroundSrc`), as a colour always did.
    const handleFillPicking = useCallback(
        (src: string | null) => {
            getScreenBackgroundManager(screenIdRef.current)?.applyBackgroundSrc(
                'fill',
                { src },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // A change made in Customize, after its pause: only onto a screen that
    // still holds a fill, and never the one it holds -- sent again, the
    // screen would read it as that press and take its fill down.
    const handleFillEditing = useCallback(
        (src: string) => {
            const screenBackgroundManager = ScreenBackgroundManager.getInstance(
                screenIdRef.current,
            );
            const current = screenBackgroundManager?.backgroundSrc ?? null;
            if (
                screenBackgroundManager === null ||
                current?.type !== 'fill' ||
                current.src === src
            ) {
                return;
            }
            screenBackgroundManager.applyBackgroundSrc('fill', { src });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="p-1 m-1 app-border-white-round">
            <FillPickerComp
                screenView={{
                    screenId,
                    isFolded,
                    onFoldToggle: () => {
                        setIsFolded((value) => !value);
                    },
                    isCustomizeClosed,
                    onCustomizeToggle: () => {
                        setIsCustomizeClosed((value) => !value);
                    },
                }}
                heldSrc={backgroundSrc.src}
                onPick={handleFillPicking}
                onEdit={handleFillEditing}
            />
        </div>
    );
}

/**
 * The Background panel's Fills tab (2026-11-14; the Colors tab until then):
 * a colour, a gradient or a pattern as a screen's background. While no
 * screen holds a fill there is one picker, whose press goes to the screens
 * chosen the way every background tab chooses them; once one does, there is
 * a picker for each screen holding one -- its own fill lit, Customize for a
 * gradient or a pattern, and its press going to that screen alone.
 */
export default function BackgroundFillsComp() {
    const [selectedBackgroundSrcList, setSelectedBackgroundSrcList] = useState<
        [string, BackgroundSrcType][] | null
    >(null);
    const initBackgroundSrcList = useCallback(async () => {
        setSelectedBackgroundSrcList(
            ScreenBackgroundManager.getBackgroundSrcListByType('fill'),
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
        (src: string | null, event: MouseEvent) => {
            if (src === null) {
                return;
            }
            ScreenBackgroundManager.handleBackgroundSelecting(
                event as any,
                'fill',
                { src },
            );
        },
        [],
    );
    const containerRef = useRef<HTMLDivElement | null>(null);
    // The swatch or tile a press landed on, by its name. Choosing the first
    // fill -- or No Color -- swaps this panel between the one picker for the
    // selected screens and a picker per screen, which unmounts the very
    // swatch that had the keyboard: focus fell to the page and the next Tab
    // started over at the top of the panel. Mouse and keyboard presses both
    // arrive here as a click (`pressElementLikeButton` turns Enter/Space into
    // one).
    const pressedSwatchRef = useRef<{ label: string; at: number } | null>(null);
    const handleSwatchPressing = useCallback((event: SyntheticEvent) => {
        const target = event.target as HTMLElement;
        const label = target.matches?.(PRESSABLE_SELECTOR)
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
            container.querySelectorAll<HTMLElement>(PRESSABLE_SELECTOR),
        ).find((element) => {
            return element.getAttribute('aria-label') === pressed.label;
        });
        swatch?.focus();
    }, [selectedBackgroundSrcList]);
    if (selectedBackgroundSrcList === null) {
        return null;
    }
    // A block, not a wrapping row: a row shrank each screen's picker to its
    // content and left the rest of the panel empty beside it. Each picker
    // spans the panel now, one screen's under another's.
    return (
        <div
            ref={containerRef}
            className="w-100 h-100"
            style={{
                overflowY: 'auto',
            }}
            onClickCapture={handleSwatchPressing}
        >
            {/* Only here is a swatch a BACKGROUND, so only here does its
                right-click offer the fill's own transition. */}
            <ColorSwatchExtraMenuContext value={genFillTransitionMenuItems}>
                {selectedBackgroundSrcList.length === 0 ? (
                    <div className="p-1 m-1">
                        <FillPickerComp
                            heldSrc={null}
                            onPick={handleBackgroundSelecting}
                        />
                    </div>
                ) : (
                    selectedBackgroundSrcList.map(([key, backgroundSrc]) => {
                        const screenId = Number.parseInt(key);
                        return (
                            <RenderFillPickerPerScreenComp
                                // Keyed by the SCREEN. The fill used to be part
                                // of the key, so every change threw the whole
                                // picker away -- and the keyboard focus with
                                // it -- only to build the same picker again.
                                key={key}
                                screenId={screenId}
                                backgroundSrc={backgroundSrc}
                            />
                        );
                    })
                )}
            </ColorSwatchExtraMenuContext>
        </div>
    );
}
