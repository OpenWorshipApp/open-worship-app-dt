import './ControllerComp.scss';

import { lazy, Suspense, useCallback, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import WindowEventListener from '../event/WindowEventListener';
import ControllerToolbarComp from './ControllerToolbarComp';
import {
    checkIsArmedTool,
    checkIsDrawingTool,
    type PresentingToolType,
} from './presentingControlHelpers';
import {
    PRESENTING_CONTROL_ID,
    PRESENTING_CONTROL_LAYER,
    presentingShortcutMap,
    usePresentingKeyboardSwallow,
    usePresentingShortcut,
} from './presentingControlShortcutHelpers';
import {
    usePresentingManagers,
    useWindowResize,
} from './presentingControlHooks';

// Loaded only once the operator asks for it, and unmounted with the controller —
// the screencast is a presenting aid, so it lives and dies with the panel rather
// than leaving a key listener behind on a window nobody is presenting any more.
const KeyboardScreencastCompLazy = lazy(
    () => import('./KeyboardScreencastComp'),
);

// The app-wide annotation layer. Three stacked, full-window boxes:
//
//   canvas  — the drawing. ALWAYS painted, even in `interact` mode: annotating
//             the app and then carrying on clicking through it is the whole
//             point, so the strokes are not tied to the tool being armed.
//   mask    — the spotlight. Above the canvas, so dimming the app dims the
//             annotation with it rather than leaving strokes glowing over a
//             darkened window.
//   toolbar — above both, and the only child that always takes the pointer.
//
// Only the layer whose tool is selected takes pointer input; the others are
// `pointer-events: none`, which is what lets `interact` hand the whole app back
// to the user with the drawing still on top.

// The controller owns the keyboard exactly while a tool is ARMED — the same
// moment its overlay owns the pointer. Holding the layer for as long as the
// panel was merely OPEN made `interact` a lie: the keyboard stack has one top
// layer and no fall-through, so everything underneath went silent — the Bible
// Lookup's Enter/Escape, F5–F10, Ctrl+B, slide navigation — in the very mode
// whose whole point is that the app stays usable with the drawing on top.
//
// The tool keys still reach in from `interact` (that is why the layer used to be
// claimed early): they are registered on `root` as well, so `B`/`F` can ARM a
// tool without the panel having to hold the keyboard hostage to hear them.
function setKeyboardLayer(isOpen: boolean) {
    WindowEventListener.fireEvent({
        widget: PRESENTING_CONTROL_LAYER,
        state: isOpen ? 'open' : 'close',
    });
}

export default function ControllerComp({
    onClose,
}: Readonly<{
    onClose: () => void;
}>) {
    const { drawManager, focusManager } = usePresentingManagers();
    const [tool, setTool] = useState<PresentingToolType>('interact');
    // Not a TOOL: the screencast changes nothing about what the pointer does, it
    // only echoes the keyboard, so it is an independent switch that stays on
    // across tool changes. Off on every open — an operator who wanted it last
    // service should not have the room's keys narrated at them by surprise.
    const [isScreencasting, setIsScreencasting] = useState(false);
    const toolRef = useAppCurrentRef(tool);
    const isArmed = checkIsArmedTool(tool);
    const isDrawing = checkIsDrawingTool(tool);
    const isFocusing = tool === 'focus';

    const handleSetTool = useCallback((nextTool: PresentingToolType) => {
        if (toolRef.current === nextTool) {
            return;
        }
        if (checkIsArmedTool(nextTool)) {
            // Arming takes DOM focus away from whatever had it — most
            // importantly a previewer's own draw canvas, whose palette shortcuts
            // are the same plain letters this toolbar binds, and any text field
            // the typing guard would otherwise keep deferring to.
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement) {
                activeElement.blur();
            }
        }
        setTool(nextTool);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggleScreencast = useCallback(() => {
        // Armed, the keyboard is swallowed whole (below): the strip would be
        // narrating keys that no longer reach anything. Its `K` is swallowed
        // along with the rest, and its button is disabled — this is the third
        // door, for a toggle already in flight when a tool was armed.
        if (checkIsArmedTool(toolRef.current)) {
            return;
        }
        setIsScreencasting((oldIsScreencasting) => {
            return !oldIsScreencasting;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Held only while armed. Disarming, closing, or a crash-reload must not
    // leave the layer on the stack: every app shortcut would stay dead with
    // nothing left to release it. StrictMode's remount runs close-then-open,
    // which nets out, and `removeLayer` is a no-op for a layer already gone.
    useAppEffect(() => {
        if (!isArmed) {
            return;
        }
        setKeyboardLayer(true);
        return () => {
            setKeyboardLayer(false);
        };
    }, [isArmed]);

    // Owning the layer only silences the app's OWN shortcut stack. Armed means
    // the app underneath is covered and taking nothing, so the keyboard goes the
    // same way as the pointer — native defaults and stray React handlers
    // included. Held for exactly as long as the layer is, and torn down with it.
    usePresentingKeyboardSwallow(isArmed);

    // ...which leaves the screencast narrating keys that now go nowhere, so
    // arming a tool switches it off rather than leaving a strip on screen
    // announcing keystrokes the app never received. Deliberately not restored on
    // disarm: turning it back on is one key, and a strip reappearing by itself
    // mid-service is the surprise this avoids in the first place.
    useAppEffect(() => {
        if (isArmed) {
            setIsScreencasting(false);
        }
    }, [isArmed]);

    // Arming follows the selected TOOL, and lives here rather than in the two
    // settings panels' mount effects. The panels are unmounted whenever the
    // floating widget is collapsed, so arming from there meant collapsing the
    // widget silently killed the brush/spotlight while the overlay went on
    // covering the app — neither drawing nor clicking through. It also left the
    // keyboard's `B`/`F` able to select a tool that never armed, since no panel
    // mounts while collapsed.
    useAppEffect(() => {
        // Eraser before armed, so the first stroke after arming is the right
        // kind rather than a paint stroke corrected a moment later.
        drawManager.setIsEraser(tool === 'eraser');
        drawManager.setIsArmed(isDrawing);
        focusManager.setIsArmed(isFocusing);
    }, [tool, isDrawing, isFocusing, drawManager, focusManager]);

    const canvasRef = useCallback(
        (canvas: HTMLCanvasElement | null) => {
            drawManager.canvas = canvas;
        },
        [drawManager],
    );
    const maskRef = useCallback(
        (div: HTMLDivElement | null) => {
            focusManager.div = div;
        },
        [focusManager],
    );

    useWindowResize(() => {
        drawManager.render();
        focusManager.render();
    });

    // Escape backs out to `interact` — one key to hand the app back mid-service
    // without hunting for the toolbar. It is on the armed layer, which is now
    // only on the stack while a tool IS armed, so in `interact` Escape goes
    // straight back to the app (a dialog, the lookup input, a full-view panel)
    // instead of being answered by a controller that has nothing to do with it.
    // It deliberately does NOT close the controller: losing the drawing to a
    // stray Escape would be worse than the extra click on the X.
    usePresentingShortcut(presentingShortcutMap.exitTool, () => {
        handleSetTool('interact');
    });

    return (
        <div id={PRESENTING_CONTROL_ID} className={isArmed ? 'is-armed' : ''}>
            <canvas
                ref={canvasRef}
                className="presenting-control-layer"
                style={{
                    pointerEvents: isDrawing ? 'auto' : 'none',
                    cursor: isDrawing ? 'crosshair' : 'default',
                }}
            />
            <div
                ref={maskRef}
                className="presenting-control-layer"
                style={{
                    pointerEvents: isFocusing ? 'auto' : 'none',
                    cursor: isFocusing ? 'crosshair' : 'default',
                }}
            />
            <ControllerToolbarComp
                tool={tool}
                setTool={handleSetTool}
                isScreencasting={isScreencasting}
                isScreencastDisabled={isArmed}
                onToggleScreencast={handleToggleScreencast}
                drawManager={drawManager}
                focusManager={focusManager}
                onClose={onClose}
            />
            {isScreencasting ? (
                // Its own boundary rather than `AppSuspenseComp`: that one falls
                // back to a loading spinner, and a spinner flashing over the app
                // while a 2KB chunk lands is worse than the strip simply not
                // being there yet — which is what it looks like between bursts
                // anyway.
                <Suspense fallback={null}>
                    <KeyboardScreencastCompLazy />
                </Suspense>
            ) : null}
        </div>
    );
}
