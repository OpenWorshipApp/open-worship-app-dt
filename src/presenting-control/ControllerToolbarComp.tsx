import { type CSSProperties, lazy } from 'react';

import AppSuspenseComp from '../others/AppSuspenseComp';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/appHooks';
import {
    drawShortcutMap,
    toShortcutTitle,
    type DrawShortcutIdType,
} from '../_screen/managers/screenDrawShortcutHelpers';
import { handleKeepOverlayFocus } from '../_screen/preview/miniScreenOverlayControlComps';
import type PresentingDrawManager from './PresentingDrawManager';
import type PresentingFocusManager from './PresentingFocusManager';
import {
    WIDGET_RECT_SETTING_NAME,
    checkIsDrawingTool,
    toPresentingSettingKey,
    type PresentingToolType,
} from './presentingControlHelpers';
import {
    toPresentingShortcutTitle,
    usePresentingShortcut,
    usePresentingToolShortcut,
    type PresentingShortcutIdType,
} from './presentingControlShortcutHelpers';
import { usePresentingManagerEvents } from './presentingControlHooks';

// The tool panels are the heaviest part of the controller and only one can be
// open at a time, so neither is in the app's startup bundle — the toolbar itself
// has to appear the instant Ctrl+Shift+P is pressed.
const importDrawTools = () => {
    return import('./ControllerDrawToolsComp');
};
const importFocusTools = () => {
    return import('./ControllerFocusToolsComp');
};
const ControllerDrawToolsCompLazy = lazy(importDrawTools);
const ControllerFocusToolsCompLazy = lazy(importFocusTools);

// The header's keys are bound for as long as the controller is open, but they
// are not all SCOPED alike. A tool key has to arm from `interact` as well as
// switch between armed tools, so `usePresentingToolShortcut` registers it on
// both the controller's layer and `root`; `C` / `Ctrl+Z` / `Ctrl+Shift+Z` stay
// on the controller's layer alone, so while the app is live those chords keep
// undoing slide edits rather than strokes. Their buttons are live in every tool
// either way — which is why they moved into this header in the first place, the
// settings panel that used to own them being unmounted by every tool but the
// brush AND by collapsing the widget.

function ToolButtonComp({
    icon,
    label,
    shortcutId,
    isActive,
    isDisabled = false,
    onClick,
    extraStyles,
}: Readonly<{
    icon: string;
    label: string;
    shortcutId: PresentingShortcutIdType;
    isActive: boolean;
    isDisabled?: boolean;
    onClick: () => void;
    extraStyles?: CSSProperties;
}>) {
    return (
        <button
            className={
                'btn btn-sm btn-' + (isActive ? 'primary' : 'outline-secondary')
            }
            style={extraStyles}
            disabled={isDisabled}
            onMouseDown={handleKeepOverlayFocus}
            onClick={onClick}
            title={toPresentingShortcutTitle(label, shortcutId)}
            aria-label={label}
            aria-pressed={isActive}
        >
            <i className={`bi ${icon}`} />
        </button>
    );
}

function HistoryButtonComp({
    icon,
    label,
    shortcutId,
    isDanger = false,
    isDisabled,
    onClick,
}: Readonly<{
    icon: string;
    label: string;
    shortcutId: DrawShortcutIdType;
    isDanger?: boolean;
    isDisabled: boolean;
    onClick: () => void;
}>) {
    return (
        <button
            className={
                'btn btn-sm btn-outline-' + (isDanger ? 'danger' : 'secondary')
            }
            disabled={isDisabled}
            onMouseDown={handleKeepOverlayFocus}
            onClick={onClick}
            title={toShortcutTitle(label, shortcutId)}
            aria-label={label}
        >
            <i className={`bi ${icon}`} />
        </button>
    );
}

