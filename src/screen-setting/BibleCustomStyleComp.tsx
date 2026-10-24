import './BibleCustomStyleComp.scss';

import { tran } from '../lang/langHelpers';
import { useBibleTextStyleEditing } from '../_screen/preview/stylingHelpers';
import type { BibleTextEffectType } from '../_screen/bibleTextStyleHelpers';
import BibleTextControlsComp from './BibleTextControlsComp';
import BibleTextLooksComp from './BibleTextLooksComp';
import BibleTextPresetTilesComp from './BibleTextPresetTilesComp';
import BibleTextStageComp from './BibleTextStageComp';
import {
    genBibleBackdropPatch,
    genBibleSampleStyle,
    genBibleTextEffectPatch,
    toBibleBackdrop,
    toPreviewTextShadow,
    type BibleBackdropType,
} from './bibleTextLookHelpers';

/**
 * Bible Properties: how a verse is drawn on a screen.
 *
 * Three parts, in the order a volunteer needs them. The stage shows the verse
 * as it will look, on the kind of background it is going over; the looks are
 * the ones worth a single press, the app's own and then any that were saved;
 * the rows under them are every value of the look, for the one that is not
 * among those -- and whatever they make can be saved as a look of its own.
 */
export default function BibleCustomStyleComp() {
    const [view, applyStyle] = useBibleTextStyleEditing();
    // Read off the words, never stored: see `BibleBackdropType`.
    const backdrop = toBibleBackdrop(view.color);
    const sampleStyle = genBibleSampleStyle(view);
    // Two letters of the script the window is read in: an outline is judged
    // on the shapes a congregation actually reads.
    const sample = tran('Aa');
    const handleBackdropChange = (newBackdrop: BibleBackdropType) => {
        applyStyle(genBibleBackdropPatch(view, newBackdrop));
    };
    const handleLookChange = (effect: BibleTextEffectType) => {
        applyStyle(genBibleTextEffectPatch(effect));
    };
    return (
        <div className="bible-style">
            {/* Stays in view while the rows scroll under it: the sliders at
                the bottom are the ones whose effect most needs watching. */}
            <div className="bible-style-dock">
                <BibleTextStageComp
                    backdrop={backdrop}
                    sampleStyle={{
                        ...sampleStyle,
                        textShadow: toPreviewTextShadow(
                            view.textShadow,
                            view.fontSize,
                        ),
                        lineHeight: view.lineHeight,
                        textAlign: view.textAlign,
                    }}
                    onBackdropChange={handleBackdropChange}
                />
            </div>
            <BibleTextLooksComp
                backdrop={backdrop}
                textShadow={view.textShadow}
                sample={sample}
                sampleStyle={sampleStyle}
                onLookChange={handleLookChange}
            >
                <BibleTextPresetTilesComp
                    view={view}
                    sample={sample}
                    applyStyle={applyStyle}
                />
            </BibleTextLooksComp>
            <BibleTextControlsComp
                view={view}
                backdrop={backdrop}
                applyStyle={applyStyle}
            />
        </div>
    );
}
