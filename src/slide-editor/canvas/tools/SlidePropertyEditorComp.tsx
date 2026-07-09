import './SlidePropertyEditorComp.scss';

import { type ChangeEvent, useCallback, useState } from 'react';

import { tran } from '../../../lang/langHelpers';
import AppDocument from '../../../app-document-list/AppDocument';
import { useSelectedEditingSlideContext } from '../../../app-document-list/appDocumentHelpers';
import RenderSlideIndexComp from '../../../app-document-presenter/items/RenderSlideIndexComp';
import { useAppStateAsync, useAppCurrentRef } from '../../../helper/appHooks';
import { getDefaultScreenDisplay } from '../../../_screen/managers/screenHelpers';
import { showAppConfirm } from '../../../popup-widget/popupWidgetHelpers';
import type Slide from '../../../app-document-list/Slide';
import { useFileSourceEvents } from '../../../helper/dirSourceHelpers';
import { ExpandChevron, useExpandToggle } from './useExpandToggle';

async function checkIsDiffOtherSlides(
    slide: Slide,
    width: number,
    height: number,
) {
    const appDocument = AppDocument.getInstance(slide.filePath);
    const slides = await appDocument.getSlides();
    return slides.some((slide1) => {
        return (
            !slide1.checkIsSame(slide) &&
            (slide1.metadata.width !== width ||
                slide1.metadata.height !== height)
        );
    });
}

function useIsDiffOtherSlides(slide: Slide, width: number, height: number) {
    const [isDiffOther, setIsDiffOther] = useAppStateAsync(() => {
        return checkIsDiffOtherSlides(slide, width, height);
    }, [slide, width, height]);
    useFileSourceEvents(
        ['update'],
        async () => {
            const isDiff = await checkIsDiffOtherSlides(slide, width, height);
            setIsDiffOther(isDiff);
        },
        [width, height, slide],
        slide.filePath,
    );
    return isDiffOther;
}

