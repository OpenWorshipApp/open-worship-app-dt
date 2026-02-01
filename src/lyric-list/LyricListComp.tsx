import './LyricListComp.scss';

import FileListHandlerComp from '../others/FileListHandlerComp';
import {
    getFileDotExtension,
    getMimetypeExtensions,
    mimetypePdf,
} from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { checkIsMarkdown } from './lyricHelpers';
import Lyric from './Lyric';
import LyricFileComp from './LyricFileComp';
import LyricAppDocument from './LyricAppDocument';
import { checkIsVaryAppDocumentOnScreen } from '../app-document-list/appDocumentHelpers';
import { tran } from '../lang/langHelpers';

async function newFileHandling(dirPath: string, name: string) {
    return !(await Lyric.create(dirPath, name));
}
const handleBodyRendering = (filePaths: string[]) => {
    return filePaths.map((filePath, i) => {
        return <LyricFileComp key={filePath} index={i} filePath={filePath} />;
    });
};

function handleExtraFileChecking(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    if (checkIsMarkdown(fileSource.dotExtension)) {
        return true;
    }
    return false;
}

async function checkIsOnScreen(filePaths: string[]) {
    for (const filePath of filePaths) {
        const lyricAppDocument =
            LyricAppDocument.getInstanceFromLyricFilePath(filePath);
        const isOnScreen =
            lyricAppDocument !== null &&
            (await checkIsVaryAppDocumentOnScreen(lyricAppDocument));
        if (isOnScreen) {
            return true;
        }
    }
    return false;
}

export default function LyricListComp() {
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.LYRIC);
    if (dirSource === null) {
        return null;
    }
    dirSource.checkExtraFile = (fileFullName: string) => {
        if (checkIsMarkdown(getFileDotExtension(fileFullName))) {
            return {
                fileFullName: fileFullName,
                appMimetype: mimetypePdf,
            };
        }
        return null;
    };

    return (
        <FileListHandlerComp
            className="app-lyric-list"
            mimetypeName="lyric"
            defaultFolderName={defaultDataDirNames.LYRIC}
            dirSource={dirSource}
            checkExtraFile={handleExtraFileChecking}
            onNewFile={newFileHandling}
            header={<span>{tran('Lyrics')}</span>}
            bodyHandler={handleBodyRendering}
            checkIsOnScreen={checkIsOnScreen}
            fileSelectionOption={{
                windowTitle: 'Select lyric files',
                dirPath: dirSource.dirPath,
                extensions: Array.from(
                    new Set([
                        ...getMimetypeExtensions('lyric'),
                        ...getMimetypeExtensions('markdown'),
                    ]),
                ),
            }}
        />
    );
}
