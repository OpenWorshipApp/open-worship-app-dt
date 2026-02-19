import { renderToStaticMarkup } from 'react-dom/server';

import { tran } from '../lang/langHelpers';
import {
    showAppAlert,
    showAppConfirm,
} from '../popup-widget/popupWidgetHelpers';
import AppDocumentListEventListener from '../event/VaryAppDocumentEventListener';
import DirSource from '../helper/DirSource';
import { handleError } from '../helper/errorHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsCopyFilePathToPath,
    getFileDotExtension,
    getFileFullName,
    getFileName,
    getTempPath,
    KEY_SEPARATOR,
    mimetypePdf,
    pathBasename,
} from '../server/fileHelpers';
import { openSlideQuickEdit } from '../app-document-presenter/SlideEditHandlerComp';
import { showSimpleToast } from '../toast/toastHelpers';
import type { WrongDimensionType } from './AppDocument';
import AppDocument from './AppDocument';
import Slide from './Slide';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { convertToPdf, getSlidesCount } from '../server/appHelpers';
import { dirSourceSettingNames } from '../helper/constants';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import PdfAppDocument from './PdfAppDocument';
import { createContext, use, useState } from 'react';
import { getSetting, setSetting } from '../helper/settingHelpers';
import type PdfSlide from './PdfSlide';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { useScreenVaryAppDocumentManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    checkSelectedFilePathExist,
    getSelectedFilePath,
    setSelectedFilePath,
} from '../others/selectedHelpers';
import type { DisplayType } from '../_screen/screenTypeHelpers';
import type {
    VaryAppDocumentType,
    VaryAppDocumentItemType,
} from './appDocumentTypeHelpers';
import { getAppDocumentListOnScreenSetting } from '../_screen/preview/screenPreviewerHelpers';

import libOfficeLogo from './liboffice-logo.png';
import FileSource from '../helper/FileSource';
import { appLog } from '../helper/loggerHelpers';

export function showPdfDocumentContextMenu(
    event: any,
    pdfSlide: PdfSlide,
    extraMenuItems: ContextMenuItemType[],
) {
    const menuItemOnScreens = genShowOnScreensContextMenu((event) => {
        ScreenVaryAppDocumentManager.handleSlideSelecting(
            event,
            pdfSlide.filePath,
            pdfSlide.toJson(),
            true,
        );
    });
    showAppContextMenu(event, [...menuItemOnScreens, ...extraMenuItems]);
}

export function gemSlideContextMenuItems(
    appDocument: AppDocument,
    slide: Slide,
    extraMenuItems: ContextMenuItemType[],
) {
    const menuItemOnScreens = genShowOnScreensContextMenu((event) => {
        ScreenVaryAppDocumentManager.handleSlideSelecting(
            event,
            slide.filePath,
            slide.toJson(),
            true,
        );
    });
    const menuItems: ContextMenuItemType[] = [
        {
            menuElement: tran('Copy'),
            onSelect: async () => {
                navigator.clipboard.writeText(slide.clipboardSerialize());
                showSimpleToast('Copied', 'Slide is copied');
            },
        },
        {
            menuElement: tran('Duplicate'),
            onSelect: () => {
                appDocument.duplicateSlide(slide);
            },
        },
        {
            menuElement: tran('Move forward'),
            onSelect: () => {
                appDocument.moveSlide(slide, true);
            },
        },
        {
            menuElement: tran('Move backward'),
            onSelect: () => {
                appDocument.moveSlide(slide, false);
            },
        },
        ...(appProvider.isPagePresenter
            ? [
                  {
                      menuElement: tran('Quick Edit'),
                      onSelect: () => {
                          if (appProvider.isPageAppDocumentEditor) {
                              AppDocumentListEventListener.selectAppDocumentItem(
                                  slide,
                              );
                          } else {
                              openSlideQuickEdit(slide);
                          }
                      },
                  },
              ]
            : []),
        ...menuItemOnScreens,
        {
            menuElement: tran('Delete'),
            onSelect: () => {
                appDocument.deleteSlide(slide);
            },
        },
    ];
    return [...menuItems, ...extraMenuItems];
}

