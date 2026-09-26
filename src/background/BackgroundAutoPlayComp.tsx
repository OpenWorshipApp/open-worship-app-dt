import './BackgroundAutoPlayComp.scss';

import { useCallback } from 'react';

import { useScreenBackgroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type { BackgroundType } from '../_screen/screenTypeHelpers';
import DirSource from '../helper/DirSource';
import { useAppEffect } from '../helper/appHooks';
import { getVideoDurationSeconds } from '../helper/videoDurationHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import { applyAutoPlayRunners } from '../slide-auto-play/autoPlayRunnerHelpers';
import SlideAutoPlayComp from '../slide-auto-play/SlideAutoPlayComp';
import type { SlideAutoPlayOptionsType } from '../slide-auto-play/slideAutoPlayHelpers';
import {
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    notifySlideAutoPlayStateChanged,
    readSlideAutoPlayOptions,
    setIsSlideAutoPlaying,
} from '../slide-auto-play/slideAutoPlayHelpers';
import { handleNextBackgroundSelecting } from './backgroundAutoPlayHelpers';
import { genBackgroundWebDisplayedSrcList } from './backgroundWebCompHelpers';
import {
    createBackgroundWebUrlSourceList,
    getBackgroundWebUrlItemList,
} from './backgroundWebUrlHelpers';

/**
 * One background list's slide show.
 *
 * Its clock lives OUTSIDE React, exactly like the foreground widgets' -- and
 * for a sharper reason here: the background lists are TABS, so switching to
 * Colors for a moment unmounts this one, and a show that stopped because the
 * operator looked at another tab would be a show nobody could trust through a
 * service.
 */
type BackgroundAutoPlayPropsType = {
    prefix: string;
    backgroundType: BackgroundType;
    dirSourceSettingName: string;
};

/**
 * Walks this list once, with nothing rendered: the folder is read off disk and
 * the order is the one the GRID draws. Answers false when nothing moved, which
 * is a cleared background or a "no repeat" show that has run out.
 */
async function tickBackground(props: BackgroundAutoPlayPropsType) {
    const { backgroundType, dirSourceSettingName, prefix } = props;
    const dirSource = await DirSource.getInstance(dirSourceSettingName);
    const filePaths =
        (await dirSource.getFilePaths(backgroundType as MimetypeNameType)) ??
        [];
    // The Webs tab draws saved URLs beside its files, so its order is its own
    // and a folder with no files in it can still have a show to run.
    const orderedSrcList =
        backgroundType === 'web'
            ? genBackgroundWebDisplayedSrcList(
                  filePaths,
                  createBackgroundWebUrlSourceList(
                      getBackgroundWebUrlItemList(),
                  ),
              )
            : undefined;
    if (filePaths.length === 0 && !orderedSrcList?.length) {
        return false;
    }
    return handleNextBackgroundSelecting({
        backgroundType,
        dirSourceSettingName,
        filePaths,
        isNext: true,
        options: readSlideAutoPlayOptions(prefix),
        orderedSrcList,
    });
}

/**
 * How long this show rests on what is up now. For clips, "wait until the video
 * ends" is the clip's own length -- see `getVideoDurationSeconds` for why it is
 * not an `ended` listener.
 */
async function getBackgroundDelaySeconds(
    props: BackgroundAutoPlayPropsType,
    options: SlideAutoPlayOptionsType,
) {
    if (!(props.backgroundType === 'video' && options.isUntilMediaEnd)) {
        return genNextDelaySeconds(options);
    }
    const [current] = ScreenBackgroundManager.getBackgroundSrcListByType(
        props.backgroundType,
    );
    const src = current?.[1]?.src;
    if (src === undefined) {
        return genNextDelaySeconds(options);
    }
    const durationSeconds = await getVideoDurationSeconds(src);
    if (durationSeconds === null) {
        return genNextDelaySeconds(options);
    }
    return durationSeconds;
}

function syncBackgroundAutoPlayRunners(props: BackgroundAutoPlayPropsType) {
    const { backgroundType, prefix } = props;
    const options = readSlideAutoPlayOptions(prefix);
    const isUntilMediaEnd =
        backgroundType === 'video' && options.isUntilMediaEnd;
    const isRunnable =
        checkIsSlideAutoPlaying(prefix) &&
        // Waiting for the clip to finish needs no seconds at all, so an empty
        // seconds box must not stop that show from running.
        (options.seconds > 0 || options.maxSeconds > 0 || isUntilMediaEnd) &&
        ScreenBackgroundManager.getBackgroundSrcListByType(backgroundType)
            .length > 0;
    // Only ever this list's own runner is named, so a show on the OTHER
    // background list -- or in a foreground widget -- is left alone.
    applyAutoPlayRunners(
        isRunnable
            ? [
                  {
                      key: prefix,
                      // What decides HOW it waits. The background on screen is
                      // deliberately not in here: an item changing must not
                      // reset the countdown, only the rules changing may.
                      signature: [
                          options.seconds,
                          options.maxSeconds,
                          options.repeatKind,
                          options.step,
                          isUntilMediaEnd,
                      ].join(':'),
                      getDelaySeconds: () => {
                          return getBackgroundDelaySeconds(props, options);
                      },
                      tick: () => {
                          return tickBackground(props);
                      },
                      onEnded: () => {
                          setIsSlideAutoPlaying(prefix, false);
                          notifySlideAutoPlayStateChanged();
                      },
                  },
              ]
            : [],
        // Anything not named here belongs to another list and must survive.
        (key) => {
            return key === prefix;
        },
    );
}

export default function BackgroundAutoPlayComp(
    props: Readonly<BackgroundAutoPlayPropsType>,
) {
    const { prefix, backgroundType, dirSourceSettingName } = props;
    // A background going up or coming off is what makes a show runnable or
    // finished, so the reconcile rides the same event the tiles do.
    useScreenBackgroundManagerEvents(['update']);
    // How many screens this list has something on. Read here rather than
    // inside the effect because it is what the effect DEPENDS on: a
    // reconcile on every render would re-read the settings each time the
    // grid redraws, and this list redraws a lot.
    const showingCount =
        ScreenBackgroundManager.getBackgroundSrcListByType(
            backgroundType,
        ).length;
    useAppEffect(() => {
        syncBackgroundAutoPlayRunners({
            prefix,
            backgroundType,
            dirSourceSettingName,
        });
    }, [prefix, backgroundType, dirSourceSettingName, showingCount]);
    const handleStateChange = useCallback(() => {
        syncBackgroundAutoPlayRunners({
            prefix,
            backgroundType,
            dirSourceSettingName,
        });
    }, [prefix, backgroundType, dirSourceSettingName]);
    // Never called -- the clock is external -- but the control asks for it, and
    // a handler that steps this very list is the honest thing to hand over.
    // Never called -- the clock is external -- but the control asks for one,
    // and stepping this very list is the honest thing to hand over. It is the
    // runner's own tick, so the two can never walk different orders.
    const handleNext = useCallback(() => {
        return tickBackground({
            prefix,
            backgroundType,
            dirSourceSettingName,
        });
    }, [prefix, backgroundType, dirSourceSettingName]);
    // Whether there is anything to control at all is the CARD's decision --
    // it keeps the strip out of the tree entirely, rather than leaving an
    // empty row with a rule under it across the top of the grid. Nothing is
    // needed here to stop a show whose background was cleared: the tick
    // itself answers false once this list has nothing on a screen, which is
    // the same guard that ends a show when the operator presses F7.
    return (
        <SlideAutoPlayComp
            prefix={prefix}
            onNext={handleNext}
            isTimerExternal
            isInline
            canUntilMediaEnd={backgroundType === 'video'}
            onStateChange={handleStateChange}
        />
    );
}
