import './CustomHTMLScreenPreviewer';

import { useCallback, useState } from 'react';

import { dragStore, extractDropData } from '../../helper/dragHelpers';
import { openContextMenu } from './screenPreviewerHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useAppEffect } from '../../helper/debuggerHelpers';
import ScreenPreviewerHeaderComp from './ScreenPreviewerHeaderComp';
import ScreenPreviewerFooterComp from './ScreenPreviewerFooterComp';
import {
    HIGHLIGHT_SELECTED_CLASSNAME,
    RECEIVING_DROP_CLASSNAME,
} from '../../helper/helpers';

export default function ScreenPreviewerItemComp({
    width,
}: Readonly<{
    width: number;
}>) {
    const screenManager = useScreenManagerContext();
    const [screenManagerDim, setScreenManagerDim] = useState({
        width: screenManager.width,
        height: screenManager.height,
    });
    useAppEffect(() => {
        const handleResize = () => {
            setScreenManagerDim({
                width: screenManager.width,
                height: screenManager.height,
            });
        };
        const registeredEvent = screenManager.registerEventListener(
            ['display-id'],
            handleResize,
        );
        return () => {
            screenManager.unregisterEventListener(registeredEvent);
        };
    }, [screenManager]);
    const selectedCN = screenManager.isSelected
        ? HIGHLIGHT_SELECTED_CLASSNAME
        : '';
    const height = Math.round(
        width * (screenManagerDim.height / screenManagerDim.width),
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            openContextMenu(event, screenManager);
        },
        [screenManager],
    );
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDrop = useCallback(
        (event: any) => {
            event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
            const droppedData = extractDropData(event);
            if (droppedData === null) {
                dragStore.onDropped?.(event);
                return;
            }
            screenManager.receiveScreenDropped(droppedData);
        },
        [screenManager],
    );
    const handleWheel = useCallback(
        (event: any) => {
            if (event.ctrlKey && screenManager.screenBibleManager.isShowing) {
                event.stopPropagation();
            }
        },
        [screenManager],
    );
    const handleScroll = useCallback((event: any) => {
        event.currentTarget.scrollTop = 0;
    }, []);
    return (
        <div
            key={screenManager.key}
            className={`mini-screen card ${selectedCN}`}
            data-screen-key={screenManager.screenId}
            data-screen-manager-key={screenManager.key}
            title={`Screen: ${screenManager.screenId}`}
            style={{
                overflow: 'hidden',
                width: `${width}px`,
                display: 'inline-block',
                verticalAlign: 'top',
            }}
            onContextMenu={handleContextMenuOpening}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onWheel={handleWheel}
        >
            <ScreenPreviewerHeaderComp />
            <div
                className="w-100 app-overflow-hidden"
                style={{
                    height: `${height}px`,
                }}
                onScroll={handleScroll}
            >
                <mini-screen-previewer-custom-html
                    screenId={screenManager.screenId}
                />
            </div>
            <ScreenPreviewerFooterComp />
        </div>
    );
}
