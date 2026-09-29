import { useAppEffect } from '../helper/appHooks';
import type { AppWidgetType } from './WindowEventListener';
import WindowEventListener from './WindowEventListener';

/**
 * How many mounted components are holding each layer.
 *
 * Refcounted rather than pushed and popped per component, because the same
 * layer is legitimately claimed twice at once: the Bible Lookup's Info popup
 * is a `ModalComp` inside a `ModalComp`, and one confirm can be opened from
 * another. Without the count the INNER one closing would hand the keyboard
 * back while the outer modal is still on screen, which is the same class of
 * bug as the unbalanced `open` that `KeyboardEventListener.addLayer` already
 * guards against — one level up.
 */
const claimCountMap = new Map<AppWidgetType, number>();

function changeClaim(layer: AppWidgetType, step: 1 | -1) {
    const count = (claimCountMap.get(layer) ?? 0) + step;
    if (count <= 0) {
        claimCountMap.delete(layer);
    } else {
        claimCountMap.set(layer, count);
    }
    // Only the first claim opens it and only the last release closes it. A
    // repeated `open` is harmless anyway (`addLayer` re-asserts), but a
    // repeated `close` would take the layer off under a holder that is still
    // there.
    if (step === 1 && count === 1) {
        WindowEventListener.fireEvent({ widget: layer, state: 'open' });
    } else if (step === -1 && count === 0) {
        WindowEventListener.fireEvent({ widget: layer, state: 'close' });
    }
}

/**
 * Hold a keyboard layer for exactly as long as the caller is mounted.
 *
 * The app's shortcut stack has ONE top layer and no fall-through, so this is
 * how something that covers the window stops the app underneath answering
 * keys. Pair it with `KeyboardLayerContext` around the same subtree, or the
 * caller's own keys go silent with everything else.
 */
export function useKeyboardLayerClaim(layer: AppWidgetType) {
    useAppEffect(() => {
        changeClaim(layer, 1);
        return () => {
            changeClaim(layer, -1);
        };
    }, [layer]);
}

/** Test seam: what is being held right now. */
export function getKeyboardLayerClaims() {
    return Object.fromEntries(claimCountMap.entries());
}
