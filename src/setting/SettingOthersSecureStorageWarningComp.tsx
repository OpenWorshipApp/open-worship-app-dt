import { tran } from '../lang/langHelpers';
import { appSecureStorage } from '../server/appSecureStorage';

/**
 * Credentials are encrypted at rest with a key held by the OS. A machine with no
 * usable credential store (typically Linux with no keyring, or the browser
 * build) cannot do that, and the app refuses to write them in the clear -- so
 * they work for the session and are gone on restart. Say so, rather than letting
 * the operator find out mid-service.
 */
export default function SettingOthersSecureStorageWarningComp() {
    if (appSecureStorage.checkIsAvailable()) {
        return null;
    }
    return (
        <p className="app-setting-others-warning">
            <i className="bi bi-shield-exclamation" aria-hidden="true" />
            {tran(
                'This system has no secure credential store, so keys are kept' +
                    ' only until the app closes',
            )}
        </p>
    );
}
