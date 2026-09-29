import './ModalComp.scss';

import type { PropsWithChildren, ReactNode } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import {
    KeyboardLayerContext,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { useKeyboardLayerClaim } from '../event/keyboardLayerHelpers';
import type { AppWidgetType } from '../event/WindowEventListener';
import { tran } from '../lang/langHelpers';
import { ModalLayerContext } from './modalLayerContext';

// A modal covers the window, so the app underneath must stop answering the
// keyboard while it is open. Until 2026-09-28 this layer was declared and
// never claimed by anything, and `F6` pressed with the Bible Lookup open
// CLEARED A LIVE SCREEN (measured); the slide arrows stepped the projector
// from behind it too. `ModalComp` is the Bible Lookup's own wrapper -- the
// lookup popup and its Info popup are its only users -- hence the name.
export const MODAL_KEYBOARD_LAYER: AppWidgetType = 'bible-lookup';

interface MyProps {
    children?: ReactNode;
}

const quittingEventMap: EventMapperType = {
    allControlKey: ['Ctrl'],
    key: 'q',
};

export function ModalCloseButtonComp({
    close,
}: Readonly<{ close: () => void }>) {
    useKeyboardRegistering([quittingEventMap], close, []);
    return (
        <div
            style={{
                position: 'absolute',
                right: 0,
                top: 0,
            }}
        >
            <button
                className="btn btn-danger"
                type="button"
                style={{
                    height: '38px',
                }}
                onClick={close}
                title={`${tran('Close')} [${toShortcutKey(quittingEventMap)}]`}
                aria-label={tran('Close')}
            >
                <i className="bi bi-x-lg" />
            </button>
        </div>
    );
}

export function ModalComp({ children }: PropsWithChildren<MyProps>) {
    useKeyboardLayerClaim(MODAL_KEYBOARD_LAYER);
    return (
        // Anything this modal opens — a floating widget above all — has to know
        // it is on top of the modal layer so it can render ABOVE it instead of
        // being hidden behind the very thing that opened it.
        <ModalLayerContext value={true}>
            {/* And its OWN keys have to keep working: the claim above silences
                `root`, so everything in here registers under the modal's layer
                instead. Read during render, so it reaches children that mount
                in the same commit as the claim. */}
            <KeyboardLayerContext value={MODAL_KEYBOARD_LAYER}>
                <div id="modal-container">{children}</div>
            </KeyboardLayerContext>
        </ModalLayerContext>
    );
}
