import './_screen/screen.scss';

import { StrictMode } from 'react';

import ScreenAppComp from './_screen/ScreenAppComp';
import appProvider from './server/appProvider';
import {
    addDomChangeEventListener,
    getParamKeyValue,
    removeDomTitle,
} from './helper/domHelpers';
import { getReactRoot } from './others/rootHelpers';
import { initAllLangCss } from './lang/langHelpers';

function main() {
    const root = getReactRoot();
    addDomChangeEventListener(removeDomTitle);
    root.render(
        <StrictMode>
            <ScreenAppComp />
        </StrictMode>,
    );

    // The stepping is applied by the main window, which owns the authoritative
    // screen managers, so the screen has to say which output it is.
    const screenIdParam = getParamKeyValue(
        globalThis.location.search,
        'screenId',
    );
    const screenId = Number.parseInt(screenIdParam ?? '');
    document.addEventListener('keyup', function (event) {
        if (
            Number.isNaN(screenId) ||
            !(event.ctrlKey || event.altKey) ||
            !['ArrowLeft', 'ArrowRight'].includes(event.key)
        ) {
            return;
        }
        appProvider.messageUtils.sendData('screen:app:change-bible', {
            screenId,
            isNext: event.key === 'ArrowRight',
        });
    });

    document.body.style.backgroundColor = 'transparent';

    window.addEventListener('resize', () => {
        appProvider.reload();
    });
}

main();
void initAllLangCss();
