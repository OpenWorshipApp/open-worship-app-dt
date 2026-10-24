import { handleError } from '../../helper/errorHelpers';
import type { TransitionEffectType } from '../transitionEffectHelpers';

/**
 * The transition a slide goes up with when it overrides the screen's
 * `Slide:` -- its own, else its slides preview's -- or `undefined` to follow
 * the screen.
 *
 * Asked on the presenter only, once per slide put up, and imported lazily so
 * the screen window (which is HANDED the answer in the sync) never loads the
 * sidecar code at all. A sidecar that cannot be read must never stop a slide
 * reaching the screen, so any failure is the screen's own transition.
 */
export async function resolveSlideTransitionEffect(
    filePath: string,
    slideId: string | number,
): Promise<TransitionEffectType | undefined> {
    try {
        const { slideTransitionManager } =
            await import('../../others/SlideTransitionManager');
        return await slideTransitionManager.resolveSlideTransition(
            filePath,
            slideId,
        );
    } catch (error) {
        handleError(error);
        return undefined;
    }
}
