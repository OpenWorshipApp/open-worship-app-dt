import { type CSSProperties } from 'react';

import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { deserializeDragData } from '../helper/dragHelpers';
import FileSource from '../helper/FileSource';
import { cloneJson } from '../helper/helpers';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import { tran } from '../lang/langHelpers';
import {
    toForegroundDragIconName,
    toForegroundDragLabel,
} from '../presenter-foreground/foregroundDragHelpers';
import type { PlaylistActionIdType } from './playlistActionHelpers';
import {
    PLAYLIST_ACTION_TYPE,
    findPlaylistAction,
} from './playlistActionHelpers';
import { toDocumentIcon, toDragTypeIconName } from './playlistHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { getBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

export const ERROR_TYPE = 'error';

export const slideDragTypeList = [
    DragTypeEnum.SLIDE,
    DragTypeEnum.LYRIC_SLIDE,
    DragTypeEnum.PDF_SLIDE,
    DragTypeEnum.PPTX_SLIDE,
    DragTypeEnum.DOCX_SLIDE,
] as DragTypeEnum[];

export const backgroundDragTypeList = [
    DragTypeEnum.BACKGROUND_COLOR,
    DragTypeEnum.BACKGROUND_IMAGE,
    DragTypeEnum.BACKGROUND_VIDEO,
    DragTypeEnum.BACKGROUND_CAMERA,
    DragTypeEnum.BACKGROUND_WEB,
] as DragTypeEnum[];

export const acceptedDragTypeList = [
    ...backgroundDragTypeList,
    ...slideDragTypeList,
    DragTypeEnum.BIBLE_ITEM,
    DragTypeEnum.APP_DOCUMENT,
    DragTypeEnum.FOREGROUND,
    // Audio is deliberately NOT in `backgroundDragTypeList`: it is played
    // locally rather than shown, so it must not reach the screen pipeline.
    DragTypeEnum.BACKGROUND_AUDIO,
] as DragTypeEnum[];

/**
 * What a playlist stores per entry.
 *
 * Slides and documents are kept as REFERENCES (`filePath` + `id`), never as a
 * snapshot of the dragged payload: a playlist is built days before it is used,
 * and a song edited in between must project its new text. Everything else
 * (backgrounds, bible verses, foregrounds) is already self-describing and small,
 * so its drag payload is stored verbatim in `data`.
 *
 * A screen ACTION is the one entry that is not content at all: it stores nothing
 * but its id in `data`, and no `title` — its label is translated on the fly, so
 * a run sheet reads in whichever language it is opened in.
 */
export type PlaylistItemType = {
    type: DragTypeEnum | typeof ERROR_TYPE | typeof PLAYLIST_ACTION_TYPE;
    filePath?: string;
    id?: number;
    // Lyric slides only: which rendering stage the slide came from.
    stage?: number;
    data?: any;
    extraStyle?: CSSProperties;
    // Label captured when the item was added. Purely cosmetic — resolving the
    // real name would mean reading every referenced file just to draw a row.
    title?: string;
    // Same colour vocabulary as the file lists. Stored on the entry rather than
    // in the shared colour-note settings: two playlists may well want the same
    // slide flagged differently.
    colorNote?: string | null;
};

export default class PlaylistItem {
    private readonly originalJson: Readonly<PlaylistItemType>;
    filePath: string;
    jsonError: any;

    constructor(filePath: string, json: PlaylistItemType) {
        this.filePath = filePath;
        this.originalJson = Object.freeze(cloneJson(json));
    }

    get extraStyle() {
        return this.originalJson.extraStyle ?? {};
    }
    get type() {
        return this.originalJson.type;
    }
    get itemFilePath() {
        return this.originalJson.filePath ?? '';
    }
    get id() {
        return this.originalJson.id ?? -1;
    }
    get stage() {
        return this.originalJson.stage ?? 0;
    }
    get data() {
        return this.originalJson.data;
    }
    get colorNote() {
        return this.originalJson.colorNote ?? null;
    }

