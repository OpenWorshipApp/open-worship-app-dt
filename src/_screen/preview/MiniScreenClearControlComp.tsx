import type { ReactNode } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import type ScreenManager from '../managers/ScreenManager';
import {
    useScreenManagerContext,
    useScreenUpdateEvents,
} from '../managers/screenManagerHooks';
import {
    clearAllEventMapper,
    clearBackgroundEventMapper,
    clearForegroundEventMapper,
    clearLongTextEventMapper,
    clearSlideEventMapper,
} from '../../keyboard-shortcut/appShortcutMappers';

function RenderButtonComp({
    btnMaps,
}: Readonly<{
    btnMaps: {
        title: string;
        text: string | ReactNode;
        btnType: string;
        onClick: () => void;
        eventMap: { key: string };
        isEnabled: boolean;
    };
}>) {
    const { title, text, btnType, onClick, eventMap, isEnabled } = btnMaps;
    const onClickCallback = isEnabled ? onClick : () => {};
    useKeyboardRegistering([eventMap], onClickCallback, [isEnabled]);
    return (
        <button
            className={`btn btn-${isEnabled ? '' : 'outline-'}${btnType}`}
            type="button"
            title={`${title} [${toShortcutKey(eventMap)}]`}
            aria-label={title}
            onClick={onClickCallback}
        >
            {text}
        </button>
    );
}

function genBtnMaps(screenManager: ScreenManager) {
    const {
        screenBackgroundManager,
        screenVaryAppDocumentManager,
        screenLongTextManager,
        screenDrawManager,
        screenFocusManager,
    } = screenManager;

    const isShowingBackground = screenBackgroundManager.isShowing;
    const isShowingSlide = screenVaryAppDocumentManager.isShowing;
    // The long-text LAYER, whatever it holds: a Bible passage or the
    // text of a Long Text Show.
    const isShowingLongTextLayer = screenLongTextManager.isShowing;
    // A long text counts: Long Text Show is a Foreground panel.
    const isShowingForeground = screenManager.isShowingForeground;
    // draw/focus have no dedicated clear button but Clear All clears them,
    // so a drawing or spotlight alone must still enable it
    const isShowing =
        isShowingBackground ||
        isShowingSlide ||
        isShowingLongTextLayer ||
        isShowingForeground ||
        screenDrawManager.isShowing ||
        screenFocusManager.isShowing;
    return [
        {
            text: <i className="bi bi-eraser" />,
            title: tran('Clear All'),
            btnType: 'danger',
            isEnabled: isShowing,
            eventMap: clearAllEventMapper,
            onClick: () => {
                screenManager.clear();
            },
        },
        {
            text: 'BG',
            title: tran('Clear Background'),
            btnType: 'secondary',
            isEnabled: isShowingBackground,
            eventMap: clearBackgroundEventMapper,
            onClick: () => {
                screenBackgroundManager.clear();
            },
        },
        {
            text: 'SL',
            title: tran('Clear Slide'),
            btnType: 'info',
            isEnabled: isShowingSlide,
            eventMap: clearSlideEventMapper,
            onClick: () => {
                screenVaryAppDocumentManager.clear();
            },
        },
        {
            // `LT`, the layer `ScreenLongTextManager` draws -- it was `BB`
            // while a Bible passage was all that layer could hold.
            text: 'LT',
            title: tran('Clear Long Text'),
            btnType: 'primary',
            isEnabled: isShowingLongTextLayer,
            eventMap: clearLongTextEventMapper,
            onClick: () => {
                screenLongTextManager.clear();
            },
        },
        {
            text: 'FG',
            title: tran('Clear Foreground'),
            btnType: 'secondary',
            isEnabled: isShowingForeground,
            eventMap: clearForegroundEventMapper,
            onClick: () => {
                screenManager.clearForeground();
            },
        },
    ];
}

export default function MiniScreenClearControlComp() {
    useScreenUpdateEvents();
    const screenManager = useScreenManagerContext();
    const btnMaps = genBtnMaps(screenManager);
    return (
        <div className="control-buttons btn-group control">
            {btnMaps.map((btnMaps) => {
                return (
                    <RenderButtonComp key={btnMaps.title} btnMaps={btnMaps} />
                );
            })}
        </div>
    );
}
