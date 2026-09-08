import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import WebEditorComp from './background/web/WebEditorComp';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import PopupLayoutComp from './router/PopupLayoutComp';

await init();
run(
    <PopupLayoutComp>
        <WebEditorComp />
        <AppWindowToolsComp />
    </PopupLayoutComp>,
);
