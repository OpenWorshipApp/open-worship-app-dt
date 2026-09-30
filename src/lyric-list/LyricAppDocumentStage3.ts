import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import { withLyricLookAhead } from './LyricAppDocumentStageLookAhead';
import { genRowArrangement } from './lyricLookAheadHelpers';

// As stage 2 with the next TWO slides side by side under it, each dimmer than
// the one before.
export default class LyricAppDocumentStage3 extends withLyricLookAhead(
    LyricAppDocumentStage1,
    genRowArrangement([1, 2]),
) {
    stage = 3;
}
