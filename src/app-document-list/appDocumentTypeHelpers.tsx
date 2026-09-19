import type AppDocument from './AppDocument';
import type { SlidePropsType } from './Slide';
import type Slide from './Slide';
import type PdfAppDocument from './PdfAppDocument';
import type { PdfSlidePropsType } from './PdfSlide';
import type PdfSlide from './PdfSlide';
import type PptxAppDocument from './PptxAppDocument';
import type PptxSlide from './PptxSlide';
import { type PptxSlidePropsType } from './PptxSlide';
import type DocxAppDocument from './DocxAppDocument';
import type { DocxSlidePropsType } from './DocxSlide';
import type DocxSlide from './DocxSlide';
import { type LyricPropsType } from '../lyric-list/LyricSlide';

export const MIN_THUMBNAIL_SCALE = 20;
export const THUMBNAIL_SCALE_STEP = 1;
export const MAX_THUMBNAIL_SCALE = 200;
export const DEFAULT_THUMBNAIL_SIZE_FACTOR = 1000 / MAX_THUMBNAIL_SCALE;
export const THUMBNAIL_WIDTH_SETTING_NAME = 'presenter-item-thumbnail-size';

export type VaryAppDocumentType =
    AppDocument | PdfAppDocument | PptxAppDocument | DocxAppDocument;
export type VaryAppDocumentWithNoteType = AppDocument | PptxAppDocument;
export type VarySlideType = Slide | PdfSlide | PptxSlide | DocxSlide;
export type VarySlideWithNoteType = Slide | PptxSlide;
export type VarySlideDataType =
    | SlidePropsType
    | LyricPropsType
    | PdfSlidePropsType
    | PptxSlidePropsType
    | DocxSlidePropsType;
export type VaryAppDocumentDynamicType = VaryAppDocumentType | null | undefined;
