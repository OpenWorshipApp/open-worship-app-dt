import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import AppPresenterComp from './presenter/AppPresenterComp';
import AppLayoutComp from './router/AppLayoutComp';
import AppWindowToolsComp from './others/AppWindowToolsComp';

await init();
run(
    <AppLayoutComp>
        <AppPresenterComp />
        <AppWindowToolsComp />
    </AppLayoutComp>,
);
