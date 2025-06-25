import AppDocument from '../app-document-list/AppDocument';
import Slide from '../app-document-list/Slide';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import { getMimetypeExtensions, MimetypeNameType } from '../server/fileHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import LyricSlide from './LyricSlide';
import FileSource from '../helper/FileSource';
import Lyric from './Lyric';
import {
    renderLyricSlideMarkdownTextList,
    renderMarkdown,
} from './markdownHelpers';
import { CanvasItemTextPropsType } from '../slide-editor/canvas/CanvasItemText';

export type LyricEditingPropsType = {
    fontFamily: string;
    fontWeight: string;
};

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'appDocument';
    lyricEditingProps: LyricEditingPropsType = {
        fontFamily: '',
        fontWeight: '',
    };
    isEditable = false;
    isPreRender = false;

    async getSlides() {
        const display = getDefaultScreenDisplay();
        const offsetPercentage = 1;
        const left = Math.floor(
            display.bounds.width * (offsetPercentage / 100),
        );
        const top = left;
        const lyric = Lyric.getInstance(
            LyricAppDocument.toLyricFilePath(this.filePath),
        );
        let textList = (await renderLyricSlideMarkdownTextList(lyric)).map(
            (text) => {
                return [text, text, undefined];
            },
        );
        if (this.isPreRender) {
            textList = await Promise.all(
                textList.map(async ([text, htmlText]) => {
                    if (!text) {
                        return [text, htmlText];
                    }
                    const htmlData = await renderMarkdown(text, {
                        isJustifyCenter: true,
                        isDisablePointerEvents: true,
                        theme: 'dark',
                        fontFamily: this.lyricEditingProps.fontFamily,
                    });
                    return [text, htmlData.html, htmlData.id];
                }),
            );
        }
        return textList.map(([text, htmlText, id], i) => {
            return new LyricSlide(this.filePath, {
                id: i,
                canvasItems: text
                    ? [
                          {
                              text,
                              htmlText,
                              color: '#FFFFFFFF',
                              fontSize: 90,
                              fontFamily: this.lyricEditingProps.fontFamily,
                              fontWeight: null,
                              textHorizontalAlignment: 'center',
                              textVerticalAlignment: 'center',
                              id: 0,
                              top,
                              left,
                              backgroundColor: '#0000008B',
                              width: Math.floor(
                                  display.bounds.width - left * 2,
                              ),
                              height: Math.floor(
                                  display.bounds.height - top * 2,
                              ),
                              rotate: 0,
                              horizontalAlignment: 'center',
                              verticalAlignment: 'center',
                              type: 'html',
                          } as CanvasItemTextPropsType,
                      ]
                    : [],
                metadata: {
                    width: display.bounds.width,
                    height: display.bounds.height,
                    uuid: id ?? '',
                } as any,
            });
        });
    }

    async showContextMenu(_event: any) {
        return;
    }

    showSlideContextMenu(
        event: any,
        slide: Slide,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        const menuItemOnScreens = genShowOnScreensContextMenu((event) => {
            ScreenVaryAppDocumentManager.handleSlideSelecting(
                event,
                slide.filePath,
                slide.toJson(),
                true,
            );
        });
        showAppContextMenu(event, [...menuItemOnScreens, ...extraMenuItems]);
    }

    async save(): Promise<boolean> {
        throw new Error('LyricAppDocument does not support saving slides.');
    }

    static toAppDocumentFilePath(lyricFilePath: string) {
        const extensions = getMimetypeExtensions(this.mimetypeName);
        if (extensions.length === 0) {
            throw new Error('No extensions found for appDocument mimetype');
        }
        const filePath = `${lyricFilePath}.preview.${extensions[0]}`;
        return filePath;
    }

    static toLyricFilePath(appDocumentFilePath: string) {
        const extensions = getMimetypeExtensions(this.mimetypeName);
        if (extensions.length === 0) {
            throw new Error('No extensions found for appDocument mimetype');
        }
        const filePath = appDocumentFilePath.replace(
            new RegExp(`\\.preview\\.${extensions[0]}$`),
            '',
        );
        return filePath;
    }

    static getInstanceFromLyricFilePath(filePath: string, isForceNew = false) {
        const fileSource = FileSource.getInstance(filePath);
        const extensions = getMimetypeExtensions(Lyric.mimetypeName);
        if (!extensions.includes(fileSource.extension)) {
            return null;
        }
        const newFilePath = this.toAppDocumentFilePath(filePath);
        if (isForceNew) {
            return new LyricAppDocument(newFilePath);
        }
        const instance = this.getInstance(
            newFilePath,
        ) as any as LyricAppDocument;
        return instance;
    }
}
