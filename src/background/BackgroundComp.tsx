import './BackgroundComp.scss';

import type { MouseEvent } from 'react';
import { lazy, useCallback, useMemo, useRef, useState } from 'react';

import {
    useStateSettingBoolean,
    useStateSettingString,
} from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { getBackgroundSrcListOnScreenSetting } from '../_screen/screenHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { genLabelIcon, toWidgetLabel } from '../others/labelIconHelpers';
import { tran } from '../lang/langHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import {
    AUDIO_PLAYING_CHANGE_EVENT,
    checkAudioPlaying,
    checkBackgroundAudioPlaying,
    showAudioPlayingToast,
} from '../helper/mediaControlHelpers';
import type {
    BackgroundSrcListType,
    BackgroundType,
} from '../_screen/screenTypeHelpers';
import EventHandler from '../event/EventHandler';
import { OPEN_BACKGROUND_AUDIO_TAB_EVENT } from './backgroundAudioTabHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import {
    BackgroundTransitionBadgeComp,
    genBackgroundTabTransitionMenuItems,
} from './backgroundTransitionMenuHelpers';

// A tab's icon and its words, the words in a span the header can fold away
// when the row is too narrow for all of them (`useIsTabRowCompact`). The
// title keeps the name on the icon for a pointer, and the folded words stay
// in the page, so the tab is still named for a screen reader and the app's
// own tools.
function RenderTabLabelComp({ labelKey }: Readonly<{ labelKey: string }>) {
    const label = tran(labelKey);
    return (
        <span title={label}>
            {genLabelIcon(labelKey)}
            <span className="background-tab-text">{label}</span>
        </span>
    );
}

