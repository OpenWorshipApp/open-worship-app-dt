import { main } from './others/appInitHelpers';
import AppPresenterComp from './presenter/AppPresenterComp';
import AppLayoutComp from './router/AppLayoutComp';

main(
    <AppLayoutComp>
        <AppPresenterComp />
    </AppLayoutComp>,
);
