import './_screen/screen.scss';

import { StrictMode } from 'react';

import ScreenAppComp from './_screen/ScreenAppComp';
import appProvider from './server/appProvider';
import {
    addDomChangeEventListener,
    checkIsZoomed,
    removeDomTitle,
} from './helper/domHelpers';
import { appLog } from './helper/loggerHelpers';
import { getReactRoot } from './others/rootHelpers';

function main() {
    const root = getReactRoot();
    addDomChangeEventListener(removeDomTitle);
    root.render(
        <StrictMode>
            <ScreenAppComp />
        </StrictMode>,
    );

    document.addEventListener('keyup', function (event) {
        if (
            (event.ctrlKey || event.altKey) &&
            ['ArrowLeft', 'ArrowRight'].includes(event.key)
        ) {
            const isNext = event.key === 'ArrowRight';
            appProvider.messageUtils.sendData(
                'screen:app:change-bible',
                isNext,
            );
        }
    });

    document.body.style.backgroundColor = 'transparent';

    appLog('Is zoom', checkIsZoomed());
    window.addEventListener('resize', () => {
        appProvider.reload();
    });
}

main();
