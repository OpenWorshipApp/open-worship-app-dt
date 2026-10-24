import './ModalComp.scss';

import type { PropsWithChildren, ReactNode } from 'react';

import { KeyboardLayerContext } from '../event/KeyboardEventListener';
import { useKeyboardLayerClaim } from '../event/keyboardLayerHelpers';
import type { AppWidgetType } from '../event/WindowEventListener';
import FullscreenPortalComp from '../others/FullscreenPortalComp';

interface MyProps {
    children?: ReactNode;
}

// A confirm / alert / input popup is BLOCKING: the question it asks is the
// only thing the keyboard should be answering. Without this the app's own
// shortcuts stayed live underneath it, so `F6` could clear a screen while a
// dialog was waiting for a Yes.
export const POPUP_KEYBOARD_LAYER: AppWidgetType = 'popup';

export default function PrimitiveModalComp({
    children,
}: PropsWithChildren<MyProps>) {
    useKeyboardLayerClaim(POPUP_KEYBOARD_LAYER);
    return (
        // The popup's own Enter/Escape register under the layer it just
        // claimed, or they would be silenced along with everything else.
        <KeyboardLayerContext value={POPUP_KEYBOARD_LAYER}>
            <FullscreenPortalComp>
                <div id="modal-container" className="modal-container--blocking">
                    {children}
                </div>
            </FullscreenPortalComp>
        </KeyboardLayerContext>
    );
}
