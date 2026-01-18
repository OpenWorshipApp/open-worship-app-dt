import { main } from './others/bootstrap';
import AppPresenterComp from './presenter/AppPresenterComp';
import AppLayoutComp from './router/AppLayoutComp';

main(
    <AppLayoutComp>
        <AppPresenterComp />
    </AppLayoutComp>,
);
