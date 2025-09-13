import { clearWidgetSizeSetting } from '../resize-actor/flexSizeHelpers';
import SettingGeneralLanguageComp from './SettingGeneralLanguageComp';
import appProvider from '../server/appProvider';
import SettingGeneralPath from './directory-setting/SettingGeneralDirectoryPathComp';
import { appLocalStorage } from './directory-setting/appLocalStorage';

export default function SettingGeneralComp() {
    return (
        <div
            className="w-100 h-100 d-flex flex-wrap justify-content-center p-1"
            style={{
                overflowY: 'auto',
            }}
        >
            <div className="m-1" style={{ minWidth: '600px' }}>
                <SettingGeneralPath />
            </div>
            <div className="m-1">
                {appProvider.systemUtils.isDev ? (
                    <>
                        <SettingGeneralLanguageComp />
                        <hr />
                    </>
                ) : null}
                <div className="m-2">
                    <button
                        className="btn btn-warning"
                        onClick={() => {
                            clearWidgetSizeSetting();
                            appProvider.reload();
                        }}
                    >
                        `Reset Widgets Size
                    </button>
                </div>
                <div className="m-2">
                    <button
                        className="btn btn-danger"
                        onClick={async () => {
                            await appLocalStorage.clear();
                            appProvider.reload();
                        }}
                    >
                        `Clear All Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
