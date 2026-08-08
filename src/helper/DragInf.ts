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
