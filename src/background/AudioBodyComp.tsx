import { type ReactNode, useCallback, useMemo } from 'react';

import FileSource from '../helper/FileSource';
import { dirSourceSettingNames } from '../helper/constants';
import {
    handleAudioPlaying,
    handleAudioPausing,
    handleAudioEnding,
} from '../helper/audioControlHelpers';
import { tran } from '../lang/langHelpers';
import type { BackgroundSrcType } from '../_screen/screenTypeHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';
import { getFileMetaData } from '../server/fileHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

function getAudioRepeatSettingName(src: string) {
    const md5 = appProvider.systemUtils.generateMD5(src);
    const settingName =
        dirSourceSettingNames.BACKGROUND_AUDIO + '-repeat-' + md5;
    return settingName;
}

export default function AudioBodyComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    const fileSource = FileSource.getInstance(filePath);
    const settingName = useMemo(() => {
        return getAudioRepeatSettingName(fileSource.src);
    }, [fileSource.src]);
    const [isRepeating, setIsRepeating] = useStateSettingBoolean(
        settingName,
        false,
    );
    const isRepeatingRef = useAppCurrentRef(isRepeating);
    const setIsRepeatingRef = useAppCurrentRef(setIsRepeating);
    const handleToggleRepeating = useCallback(() => {
        setIsRepeatingRef.current(!isRepeatingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100" data-file-path={filePath}>
            <div className="d-flex align-items-center w-100 my-2">
                <audio
                    className="flex-fill"
                    data-is-background-audio="true"
                    data-repeat-setting-name={settingName}
                    controls
                    onPlay={handleAudioPlaying}
                    onPause={handleAudioPausing}
                    onEnded={handleAudioEnding.bind(null, isRepeating)}
                >
                    <source src={fileSource.src} />
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
                        onClick={handleToggleRepeating}
                    />
                </div>
            </div>
        </div>
    );
}

export function genAudioBodyChild(
    activeMap: { [key: string]: boolean },
    filePath: string,
    _selectedBackgroundSrcList: [string, BackgroundSrcType][],
    _width: number,
    _height: number,
    extraChild?: ReactNode,
) {
    const fileSource = FileSource.getInstance(filePath);
    const isVideo =
        getFileMetaData(fileSource.fullName)?.appMimetype.mimetypeName ===
        'video';

    return (
        <>
            {isVideo ? (
                <i
                    className="bi bi-film me-2"
                    style={{
                        position: 'absolute',
                        top: -7,
                        left: 4,
                        fontSize: '0.8rem',
                    }}
                />
            ) : null}
            {!activeMap[filePath] ? (
                <div data-file-path={filePath} style={{ display: 'none' }} />
            ) : (
                <AudioBodyComp filePath={filePath} />
            )}
            {extraChild}
        </>
    );
}
