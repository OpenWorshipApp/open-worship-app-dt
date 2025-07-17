import AppDocument from './AppDocument';
import Slide, { SlideType } from './Slide';
import PdfAppDocument from './PdfAppDocument';
import PdfSlide, { PdfSlideType } from './PdfSlide';

export const MIN_THUMBNAIL_SCALE = 1;
export const THUMBNAIL_SCALE_STEP = 1;
export const MAX_THUMBNAIL_SCALE = 10;
export const DEFAULT_THUMBNAIL_SIZE_FACTOR = 1000 / MAX_THUMBNAIL_SCALE;
export const THUMBNAIL_WIDTH_SETTING_NAME = 'presenter-item-thumbnail-size';

export type VaryAppDocumentType = AppDocument | PdfAppDocument;
export type VaryAppDocumentItemType = Slide | PdfSlide;
export type VaryAppDocumentItemDataType = SlideType | PdfSlideType;
export type VaryAppDocumentDynamicType = VaryAppDocumentType | null | undefined;
