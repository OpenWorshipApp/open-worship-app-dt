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
    renderLyricSlideMarkdownMusicTextList,
    renderMarkdownMusic,
} from './markdownHelpers';
import { CanvasItemTextPropsType } from '../slide-editor/canvas/CanvasItemText';

export type LyricEditingPropsType = {
    fontFamily: string;
    fontWeight: string;
    scale: number;
};
export const defaultLyricEditingProps: LyricEditingPropsType = {
    fontFamily: '',
    fontWeight: '',
    scale: 30,
};

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'appDocument';
    lyricEditingProps: LyricEditingPropsType = defaultLyricEditingProps;
    isEditable = false;
    isPreRender = false;

    async getSlides() {
        const display = getDefaultScreenDisplay();
        const offsetPercentage = 1;
        const left = Math.round(
            display.bounds.width * (offsetPercentage / 100),
        );
        const top = left;
        const lyric = Lyric.getInstance(
            LyricAppDocument.toLyricFilePath(this.filePath),
        );
        let textList = (await renderLyricSlideMarkdownMusicTextList(lyric)).map(
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
                    const htmlData = await renderMarkdownMusic(text, {
                        isJustifyCenter: true,
                        isDisablePointerEvents: true,
                        theme: 'dark',
                        fontFamily: this.lyricEditingProps.fontFamily,
                        fontWeight: this.lyricEditingProps.fontWeight,
                        scale: this.lyricEditingProps.scale / 10,
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
                              id: 0,
                              type: 'html',
                              text,
                              htmlText,

                              color: '#FFFFFFFF',
                              fontSize: 90,
                              fontFamily: this.lyricEditingProps.fontFamily,
                              fontWeight: null,
                              textHorizontalAlignment: 'center',
                              textVerticalAlignment: 'center',
                              top,
                              left,
                              backgroundColor: '#0000008B',
                              backdropFilter: 5,
                              width: Math.round(
                                  display.bounds.width - left * 2,
                              ),
                              height: Math.round(
                                  display.bounds.height - top * 2,
                              ),
                              rotate: 0,
                              horizontalAlignment: 'center',
                              verticalAlignment: 'center',
                              roundSizePixel: 0,
                              roundSizePercentage: 0,
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
        const filePath = `${lyricFilePath}.preview`;
        return filePath;
    }

    static toLyricFilePath(appDocumentFilePath: string) {
        const extensions = getMimetypeExtensions(this.mimetypeName);
        if (extensions.length === 0) {
            throw new Error('No extensions found for appDocument mimetype');
        }
        const filePath = appDocumentFilePath.replace(/\.preview$/, '');
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