export function checkIsPdf(ext: string) {
    return mimetypePdf.extensions.includes(ext.toLocaleLowerCase());
}

const docFileInfo = {
    // Writer (Word Processor)
    '.odt': 'OpenDocument Text',
    '.ott': 'OpenDocument Text Template',
    '.sxw': 'OpenOffice.org 1.x Text Document',
    '.stw': 'OpenOffice.org 1.x Text Template',
    '.doc': 'Microsoft Word 97/2000/XP/2003',
    '.docx': 'Microsoft Word 2007/2010/2013/2016',
    // Impress (Presentation)
    '.odp': 'OpenDocument Presentation',
    '.otp': 'OpenDocument Presentation Template',
    '.sxi': 'OpenOffice.org 1.x Presentation',
    '.sti': 'OpenOffice.org 1.x Presentation Template',
    '.ppt': 'Microsoft PowerPoint 97/2000/XP/2003',
    '.pptx': 'Microsoft PowerPoint 2007/2010/2013/2016',
    // Draw (Drawing)
    '.odg': 'OpenDocument Drawing',
    '.otg': 'OpenDocument Drawing Template',
    '.svg': 'Scalable Vector Graphics',
    '.svgz': 'Compressed Scalable Vector Graphics',
    // Math (Formula Editor)
    '.odf': 'OpenDocument Formula Template',
    '.smf': 'StarMath Formula',
};

export const supportOfficeFileExtensions = Object.keys(docFileInfo);

function genAlertMessage() {
    return renderToStaticMarkup(
        <div>
            <b>LibreOffice </b>
            is required for converting Office file to PDF. Please install it and
            try again.
            <br />
            <div style={{ margin: '20px' }}>
                <a
                    href={
                        'https://www.google.com/search?q=libreoffice+download'
                    }
                    target="_blank"
                >
                    <strong>{tran('Download')}</strong>
                    <img
                        height={20}
                        src={libOfficeLogo}
                        alt="LibreOffice Logo"
                        style={{
                            paddingLeft: '5px',
                            padding: '2px',
                            borderRadius: '3px',
                            margin: '0 5px',
                            backgroundColor: '#00000074',
                        }}
                    />
                </a>
                <hr />
            </div>
        </div>,
    );
}

const WIDGET_TITLE = 'Converting to PDF';

function showConfirmPdfConvert(dirPath: string, file: DroppedFileType) {
    const fileFullName = getFileFullName(file);
    const confirmMessage = renderToStaticMarkup(
        <div>
            <b>"{fileFullName}"</b>
            {tran(' will be converted to PDF into ')}
            <b>{dirPath}</b>
        </div>,
    );
    return showAppConfirm(WIDGET_TITLE, confirmMessage);
}

async function getTempFilePath(dotExt: string | null) {
    const tempDir = getTempPath();
    let tempFilePath: string | null = null;
    let i = 0;
    while (tempFilePath === null || (await fsCheckFileExist(tempFilePath))) {
        tempFilePath = appProvider.pathUtils.join(
            tempDir,
            `temp-to-pdf-${i}${dotExt ?? ''}`,
        );
        i++;
    }
    return tempFilePath;
}

function toHtmlBold(text: string) {
    return `<b>${text}</b>`;
}

async function getPdfFilePath(dirPath: string, fileName: string) {
    let i = 0;
    while (true) {
        const targetPdfFilePath = appProvider.pathUtils.join(
            dirPath,
            `${fileName}${i === 0 ? '' : '-' + i}.pdf`,
        );
        if (!(await fsCheckFileExist(targetPdfFilePath))) {
            return targetPdfFilePath;
        }
        i++;
    }
}

