import './_present/present.scss';
import './others/font.scss';

import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import appProviderPresent from './_present/appProviderPresent';
import PresentApp from './_present/PresentApp';

const container = document.getElementById('root');
if (container !== null) {
    const root = createRoot(container);
    root.render(
        <StrictMode>
            <PresentApp />
        </StrictMode>
    );
}

document.addEventListener('keyup', function (event) {
    if (
        (event.ctrlKey || event.altKey) &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
    ) {
        const isNext = event.key === 'ArrowRight';
        appProviderPresent.messageUtils.sendData(
            'present:app:change-bible', isNext,
        );
    }
});

document.body.style.backgroundColor = 'transparent';
