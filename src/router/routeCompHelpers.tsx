import AppDocument from '../app-document-list/AppDocument';
import { getSelectedVaryAppDocument } from '../app-document-list/appDocumentHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import appProvider from '../server/appProvider';
import { TabOptionType, toTitleExternal } from './routeHelpers';

export const editorTab: TabOptionType = {
    title: toTitleExternal('Slide Editor'),
    routePath: appProvider.editorHomePage,
    preCheck: async () => {
        const varyAppDocument = await getSelectedVaryAppDocument();
        if (!AppDocument.checkIsThisType(varyAppDocument)) {
            showAppAlert(
                'No slide selected',
                'Please select an Open Worship slide first',
            );
            return false;
        }
        return true;
    },
};
