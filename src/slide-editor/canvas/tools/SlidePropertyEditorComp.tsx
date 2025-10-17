import { useMemo, useState } from 'react';
import AppDocument from '../../../app-document-list/AppDocument';
import { useSelectedEditingSlideContext } from '../../../app-document-list/appDocumentHelpers';
import RenderSlideIndexComp from '../../../app-document-presenter/items/RenderSlideIndexComp';
import { useAppStateAsync } from '../../../helper/debuggerHelpers';
import { getDefaultScreenDisplay } from '../../../_screen/managers/screenHelpers';
import { showAppConfirm } from '../../../popup-widget/popupWidgetHelpers';
import Slide from '../../../app-document-list/Slide';
import { useFileSourceEvents } from '../../../helper/dirSourceHelpers';

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
    return (
        <div className="m-1 p-1 d-flex align-items-center">
            {name}:
            <input
                className="form-control form-control-sm"
                type="number"
                style={{
                    maxWidth: '70px',
                }}
                value={value}
                onChange={(e) => {
                    const newValue = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(newValue)) {
                        setValue(newValue);
                    }
                }}
            />
            px
        </div>
    );
}

function RenderDimEditComp() {
    const slide = useSelectedEditingSlideContext();
    const [width, setWidth] = useState(slide.metadata.width);
    const [height, setHeight] = useState(slide.metadata.height);
    const hasChanged = useMemo(() => {
        return (
            width !== slide.metadata.width || height !== slide.metadata.height
        );
    }, [width, height, slide]);
    const isScreenDiff = useMemo(() => {
        const { bounds } = getDefaultScreenDisplay();
        return width !== bounds.width || height !== bounds.height;
    }, [width, height, slide]);
    const isDiffOther = useIsDiffOtherSlides(slide, width, height);
    const applyDim = async (
        newWidth: number,
        newHeight: number,
        isAll = false,
    ) => {
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
    };
    return (
        <div className="d-flex flex-column">
            <div className="d-flex flex-wrap">
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
            <div>
                {hasChanged ? (
                    <button
                        className="btn btn-primary btn-sm m-1"
                        title="`Apply changed dimension to this slide"
                        onClick={() => {
                            applyDim(width, height);
                        }}
                    >
                        `Apply
                    </button>
                ) : null}
                {isScreenDiff ? (
                    <button
                        className="btn btn-primary btn-sm m-1"
                        title="`Reset to default display dimension"
                        onClick={() => {
                            const { bounds } = getDefaultScreenDisplay();
                            if (
                                bounds.width !== slide.metadata.width ||
                                bounds.height !== slide.metadata.height
                            ) {
                                applyDim(bounds.width, bounds.height);
                            }
                        }}
                    >
                        `Reset
                    </button>
                ) : null}
                {isDiffOther ? (
                    <button
                        className="btn btn-danger btn-sm m-1"
                        title="`Apply this dimension to all slides in this document"
                        onClick={async () => {
                            const isConfirmed = await showAppConfirm(
                                '`This will change all Slides',
                                '`Are you sure to apply this dimension to all slides?',
                            );
                            if (!isConfirmed) {
                                return;
                            }
                            applyDim(width, height, true);
                        }}
                    >
                        `Apply All Slides
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function RenderNameEditorComp() {
    const slide = useSelectedEditingSlideContext();
    const [name, setName] = useState(slide.name);
    const hasChanged = useMemo(() => {
        return name !== slide.name;
    }, [name, slide]);
    const handleNameChanging = () => {
        const appDocument = AppDocument.getInstance(slide.filePath);
        slide.name = name;
        appDocument.updateSlide(slide);
    };
    return (
        <div className="m-1 p-1 d-flex align-items-center">
            Name:
            <input
                className="form-control form-control-sm"
                type="text"
                placeholder="name"
                style={{
                    maxWidth: '200px',
                }}
                value={name}
                onChange={(e) => {
                    setName(e.target.value);
                }}
            />
            {hasChanged ? (
                <button
                    className="btn btn-primary btn-sm m-1"
                    title="`Apply changed name to this slide"
                    onClick={handleNameChanging}
                >
                    `Apply
                </button>
            ) : null}
        </div>
    );
}

export default function SlidePropertyEditorComp() {
    const slide = useSelectedEditingSlideContext();
    const [index] = useAppStateAsync(() => {
        const appDocument = AppDocument.getInstance(slide.filePath);
        return appDocument.getSlideIndex(slide);
    }, [slide]);
    return (
        <div className="m-1 app-border-white-round">
            <div className="d-flex flex-wrap">
                <div className="d-flex flex-row m-1 p-1">
                    Index:
                    <RenderSlideIndexComp viewIndex={index ?? -1} />
                </div>
                <div className="m-1 p-1 app-border-white-round">
                    Id: {slide.id}
                </div>
                <RenderNameEditorComp />
            </div>
            <RenderDimEditComp />
        </div>
    );
}
