import { createContext, use } from 'react';

// True for every pane rendered inside a floating widget, which then stays out of
// the View → Widgets menu. A floating panel is a SECOND copy of something the
// page already shows (a document previewed beside the one the main panel has
// selected), and there can be several at once, so its panes would hand the menu
// labels the page's own panes already use (`checkAreNamesUnique`) with nothing
// to tell the two checkboxes apart. Each pane still keeps its strip inside the
// panel, and the panel itself closes from its own header.
export const WidgetMenuExcludedContext = createContext(false);

export function useIsWidgetMenuExcluded() {
    return use(WidgetMenuExcludedContext);
}
