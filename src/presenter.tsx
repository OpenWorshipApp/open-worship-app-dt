import { init } from './boot';
import { run } from './others/main';
import AppLayoutComp from './router/AppLayoutComp';

init(async () => {
    // Load AppPresenterComp dynamically to ensure lang data is ready
    const AppPresenterComp = (await import('./presenter/AppPresenterComp'))
        .default;
    run(
        <AppLayoutComp>
            <AppPresenterComp />
        </AppLayoutComp>,
    );
});
