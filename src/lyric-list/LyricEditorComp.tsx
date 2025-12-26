import { lazy, useMemo } from 'react';

import ResizeActorComp from '../resize-actor/ResizeActorComp';
import Lyric from './Lyric';
import { fsExistSync, pathJoin } from '../server/fileHelpers';
import DirSource from '../helper/DirSource';
import { dirSourceSettingNames } from '../helper/constants';
import LyricEditingManager, {
    LyricEditingManagerContext,
} from './LyricEditingManager';

const LazyLyricEditorComp = lazy(() => {
    return import('./LyricEditorIDEComp');
});
const LazyLyricPreviewerComp = lazy(() => {
    return import('./LyricPreviewerComp');
});

function getLyric() {
    const fileFullName = new URLSearchParams(globalThis.location.search).get(
        'lyric',
    );
    if (fileFullName === null) {
        throw new Error('Lyric file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.LYRIC,
    );
    if (dirPath === null) {
        throw new Error('Lyric directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Lyric file not found: ${fileFullName}`);
    }
    return Lyric.getInstance(filePath);
}

export default function LyricEditorComp() {
    const lyric = useMemo(() => {
        return getLyric();
    }, []);
    const lyricEditingManager = useMemo(() => {
        const lyricEditingManager = new LyricEditingManager('');
        lyricEditingManager.filePath = lyric.filePath;
        return lyricEditingManager;
    }, [lyric]);
    return (
        <LyricEditingManagerContext value={lyricEditingManager}>
            <ResizeActorComp
                flexSizeName={'lyric-previewer'}
                isHorizontal
                flexSizeDefault={{
                    h1: ['1'],
                    h2: ['1'],
                }}
                dataInput={[
                    {
                        children: LazyLyricEditorComp,
                        key: 'h1',
                        widgetName: 'Editor',
                    },
                    {
                        children: LazyLyricPreviewerComp,
                        key: 'h2',
                        widgetName: 'Previewer',
                    },
                ]}
            />
        </LyricEditingManagerContext>
    );
}
