import type { ReaderDemoType } from './readerDemos.mjs';

export type PageDemoType = {
  id: string;
  page: string;
  label: string;
  detail: string;
  find?: string;
};
export const PAGE_DEMO_LIST: PageDemoType[];
export function getPageDemo(
  id: string,
  translate?: (label: string) => string,
): ReaderDemoType | null;
