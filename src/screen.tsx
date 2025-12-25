import './_screen/screen.scss';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import ScreenAppComp from './_screen/ScreenAppComp';
import appProvider from './server/appProvider';
import {
    addDomChangeEventListener,
    checkIsZoomed,
    removeDomTitle,
} from './helper/domHelpers';

const container = document.getElementById('root');
if (container !== null) {
    addDomChangeEventListener(removeDomTitle);
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <ScreenAppComp />
        </StrictMode>,
    );
}

document.addEventListener('keyup', function (event) {
    if (
        (event.ctrlKey || event.altKey) &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
        const isNext = event.key === 'ArrowRight';
        appProvider.messageUtils.sendData('screen:app:change-bible', isNext);
    }
});

document.body.style.backgroundColor = 'transparent';

console.log('Is zoom', checkIsZoomed());
window.addEventListener('resize', () => {
    appProvider.reload();
});
