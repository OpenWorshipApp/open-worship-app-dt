import { tran } from '../lang/langHelpers';

/**
 * The Background panel's `(dev)CSS Animation` tab: a place kept for
 * backgrounds made with a CSS animation, empty but for a note until they are
 * built (2026-11-14, the user: _like (dev)Experiment, add a bank section with
 * note for css animation, I will implement this next time_). Only a
 * development build draws its tab (`BackgroundComp`), as only it draws the
 * `(dev)Experiment` page. It reads and holds nothing, and its chunk loads
 * only when the tab is chosen.
 *
 * Already there for it: a fill's motion moves by `transform` alone, on the
 * screen window alone (`ScreenBackgroundFillComp`, `fillValueHelpers`'
 * `genFillMotionPlan`), and a fill's Copy CSS writes that motion out
 * (`fillCssTextHelpers`).
 */
export default function BackgroundCssAnimationComp() {
    return (
        <div className="w-100 h-100 d-flex align-items-center justify-content-center p-3">
            <div className="text-center" style={{ opacity: 0.75 }}>
                <i className="bi bi-magic fs-3" aria-hidden="true" />
                <div>
                    {tran('CSS animation backgrounds will be built here.')}
                </div>
            </div>
        </div>
    );
}
