import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import { withLyricLookAhead } from './LyricAppDocumentStageLookAhead';
import { PREVIOUS_NEXT_ARRANGEMENT } from './lyricLookAheadHelpers';

// For the audience to follow along: a stage-1 slide (titles, chords) large,
// the PREVIOUS slide small at its top left and the NEXT small at its bottom
// right -- previous, current, next on one diagonal, in the order they are sung.
export default class LyricAppDocumentStage5 extends withLyricLookAhead(
    LyricAppDocumentStage1,
    PREVIOUS_NEXT_ARRANGEMENT,
) {
    stage = 5;
}