// True while the tabs' full words do not fit beside the Audios tab. The row
// used to scroll sideways instead, which cut the last tab mid-word ("W" for
// Webs) at the default width in English. Measured, not guessed from a width:
// the same panel fits every Khmer label and not every English one.
function useIsTabRowCompact() {
    const headerRef = useRef<HTMLDivElement | null>(null);
    const [isCompact, setIsCompact] = useState(false);
    const isCompactRef = useAppCurrentRef(isCompact);
    // The header width the full words need, measured while they were shown.
    const fullWidthRef = useRef(0);
    const check = useCallback(() => {
        const header = headerRef.current;
        const tabList = header?.firstElementChild;
        if (!header || !(tabList instanceof HTMLElement)) {
            return;
        }
        if (isCompactRef.current) {
            if (header.clientWidth >= fullWidthRef.current) {
                setIsCompact(false);
            }
            return;
        }
        const overflow = tabList.scrollWidth - tabList.clientWidth;
        if (overflow > 1) {
            fullWidthRef.current = header.clientWidth + overflow;
            setIsCompact(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        const header = headerRef.current;
        if (header === null) {
            return;
        }
        const observer = new ResizeObserver(check);
        observer.observe(header);
        return () => {
            observer.disconnect();
        };
    }, []);
    // Once more after each switch: unfolding on a remembered width is a guess.
    useAppEffect(() => {
        check();
    }, [isCompact]);
    return { headerRef, isCompact };
}

const LazyBackgroundColorsComp = lazy(() => {
    return import('./BackgroundColorsComp');
});
const LazyBackgroundImagesComp = lazy(() => {
    return import('./BackgroundImagesComp');
});
const LazyBackgroundVideosComp = lazy(() => {
    return import('./BackgroundVideosComp');
});
const LazyBackgroundCamerasComp = lazy(() => {
    return import('./BackgroundCamerasComp');
});
const LazyBackgroundWebComp = lazy(() => {
    return import('./BackgroundWebComp');
});
const LazyBackgroundAudiosComp = lazy(() => {
    return import('./BackgroundAudiosComp');
});

function RenderAudiosTabComp({
    isActive,
    setIsActive,
}: Readonly<{
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
}>) {
    const [isPlaying, setIsPlaying] = useState(false);
    useAppEffect(() => {
        const registerEvent = EventHandler.registerEventListener(
            [AUDIO_PLAYING_CHANGE_EVENT],
            () => {
                // Deliberately ignoring the payload. Starting a track pauses
                // the others first, and each of those pauses fires its own
                // `null` AFTER this event, so taking the last payload turned
                // the dot off while a track was still playing -- and left it
                // off, because every later play pauses a sibling too. Ask the
                // DOM, which is the only thing that knows what is running.
                setIsPlaying(checkBackgroundAudioPlaying());
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registerEvent);
        };
    }, []);
    const isActiveRef = useAppCurrentRef(isActive);
    const setIsActiveRef = useAppCurrentRef(setIsActive);
    const handleToggleActive = useCallback(() => {
        setIsActiveRef.current(!isActiveRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <ul className={'nav nav-tabs flex-fill d-flex justify-content-end'}>
            <li className={'nav-item '}>
                <button
                    className={
                        'btn btn-sm btn-link nav-link' +
                        ` ${isActive ? 'active' : ''}` +
                        ` ${isPlaying ? ' app-on-screen' : ''}`
                    }
                    onClick={handleToggleActive}
                >
                    <RenderTabLabelComp labelKey="Audios" />
                </button>
            </li>
        </ul>
    );
}

const genIsSelected = (
    backgroundSrcList: BackgroundSrcListType,
    type: BackgroundType,
) => {
    const isSelected = Object.values(backgroundSrcList).some((src) => {
        return src.type === type;
    });
    return isSelected;
};

// Label KEYS, translated where they render: `tran()` at module scope reads
// the language before the app has loaded it.
const tabTypeList = [
    ['color', 'Colors', LazyBackgroundColorsComp],
    ['image', 'Images', LazyBackgroundImagesComp],
    ['video', 'Videos', LazyBackgroundVideosComp],
    ['camera', 'Cameras', LazyBackgroundCamerasComp],
    ['web', 'Webs', LazyBackgroundWebComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0] | 'audio';
export default function BackgroundComp() {
    const [isAudioTabActive, setIsAudioTabActive] = useStateSettingBoolean(
        'background-audio-active',
        false,
    );
    const setIsAudioTabActiveRef = useAppCurrentRef(setIsAudioTabActive);
    const setIsAudioTabActive1 = useCallback((newValue: boolean) => {
        const isAudioPlaying = checkAudioPlaying();
        if (!newValue && isAudioPlaying) {
            showAudioPlayingToast();
            return;
        }
        setIsAudioTabActiveRef.current(newValue);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Somewhere else in the app is pointing at a track (a presenting flow entry), so
    // the split has to be open before it can be scrolled to and flashed.
    useAppEffect(() => {
        const registeredEvent = EventHandler.registerEventListener(
            [OPEN_BACKGROUND_AUDIO_TAB_EVENT],
            () => {
                setIsAudioTabActiveRef.current(true);
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registeredEvent);
        };
    }, []);
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        'background-tab',
        'image',
    );
    useScreenBackgroundManagerEvents(['update']);

    const normalBackgroundChild = useMemo(() => {
        return tabTypeList.map(([type, _, target]) => {
            return genTabBody<TabKeyType>(tabKey, [type, target]);
        });
    }, [tabKey]);
    const tabs = useMemo(() => {
        return tabTypeList.map(([key, labelKey]) => {
            return {
                key,
                title: (
                    <>
                        <RenderTabLabelComp labelKey={labelKey} />
                        {/* While the tab has its OWN transition. */}
                        <BackgroundTransitionBadgeComp backgroundType={key} />
                    </>
                ),
                checkIsOnScreen: (targeKey: TabKeyType) => {
                    const backgroundSrcList =
                        getBackgroundSrcListOnScreenSetting();
                    return genIsSelected(backgroundSrcList, targeKey);
                },
                // Every background from this tab can come in with the tab's
                // own transition instead of the screen's.
                onContextMenu: (
                    targetKey: TabKeyType,
                    event: MouseEvent<HTMLButtonElement>,
                ) => {
                    if (targetKey === 'audio') {
                        return;
                    }
                    const menuItems =
                        genBackgroundTabTransitionMenuItems(targetKey);
                    if (menuItems.length > 0) {
                        showAppContextMenu(event as any, menuItems);
                    }
                },
            };
        });
    }, []);
    const { headerRef, isCompact } = useIsTabRowCompact();
    return (
        <div className="background w-100 h-100 d-flex flex-column">
            <div
                ref={headerRef}
                className={'header d-flex' + (isCompact ? ' is-compact' : '')}
            >
                <TabRenderComp<TabKeyType>
                    tabs={tabs}
                    activeTabs={[tabKey]}
                    setActiveTab={(key) => setTabKey(key)}
                />
                <RenderAudiosTabComp
                    isActive={isAudioTabActive}
                    setIsActive={setIsAudioTabActive1}
                />
            </div>
            <div className="body flex-fill d-flex overflow-hidden">
                {isAudioTabActive ? (
                    <ResizeActorComp
                        flexSizeName={'flex-size-background'}
                        isHorizontal
                        isDisableQuickResize
                        flexSizeDefault={{
                            h1: ['1'],
                            h2: ['1'],
                        }}
                        dataInput={[
                            {
                                children: {
                                    render: () => {
                                        return normalBackgroundChild;
                                    },
                                },
                                key: 'h1',
                                ...toWidgetLabel('Background'),
                            },
                            {
                                children: LazyBackgroundAudiosComp,
                                key: 'h2',
                                ...toWidgetLabel('Background Audio'),
                            },
                        ]}
                    />
                ) : (
                    normalBackgroundChild
                )}
            </div>
        </div>
    );
}
