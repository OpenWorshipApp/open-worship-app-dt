import { detectBotFocus } from './botFocus.mjs';
import { getPageDemo, PAGE_DEMO_LIST } from './pageDemos.mjs';
import { getPresenterDemo, PRESENTER_DEMO_IDS } from './presenterDemos.mjs';
import { getReaderDemo, READER_DEMO_IDS } from './readerDemos.mjs';

export function getBuiltInDemoPage(id, requestedPage) {
  const focus = READER_DEMO_IDS.includes(id)
    ? 'reader'
    : PRESENTER_DEMO_IDS.includes(id)
      ? 'presenter'
      : PAGE_DEMO_LIST.find((demo) => demo.id === id)?.page;
  if (focus === undefined) {
    return null;
  }
  // A popup and the main window can show the SAME page. Keep the caller's
  // complete URL in that case; a demo for a different page still owns its route.
  return detectBotFocus(requestedPage) === focus
    ? requestedPage
    : `${focus}.html`;
}

export function getBuiltInDemo(id, translate) {
  return (
    getReaderDemo(id, translate) ??
    getPresenterDemo(id, translate) ??
    getPageDemo(id, translate)
  );
}
