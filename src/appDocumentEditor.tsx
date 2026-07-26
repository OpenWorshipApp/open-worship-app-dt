import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppLayoutComp from './router/AppLayoutComp';
import PresentingControlComp from './presenting-control/PresentingControlComp';

init(async () => {
    const AppDocumentEditorComp = (
        await import('./app-document-editor/AppDocumentEditorComp')
    ).default;
    run(
        <AppLayoutComp>
            <AppDocumentEditorComp />
            <PresentingControlComp />
        </AppLayoutComp>,
    );
});
