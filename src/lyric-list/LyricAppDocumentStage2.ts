import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import { withLyricLookAhead } from './LyricAppDocumentStageLookAhead';
import { genRowArrangement } from './lyricLookAheadHelpers';

// The band's monitor: stage-1 slides (titles, chords), every slide with the
// NEXT one smaller and dimmer under it.
export default class LyricAppDocumentStage2 extends withLyricLookAhead(
    LyricAppDocumentStage1,
    genRowArrangement([1]),
) {
    stage = 2;
}
