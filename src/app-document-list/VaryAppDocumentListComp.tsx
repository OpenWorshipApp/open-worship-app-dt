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
    checkIsLyric,
    checkIsPdf,
    checkIsPptx,
    checkIsVaryAppDocumentFilePathOnScreen,
    convertOfficeFile,
    supportOfficeFileExtensions,
} from './appDocumentHelpers';
import LyricFileComp from '../lyric-list/LyricFileComp';
import type DirSource from '../helper/DirSource';
import { tran } from '../lang/langHelpers';
import { toIconedLabel } from '../others/labelIconHelpers';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
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
import {
    askAndImportAppDocumentArchiveFromUrl,
    checkIsAppDocumentArchiveFileFullName,
    importDroppedAppDocumentArchive,
    selectAndImportAppDocumentArchive,
} from './appDocumentArchiveHelpers';

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
    if (checkIsLyric(fileSource.dotExtension)) {
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
    // An exported bundle is imported rather than dropped into the documents
    // folder as-is: the archive itself is not a document the app can open, so
    // copying it there would only leave an unreadable file behind.
    if (checkIsAppDocumentArchiveFileFullName(fileFullName)) {
        importDroppedAppDocumentArchive(file);
        return true;
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
        // Lyrics live in this directory alongside slide documents, but they
        // keep their own row component: selecting one drives the "Lyrics"
        // previewer tab rather than the documents previewer.
        if (checkIsLyric(getFileDotExtension(filePath))) {
            return (
                <LyricFileComp key={filePath} index={i} filePath={filePath} />
            );
        }
        return (
            <VaryAppDocumentFileComp
                key={filePath}
                index={i}
                filePath={filePath}
            />
        );
    });
}

const NEW_FILE_KIND_LYRIC = 'lyric';
const newFileKinds = [
    {
        key: 'app-document',
        title: 'New App Document',
        iconName: 'file-earmark-slides',
    },
    { key: NEW_FILE_KIND_LYRIC, title: 'New Lyric', iconName: 'music-note' },
];

async function newFileHandling(
    dirPath: string,
    name: string,
    kindKey: string | null,
) {
    if (kindKey === NEW_FILE_KIND_LYRIC) {
        const { default: Lyric } = await import('../lyric-list/Lyric');
        return !(await Lyric.create(dirPath, name));
    }
    return !(await AppDocument.create(dirPath, name));
}

async function checkIsOnScreen(filePaths: string[]) {
    for (const filePath of filePaths) {
        // Matched by file path only: this runs for every row on every screen
        // update, and building a document per row just to read `filePath` back
        // off it was pure waste (and cannot resolve lyric rows at all).
        const isOnScreen =
            await checkIsVaryAppDocumentFilePathOnScreen(filePath);
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
    const contextMenuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('box-arrow-in-down'),
            menuElement: tran('Import'),
            onSelect: () => {
                selectAndImportAppDocumentArchive();
            },
        },
        {
            childBefore: genContextMenuItemIcon('cloud-download'),
            menuElement: tran('Import From URL'),
            onSelect: () => {
                askAndImportAppDocumentArchiveFromUrl();
            },
        },
    ];
    const title = tran('Download From URL');
    contextMenuItems.push(
        {
            childBefore: genContextMenuItemIcon('download'),
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
                ...getMimetypeExtensions('lyric'),
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
            extraMimetypeNames={['lyric']}
            defaultFolderName={defaultDataDirNames.APP_DOCUMENT}
            dirSource={dirSource}
            checkExtraFile={handleExtraFileChecking}
            takeDroppedFile={handleFileTaking.bind(null, dirSource)}
            onNewFile={newFileHandling}
            newFileKinds={newFileKinds}
            header={<span>{toIconedLabel('Documents')}</span>}
            bodyHandler={handleBodyRendering}
            checkIsOnScreen={checkIsOnScreen}
            fileSelectionOption={fileSelectionOption}
            onItemsAdding={handleItemsAdding.bind(null, dirSource)}
        />
    );
}
