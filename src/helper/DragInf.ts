export enum DragTypeEnum {
    UNKNOWN = 'unknown',
    PDF_SLIDE = 'pdfSlide',
    SLIDE = 'slide',
    BIBLE_ITEM = 'bibleItem',
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