export default function ControllerToolbarComp({
    tool,
    setTool,
    isScreencasting,
    isScreencastDisabled,
    onToggleScreencast,
    drawManager,
    focusManager,
    onClose,
}: Readonly<{
    tool: PresentingToolType;
    setTool: (tool: PresentingToolType) => void;
    isScreencasting: boolean;
    isScreencastDisabled: boolean;
    onToggleScreencast: () => void;
    drawManager: PresentingDrawManager;
    focusManager: PresentingFocusManager;
    onClose: () => void;
}>) {
    // Re-render so Undo/Redo/Clear track what is actually on the canvas.
    usePresentingManagerEvents(drawManager);
    const isDrawing = checkIsDrawingTool(tool);

    // Warm both panel chunks as soon as the controller opens. Correctness no
    // longer depends on it — arming is a tool fact ControllerComp owns, so the
    // brush draws whether or not its panel has landed — but the user opened the
    // controller precisely to use these tools, so this only moves the fetch off
    // the moment they reach for it. They stay out of the app's startup bundle,
    // which is what the split is actually for.
    useAppEffect(() => {
        importDrawTools();
        importFocusTools();
    }, []);

    usePresentingToolShortcut('useInteract', () => {
        setTool('interact');
    });
    usePresentingToolShortcut('usePaint', () => {
        setTool('paint');
    });
    usePresentingToolShortcut('useEraser', () => {
        setTool('eraser');
    });
    usePresentingToolShortcut('useFocus', () => {
        setTool('focus');
    });
    usePresentingToolShortcut('toggleScreencast', onToggleScreencast);

    // The keys behind the three header buttons. Same ids (and so the same
    // rendered hints) as the audience-screen draw panel, so one set of habits
    // covers both. Clear collapses to a single snapshot rather than wiping the
    // history, so a mis-hit `C` mid-service costs one Ctrl+Z.
    //
    // Armed-tool only (they sit on the controller's layer): in `interact` the
    // app is live and Ctrl+Z belongs to whatever the operator is actually
    // editing. The buttons work in every tool regardless.
    usePresentingShortcut(drawShortcutMap.clearDrawing, () => {
        drawManager.clear();
    });
    usePresentingShortcut(drawShortcutMap.undo, () => {
        drawManager.undo();
    });
    usePresentingShortcut(drawShortcutMap.redo, () => {
        drawManager.redo();
    });

    // All three button groups live in the widget's HEADER, not its content: the
    // tool switcher on the left, then the screencast switch and
    // undo/redo/clear on the right. The header is the one part that survives
    // collapsing, so switching tool and undoing a stroke stay
    // one click away when the panel is rolled up out of the way — which is
    // exactly when the settings underneath are not wanted. Buttons are excluded
    // from the header's drag area (`isBlankDragArea`), so pressing one never
    // moves the widget; the heading text is what stays draggable.
    const titleComp = (
        <>
            <span className="presenting-control-heading">
                {tran('Presenting Control')}
            </span>
            <div
                className="btn-group btn-group-sm presenting-control-tool-group"
                role="group"
                aria-label={tran('Presenting tool')}
            >
                <ToolButtonComp
                    icon="bi-cursor"
                    label={tran('Use the app (drawing stays on top)')}
                    shortcutId="useInteract"
                    isActive={tool === 'interact'}
                    onClick={() => {
                        setTool('interact');
                    }}
                />
                <ToolButtonComp
                    icon="bi-brush"
                    label={tran('Draw on the app')}
                    shortcutId="usePaint"
                    isActive={tool === 'paint'}
                    onClick={() => {
                        setTool('paint');
                    }}
                />
                <ToolButtonComp
                    icon="bi-eraser"
                    label={tran('Erase parts of the drawing')}
                    shortcutId="useEraser"
                    isActive={tool === 'eraser'}
                    onClick={() => {
                        setTool('eraser');
                    }}
                    extraStyles={{ color: 'var(--bs-warning)' }}
                />
                <ToolButtonComp
                    icon="bi-record-circle"
                    label={tran('Spotlight part of the app')}
                    shortcutId="useFocus"
                    isActive={tool === 'focus'}
                    onClick={() => {
                        setTool('focus');
                    }}
                />
            </div>
            <div
                className={
                    'btn-group btn-group-sm ms-auto' +
                    ' presenting-control-screencast-group'
                }
                role="group"
                aria-label={tran('Keyboard screencast')}
            >
                <ToolButtonComp
                    icon="bi-keyboard"
                    label={
                        // The strip is off and unavailable while a tool is
                        // armed: the overlay swallows the keyboard, so there is
                        // nothing left worth echoing to the room.
                        isScreencastDisabled
                            ? tran('Available while using the app')
                            : tran('Show the keys being pressed')
                    }
                    shortcutId="toggleScreencast"
                    isActive={isScreencasting}
                    isDisabled={isScreencastDisabled}
                    onClick={onToggleScreencast}
                />
            </div>
            <div
                className="btn-group btn-group-sm presenting-control-history-group"
                role="group"
                aria-label={tran('Drawing history')}
            >
                <HistoryButtonComp
                    icon="bi-arrow-counterclockwise"
                    label={tran('Undo')}
                    shortcutId="undo"
                    isDisabled={!drawManager.canUndo}
                    onClick={() => {
                        drawManager.undo();
                    }}
                />
                <HistoryButtonComp
                    icon="bi-arrow-clockwise"
                    label={tran('Redo')}
                    shortcutId="redo"
                    isDisabled={!drawManager.canRedo}
                    onClick={() => {
                        drawManager.redo();
                    }}
                />
                <HistoryButtonComp
                    icon="bi-eraser-fill"
                    label={tran('Clear drawing')}
                    shortcutId="clearDrawing"
                    isDanger
                    isDisabled={!drawManager.isShowing}
                    onClick={() => {
                        drawManager.clear();
                    }}
                />
            </div>
        </>
    );

    return (
        <FloatingWidgetComp
            title={titleComp}
            persistKey={toPresentingSettingKey(WIDGET_RECT_SETTING_NAME)}
            onClose={onClose}
            options={{
                // Sized for the widest panel (the brush row) wrapping onto two
                // lines; `interact` has no panel at all and leaves the body empty
                // rather than resizing under the user, and a persisted rect wins
                // over this anyway.
                width: 640,
                height: 150,
                // Both header groups keep their full width at every size, so the
                // floor is what they need plus enough heading left over to drag
                // by — the heading is the only drag handle up there.
                minWidth: 360,
                minHeight: 90,
                // `#presenting-control` is pointer-transparent so `interact` can
                // hand the app back; the widget has to opt its own box back in.
                extraClassName: 'presenting-control-widget',
            }}
        >
            {isDrawing ? (
                <AppSuspenseComp>
                    <ControllerDrawToolsCompLazy
                        drawManager={drawManager}
                        isEraser={tool === 'eraser'}
                    />
                </AppSuspenseComp>
            ) : null}
            {tool === 'focus' ? (
                <AppSuspenseComp>
                    <ControllerFocusToolsCompLazy focusManager={focusManager} />
                </AppSuspenseComp>
            ) : null}
        </FloatingWidgetComp>
    );
}
