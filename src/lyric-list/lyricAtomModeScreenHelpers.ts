import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { handleError } from '../helper/errorHelpers';
import { getLyricAppDocumentStageByStage } from './lyricHelpers';
import { LYRIC_SLIDE_TYPE_KEY } from './LyricSlide';
import type LyricSlide from './LyricSlide';

/**
 * What a song slide that is UP has to become when Atom Mode is switched.
 *
 * The switch renumbers every song: a slide's id is its place in the deck, and
 * a part becomes as many slides as it has lines. A screen keeps the slide it
 * was given, so it would go on showing a whole part while the presenter marks
 * whichever card now has that id, and the next key would step on from there --
 * the trap Long Text Show met with its own Atom Mode (memory `long-text-show`).
 * So every song slide on a screen is put up again as its counterpart in the
 * new deck: a part's first line when the switch goes on, the whole part when
 * it goes off.
 *
 * Loaded only when the switch is pressed.
 */

type QuickSlideType = Pick<
    LyricSlide,
    'id' | 'openLyricIndex' | 'openLyricRepeat' | 'openLyricLine'
>;

/**
 * The id `id` of a deck listed as `oldList` has in the same song listed as
 * `newList` -- both `getSlidesQuick` lists, under the two modes.
 *
 * First, Info and None lead every deck, so they keep their ids. A part's slide
 * goes to the same Structure step and the same play of it: the same line when
 * the new deck has one, else the step's first slide (the whole part, or its
 * first line). The attachment slides follow the song's own and are not in a
 * quick list, so they move by however much the deck grew or shrank.
 */
export function mapLyricSlideIdAcrossAtomMode(
    oldList: QuickSlideType[],
    newList: QuickSlideType[],
    id: number,
) {
    const oldSlide = oldList.find((slide) => slide.id === id);
    if (oldSlide === undefined) {
        return id >= oldList.length ? id - oldList.length + newList.length : id;
    }
    if (oldSlide.openLyricIndex < 0) {
        return id;
    }
    const repeatIndex = oldSlide.openLyricRepeat?.index ?? -1;
    const stepSlides = newList.filter((slide) => {
        return (
            slide.openLyricIndex === oldSlide.openLyricIndex &&
            (slide.openLyricRepeat?.index ?? -1) === repeatIndex
        );
    });
    if (stepSlides.length === 0) {
        return id;
    }
    const lineIndex = oldSlide.openLyricLine?.index ?? 0;
    const sameLine = stepSlides.find((slide) => {
        return (slide.openLyricLine?.index ?? 0) === lineIndex;
    });
    return (sameLine ?? stepSlides[0]).id;
}

type PlanType = {
    manager: ScreenVaryAppDocumentManager;
    filePath: string;
    stage: number;
    oldId: number;
    newId: number;
};

async function genPlan(
    manager: ScreenVaryAppDocumentManager,
    newIsAtomMode: boolean,
): Promise<PlanType | null> {
    const varySlideData = manager.varySlideData;
    const itemJson = varySlideData?.itemJson as any;
    if (
        varySlideData === null ||
        varySlideData === undefined ||
        itemJson?.type !== LYRIC_SLIDE_TYPE_KEY ||
        typeof itemJson.id !== 'number' ||
        typeof itemJson.stage !== 'number'
    ) {
        return null;
    }
    const { filePath } = varySlideData;
    const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
        filePath,
        itemJson.stage,
    );
    const [oldList, newList] = await Promise.all([
        lyricAppDocument.getSlidesQuick(!newIsAtomMode),
        lyricAppDocument.getSlidesQuick(newIsAtomMode),
    ]);
    const oldSlide = oldList.find((slide) => slide.id === itemJson.id);
    const newId = mapLyricSlideIdAcrossAtomMode(oldList, newList, itemJson.id);
    // First, Info and None are the same slide under either mode; a part's
    // slide is not (the whole part, or one line of it), even at the same id.
    if (newId === itemJson.id && (oldSlide?.openLyricIndex ?? -1) < 0) {
        return null;
    }
    return {
        manager,
        filePath,
        stage: itemJson.stage,
        oldId: itemJson.id,
        newId,
    };
}

/**
 * Reads, BEFORE the switch is written, where every song slide that is up goes,
 * and answers what puts them there -- to be called once the new mode is
 * written, so the slides it builds are of the new deck. A locked screen is
 * left as it is: locked means nothing changes on it.
 */
export async function prepareLyricAtomModeScreens(newIsAtomMode: boolean) {
    const managers = ScreenVaryAppDocumentManager.getAllInstances().filter(
        (manager) => {
            return !manager.screenManagerBase.isLocked;
        },
    );
    const plans = (
        await Promise.all(
            managers.map((manager) => {
                return genPlan(manager, newIsAtomMode).catch((error) => {
                    handleError(error);
                    return null;
                });
            }),
        )
    ).filter((plan) => plan !== null);
    return async () => {
        for (const { manager, filePath, stage, oldId, newId } of plans) {
            try {
                const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
                    filePath,
                    stage,
                );
                const slide = await lyricAppDocument.getSlideById(newId);
                const varySlideData = manager.varySlideData;
                // Something else went up while the deck was built: that is
                // what the operator meant, so it stays.
                if (
                    slide === null ||
                    varySlideData === null ||
                    varySlideData.filePath !== filePath ||
                    varySlideData.itemJson.id !== oldId
                ) {
                    continue;
                }
                await manager.applyVarySlideData({
                    ...varySlideData,
                    itemJson: slide.toJson(),
                });
            } catch (error) {
                handleError(error);
            }
        }
    };
}
