import { tran } from '../../lang/langHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { openOthersSetting } from '../../setting/settingHelpers';

/** Explain the master switch and offer the settings page that owns it. */
export async function askToEnableAI() {
    const isOk = await showAppConfirm(
        tran('Enable AI features'),
        `${tran('AI features are turned off in Settings.')} ` +
            `${tran('Would you like to open Settings to enable them?')} ` +
            `(${tran('Restart the app to apply')})`,
        {
            cancelButtonLabel: 'No',
            confirmButtonLabel: 'Yes',
        },
    );
    if (isOk) {
        openOthersSetting();
    }
}
