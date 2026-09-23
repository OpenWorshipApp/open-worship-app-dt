export type PresenterDemoStepType = {
  text: string;
  find: string;
  finds?: string[];
  action: 'click';
};

export type PresenterDemoType = {
  id: string;
  label: string;
  detail: string;
  title: string;
  steps: PresenterDemoStepType[];
};

export const PRESENTER_DEMO_LIST: PresenterDemoType[];
export const PRESENTER_DEMO_IDS: string[];
export function getPresenterDemo(
  id: string,
  translate?: (value: string) => string,
): PresenterDemoType | null;
