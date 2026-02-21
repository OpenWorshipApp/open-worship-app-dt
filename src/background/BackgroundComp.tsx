import './BackgroundComp.scss';

import { lazy, useCallback, useState } from 'react';

import {
    useStateSettingBoolean,
    useStateSettingString,
} from '../helper/settingHelpers';
import TabRenderComp, { genTabBody } from '../others/TabRenderComp';
import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { getBackgroundSrcListOnScreenSetting } from '../_screen/screenHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    AUDIO_PLAYING_CHANGE_EVENT,
    checkAudioPlaying,
    showAudioPlayingToast,
} from '../helper/audioControlHelpers';
import type {
    BackgroundSrcListType,
    BackgroundType,
} from '../_screen/screenTypeHelpers';
import appProvider from '../server/appProvider';
import EventHandler from '../event/EventHandler';

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
            (audio: HTMLAudioElement | null) => {
                if (
                    audio !== null &&
                    audio.dataset.isBackgroundAudio === 'true' &&
                    !audio.paused
                ) {
                    setIsPlaying(true);
                    return;
                }
                setIsPlaying(false);
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registerEvent);
        };
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
                    onClick={() => {
                        setIsActive(!isActive);
                    }}
                >
                    ♫{tran('Audios')}♫
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

const tabTypeList = [
    ['color', tran('Colors'), LazyBackgroundColorsComp],
    ['image', tran('Images'), LazyBackgroundImagesComp],
    ['video', tran('Videos'), LazyBackgroundVideosComp],
    ['camera', tran('Cameras'), LazyBackgroundCamerasComp],
    ['web', tran('Webs'), LazyBackgroundWebComp],
] as const;
type TabKeyType = (typeof tabTypeList)[number][0] | 'audio';
export default function BackgroundComp() {
    const [isAudioTabActive, setIsAudioTabActive] = useStateSettingBoolean(
        'background-audio-active',
        false,
    );
    const setIsAudioTabActive1 = useCallback(
        (newValue: boolean) => {
            const isAudioPlaying = checkAudioPlaying();
            if (!newValue && isAudioPlaying) {
                showAudioPlayingToast();
                return;
            }
            setIsAudioTabActive(newValue);
        },
        [isAudioTabActive],
    );
    const [tabKey, setTabKey] = useStateSettingString<TabKeyType>(
        'background-tab',
        'image',
    );
    useScreenBackgroundManagerEvents(['update']);

    const normalBackgroundChild = tabTypeList.map(([type, _, target]) => {
        return genTabBody<TabKeyType>(tabKey, [type, target]);
    });
    return (
        <div className="background w-100 h-100 d-flex flex-column">
            <div className="header d-flex">
                <TabRenderComp<TabKeyType>
                    tabs={tabTypeList.map(([key, name]) => {
                        return {
                            key,
                            title: name,
                            checkIsOnScreen: (targeKey) => {
                                const backgroundSrcList =
                                    getBackgroundSrcListOnScreenSetting();
                                return genIsSelected(
                                    backgroundSrcList,
                                    targeKey,
                                );
                            },
                        };
                    })}
                    activeTab={tabKey}
                    setActiveTab={setTabKey}
                />
                {appProvider.isPagePresenter ? (
                    <RenderAudiosTabComp
                        isActive={isAudioTabActive}
                        setIsActive={setIsAudioTabActive1}
                    />
                ) : null}
            </div>
            <div className="body flex-fill d-flex overflow-hidden">
                {appProvider.isPagePresenter && isAudioTabActive ? (
                    <ResizeActorComp
                        flexSizeName={'flex-size-background'}
                        isHorizontal
                        isDisableQuickResize={true}
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
                                widgetName: 'Background',
                            },
                            {
                                children: LazyBackgroundAudiosComp,
                                key: 'h2',
                                widgetName: 'Background Audio',
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