async function startConvertingOfficeFile(
    file: DroppedFileType,
    dirSource: DirSource,
) {
    const droppedFileFullName = (file as any).name ?? null;
    const dotExt =
        droppedFileFullName === null
            ? null
            : getFileDotExtension(droppedFileFullName);
    const tempFilePath = await getTempFilePath(dotExt);
    appLog('Temp file path for converting:', tempFilePath);
    const fileFullName = getFileFullName(file);
    const targetPdfFilePath = await getPdfFilePath(
        dirSource.dirPath,
        getFileName(fileFullName),
    );
    try {
        showProgressBar(WIDGET_TITLE);
        if (!(await fsCopyFilePathToPath(file, tempFilePath, ''))) {
            throw new Error('Fail to copy file');
        }
        let slidesCount: number | null = null;
        try {
            slidesCount = await getSlidesCount(tempFilePath);
        } catch {}
        const slideMessage = slidesCount
            ? slidesCount + ' slides'
            : 'unknown slides count';
        showSimpleToast(
            WIDGET_TITLE,
            `Document with ${slideMessage} is being converted. ` +
                'Do not close application',
        );
        const error = await convertToPdf(tempFilePath, targetPdfFilePath);
        if (error !== null) {
            showSimpleToast(
                WIDGET_TITLE,
                `Failed to convert ${toHtmlBold(fileFullName)} to PDF. ` +
                    `Error: ${error.message}`,
            );
            return;
        }
        const pdfPagesCount = await getSlidesCount(targetPdfFilePath);
        if (slidesCount != null && pdfPagesCount !== slidesCount) {
            showSimpleToast(
                WIDGET_TITLE,
                `Warning: Slides count mismatch. ` +
                    `Original: ${slidesCount}, Converted: ${pdfPagesCount}`,
            );
        }
        showSimpleToast(
            WIDGET_TITLE,
            `${toHtmlBold(fileFullName)} is converted to PDF ` +
                `"${targetPdfFilePath}"`,
        );
    } catch (error: any) {
        const regex = /Could not find .+ binary/i;
        if (regex.test(error.message)) {
            showAppAlert('LibreOffice is not installed', genAlertMessage());
        } else {
            handleError(error);
            const pdfFileSource = FileSource.getInstance(targetPdfFilePath);
            showSimpleToast(
                WIDGET_TITLE,
                'Something wrong during converting, please check converted ' +
                    `file "${pdfFileSource.fullName}" and try again.`,
            );
        }
    }
    hideProgressBar(WIDGET_TITLE);
}

export async function convertOfficeFile(
    file: DroppedFileType,
    dirSource: DirSource,
) {
    const isConfirm = await showConfirmPdfConvert(dirSource.dirPath, file);
    if (!isConfirm) {
        return;
    }
    await startConvertingOfficeFile(file, dirSource);
}

export async function selectSlide(event: any, currentFilePath: string) {
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.APP_DOCUMENT,
    );
    const newFilePaths = await dirSource.getFilePaths('appDocument');
    if (!newFilePaths?.length) {
        return null;
    }
    return new Promise<AppDocument | null>((resolve) => {
        const menuItems: ContextMenuItemType[] = newFilePaths
            .filter((filePath) => {
                return filePath !== currentFilePath;
            })
            .map((filePath) => {
                return {
                    menuElement: pathBasename(filePath),
                    title: filePath,
                    onSelect: () => {
                        const appDocument = AppDocument.getInstance(filePath);
                        resolve(appDocument);
                    },
                };
            });
        showAppContextMenu(event, menuItems);
    });
}

export const SelectedVaryAppDocumentContext = createContext<{
    selectedVaryAppDocument: VaryAppDocumentType | null;
    setSelectedVaryAppDocument: (
        newVaryAppDocument: VaryAppDocumentType | null,
    ) => void;
} | null>(null);

