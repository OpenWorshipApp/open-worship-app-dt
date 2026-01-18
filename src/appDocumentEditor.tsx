import AppDocumentEditorComp from './app-document-editor/AppDocumentEditorComp';
import { main } from './others/bootstrap';
import AppLayoutComp from './router/AppLayoutComp';

main(
    <AppLayoutComp>
        <AppDocumentEditorComp />
    </AppLayoutComp>,
);
