import { useState } from 'react';
import { getAudioAISetting, setAudioAISetting } from '../helper/aiHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';

export function AudioAIComp() {
    const [isAvailable, setIsAvailable] = useState(
        !!getAudioAISetting().openAIAPIKey,
    );
    const [isAutoPlay, setIsAutoPlay] = useState(
        !!getAudioAISetting().isAutoPlay,
    );
    return (
        <div className="d-flex">
            <div className="ms-2">
                <i
                    className="bi bi-activity app-caught-hover-pointer"
                    title="`Set OpenAI API Key for Audio AI"
                    style={{
                        color: isAvailable ? 'green' : '',
                        fontSize: '25px',
                    }}
                    onClick={async () => {
                        const audioAISetting = getAudioAISetting();
                        let openAIAPIKey = audioAISetting.openAIAPIKey;
                        const isConfirmInput = await showAppInput(
                            'Audio AI Setting',
                            <div className="d-flex flex-column w-100 h-100">
                                <div>OpenAI API Key :</div>
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
                                        className="flex-fill mx-2"
                                        type="text"
                                        onChange={(e) => {
                                            openAIAPIKey = e.target.value;
                                        }}
                                    />
                                </div>
                            </div>,
                        );
                        if (!isConfirmInput) {
                            return;
                        }
                        setAudioAISetting({ ...audioAISetting, openAIAPIKey });
                        setIsAvailable(!!openAIAPIKey);
                    }}
                />
            </div>
            <div className="ms-2">
                <i
                    className="bi bi-megaphone app-caught-hover-pointer"
                    title="`Auto Play Audio AI when available"
                    style={{ color: isAutoPlay ? 'green' : '' }}
                    onClick={() => {
                        const audioAISetting = getAudioAISetting();
                        audioAISetting.isAutoPlay = !audioAISetting.isAutoPlay;
                        setAudioAISetting(audioAISetting);
                        setIsAutoPlay(audioAISetting.isAutoPlay);
                    }}
                />
            </div>
        </div>
    );
}
