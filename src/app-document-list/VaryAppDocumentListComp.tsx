import './AppDocumentListComp.scss';

import FileListHandlerComp from '../others/FileListHandlerComp';
import VaryAppDocumentFileComp from './VaryAppDocumentFileComp';
import AppDocument from './AppDocument';
import {
    fsMove,
    getDownloadPath,
    getFileDotExtension,
    getFileFullName,
    getMimetypeExtensions,
    mimetypeDocx,
    mimetypePdf,
    mimetypePptx,
    pathJoin,
} from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import {
    checkIsDocx,
    checkIsPdf,
    checkIsPptx,
    checkIsVaryAppDocumentOnScreen,
    convertOfficeFile,
    supportOfficeFileExtensions,
    varyAppDocumentFromFilePath,
} from './appDocumentHelpers';
import type DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import {
    askForURL,
    getOpenSharedLinkMenuItem,
    messageCallback,
    streamDownloadFile,
} from '../background/downloadHelper';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { handleError } from '../helper/errorHelpers';
import { initHttpRequest } from '../helper/bible-helpers/downloadHelpers';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';

function handleExtraFileChecking(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    if (checkIsPdf(fileSource.dotExtension)) {
        return true;
    }
    if (checkIsPptx(fileSource.dotExtension)) {
        return true;
    }
    if (
        checkIsDocx(fileSource.dotExtension) &&
        !fileSource.fullName.startsWith('~$')
    ) {
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
    if (!fileFullName) {
        return false;
    }
    const dotExtension = getFileDotExtension(fileFullName).toLocaleLowerCase();
    if (dotExtension === '.docx') {
        return false;
    }
    if (supportOfficeFileExtensions.includes(dotExtension)) {
        convertOfficeFile(file, dirSource);
        return true;
    }
    return false;
}

function handleBodyRendering(filePaths: string[]) {
    return filePaths.map((filePath, i) => {
        return (
            <VaryAppDocumentFileComp
                key={filePath}
                index={i}
                filePath={filePath}
            />
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

async function genContextMenuItems(dirSource: DirSource) {
    if (dirSource.dirPath === '') {
        return [];
    }
    const contextMenuItems: ContextMenuItemType[] = [];
    const title = tran('Download From URL');
    contextMenuItems.push(
        {
            menuElement: title,
            onSelect: async () => {
                const documentUrl = await askForURL(title, 'Documents URL:');
                if (documentUrl === null) {
                    return;
                }
                const downloadDirPath = getDownloadPath();
                const downloadDestFilePath = pathJoin(
                    downloadDirPath,
                    `${crypto.randomUUID()}.owa-downloading`,
                );
                try {
                    showSimpleToast(
                        title,
                        `Downloading document from "${documentUrl}", please wait...`,
                    );
                    showProgressBar(documentUrl);
                    messageCallback('Downloading file...');
                    const response = await initHttpRequest(
                        new URL(documentUrl),
                    );
                    await streamDownloadFile(
                        downloadDestFilePath,
                        response,
                        messageCallback,
                    );
                    let fileFullName = getFileFullName(documentUrl);
                    if (!fileFullName) {
                        fileFullName = `downloaded-document-${Date.now()}`;
                    }
                    const destFilePath = pathJoin(
                        dirSource.dirPath,
                        fileFullName,
                    );
                    const fileSource = FileSource.getInstance(destFilePath);
                    const nextDestFilePath = await fileSource.genNextFilePath();
                    await fsMove(downloadDestFilePath, nextDestFilePath);
                    showSimpleToast(title, 'Document downloaded successfully');
                } catch (error) {
                    handleError(error);
                    showSimpleToast(
                        title,
                        'Error occurred during downloading document',
                    );
                } finally {
                    hideProgressBar(documentUrl);
                }
            },
        },
        getOpenSharedLinkMenuItem('slides'),
    );
    return contextMenuItems;
}

async function handleItemsAdding(
    dirSource: DirSource,
    defaultContextMenuItems: ContextMenuItemType[],
    event: any,
) {
    const contextMenuItems = await genContextMenuItems(dirSource);
    showAppContextMenu(event, [
        ...defaultContextMenuItems,
        ...contextMenuItems,
    ]);
}

export default function VaryAppDocumentListComp() {
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.APP_DOCUMENT);
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
        if (checkIsPptx(getFileDotExtension(fileFullName))) {
            if (fileFullName.startsWith('~$')) {
                return null;
            }
            return {
                fileFullName: fileFullName,
                appMimetype: mimetypePptx,
            };
        }
        if (checkIsDocx(getFileDotExtension(fileFullName))) {
            if (fileFullName.startsWith('~$')) {
                return null;
            }
            return {
                fileFullName: fileFullName,
                appMimetype: mimetypeDocx,
            };
        }
        return null;
    };
    const fileSelectionOption = {
        windowTitle: 'Select slide files',
        dirPath: dirSource.dirPath,
        extensions: Array.from(
            new Set([
                ...getMimetypeExtensions('appDocument'),
                ...getMimetypeExtensions('pdf'),
                ...getMimetypeExtensions('pptx'),
                ...getMimetypeExtensions('docx'),
                ...supportOfficeFileExtensions.map((ext) => {
                    return ext.slice(1);
                }),
            ]),
        ),
        takeSelectedFile: handleFileTaking.bind(null, dirSource),
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
            header={<span>{tran('Documents')}</span>}
            bodyHandler={handleBodyRendering}
            checkIsOnScreen={checkIsOnScreen}
            fileSelectionOption={fileSelectionOption}
            onItemsAdding={handleItemsAdding.bind(null, dirSource)}
        />
    );
}
