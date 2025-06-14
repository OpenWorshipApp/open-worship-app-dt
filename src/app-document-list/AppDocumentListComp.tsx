import './AppDocumentListComp.scss';

import FileListHandlerComp from '../others/FileListHandlerComp';
import AppDocumentFileComp from './AppDocumentFileComp';
import AppDocument from './AppDocument';
import {
    getFileExtension,
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
    convertOfficeFile,
    supportOfficeFileExtensions,
} from './appDocumentHelpers';
import DirSource from '../helper/DirSource';

function handleExtraFileChecking(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    if (checkIsPdf(fileSource.extension)) {
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
    const ext = getFileExtension(fileFullName).toLocaleLowerCase();
    if (supportOfficeFileExtensions.includes(ext)) {
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

export default function AppDocumentListComp() {
    const dirSource = useGenDirSource(dirSourceSettingNames.SLIDE);
    if (dirSource === null) {
        return null;
    }
    dirSource.checkExtraFile = (fileFullName: string) => {
        if (checkIsPdf(getFileExtension(fileFullName))) {
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
            mimetypeName="slide"
            defaultFolderName={defaultDataDirNames.SLIDE}
            dirSource={dirSource}
            checkExtraFile={handleExtraFileChecking}
            takeDroppedFile={handleFileTaking.bind(null, dirSource)}
            onNewFile={newFileHandling}
            header={<span>Documents</span>}
            bodyHandler={handleBodyRendering}
            fileSelectionOption={{
                windowTitle: 'Select slide files',
                dirPath: dirSource.dirPath,
                extensions: Array.from(
                    new Set([
                        ...getMimetypeExtensions('slide'),
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
