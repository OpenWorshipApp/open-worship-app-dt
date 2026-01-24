import WebEditorComp from './background/web/WebEditorComp';
import { init } from './boot';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

await init();
run(
    <PopupLayoutComp>
        <WebEditorComp />
    </PopupLayoutComp>,
);
