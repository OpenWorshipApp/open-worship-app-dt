import './LyricList.scss';

import { useCallback } from 'react';

import LyricFile from './LyricFile';
import FileListHandler from '../others/FileListHandler';
import Lyric from './Lyric';
import { useGenDS } from '../helper/dirSourceHelpers';
import { dirSourceSettingNames } from '../helper/constants';

export default function LyricList() {
    const dirSource = useGenDS(dirSourceSettingNames.LYRIC);
    const bodyHandlerCallback = useCallback((filePaths: string[]) => {
        return (
            <>
                {filePaths.map((filePath, i) => {
                    return <LyricFile key={filePath}
                        index={i}
                        filePath={filePath} />;
                })}
            </>
        );
    }, []);
    if (dirSource === null) {
        return null;
    }
    return (
        <FileListHandler id='lyric-list'
            mimetype='lyric'
            defaultFolderName='lyrics'
            dirSource={dirSource}
            onNewFile={async (dirPath: string, name: string) => {
                return !await Lyric.create(dirPath, name);
            }}
            header={<span>Lyrics</span>}
            bodyHandler={bodyHandlerCallback} />
    );
}
