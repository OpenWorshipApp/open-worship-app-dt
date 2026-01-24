import { init } from './boot';
import { run } from './others/main';
import AppPresenterComp from './presenter/AppPresenterComp';
import AppLayoutComp from './router/AppLayoutComp';

await init();
run(
    <AppLayoutComp>
        <AppPresenterComp />
    </AppLayoutComp>,
);
