import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import ScreenManager from '../managers/ScreenManager';
import {
    useScreenManagerContext,
    useScreenUpdateEvents,
} from '../managers/screenManagerHooks';

function RenderButtonComp({
    btnMaps,
}: Readonly<{
    btnMaps: {
        title: string;
        text: string | React.ReactNode;
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
            className={`btn btn-sm btn-${isEnabled ? '' : 'outline-'}${btnType}`}
            type="button"
            title={`${title} [${toShortcutKey(eventMap)}]`}
            style={{ height: '20px' }}
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
    } = screenManager;

    const isShowingBackground = screenBackgroundManager.isShowing;
    const isShowingSlide = screenVaryAppDocumentManager.isShowing;
    const isShowingBible = screenBibleManager.isShowing;
    const isShowingForeground = screenForegroundManager.isShowing;
    const isShowing =
        isShowingBackground ||
        isShowingSlide ||
        isShowingBible ||
        isShowingForeground;
    return [
        {
            text: <i className="bi bi-eraser" />,
            title: '`Clear All',
            btnType: 'danger',
            isEnabled: isShowing,
            eventMap: { key: 'F6' },
            onClick: () => {
                screenManager.clear();
            },
        },
        {
            text: 'BG',
            title: '`Clear Background',
            btnType: 'secondary',
            isEnabled: isShowingBackground,
            eventMap: { key: 'F7' },
            onClick: () => {
                screenBackgroundManager.clear();
            },
        },
        {
            text: 'SL',
            title: '`Clear Slide',
            btnType: 'info',
            isEnabled: isShowingSlide,
            eventMap: { key: 'F8' },
            onClick: () => {
                screenVaryAppDocumentManager.clear();
            },
        },
        {
            text: 'BB',
            title: '`Clear Bible',
            btnType: 'primary',
            isEnabled: isShowingBible,
            eventMap: { key: 'F9' },
            onClick: () => {
                screenBibleManager.clear();
            },
        },
        {
            text: 'FG',
            title: '`Clear Foreground',
            btnType: 'secondary',
            isEnabled: isShowingForeground,
            eventMap: { key: 'F10' },
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
        <div className="btn-group control">
            {btnMaps.map((btnMaps) => {
                return (
                    <RenderButtonComp key={btnMaps.title} btnMaps={btnMaps} />
                );
            })}
        </div>
    );
}