    get isError() {
        return this.type === ERROR_TYPE;
    }
    get isSlide() {
        return slideDragTypeList.includes(this.type as DragTypeEnum);
    }
    get isBackground() {
        return backgroundDragTypeList.includes(this.type as DragTypeEnum);
    }
    get isBibleItem() {
        return this.type === DragTypeEnum.BIBLE_ITEM;
    }
    get isAppDocument() {
        return this.type === DragTypeEnum.APP_DOCUMENT;
    }
    get isForeground() {
        return this.type === DragTypeEnum.FOREGROUND;
    }
    get isAudio() {
        return this.type === DragTypeEnum.BACKGROUND_AUDIO;
    }
    get isAction() {
        return this.type === PLAYLIST_ACTION_TYPE;
    }
    /** Never null while this is an action — `validate` rejects unknown ids. */
    get action() {
        return findPlaylistAction(this.data);
    }
    /**
     * A document opens a preview and audio plays locally, so neither goes to a
     * screen — they are the item kinds the screen pipeline cannot take. An
     * action does reach a screen, but it is RUN on one rather than shown, so it
     * is deliberately not part of this.
     */
    get isShowableOnScreen() {
        return (
            !this.isError &&
            !this.isAppDocument &&
            !this.isAudio &&
            !this.isAction
        );
    }
    /**
     * Everything an operator can send to a screen from a run sheet — content to
     * show, or an action to run there. What the click, the drag, the next-key
     * and the right-click menu all gate on.
     */
    get isScreenReachable() {
        return this.isShowableOnScreen || this.isAction;
    }

    get iconName() {
        if (this.isError) {
            return 'exclamation-triangle';
        }
        if (this.isAction) {
            return this.action?.iconName ?? 'eraser';
        }
        if (this.isForeground) {
            return toForegroundDragIconName(this.data?.target);
        }
        if (this.isAppDocument) {
            return toDocumentIcon(this.itemFilePath)[0];
        }
        return toDragTypeIconName(this.type);
    }

    /** Only the kinds whose icon carries meaning in colour set this. */
    get iconColor() {
        if (this.type === DragTypeEnum.BACKGROUND_COLOR) {
            return this.data;
        }
        if (this.isAppDocument) {
            return toDocumentIcon(this.itemFilePath)[1];
        }
        if (this.isAction) {
            return this.action?.color;
        }
        return undefined;
    }

    get title() {
        // Translated here rather than captured on add, unlike every other kind:
        // an action has no name of its own to preserve, and its label is one the
        // app already ships in every language.
        if (this.isAction) {
            const { action } = this;
            return action === null ? this.type : tran(action.label);
        }
        return this.originalJson.title ?? this.type;
    }

    /** Short badge identifying WHICH element this is, next to the type icon. */
    get idLabel() {
        if (this.isSlide) {
            return `#${this.id}`;
        }
        if (this.isAction) {
            return this.action?.badge ?? '';
        }
        return '';
    }

    /**
     * Rebuild the payload the screen pipeline expects. Slides are re-read from
     * their document here, which is also why this is async.
     */
    async toDroppedData(): Promise<DroppedDataType | null> {
        // An action carries no payload at all — it is applied to a screen
        // manager directly (`applyPlaylistActionOnScreens`).
        if (this.isError || this.isAction) {
            return null;
        }
        if (this.isSlide) {
            const varySlide = await this.getVarySlide();
            if (varySlide === null) {
                return null;
            }
            return { type: this.type as DragTypeEnum, item: varySlide };
        }
        return deserializeDragData({
            type: this.type as DragTypeEnum,
            data: this.data,
        });
    }

