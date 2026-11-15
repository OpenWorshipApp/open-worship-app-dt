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
    BACKGROUND_ANIMATION_CUSTOMIZE_CLOSED_SETTING_PREFIX,
    BACKGROUND_ANIMATION_FOLDED_SETTING_PREFIX,
} from '../_screen/managers/screenSettingKeyHelpers';
import AnimationPickerComp from './AnimationPickerComp';
import PaintTabFrameComp, { usePaintSessionStrip } from './PaintTabFrameComp';
import { useBackgroundPaintAutoPlaySync } from './BackgroundPaintAutoPlayComp';
import { toPaintPresetSettingName } from './paintShowOrderHelpers';

// How long after a tile press its focus may still be put back. The press and
// the re-render it causes are milliseconds apart; anything later is some other
// change to a screen, and that must never pull the keyboard into this panel.
const FOCUS_RESTORE_WINDOW_MS = 2000;
const PRESSABLE_SELECTOR = '.animation-tile[role="button"]';

function RenderAnimationPickerPerScreenComp({
    screenId,
    backgroundSrc,
    presetSettingName,
}: Readonly<{
    screenId: number;
    backgroundSrc: BackgroundSrcType;
    presetSettingName: string;
}>) {
    const screenIdRef = useAppCurrentRef(screenId);
    // Both remembered for this screen -- and dropped with it, since a deleted
    // screen's id goes to the next one made (`previewerSettingPrefixList`).
    const [isFolded, setIsFolded] = useStateSettingBoolean(
        `${BACKGROUND_ANIMATION_FOLDED_SETTING_PREFIX}${screenId}`,
    );
    const [isCustomizeClosed, setIsCustomizeClosed] = useStateSettingBoolean(
        `${BACKGROUND_ANIMATION_CUSTOMIZE_CLOSED_SETTING_PREFIX}${screenId}`,
    );
    // A press: what was pressed goes up, and pressing what is up takes it
    // down (`applyBackgroundSrc`), as every background tab does.
    const handlePicking = useCallback((src: string) => {
        const screenBackgroundManager = ScreenBackgroundManager.getInstance(
            screenIdRef.current,
        );
        if (screenBackgroundManager === null) {
            showSimpleToast(
                tran(
                    'Failed to apply to screen. Please make sure the screen is open.',
                ),
                tran('Error'),
            );
            return;
        }
        screenBackgroundManager.applyBackgroundSrc('animation', { src });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A change made in Customize or Edit Code: only onto a screen that still
    // holds an animation, and never the one it holds -- sent again, the
    // screen would read it as that press and take its animation down.
    const handleEditing = useCallback((src: string) => {
        const screenBackgroundManager = ScreenBackgroundManager.getInstance(
            screenIdRef.current,
        );
        const current = screenBackgroundManager?.backgroundSrc ?? null;
        if (
            screenBackgroundManager === null ||
            current?.type !== 'animation' ||
            current.src === src
        ) {
            return;
        }
        screenBackgroundManager.applyBackgroundSrc('animation', { src });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="p-1 m-1 app-border-white-round">
            <AnimationPickerComp
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
                onPick={handlePicking}
                onEdit={handleEditing}
                presetSettingName={presetSettingName}
            />
        </div>
    );
}

/**
 * The Background panel's Animations tab (2026-11-15, the user: _implement
 * `Animation` for background, it should provide both css and glsl_): a
 * moving background made of CSS layers or drawn by a GLSL shader, each a
 * season or theme of worship to start from, recoloured and kept as a
 * preset, or a person's own shader. While no screen holds an animation
 * there is one picker, whose press goes to the screens chosen the way every
 * background tab chooses them; once one does, there is a picker for each
 * screen holding one -- its own lit, Customize, and its press going to that
 * screen alone.
 *
 * It moves only where it is presented (`ScreenBackgroundComp`); the tiles
 * here are still until the pointer is on one.
 *
 * Over them, the Images tab's strip (2026-11-15, the user: _like background
 * image, `Fills` and `Animations` should support session and auto-play_):
 * the sessions, each keeping its own saved animations, and -- once one is
 * up -- the slide show, which walks the row the one up is in
 * (`BackgroundPaintAutoPlayComp`).
 */
export default function BackgroundAnimationsComp() {
    const [selectedBackgroundSrcList, setSelectedBackgroundSrcList] = useState<
        [string, BackgroundSrcType][] | null
    >(null);
    const initBackgroundSrcList = useCallback(async () => {
        setSelectedBackgroundSrcList(
            ScreenBackgroundManager.getBackgroundSrcListByType('animation'),
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
    const session = usePaintSessionStrip('animation');
    useBackgroundPaintAutoPlaySync(
        'animation',
        selectedBackgroundSrcList?.length ?? 0,
    );
    const presetSettingName = toPaintPresetSettingName(
        'animation',
        session.suffix,
    );
    const handleBackgroundSelecting = useCallback(
        (src: string, event: MouseEvent) => {
            ScreenBackgroundManager.handleBackgroundSelecting(
                event as any,
                'animation',
                { src },
            );
        },
        [],
    );
    const containerRef = useRef<HTMLDivElement | null>(null);
    // The tile a press landed on, by its name: choosing the first animation
    // swaps this panel between the one picker for the selected screens and a
    // picker per screen, which unmounts the very tile that had the keyboard
    // (as in `BackgroundFillsComp`).
    const pressedTileRef = useRef<{ label: string; at: number } | null>(null);
    const handleTilePressing = useCallback((event: SyntheticEvent) => {
        const target = event.target as HTMLElement;
        const label = target.matches?.(PRESSABLE_SELECTOR)
            ? target.getAttribute('aria-label')
            : null;
        pressedTileRef.current =
            label === null ? null : { label, at: Date.now() };
    }, []);
    useAppEffect(() => {
        const pressed = pressedTileRef.current;
        const container = containerRef.current;
        if (pressed === null || container === null) {
            return;
        }
        if (Date.now() - pressed.at > FOCUS_RESTORE_WINDOW_MS) {
            pressedTileRef.current = null;
            return;
        }
        const activeElement = document.activeElement;
        if (activeElement !== null && activeElement !== document.body) {
            return;
        }
        pressedTileRef.current = null;
        const tile = Array.from(
            container.querySelectorAll<HTMLElement>(PRESSABLE_SELECTOR),
        ).find((element) => {
            return element.getAttribute('aria-label') === pressed.label;
        });
        tile?.focus();
    }, [selectedBackgroundSrcList]);
    if (selectedBackgroundSrcList === null) {
        return null;
    }
    return (
        <PaintTabFrameComp
            kind="animation"
            session={session}
            isShowing={selectedBackgroundSrcList.length > 0}
        >
            <div
                ref={containerRef}
                // Keyed by session: its saved animations are its own list.
                key={session.activeId}
                className="w-100 h-100"
                style={{
                    overflowY: 'auto',
                }}
                onClickCapture={handleTilePressing}
            >
                {selectedBackgroundSrcList.length === 0 ? (
                    <div className="p-1 m-1">
                        <AnimationPickerComp
                            heldSrc={null}
                            onPick={handleBackgroundSelecting}
                            presetSettingName={presetSettingName}
                        />
                    </div>
                ) : (
                    selectedBackgroundSrcList.map(([key, backgroundSrc]) => {
                        return (
                            <RenderAnimationPickerPerScreenComp
                                // Keyed by the SCREEN: a change of animation
                                // keeps the picker, and the keyboard focus in it.
                                key={key}
                                screenId={Number.parseInt(key)}
                                backgroundSrc={backgroundSrc}
                                presetSettingName={presetSettingName}
                            />
                        );
                    })
                )}
            </div>
        </PaintTabFrameComp>
    );
}
