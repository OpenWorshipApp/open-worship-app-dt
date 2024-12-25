import './_screen/screen.scss';
import './others/font.scss';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import appProviderScreen from './_screen/appProviderScreen';
import ScreenAppComp from './_screen/ScreenAppComp';

const container = document.getElementById('root');
if (container !== null) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <ScreenAppComp />
        </StrictMode>
    );
}

document.addEventListener('keyup', function (event) {
    if (
        (event.ctrlKey || event.altKey) &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
        const isNext = event.key === 'ArrowRight';
        appProviderScreen.messageUtils.sendData(
            'screen:app:change-bible', isNext,
        );
    }
});

document.body.style.backgroundColor = 'transparent';
