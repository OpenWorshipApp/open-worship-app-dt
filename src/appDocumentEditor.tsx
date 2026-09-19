import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppLayoutComp from './router/AppLayoutComp';
import AppWindowToolsComp from './others/AppWindowToolsComp';

init(async () => {
    const AppDocumentEditorComp = (
        await import('./app-document-editor/AppDocumentEditorComp')
    ).default;
    run(
        <AppLayoutComp>
            <AppDocumentEditorComp />
            <AppWindowToolsComp />
        </AppLayoutComp>,
    );
});
