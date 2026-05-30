import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import WebEditorComp from './background/web/WebEditorComp';
import PopupLayoutComp from './router/PopupLayoutComp';

await init();
run(
    <PopupLayoutComp>
        <WebEditorComp />
    </PopupLayoutComp>,
);
