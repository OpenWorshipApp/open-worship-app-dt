import './AppDocumentListComp.scss';

import FileListHandlerComp from '../others/FileListHandlerComp';
import AppDocumentFileComp from './AppDocumentFileComp';
import AppDocument from './AppDocument';
import {
    getFileDotExtension,
    getFileFullName,
    getMimetypeExtensions,
    mimetypePdf,
} from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import { useGenDirSource } from '../helper/dirSourceHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { DroppedFileType } from '../others/droppingFileHelpers';
import {
    checkIsPdf,
    checkIsVaryAppDocumentOnScreen,
    convertOfficeFile,
    supportOfficeFileExtensions,
    varyAppDocumentFromFilePath,
} from './appDocumentHelpers';
import DirSource from '../helper/DirSource';

function handleExtraFileChecking(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    if (checkIsPdf(fileSource.dotExtension)) {
        return true;
    }
    return false;
}

function handleFileTaking(
    dirSource: DirSource,
    file: DroppedFileType | string,
) {
    if (dirSource === null) {
        return false;
    }
    const fileFullName = getFileFullName(file);
    const dotExtension = getFileDotExtension(fileFullName).toLocaleLowerCase();
    if (supportOfficeFileExtensions.includes(dotExtension)) {
        convertOfficeFile(file, dirSource);
        return true;
    }
    return false;
}

function handleBodyRendering(filePaths: string[]) {
    return filePaths.map((filePath, i) => {
        return (
            <AppDocumentFileComp key={filePath} index={i} filePath={filePath} />
        );
    });
}

async function newFileHandling(dirPath: string, name: string) {
    return !(await AppDocument.create(dirPath, name));
}

async function checkIsOnScreen(filePaths: string[]) {
    for (const filePath of filePaths) {
        const varyAppDocument = varyAppDocumentFromFilePath(filePath);
        const isOnScreen =
            await checkIsVaryAppDocumentOnScreen(varyAppDocument);
        if (isOnScreen) {
            return true;
        }
    }
    return false;
}

export default function AppDocumentListComp() {
    const dirSource = useGenDirSource(dirSourceSettingNames.APP_DOCUMENT);
    if (dirSource === null) {
        return null;
    }
    dirSource.checkExtraFile = (fileFullName: string) => {
        if (checkIsPdf(getFileDotExtension(fileFullName))) {
            return {
                fileFullName: fileFullName,
                appMimetype: mimetypePdf,
            };
        }
        return null;
    };

    return (
        <FileListHandlerComp
            className="app-document-list"
            mimetypeName="appDocument"
            defaultFolderName={defaultDataDirNames.APP_DOCUMENT}
            dirSource={dirSource}
            checkExtraFile={handleExtraFileChecking}
            takeDroppedFile={handleFileTaking.bind(null, dirSource)}
            onNewFile={newFileHandling}
            header={<span>Documents</span>}
            bodyHandler={handleBodyRendering}
            checkIsOnScreen={checkIsOnScreen}
            fileSelectionOption={{
                windowTitle: 'Select slide files',
                dirPath: dirSource.dirPath,
                extensions: Array.from(
                    new Set([
                        ...getMimetypeExtensions('appDocument'),
                        ...getMimetypeExtensions('pdf'),
                        ...supportOfficeFileExtensions.map((ext) => {
                            return ext.slice(1);
                        }),
                    ]),
                ),
                takeSelectedFile: handleFileTaking.bind(null, dirSource),
            }}
        />
    );
}
