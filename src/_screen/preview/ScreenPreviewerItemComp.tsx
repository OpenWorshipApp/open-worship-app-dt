import './CustomHTMLScreenPreviewer';

import { useCallback, useRef, useState } from 'react';

import { dragStore, extractDropData } from '../../helper/dragHelpers';
import { openContextMenu } from './screenPreviewerHelpers';
import { useScreenManagerContext } from '../managers/screenManagerHooks';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import ScreenPreviewerHeaderComp from './ScreenPreviewerHeaderComp';
import ScreenPreviewerFooterComp from './ScreenPreviewerFooterComp';
import {
    APP_FULL_VIEW_CLASSNAME,
    HIGHLIGHT_SELECTED_CLASSNAME,
    RECEIVING_DROP_CLASSNAME,
} from '../../helper/helpers';

export default function ScreenPreviewerItemComp({
    width,
}: Readonly<{
    width: number;
}>) {
    const screenManager = useScreenManagerContext();
    const [isFullView, setIsFullView] = useState(false);
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
    const screenManagerRef = useAppCurrentRef(screenManager);
    // The custom-html previewer only rescales on a refresh event, so whenever
    // its container width changes (full view toggled via the button or exited
    // with Escape, window resize, zoom) fire a refresh to recompute the scale.
    // Removing `app-full-view` always resizes the card, so this observer also
    // reconciles the React state when Escape (handled globally by removing the
    // class from the DOM) exits full view, preventing a later re-render from
    // re-applying the class and jumping back into full view.
    const cardRef = useRef<HTMLDivElement | null>(null);
    const previewFitRef = useRef<HTMLDivElement | null>(null);
    useAppEffect(() => {
        const fitElement = previewFitRef.current;
        if (fitElement === null || typeof ResizeObserver === 'undefined') {
            return;
        }
        let lastWidth = fitElement.clientWidth;
        const observer = new ResizeObserver(() => {
            const nextWidth = fitElement.clientWidth;
            if (nextWidth !== lastWidth) {
                lastWidth = nextWidth;
                screenManagerRef.current.fireRefreshEvent();
            }
            const cardElement = cardRef.current;
            if (
                cardElement !== null &&
                !cardElement.classList.contains(APP_FULL_VIEW_CLASSNAME)
            ) {
                setIsFullView((prev) => (prev ? false : prev));
            }
        });
        observer.observe(fitElement);
        return () => {
            observer.disconnect();
        };
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        openContextMenu(event, screenManagerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDrop = useCallback((event: any) => {
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
        const droppedData = extractDropData(event);
        if (droppedData === null) {
            dragStore.onDropped?.(event);
            return;
        }
        screenManagerRef.current.receiveScreenDropped(droppedData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleWheel = useCallback((event: any) => {
        if (
            event.ctrlKey &&
            screenManagerRef.current.screenBibleManager.isShowing
        ) {
            event.stopPropagation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleScroll = useCallback((event: any) => {
        event.currentTarget.scrollTop = 0;
    }, []);
    return (
        <div
            key={screenManager.key}
            ref={cardRef}
            className={
                `mini-screen card ${selectedCN}` +
                (isFullView ? ` ${APP_FULL_VIEW_CLASSNAME}` : '')
            }
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
            <ScreenPreviewerHeaderComp
                isFullView={isFullView}
                setIsFullView={setIsFullView}
            />
            <div
                className="mini-screen-preview-body w-100 app-overflow-hidden"
                style={{
                    height: `${height}px`,
                }}
                onScroll={handleScroll}
            >
                <div
                    ref={previewFitRef}
                    className="mini-screen-preview-fit"
                    style={{
                        width: '100%',
                        height: '100%',
                        aspectRatio: `${screenManagerDim.width} / ${screenManagerDim.height}`,
                    }}
                >
                    <mini-screen-previewer-custom-html
                        screenId={screenManager.screenId}
                    />
                </div>
            </div>
            <ScreenPreviewerFooterComp />
        </div>
    );
}
