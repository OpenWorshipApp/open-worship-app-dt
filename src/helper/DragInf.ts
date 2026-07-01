export enum DragTypeEnum {
    UNKNOWN = 'unknown',
    PDF_SLIDE = 'pdfSlide',
    PPTX_SLIDE = 'pptxSlide',
    DOCX_SLIDE = 'docxSlide',
    SLIDE = 'slide',
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
