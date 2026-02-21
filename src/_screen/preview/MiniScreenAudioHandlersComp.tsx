import { useMemo, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../../helper/audioControlHelpers';

export default function MiniScreenAudioHandlersComp({
    src,
}: Readonly<{
    src: string;
}>) {
    const [isRepeating, setIsRepeating] = useState(false);
    const fileFullName = useMemo(() => {
        const decodeSrc = decodeURIComponent(src);
        return decodeSrc.split('/').pop() || decodeSrc;
    }, [src]);
    return (
        <div className="w-100">
            <hr className="w-100" />
            <div className="w-100 app-ellipsis-left overflow-hidden">
                {fileFullName}
            </div>
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    className="flex-fill"
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                >
                    <source src={src} />
                    <track kind="captions" />
                    Browser does not support audio.
                </audio>
                <div>
                    <i
                        className="bi bi-repeat-1 p-1"
                        title={tran('Repeat this audio')}
                        style={{
                            fontSize: '1.5rem',
                            opacity: isRepeating ? 1 : 0.5,
                            color: isRepeating ? 'green' : 'inherit',
                        }}
                        onClick={() => {
                            setIsRepeating(!isRepeating);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
