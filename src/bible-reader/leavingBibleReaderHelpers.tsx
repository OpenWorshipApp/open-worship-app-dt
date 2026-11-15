import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

// What the confirm draws: the Presenter's own Bible Reader tab, as it looks
// there (`readerTab` in `src/router/layoutHelpers.tsx`), so the way back is a
// thing to recognise rather than a sentence to follow.
function LeavingBibleReaderBodyComp() {
    return (
        <div style={{ maxWidth: '460px' }}>
            <p>
                {tran(
                    'You are about to leave the Bible Reader and go to the ' +
                        'Presenter. Your passages will still be here when you ' +
                        'come back.',
                )}
            </p>
            <p className="mb-2">
                {tran(
                    'To come back, click this tab at the top left of the ' +
                        'Presenter:',
                )}
            </p>
            <div className="d-flex justify-content-center">
                <span
                    className="px-3 py-1"
                    style={{
                        color: 'var(--app-color-reader)',
                        border: '1px solid var(--bs-border-color)',
                        borderRadius: 'var(--bs-border-radius)',
                    }}
                >
                    📖 {tran('Bible Reader')}
                </span>
            </div>
        </div>
    );
}

/**
 * Asked before the Reader's 🖥️ **Go Back to Presenter** leaves the page
 * (2026-11-15, the user: _elderly user might click the button by accident and
 * quit the reader … give enough information about leaving and how to come
 * back from presenter page_). The button sits in the row with Settings, the
 * assistant and Help, one stray click from any of them, and the Presenter it
 * lands on has no sign of how to get back.
 *
 * Enter does NOT confirm: a reader who pressed the button by mistake may well
 * press Enter next, meaning the reference box. Leaving takes a click on the
 * button that says so; Escape and the other button stay.
 */
export function askLeavingBibleReader() {
    return showAppConfirm(
        tran('Leave the Bible Reader?'),
        <LeavingBibleReaderBodyComp />,
        {
            enterToOk: false,
            cancelButtonLabel: 'Stay in Bible Reader',
            confirmButtonLabel: 'Go Back to Presenter',
        },
    );
}
