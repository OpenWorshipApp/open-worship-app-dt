import type AppDocument from './AppDocument';
import type { SlideType } from './Slide';
import type Slide from './Slide';
import type PdfAppDocument from './PdfAppDocument';
import type { PdfSlideType } from './PdfSlide';
import type PdfSlide from './PdfSlide';

export const MIN_THUMBNAIL_SCALE = 20;
export const THUMBNAIL_SCALE_STEP = 1;
export const MAX_THUMBNAIL_SCALE = 200;
export const DEFAULT_THUMBNAIL_SIZE_FACTOR = 1000 / MAX_THUMBNAIL_SCALE;
export const THUMBNAIL_WIDTH_SETTING_NAME = 'presenter-item-thumbnail-size';

export type VaryAppDocumentType = AppDocument | PdfAppDocument;
export type VaryAppDocumentItemType = Slide | PdfSlide;
export type VaryAppDocumentItemDataType = SlideType | PdfSlideType;
export type VaryAppDocumentDynamicType = VaryAppDocumentType | null | undefined;
