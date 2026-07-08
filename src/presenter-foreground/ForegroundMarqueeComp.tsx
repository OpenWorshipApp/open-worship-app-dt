import { type ChangeEvent, type CSSProperties, useCallback } from 'react';

import { DEFAULT_LOCALE, tran } from '../lang/langHelpers';
import {
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import type { ForegroundMarqueDataType } from '../_screen/screenTypeHelpers';
import { dragStore } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

const FONT_SIZE_SETTING_NAME = 'foreground-marquee-font-size';
const FONT_SIZE_PRESETS = [0, 50, 75, 100, 150];

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllMarquees(
    showingScreenIdDataList: [number, ForegroundMarqueDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
        for (const [screenId, data] of showingScreenIdDataList) {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.setMarqueeData({
                        ...data,
                        extraStyle,
                    });
                },
            );
        }
    });
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setMarqueeData(null);
    });
}

export default function ForegroundMarqueeComp() {
    useScreenForegroundManagerEvents(['update']);
    const [text, setText] = useStateSettingString<string>(
        'foreground-marquee-setting',
        'This is a testing marquee text. It has to be long enough to test ' +
            'the marquee scrolling effect properly.',
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        FONT_SIZE_SETTING_NAME,
        0,
    );
    const handleFontSizeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setFontSize(Number.parseInt(event.target.value) || 0);
        },
        [setFontSize],
    );
    const withFontSize = useCallback(
        (style: CSSProperties): CSSProperties => {
            return fontSize > 0
                ? { ...style, fontSize: `${fontSize}px` }
                : style;
        },
        [fontSize],
    );

    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.marqueeData !== null;
        },
    )
        .map(([screenId, data]): [number, ForegroundMarqueDataType] | null => {
            if (data.marqueeData === null) {
                return null;
            }
            return [screenId, data.marqueeData];
        })
        .filter((item) => {
            return item !== null;
        });
    const {
        genStyle,
        element: propsSetting,
        fontFamily,
        fontWeight,
    } = useForegroundPropsSetting({
        prefix: 'marquee',
        isGeometry: false,
        onChange: (extraStyle) => {
            refreshAllMarquees(
                showingScreenIdDataList,
                withFontSize(extraStyle),
            );
        },
        extraControls: (
            <>
                <div
                    className="d-flex input-group m-1"
                    style={{ width: '190px', height: '35px' }}
                    title={tran('Marquee font size (0 = auto)')}
                >
                    <span className="input-group-text">
                        <i className="bi bi-fonts" />
                    </span>
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        value={fontSize}
                        placeholder={tran('auto')}
                        onChange={handleFontSizeChange}
                    />
                    <span className="input-group-text">px</span>
                </div>
                <div
                    className="btn-group btn-group-sm m-1"
                    role="group"
                    title={tran('Quick font size')}
                >
                    {FONT_SIZE_PRESETS.map((size) => {
                        return (
                            <button
                                key={size}
                                type="button"
                                className={
                                    'btn btn-outline-secondary' +
                                    (fontSize === size ? ' active' : '')
                                }
                                onClick={() => setFontSize(size)}
                            >
                                {size === 0 ? tran('Auto') : size}
                            </button>
                        );
                    })}
                </div>
            </>
        ),
    });
    const genExtraStyle = useCallback((): CSSProperties => {
        return withFontSize(genStyle());
    }, [genStyle, withFontSize]);
    const editorStyle: CSSProperties = {
        fontFamily: fontFamily || undefined,
        fontWeight: fontWeight && fontWeight !== '--' ? fontWeight : undefined,
        height: '150px',
    };

    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.setMarquee(
                event,
                text,
                genExtraStyle(),
                isForceChoosing,
            );
        },
        [text, genExtraStyle],
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            handleShowing(event, true);
        },
        [handleShowing],
    );
    const handleByDropped = useCallback(
        (event: any) => {
            const screenForegroundManager =
                getScreenForegroundManagerByDropped(event);
            if (screenForegroundManager === null) {
                return;
            }
            screenForegroundManager.setMarqueeData({
                text,
                extraStyle: genExtraStyle(),
            });
        },
        [text, genExtraStyle],
    );
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
            buttonText={tran('Hide Marquee')}
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    const handleDateSetting = useCallback(() => {
        const date = new Date();
        const formattedDate = date.toLocaleString(DEFAULT_LOCALE, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        setText(formattedDate);
    }, [setText]);
    const handleTextChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            setText(event.target.value);
        },
        [setText],
    );
    const handleMarqueeDragStart = useCallback(() => {
        dragStore.onDropped = handleByDropped;
    }, [handleByDropped]);
    const handleMarqueeDragEnd = useCallback(() => {
        dragStore.onDropped = null;
    }, []);
    return (
        <ForegroundLayoutComp
            target="marquee"
            fullChildHeaders={<h4>{tran('Marquee')}</h4>}
            childHeadersOnHidden={genHidingElement(true)}
        >
            {propsSetting}
            <hr />
            <div className="d-flex flex-column gap-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                        className="btn btn-sm btn-outline-info"
                        title={tran("Insert today's date as the marquee text")}
                        onClick={handleDateSetting}
                    >
                        <i className="bi bi-calendar-plus" />{' '}
                        {tran("Today's Date")}
                    </button>
                </div>
                <div className="form-floating">
                    <textarea
                        id="marquee-textarea"
                        className="form-control"
                        cols={30}
                        rows={50}
                        value={text}
                        onChange={handleTextChange}
                        placeholder="Leave a marquee text here"
                        style={editorStyle}
                    />
                    <label htmlFor="marquee-textarea">{tran('Marquee')}</label>
                </div>
                <div className="d-flex">
                    <button
                        className="btn btn-primary"
                        title={tran('Show Marquee')}
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={handleMarqueeDragStart}
                        onDragEnd={handleMarqueeDragEnd}
                    >
                        <i className="bi bi-display" /> {tran('Show Marquee')}
                    </button>
                </div>
            </div>
            {genHidingElement(false)}
        </ForegroundLayoutComp>
    );
}
