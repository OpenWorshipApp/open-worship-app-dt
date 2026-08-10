export enum DragTypeEnum {
    UNKNOWN = 'unknown',
    PDF_SLIDE = 'pdfSlide',
    PPTX_SLIDE = 'pptxSlide',
    DOCX_SLIDE = 'docxSlide',
    SLIDE = 'slide',
    LYRIC_SLIDE = 'lyric-slide',
    BIBLE_ITEM = 'bibleItem',
    BIBLE_ITEM_TARGET_ONLY = 'bibleItem-target-only',
    NOTE_ITEM = 'noteItem',
    LYRIC_ITEM = 'lyricItem',
    BACKGROUND_VIDEO = 'bg-video',
    BACKGROUND_CAMERA = 'bg-camera',
    BACKGROUND_WEB = 'bg-web',
    BACKGROUND_AUDIO = 'bg-audio',
    BACKGROUND_IMAGE = 'bg-image',
    BACKGROUND_COLOR = 'bg-color',
    // A whole document (pdf/pptx/docx/lyric/app-document) by file path. It is a
    // reference, not a snapshot: nothing but the path travels with the drag.
    APP_DOCUMENT = 'appDocument',
    // Any foreground widget (countdown/stopwatch/time/marquee/quick-text/
    // camera/web). The payload carries the widget target plus its own settings,
    // so a foreground can be stored in a presenting flow and replayed later.
    FOREGROUND = 'foreground',
}

// Chromium puts a drag's `DataTransfer` in protected mode while it is in
// flight: `getData` returns '' until the drop, but the mime TYPES stay
// readable. Riding the drag KIND along as an empty entry under its own mime
// type is therefore the only way a drop target can tell what it is hovering
// over — and so whether to show its accept feedback — before the drop lands.
//
// `toLowerCase` is load-bearing: `DataTransfer.setData` ASCII-lowercases the
// format, so `bibleItem`/`pdfSlide`/`appDocument` would never match on read.
export function genDragMimeType(type: DragTypeEnum) {
    return `application/x-owa-drag-${type}`.toLowerCase();
}

export type DragDataType<T> = {
    type: DragTypeEnum;
    data: T;
};

export type DroppedDataType = {
    type: DragTypeEnum;
    item: any;
};

interface DragInf<T> {
    dragSerialize(type?: DragTypeEnum): DragDataType<T>;
}

export default DragInf;