function RenderDimElementComp({
    name,
    value,
    setValue,
}: Readonly<{
    name: string;
    value: number;
    setValue: (value: number) => void;
}>) {
    const setValueRef = useAppCurrentRef(setValue);
    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const newValue = Number.parseInt(e.target.value, 10);
        if (!Number.isNaN(newValue)) {
            setValueRef.current(newValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="d-flex align-items-center gap-1">
            <label className="spe-label">{tran(name)}</label>
            <input
                className="form-control form-control-sm spe-dim-input"
                type="number"
                value={value}
                onChange={handleChange}
            />
            <span className="spe-unit">px</span>
        </div>
    );
}

function RenderDimEditComp() {
    const slide = useSelectedEditingSlideContext();
    const [width, setWidth] = useState(slide.metadata.width);
    const [height, setHeight] = useState(slide.metadata.height);
    const hasChanged =
        width !== slide.metadata.width || height !== slide.metadata.height;
    const { bounds: screenBounds } = getDefaultScreenDisplay();
    const isScreenDiff =
        width !== screenBounds.width || height !== screenBounds.height;
    const isDiffOther = useIsDiffOtherSlides(slide, width, height);
    const applyDim = useCallback(
        async (newWidth: number, newHeight: number, isAll = false) => {
            setWidth(newWidth);
            setHeight(newHeight);
            const appDocument = AppDocument.getInstance(slide.filePath);
            await appDocument.changeSlidesDimension(
                {
                    width: newWidth,
                    height: newHeight,
                },
                isAll ? undefined : slide,
            );
        },
        [slide],
    );
    const applyDimRef = useAppCurrentRef(applyDim);
    const widthRef = useAppCurrentRef(width);
    const heightRef = useAppCurrentRef(height);
    const handleApply = useCallback(() => {
        applyDimRef.current(widthRef.current, heightRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const slideRef = useAppCurrentRef(slide);
    const handleReset = useCallback(() => {
        const { bounds } = getDefaultScreenDisplay();
        if (
            bounds.width !== slideRef.current.metadata.width ||
            bounds.height !== slideRef.current.metadata.height
        ) {
            applyDimRef.current(bounds.width, bounds.height);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleApplyAll = useCallback(async () => {
        const isConfirmed = await showAppConfirm(
            tran('This will change all Slides'),
            tran('Are you sure to apply this dimension to all slides?'),
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isConfirmed) {
            return;
        }
        applyDimRef.current(widthRef.current, heightRef.current, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="spe-field d-flex flex-column">
            <div className="d-flex align-items-start gap-2">
                <label className="spe-label">{tran('Size')}</label>
                <div className="d-flex flex-column gap-1">
                    <RenderDimElementComp
                        name="Width"
                        value={width}
                        setValue={setWidth}
                    />
                    <RenderDimElementComp
                        name="Height"
                        value={height}
                        setValue={setHeight}
                    />
                </div>
            </div>
            {hasChanged || isScreenDiff || isDiffOther ? (
                <div className="spe-actions d-flex flex-wrap mt-2">
                    {hasChanged ? (
                        <button
                            className="btn btn-primary btn-sm"
                            title={tran(
                                'Apply changed dimension to this slide',
                            )}
                            onClick={handleApply}
                        >
                            {tran('Apply')}
                        </button>
                    ) : null}
                    {isScreenDiff ? (
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            title={tran('Reset to default display dimension')}
                            onClick={handleReset}
                        >
                            {tran('Reset')}
                        </button>
                    ) : null}
                    {isDiffOther ? (
                        <button
                            className="btn btn-outline-danger btn-sm"
                            title={tran(
                                'Apply this dimension to all slides in this' +
                                    ' document',
                            )}
                            onClick={handleApplyAll}
                        >
                            {tran('Apply All Slides')}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function RenderNameEditorComp() {
    const slide = useSelectedEditingSlideContext();
    const [name, setName] = useState(slide.name);
    const hasChanged = name !== slide.name;
    const slideRef = useAppCurrentRef(slide);
    const nameRef = useAppCurrentRef(name);
    const handleNameChanging = useCallback(() => {
        const appDocument = AppDocument.getInstance(slideRef.current.filePath);
        slideRef.current.name = nameRef.current;
        appDocument.updateSlide(slideRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    }, []);
    return (
        <div className="spe-field d-flex align-items-center">
            <label className="spe-label">{tran('Name')}</label>
            <input
                className="form-control form-control-sm"
                type="text"
                placeholder={tran('name')}
                style={{
                    maxWidth: '200px',
                }}
                value={name}
                onChange={handleNameChange}
            />
            {hasChanged ? (
                <button
                    className="btn btn-primary btn-sm"
                    title={tran('Apply changed name to this slide')}
                    onClick={handleNameChanging}
                >
                    {tran('Apply')}
                </button>
            ) : null}
        </div>
    );
}

export default function SlidePropertyEditorComp() {
    const slide = useSelectedEditingSlideContext();
    const { isExpanded, headerProps } = useExpandToggle(false);
    const [index] = useAppStateAsync(() => {
        const appDocument = AppDocument.getInstance(slide.filePath);
        return appDocument.getSlideIndex(slide);
    }, [slide]);
    return (
        <div className="slide-property-editor m-1 app-border-white-round">
            <div
                className="spe-header d-flex align-items-center justify-content-between px-2 py-1"
                {...headerProps}
            >
                <div className="d-flex align-items-center gap-2">
                    <ExpandChevron
                        isExpanded={isExpanded}
                        className="spe-toggle-icon"
                    />
                    <span className="spe-title">{tran('Slide')}</span>
                    <RenderSlideIndexComp
                        viewIndex={index ?? -1}
                        title={tran('Slide index')}
                    />
                </div>
                <span
                    className="spe-id badge text-bg-secondary"
                    title={tran('Slide Id')}
                >
                    ID {slide.id}
                </span>
            </div>
            {isExpanded ? (
                <div className="d-flex flex-column gap-2 p-2">
                    <RenderNameEditorComp />
                    <RenderDimEditComp />
                </div>
            ) : null}
        </div>
    );
}
