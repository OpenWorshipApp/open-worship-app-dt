import appProvider from '../server/appProvider';
import { showSimpleToast } from '../toast/toastHelpers';
import { type LyricPropsType } from './LyricSlide';

export async function getTargetLyricSlideItemData(
    filePath: string,
    lyricSlideItemData: LyricPropsType,
    stage: number,
) {
    if (appProvider.isPageScreen) {
        return lyricSlideItemData;
    }
    const { getLyricAppDocumentStageByStage, LYRIC_SLIDE_TYPE_KEY } =
        await import('./lyricHelpers');
    if (
        lyricSlideItemData.type !== LYRIC_SLIDE_TYPE_KEY ||
        lyricSlideItemData.stage === stage
    ) {
        return lyricSlideItemData;
    }

    const [_, targetLyricAppDocument] = getLyricAppDocumentStageByStage(
        filePath,
        stage,
    );
    const slideId = lyricSlideItemData.id;
    const targetLyricSlide = await targetLyricAppDocument.getSlideById(slideId);
    if (targetLyricSlide === null) {
        showSimpleToast(
            'Fail',
            `Fail to get target lyric slide data for filePath: ${filePath},` +
                ` slideID: ${slideId}, stage: ${stage}`,
        );
        return lyricSlideItemData;
    }
    return targetLyricSlide.toJson();
}
