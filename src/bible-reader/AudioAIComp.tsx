import { useState } from 'react';
import { getAudioAISetting, setAudioAISetting } from '../helper/aiHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';

export function AudioAIComp() {
    const [isEnabled, setIsEnabled] = useState(
        !!getAudioAISetting().openAIAPIKey,
    );
    return (
        <i
            className="bi bi-soundwave app-caught-hover-pointer"
            style={{
                color: isEnabled ? 'green' : '',
            }}
            onClick={async () => {
                const audioAISetting = getAudioAISetting();
                let openAIAPIKey = audioAISetting.openAIAPIKey;
                let isAutoPlay = audioAISetting.isAutoPlay;
                const isConfirmInput = await showAppInput(
                    'Audio AI Setting',
                    <div className="w-100 h-100">
                        <div className="d-flex mb-2">
                            <span>OpenAI API Key :</span>
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
                                className="flex-fill mx-2"
                                type="text"
                                onChange={(e) => {
                                    openAIAPIKey = e.target.value;
                                }}
                            />
                        </div>
                        <div className="d-flex mb-2">
                            <span>Auto Play :</span>
                            <input
                                ref={(input) => {
                                    if (input) {
                                        input.checked = !!isAutoPlay;
                                    }
                                }}
                                className="m-2"
                                type="checkbox"
                                onChange={(e) => {
                                    isAutoPlay = e.target.checked;
                                }}
                            />
                        </div>
                    </div>,
                );
                if (!isConfirmInput) {
                    return;
                }
                setAudioAISetting({ openAIAPIKey, isAutoPlay });
                setIsEnabled(!!openAIAPIKey);
            }}
        />
    );
}
