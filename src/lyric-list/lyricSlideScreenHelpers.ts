import { showSimpleToast } from '../toast/toastHelpers';
import { LYRIC_SLIDE_TYPE_KEY, type LyricPropsType } from './LyricSlide';

export async function getTargetLyricSlideItemData(
    filePath: string,
    lyricSlideItemData: LyricPropsType,
    stage: number,
) {
    // Cheap, import-free outs first. Only a lyric slide carries `stage`, and
    // data already on the wanted stage needs no work — so ordinary documents
    // and the common already-correct case never pull in the lyric helper graph.
    //
    // This deliberately no longer bails out on `appProvider.isPageScreen`. That
    // early return made the screen renderer accept whatever stage was handed to
    // it, so a `St: 1` screen restored from a stage-0 snapshot projected the
    // stage-0 layout — no chords, no section titles — while the presenter's own
    // mini preview (which does re-derive) looked correct. The parse below now
    // runs on the screen too, but only on an actual stage mismatch, which is
    // the repair path rather than the steady state.
    if (
        typeof lyricSlideItemData.stage !== 'number' ||
        lyricSlideItemData.stage === stage
    ) {
        return lyricSlideItemData;
    }
    if (lyricSlideItemData.type !== LYRIC_SLIDE_TYPE_KEY) {
        return lyricSlideItemData;
    }
    const { getLyricAppDocumentStageByStage } = await import('./lyricHelpers');

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
