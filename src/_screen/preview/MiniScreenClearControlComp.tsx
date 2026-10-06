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
    clearBibleEventMapper,
    clearForegroundEventMapper,
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
        screenBibleManager,
        screenForegroundManager,
        screenDrawManager,
        screenFocusManager,
    } = screenManager;

    const isShowingBackground = screenBackgroundManager.isShowing;
    const isShowingSlide = screenVaryAppDocumentManager.isShowing;
    const isShowingBible = screenBibleManager.isShowing;
    const isShowingForeground = screenForegroundManager.isShowing;
    // draw/focus have no dedicated clear button but Clear All clears them,
    // so a drawing or spotlight alone must still enable it
    const isShowing =
        isShowingBackground ||
        isShowingSlide ||
        isShowingBible ||
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
            text: 'BB',
            title: tran('Clear Bible'),
            btnType: 'primary',
            isEnabled: isShowingBible,
            eventMap: clearBibleEventMapper,
            onClick: () => {
                screenBibleManager.clear();
            },
        },
        {
            text: 'FG',
            title: tran('Clear Foreground'),
            btnType: 'secondary',
            isEnabled: isShowingForeground,
            eventMap: clearForegroundEventMapper,
            onClick: () => {
                screenForegroundManager.clear();
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
