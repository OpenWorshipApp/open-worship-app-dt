import appProvider from '../server/appProvider';
import { useStateSettingString } from '../helper/settingHelpers';
import { NODE_BIN_PATH_SETTING_NAME } from './settingHelpers';

export default function SettingGeneralBinPathComp() {
    const [nodeBinPath, setNodeBinPath] = useStateSettingString(
        NODE_BIN_PATH_SETTING_NAME,
    );
    return (
        <div className="card m-1">
            <div className="card-header">`Bin Path</div>
            <div className="card-body">
                <div className="d-flex flex-column w-100 h-100 mb-2">
                    <div>NodeJS:</div>
                    <div className="flex-grow-1 d-flex align-items-center">
                        <input
                            className="form-control form-control-sm flex-fill mx-2"
                            type="text"
                            value={nodeBinPath}
                            onChange={(e) => {
                                setNodeBinPath(e.target.value);
                            }}
                        />
                        <button
                            className="btn btn-sm btn-secondary"
                            title="`Create Anthropic api key"
                            onClick={async () => {
                                appProvider.browserUtils.openExternalURL(
                                    'https://nodejs.org/en/download/',
                                );
                            }}
                        >
                            NodeJS Download{' '}
                            <i className="bi bi-box-arrow-up-right ms-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