function useContext() {
    const context = use(SelectedVaryAppDocumentContext);
    if (context === null) {
        throw new Error('No SelectedVaryAppDocumentContext found');
    }
    return context;
}

export const VaryAppDocumentContext = createContext<VaryAppDocumentType | null>(
    null,
);

export function useVaryAppDocumentContext() {
    const varyAppDocument = use(VaryAppDocumentContext);
    if (varyAppDocument === null) {
        throw new Error('No VaryAppDocumentContext found');
    }
    return varyAppDocument;
}

export function useSelectedAppDocumentSetterContext() {
    const context = useContext();
    return context.setSelectedVaryAppDocument;
}

export const SelectedEditingSlideContext = createContext<{
    selectedSlide: Slide | null;
    setSelectedDocument: (newSlide: Slide | null) => void;
} | null>(null);

function useContextItem() {
    const context = use(SelectedEditingSlideContext);
    if (context === null) {
        throw new Error(
            'useSelectedEditingSlideContext must be used within a ' +
                'SelectedEditingSlideContext',
        );
    }
    return context;
}

export function useSelectedEditingSlideContext() {
    const context = useContextItem();
    if (
        context.selectedSlide === null ||
        !(context.selectedSlide instanceof Slide)
    ) {
        throw new Error('No selected slide');
    }
    return context.selectedSlide;
}

export function useSelectedEditingSlideSetterContext() {
    const context = useContextItem();
    return context.setSelectedDocument;
}

export function useSlideWrongDimension(
    varyAppDocument: VaryAppDocumentType,
    display: DisplayType,
) {
    const [wrong, setWrong] = useState<WrongDimensionType | null>(null);
    const checkWrongDimension = async () => {
        if (!AppDocument.checkIsThisType(varyAppDocument)) {
            return;
        }
        const wrong = await varyAppDocument.getIsWrongDimension(display);
        setWrong(wrong);
    };
    useFileSourceEvents(
        ['update'],
        checkWrongDimension,
        [varyAppDocument, display],
        varyAppDocument.filePath,
    );
    useAppEffect(() => {
        checkWrongDimension();
    }, [varyAppDocument, display]);
    return wrong;
}

export function toKeyByFilePath(filePath: string, id: number) {
    return `${filePath}${KEY_SEPARATOR}${id}`;
}

export function appDocumentItemExtractKey(key: string) {
    const [filePath, id] = key.split(KEY_SEPARATOR);
    if (filePath === undefined || id === undefined) {
        return null;
    }
    return {
        filePath,
        id: Number.parseInt(id),
    };
}

export async function appDocumentItemFromKey(key: string) {
    const extracted = appDocumentItemExtractKey(key);
    if (extracted === null) {
        return null;
    }
    const { filePath, id } = extracted;
    if (filePath === undefined || id === undefined) {
        return null;
    }
    const varyAppDocument = varyAppDocumentFromFilePath(filePath);
    return await varyAppDocument.getItemById(id);
}

const SELECTED_APP_DOCUMENT_SETTING_NAME = 'selected-vary-app-document';
const SELECTED_APP_DOCUMENT_ITEM_SETTING_NAME =
    SELECTED_APP_DOCUMENT_SETTING_NAME + '-item';

