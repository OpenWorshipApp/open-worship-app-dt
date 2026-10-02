import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import {
    getAISetting,
    setAISetting,
    useAISetting,
} from '../helper/ai/aiHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { pressElementLikeButton } from '../helper/helpers';

function AudioAutoPlayComp() {
    const aiSetting = useAISetting();
    const aiSettingRef = useAppCurrentRef(aiSetting);
    const handleToggleAutoPlay = useCallback(() => {
        const audioAISetting = getAISetting();
        audioAISetting.isAutoPlay = !aiSettingRef.current.isAutoPlay;
        setAISetting(audioAISetting);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!aiSetting.openAIAPIKey) {
        return null;
    }
    return (
        <div className="ms-2">
            <i
                className="bi bi-megaphone app-caught-hover-pointer"
                title={tran('Auto Play Audio AI when available')}
                // A toggle whose state was only a colour: say it is a button
                // and whether it is on.
                role="button"
                tabIndex={0}
                aria-label={tran('Auto Play Audio AI when available')}
                aria-pressed={!!aiSetting.isAutoPlay}
                style={{ color: aiSetting.isAutoPlay ? 'green' : '' }}
                onClick={handleToggleAutoPlay}
                onKeyDown={pressElementLikeButton}
            />
        </div>
    );
}

// The API keys themselves live in Settings > Others; only the per-reader
// auto-play toggle stays in the lookup header.
export function AIConfigComp() {
    return (
        <div className="d-flex">
            <AudioAutoPlayComp />
        </div>
    );
}
