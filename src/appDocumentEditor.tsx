import AppDocumentEditorComp from './app-document-editor/AppDocumentEditorComp';
import { main } from './others/appInitHelpers';
import AppLayoutComp from './router/AppLayoutComp';

main(
    <AppLayoutComp>
        <AppDocumentEditorComp />
    </AppLayoutComp>,
);
