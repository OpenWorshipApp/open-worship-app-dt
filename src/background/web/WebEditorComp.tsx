import { lazy, useMemo } from 'react';

import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { getParamFileFullName } from '../../helper/domHelpers';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import { pathJoin, fsExistSync } from '../../server/fileHelpers';
import { SelectedWebContext } from './webEditorHelpers';

const LazyWebEditorIDEComp = lazy(() => {
    return import('./WebEditorIDEComp');
});
const LazyWebPreviewerComp = lazy(() => {
    return import('./WebPreviewerComp');
});

function getWebFilePath() {
    const fileFullName = getParamFileFullName();
    if (fileFullName === null) {
        throw new Error('Web file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.BACKGROUND_WEB,
    );
    if (dirPath === null) {
        throw new Error('Web directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Web file not found: ${fileFullName}`);
    }
    return filePath;
}

export default function LyricEditorComp() {
    const filePath = useMemo(() => {
        return getWebFilePath();
    }, []);
    return (
        <SelectedWebContext value={filePath}>
            <ResizeActorComp
                flexSizeName={'lyric-previewer'}
                isHorizontal
                flexSizeDefault={{
                    h1: ['1'],
                    h2: ['1'],
                }}
                dataInput={[
                    {
                        children: LazyWebEditorIDEComp,
                        key: 'h1',
                        widgetName: 'Editor',
                    },
                    {
                        children: LazyWebPreviewerComp,
                        key: 'h2',
                        widgetName: 'Previewer',
                    },
                ]}
            />
        </SelectedWebContext>
    );
}
