// Small, deterministic Presenter lessons for Tips of the Day. These only
// reveal app controls; they never change the content shown to the congregation.

export const PRESENTER_DEMO_LIST = [
  {
    id: 'presenter-bible-lookup',
    label: 'Look up a Bible passage',
    detail: 'Open Bible Lookup without leaving the Presenter.',
    title: 'Look up a Bible passage',
    steps: [
      {
        text: 'Open Bible Lookup from the top of the Presenter.',
        find: 'Bible Lookup',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-document-list',
    label: 'Show or hide the Document List',
    detail: 'Toggle the panel that holds your slide documents.',
    title: 'Show or hide the Document List',
    steps: [
      {
        text: 'Toggle the Document List panel.',
        find: 'Document List',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-flow-list',
    label: 'Show or hide the Presenting Flow List',
    detail: 'Toggle the panel used to build and follow a service order.',
    title: 'Show or hide the Presenting Flow List',
    steps: [
      {
        text: 'Toggle the Presenting Flow List panel.',
        find: 'Presenting Flow List',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-bible-notes',
    label: 'Show or hide Bibles and Bible Notes',
    detail: 'Toggle the panel for saved passages and notes.',
    title: 'Show or hide Bibles and Bible Notes',
    steps: [
      {
        text: 'Toggle the Bible and Notes panel.',
        find: 'Bible and Notes',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-mini-screen',
    label: 'Show or hide the Mini Screen',
    detail: 'Toggle the panel that previews and controls audience screens.',
    title: 'Show or hide the Mini Screen',
    steps: [
      {
        text: 'Toggle the Mini Screen panel.',
        find: 'Mini Screen',
        translateFind: true,
        action: 'click',
      },
    ],
  },
  {
    id: 'presenter-full-view',
    label: 'Give the Presenter more room',
    detail: 'Switch the Presenter between normal and full view.',
    title: 'Give the Presenter more room',
    steps: [
      {
        text: 'Toggle the Presenter full view.',
        find: 'Full view',
        finds: ['Full view', 'Exit full view'],
        translateFinds: true,
        action: 'click',
      },
    ],
  },
];

export const PRESENTER_DEMO_IDS = PRESENTER_DEMO_LIST.map((demo) => demo.id);

/** A fresh localized copy, so callers can safely decorate its steps. */
export function getPresenterDemo(id, translate = (value) => value) {
  const source = PRESENTER_DEMO_LIST.find((demo) => demo.id === id);
  if (source === undefined) {
    return null;
  }
  return {
    ...source,
    label: translate(source.label),
    detail: translate(source.detail),
    title: translate(source.title),
    steps: source.steps.map((sourceStep) => {
      const { translateFind, translateFinds, ...step } = sourceStep;
      const finds = [...(step.finds ?? [step.find])];
      if (translateFind) {
        finds.push(translate(step.find));
      }
      if (translateFinds) {
        finds.push(...finds.map((find) => translate(find)));
      }
      return { ...step, finds: [...new Set(finds)] };
    }),
  };
}
