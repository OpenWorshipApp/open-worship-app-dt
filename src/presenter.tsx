import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppPresenterComp from './presenter/AppPresenterComp';
import AppLayoutComp from './router/AppLayoutComp';
import PresentingControlComp from './presenting-control/PresentingControlComp';

await init();
run(
    <AppLayoutComp>
        <AppPresenterComp />
        <PresentingControlComp />
    </AppLayoutComp>,
);