export async function getSelectedVaryAppDocumentFilePath() {
    return await getSelectedFilePath(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

export function setSelectedVaryAppDocumentFilePath(filePath: string | null) {
    setSelectedFilePath(
        SELECTED_APP_DOCUMENT_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
        filePath,
    );
}

export async function getSelectedVaryAppDocument() {
    const selectedAppDocumentFilePath =
        await getSelectedVaryAppDocumentFilePath();
    if (selectedAppDocumentFilePath === null) {
        return null;
    }
    return varyAppDocumentFromFilePath(selectedAppDocumentFilePath);
}

export async function setSelectedVaryAppDocument(
    varyAppDocument: VaryAppDocumentType | null,
) {
    setSelectedVaryAppDocumentFilePath(varyAppDocument?.filePath ?? null);
}

export async function getSelectedEditingSlideFilePath() {
    const selectedKey =
        getSetting(SELECTED_APP_DOCUMENT_ITEM_SETTING_NAME) ?? '';
    const [filePath, idString] = selectedKey.split(KEY_SEPARATOR);
    const selectedAppDocument = await getSelectedVaryAppDocument();
    const isValid =
        AppDocument.checkIsThisType(selectedAppDocument) &&
        (await checkSelectedFilePathExist(
            SELECTED_APP_DOCUMENT_ITEM_SETTING_NAME,
            dirSourceSettingNames.APP_DOCUMENT,
            filePath,
        )) &&
        selectedAppDocument.filePath === filePath;
    if (!isValid) {
        return null;
    }
    const id = Number.parseInt(idString);
    if (Number.isNaN(id)) {
        setSelectedEditingSlideFilePath(null, -1);
        return null;
    }
    return { filePath, id };
}

export function setSelectedEditingSlideFilePath(
    filePath: string | null,
    id: number,
) {
    const keyPath = filePath === null ? '' : toKeyByFilePath(filePath, id);
    setSetting(SELECTED_APP_DOCUMENT_ITEM_SETTING_NAME, keyPath);
}

export async function getSelectedEditingSlide() {
    const selected = await getSelectedEditingSlideFilePath();
    if (selected === null) {
        return null;
    }
    const { filePath, id } = selected;
    const varyAppDocument = varyAppDocumentFromFilePath(filePath);
    if (!AppDocument.checkIsThisType(varyAppDocument)) {
        return null;
    }
    return await varyAppDocument.getItemById(id);
}

export function setSelectedEditingSlide(slide: Slide | null) {
    setSelectedEditingSlideFilePath(slide?.filePath ?? null, slide?.id ?? -1);
}

export function varyAppDocumentFromFilePath(filePath: string) {
    if (checkIsPdf(getFileDotExtension(filePath))) {
        return PdfAppDocument.getInstance(filePath);
    }
    return AppDocument.getInstance(filePath);
}

export function useAnyItemSelected(
    varyAppDocumentItems?: VaryAppDocumentItemType[] | null,
) {
    const [isAnyItemSelected, setIsAnyItemSelected] = useState(false);
    const refresh = () => {
        if (!varyAppDocumentItems || varyAppDocumentItems.length === 0) {
            return;
        }
        const isSelected = varyAppDocumentItems.some((varyAppDocumentItem) => {
            const dataList = ScreenVaryAppDocumentManager.getDataList(
                varyAppDocumentItem.filePath,
                varyAppDocumentItem.id,
            );
            return dataList.length > 0;
        });
        setIsAnyItemSelected(isSelected);
    };
    useScreenVaryAppDocumentManagerEvents(['update'], undefined, refresh);
    useAppEffect(refresh, [
        varyAppDocumentItems?.map((item) => item.id).join('|'),
    ]);
    return isAnyItemSelected;
}

export function checkIsAppDocumentItemOnScreen(
    varyAppDocumentItem: VaryAppDocumentItemType,
) {
    const data = ScreenVaryAppDocumentManager.getDataList(
        varyAppDocumentItem.filePath,
        varyAppDocumentItem.id,
    );
    return data.length > 0;
}

export async function checkIsVaryAppDocumentOnScreen(
    varyAppDocument: VaryAppDocumentType,
) {
    const dataList = getAppDocumentListOnScreenSetting();
    if (Object.keys(dataList).length === 0) {
        return false;
    }
    const varyAppDocumentItems = await varyAppDocument.getSlides();
    for (const varyAppDocumentItem of varyAppDocumentItems) {
        const data = ScreenVaryAppDocumentManager.getDataList(
            varyAppDocumentItem.filePath,
            varyAppDocumentItem.id,
        );
        if (data !== null && data.length > 0) {
            return true;
        }
    }
    return false;
}
