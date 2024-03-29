import './PresentAlert.scss';

import { useRef } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import { usePMEvents } from './presentEventHelpers';
import PresentManager from './PresentManager';

export default function PresentAlert({ presentManager }: Readonly<{
    presentManager: PresentManager;
}>) {
    usePMEvents(['resize'], presentManager, () => {
        presentManager.presentAlertManager.renderAll();
    });
    const div = useRef<HTMLDivElement>(null);
    const { presentAlertManager } = presentManager;
    useAppEffect(() => {
        if (div.current) {
            presentAlertManager.div = div.current;
        }
    });
    return (
        <div id='alert' ref={div}
            style={presentAlertManager.containerStyle} >
            <div id='countdown' />
            <div id='marquee' />
            <div id='toast' />
        </div>
    );
}
