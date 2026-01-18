import { init } from './boot';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

init(async () => {
    const WebEditorComp = (await import('./background/web/WebEditorComp'))
        .default;
    run(
        <PopupLayoutComp>
            <WebEditorComp />
        </PopupLayoutComp>,
    );
});
