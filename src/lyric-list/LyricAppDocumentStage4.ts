import LyricAppDocumentStage0 from './LyricAppDocumentStage0';
import { withLyricLookAhead } from './LyricAppDocumentStageLookAhead';
import { genRowArrangement } from './lyricLookAheadHelpers';

// Stage 2's arrangement with stage 0's content: plain centred lines, no chords
// or section titles — two slides per screen that an AUDIENCE can read.
export default class LyricAppDocumentStage4 extends withLyricLookAhead(
    LyricAppDocumentStage0,
    genRowArrangement([1]),
) {
    stage = 4;
}
