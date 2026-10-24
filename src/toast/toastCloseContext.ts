import { createContext, useContext } from 'react';

/**
 * Closes the toast a message is drawn in. A toast whose message carries an
 * action -- the lock refusal's Unlock, the text-colour change's Undo -- is done
 * once that action ran, and a toast left saying "Screen Manager is locked"
 * after the screen was unlocked is wrong twice over: it says the opposite of
 * what is true, and the pointer that pressed the button is resting on it, so
 * the hover pause holds it over the controls under it for as long as the
 * mouse stays there.
 */
export const ToastCloseContext = createContext<(() => void) | null>(null);

// A no-op outside a toast, so a message component renders on its own too.
export function useToastClose() {
    return useContext(ToastCloseContext) ?? noop;
}

function noop() {}
