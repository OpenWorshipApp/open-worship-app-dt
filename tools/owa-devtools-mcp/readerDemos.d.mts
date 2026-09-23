export type ReaderDemoStepType = {
  text: string;
  find?: string | null;
  finds?: string[];
  action?: 'click' | 'type';
  value?: string;
  skipIfVisible?: string;
};

export type ReaderDemoType = {
  id: string;
  label: string;
  detail: string;
  title: string;
  isFeatured?: boolean;
  steps: ReaderDemoStepType[];
};

export const READER_DEMO_LIST: ReaderDemoType[];
export const READER_DEMO_IDS: string[];
export function getReaderDemo(
  id: string,
  translate?: (value: string) => string,
): ReaderDemoType | null;
