import appProvider from './appProvider';

// A dependency-light home for this check, re-exported from `appHelpers` for
// its existing callers: a page entry that needs only this must not pull that
// module's file, toast and progress-bar code into its static closure.
export function checkIsMainWindow() {
    return (
        appProvider.messageUtils.sendDataSync(
            'all:app:check-is-main-window',
        ) === true
    );
}
