import { init } from './boot';
import { run } from './others/main';
import AppLayoutComp from './router/AppLayoutComp';

init(async () => {
    const AppDocumentEditorComp = (
        await import('./app-document-editor/AppDocumentEditorComp')
    ).default;
    run(
        <AppLayoutComp>
            <AppDocumentEditorComp />
        </AppLayoutComp>,
    );
});
