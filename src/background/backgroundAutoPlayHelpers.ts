import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import type {
    BackgroundSrcType,
    BackgroundType,
} from '../_screen/screenTypeHelpers';
import FileSource from '../helper/FileSource';
import { toDisplayedFilePaths } from '../others/fileListFilterHelpers';
import type { SlideAutoPlayOptionsType } from '../slide-auto-play/slideAutoPlayRuleHelpers';
import { toNextIndex } from '../slide-auto-play/slideAutoPlayRuleHelpers';
import { sortMediaFilePaths } from './BackgroundMediaComp';

/**
 * A slide show over the BACKGROUND layer -- the pictures and clips behind the
 * words, which is where a church actually runs one.
 *
 * It is the foreground widgets' walk applied one layer down, and shares their
 * two rules: "next" is the next TILE IN THE GRID rather than the next entry
 * the filesystem hands back, and every screen holding one of these files moves
 * on its own, staggered so several screens do not re-render in the same frame.
 *
 * The move is `applyBackgroundSrcWithSyncGroup` rather than
 * `handleBackgroundSelecting`: that one TOGGLES a background that is already
 * up, so "repeat one" would have taken the picture off the projector instead
 * of holding it, and it asks which screens to use -- a question a running show
 * must not put in front of anybody.
 */
export function handleNextBackgroundSelecting({
    backgroundType,
    dirSourceSettingName,
    filePaths,
    isNext,
    options,
    orderedSrcList: givenSrcList,
}: {
    backgroundType: BackgroundType;
    dirSourceSettingName: string;
    filePaths: string[];
    isNext: boolean;
    options: SlideAutoPlayOptionsType;
    /**
     * The grid's order, when the caller is the only one who can work it out.
     * The Webs tab is: its tiles are files AND saved URLs, grouped together,
     * so there is no list of file paths that describes what it draws.
     */
    orderedSrcList?: string[];
}) {
    const orderedSrcList =
        givenSrcList ??
        toDisplayedFilePaths(
            dirSourceSettingName,
            filePaths,
            sortMediaFilePaths,
        ).map((filePath) => {
            return FileSource.getInstance(filePath).src;
        });
    if (orderedSrcList.length === 0) {
        return false;
    }
    const foundList = ScreenBackgroundManager.getBackgroundSrcListByType(
        backgroundType,
    )
        .map(([screenIdText, backgroundSrc]) => {
            const index = orderedSrcList.indexOf(backgroundSrc.src);
            if (index === -1) {
                return null;
            }
            const nextIndex = toNextIndex(index, orderedSrcList.length, {
                isNext,
                step: options.step,
                repeatKind: options.repeatKind,
            });
            // "No repeat" has walked off the end. What is up stays up: a show
            // that ran out must leave the last picture on the wall, never
            // blank it.
            if (nextIndex === null) {
                return null;
            }
            return {
                screenId: Number.parseInt(screenIdText),
                src: orderedSrcList[nextIndex],
                backgroundSrc,
            };
        })
        .filter((item) => {
            return item !== null;
        });
    for (let i = 0; i < foundList.length; i++) {
        const { screenId, src, backgroundSrc } = foundList[i];
        setTimeout(async () => {
            const screenBackgroundManager =
                ScreenBackgroundManager.getInstance(screenId);
            if (screenBackgroundManager === null) {
                return;
            }
            const newBackgroundSrc =
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    src,
                    backgroundType,
                );
            // How the operator had it fitted and styled belongs to the SCREEN,
            // not to the file, so a show must carry it across every item --
            // otherwise the first tick quietly resets a stretched background
            // to the default.
            const carriedOver: BackgroundSrcType = {
                ...newBackgroundSrc,
                scaleType: backgroundSrc.scaleType,
                extraStyle: backgroundSrc.extraStyle,
            };
            screenBackgroundManager.applyBackgroundSrcWithSyncGroup(
                carriedOver,
            );
        }, i * 100);
    }
    return foundList.length > 0;
}
