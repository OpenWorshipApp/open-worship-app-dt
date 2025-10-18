import {
    getAISetting,
    setAISetting,
    useAISetting,
} from '../helper/ai/aiHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import appProvider from '../server/appProvider';

function AISettingComp() {
    const aiSetting = useAISetting();
    return (
        <div className="ms-2">
            <i
                className="bi bi-robot app-caught-hover-pointer"
                title="`Set OpenAI API Key for Audio AI"
                style={{
                    color: aiSetting.openAIAPIKey ? 'green' : '',
                    fontSize: '25px',
                }}
                onClick={async () => {
                    const openAISetting = getAISetting();
                    let openAIAPIKey = openAISetting.openAIAPIKey;
                    let anthropicAPIKey = openAISetting.anthropicAPIKey;
                    const isConfirmInput = await showAppInput(
                        'Audio AI Setting',
                        <>
                            <div className="d-flex flex-column w-100 h-100">
                                <div>
                                    OpenAI API Key{' '}
                                    <i
                                        className="bi bi-lightbulb"
                                        title="`This key will be used in custom Bible Cross Ref and Bible Audio"
                                        style={{
                                            color: 'var(--bs-info-text-emphasis)',
                                        }}
                                    />
                                    :
                                </div>
                                <div className="flex-grow-1 d-flex align-items-center">
                                    <input
                                        ref={(input) => {
                                            if (input) {
                                                input.value = openAIAPIKey;
                                                setTimeout(() => {
                                                    input.focus();
                                                    input.select();
                                                }, 100);
                                            }
                                        }}
                                        className="form-control form-control-sm flex-fill mx-2"
                                        type="text"
                                        onChange={(e) => {
                                            openAIAPIKey = e.target.value;
                                        }}
                                    />
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        title="`Create OpenAI api key"
                                        onClick={async () => {
                                            appProvider.browserUtils.openExternalURL(
                                                'https://platform.openai.com/api-keys',
                                            );
                                        }}
                                    >
                                        API Key
                                        <i className="bi bi-box-arrow-up-right ms-1" />
                                    </button>
                                </div>
                            </div>
                            <hr />
                            <div className="d-flex flex-column w-100 h-100 mb-2">
                                <div>
                                    Anthropic API Key{' '}
                                    <i
                                        className="bi bi-lightbulb"
                                        title="`This key will be used in custom Bible Cross Ref"
                                        style={{
                                            color: 'var(--bs-info-text-emphasis)',
                                        }}
                                    />
                                    :
                                </div>
                                <div className="flex-grow-1 d-flex align-items-center">
                                    <input
                                        ref={(input) => {
                                            if (input) {
                                                input.value = anthropicAPIKey;
                                                setTimeout(() => {
                                                    input.focus();
                                                    input.select();
                                                }, 100);
                                            }
                                        }}
                                        className="form-control form-control-sm flex-fill mx-2"
                                        type="text"
                                        onChange={(e) => {
                                            anthropicAPIKey = e.target.value;
                                        }}
                                    />
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        title="`Create Anthropic api key"
                                        onClick={async () => {
                                            appProvider.browserUtils.openExternalURL(
                                                'https://console.anthropic.com/settings/keys',
                                            );
                                        }}
                                    >
                                        API Key
                                        <i className="bi bi-box-arrow-up-right ms-1" />
                                    </button>
                                </div>
                            </div>
                        </>,
                    );
                    if (!isConfirmInput) {
                        return;
                    }
                    setAISetting({
                        ...openAISetting,
                        openAIAPIKey,
                        anthropicAPIKey,
                    });
                }}
            />
        </div>
    );
}

function AudioAutoPlayComp() {
    const aiSetting = useAISetting();
    if (!aiSetting.openAIAPIKey) {
        return null;
    }
    return (
        <div className="ms-2">
            <i
                className="bi bi-megaphone app-caught-hover-pointer"
                title="`Auto Play Audio AI when available"
                style={{ color: aiSetting.isAutoPlay ? 'green' : '' }}
                onClick={() => {
                    const audioAISetting = getAISetting();
                    audioAISetting.isAutoPlay = !aiSetting.isAutoPlay;
                    setAISetting(audioAISetting);
                }}
            />
        </div>
    );
}

export function AIConfigComp() {
    return (
        <div className="d-flex">
            <AISettingComp />
            <AudioAutoPlayComp />
        </div>
    );
}
