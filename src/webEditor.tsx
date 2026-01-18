import WebEditorComp from './background/web/WebEditorComp';
import { main } from './others/bootstrap';
import PopupLayoutComp from './router/PopupLayoutComp';

main(
    <PopupLayoutComp>
        <WebEditorComp />
    </PopupLayoutComp>,
);