    /**
     * Resolve the referenced slide. The document graphs are imported lazily:
     * they are heavy, they form an initialization cycle with each other, and a
     * playlist that is merely listed must not pull them in at all.
     */
    async getVarySlide(): Promise<VarySlideType | null> {
        if (!this.isSlide || !this.itemFilePath) {
            return null;
        }
        try {
            if (this.type === DragTypeEnum.LYRIC_SLIDE) {
                const { getLyricAppDocumentStageByStage } =
                    await import('../lyric-list/lyricHelpers');
                const [, lyricAppDocument] = getLyricAppDocumentStageByStage(
                    this.itemFilePath,
                    this.stage,
                );
                return await lyricAppDocument.getSlideById(this.id);
            }
            const { varyAppDocumentFromFilePath } =
                await import('../app-document-list/appDocumentHelpers');
            const varyAppDocument = varyAppDocumentFromFilePath(
                this.itemFilePath,
            );
            return (await varyAppDocument.getItemById(
                this.id,
            )) as VarySlideType | null;
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    /**
     * Put this item back on a drag event. Slides cannot be resolved
     * synchronously, so they travel as a reference and the drop side resolves
     * them — see `PlaylistItemComp`.
     */
    dragSerialize(): DragDataType<any> | null {
        if (
            this.isSlide ||
            this.isAppDocument ||
            this.isError ||
            this.isAction
        ) {
            return null;
        }
        return { type: this.type as DragTypeEnum, data: this.data };
    }

    static async fromDroppedData(
        { type, item }: DroppedDataType,
        dragData: DragDataType<any>,
    ): Promise<PlaylistItemType | null> {
        if (!acceptedDragTypeList.includes(type)) {
            return null;
        }
        if (slideDragTypeList.includes(type)) {
            const varySlide = item as VarySlideType;
            const fileSource = FileSource.getInstance(varySlide.filePath);
            return {
                type,
                filePath: varySlide.filePath,
                id: varySlide.id,
                ...(type === DragTypeEnum.LYRIC_SLIDE
                    ? { stage: (varySlide as any).stage ?? 0 }
                    : {}),
                title:
                    `${fileSource.name} #${varySlide.id}` +
                    (varySlide.name ? ` ${varySlide.name}` : ''),
            };
        }
        if (type === DragTypeEnum.APP_DOCUMENT) {
            const documentFilePath = item.filePath as string;
            return {
                type,
                filePath: documentFilePath,
                data: documentFilePath,
                title: FileSource.getInstance(documentFilePath).name,
            };
        }
        const title = await toDroppedDataTitle(type, item, dragData);
        const extraStyle = await toDroppedExtraStyle(type, dragData);
        console.log(extraStyle);

        return {
            type,
            data: dragData.data,
            title,
            extraStyle,
        };
    }

    /**
     * A screen action, as it is stored. Only the id travels: the label follows
     * the app's language and what the action does lives in code, so a playlist
     * written today keeps working when either changes.
     */
    static fromActionId(actionId: PlaylistActionIdType): PlaylistItemType {
        return { type: PLAYLIST_ACTION_TYPE, data: actionId };
    }

    static fromJson(filePath: string, json: PlaylistItemType) {
        this.validate(json);
        return new PlaylistItem(filePath, json);
    }

    static fromJsonError(filePath: string, json: AnyObjectType) {
        const item = new PlaylistItem(filePath, {
            type: ERROR_TYPE,
            title: 'Invalid item',
        });
        item.jsonError = json;
        return item;
    }

    toJson(): PlaylistItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return cloneJson(this.originalJson) as PlaylistItemType;
    }

    static validate(json: AnyObjectType) {
        if (json.type === PLAYLIST_ACTION_TYPE) {
            // An id nothing answers to becomes an error row rather than a row
            // that quietly does nothing when the operator presses it mid-service.
            if (findPlaylistAction(json.data) === null) {
                loggerHelpers.appError(json);
                throw new Error('Invalid playlist action id');
            }
            return;
        }
        if (
            !acceptedDragTypeList.includes(json.type) ||
            (json.filePath !== undefined &&
                typeof json.filePath !== 'string') ||
            (json.id !== undefined && typeof json.id !== 'number') ||
            (slideDragTypeList.includes(json.type) &&
                (typeof json.filePath !== 'string' ||
                    typeof json.id !== 'number'))
        ) {
            loggerHelpers.appError(json);
            throw new Error('Invalid playlist item data');
        }
    }

    clone() {
        return PlaylistItem.fromJson(this.filePath, this.toJson());
    }
}

async function toDroppedDataTitle(
    type: DragTypeEnum,
    item: any,
    dragData: DragDataType<any>,
) {
    if (type === DragTypeEnum.BACKGROUND_COLOR) {
        return `${item}`;
    }
    if (type === DragTypeEnum.BACKGROUND_CAMERA) {
        return 'Camera';
    }
    if (
        backgroundDragTypeList.includes(type) ||
        type === DragTypeEnum.BACKGROUND_AUDIO
    ) {
        // Image/video/audio/web backgrounds deserialize to a `FileSource`, so
        // the name is read off it — re-instantiating from `src` would treat the
        // `file://` URL as a path and mangle the name.
        return item?.fullName ?? item?.src ?? `${type}`;
    }
    if (type === DragTypeEnum.BIBLE_ITEM) {
        const { bibleKey, target } = dragData.data ?? {};
        if (target === undefined) {
            return 'Bible Item';
        }
        const fullVerseTitle = await bibleRenderHelper.toTitle(
            bibleKey,
            target,
        );
        if (fullVerseTitle !== null) {
            return `(${bibleKey}) ${fullVerseTitle}`;
        }
        const verse =
            target.verseStart === target.verseEnd
                ? `${target.verseStart}`
                : `${target.verseStart}-${target.verseEnd}`;
        return `(${bibleKey}) ${target.bookKey} ${target.chapter}:${verse}`;
    }
    if (type === DragTypeEnum.FOREGROUND) {
        return toForegroundDragLabel(item);
    }
    return `${type}`;
}

async function toDroppedExtraStyle(
    type: DragTypeEnum,
    dragData: DragDataType<any>,
): Promise<CSSProperties> {
    if (type === DragTypeEnum.BIBLE_ITEM) {
        const fontFamily = await getBibleFontFamily(dragData.data?.bibleKey);
        return { fontFamily };
    }
    return {};
}
