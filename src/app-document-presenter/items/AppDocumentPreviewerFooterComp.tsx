import { useState } from 'react';

import { PathPreviewerComp } from '../../others/PathPreviewerComp';
import {
    MIN_THUMBNAIL_SCALE,
    MAX_THUMBNAIL_SCALE,
    THUMBNAIL_SCALE_STEP,
    selectSlide,
    useSelectedVaryAppDocumentContext,
    useSelectedAppDocumentSetterContext,
    VaryAppDocumentItemType,
    toKeyByFilePath,
} from '../../app-document-list/appDocumentHelpers';
import AppRangeComp from '../../others/AppRangeComp';
import { useAppDocumentItemThumbnailSizeScale } from '../../event/SlideListEventListener';
import appProvider from '../../server/appProvider';
import { showAppAlert } from '../../popup-widget/popupWidgetHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';

export const slidePreviewerMethods = {
    handleSlideItemSelected: (
        _viewIndex: number,
        _varyAppDocumentItem: VaryAppDocumentItemType,
    ) => {},
};

function HistoryPreviewerFooterComp() {
    const [selectedSlideItemHistories, setSelectedSlideItemHistories] =
        useState<[number, string][]>([]);
    useAppEffect(() => {
        slidePreviewerMethods.handleSlideItemSelected = (
            viewIndex: number,
            varyAppDocumentItem: VaryAppDocumentItemType,
        ) => {
            setSelectedSlideItemHistories((oldHistories) => {
                const newHistories = [
                    ...oldHistories,
                    [
                        viewIndex,
                        toKeyByFilePath(
                            varyAppDocumentItem.filePath,
                            varyAppDocumentItem.id,
                        ),
                    ],
                ];
                while (newHistories.length > 3) {
                    newHistories.shift();
                }
                return newHistories as [number, string][];
            });
        };
        return () => {
            slidePreviewerMethods.handleSlideItemSelected = (
                _viewIndex,
                _varyAppDocumentItem,
            ) => {};
        };
    }, []);
    return (
        <div className="history me-1">
            {selectedSlideItemHistories.map(([index, key], i) => {
                return (
                    <span
                        title={key}
                        key={key + i}
                        className="badge rounded-pill text-bg-info"
                    >
                        {index}
                    </span>
                );
            })}
        </div>
    );
}

export const defaultRangeSize = {
    size: MIN_THUMBNAIL_SCALE,
    min: MIN_THUMBNAIL_SCALE,
    max: MAX_THUMBNAIL_SCALE,
    step: THUMBNAIL_SCALE_STEP,
};
export default function AppDocumentPreviewerFooterComp() {
    const selectedVaryAppDocument = useSelectedVaryAppDocumentContext();
    const setSelectedSlide = useSelectedAppDocumentSetterContext();
    const [thumbnailSizeScale, setThumbnailSizeScale] =
        useAppDocumentItemThumbnailSizeScale();
    const handleSlideChoosing = async (event: any) => {
        const slide = await selectSlide(
            event,
            selectedVaryAppDocument.filePath,
        );
        if (slide === null) {
            showAppAlert(
                'No Slide Available',
                'No other slide found in the slide directory',
            );
        } else {
            setSelectedSlide(slide);
        }
    };
    return (
        <div className="card-footer w-100">
            <div className="d-flex w-100 h-100">
                <div className="flex-item">
                    <AppRangeComp
                        value={thumbnailSizeScale}
                        title="Slide Thumbnail Size Scale"
                        setValue={setThumbnailSizeScale}
                        defaultSize={defaultRangeSize}
                    />
                    <PathPreviewerComp
                        dirPath={selectedVaryAppDocument.filePath}
                        isShowingNameOnly
                        onClick={handleSlideChoosing}
                    />
                </div>
                {appProvider.isPagePresenter ? (
                    <div className="flex-item">
                        <HistoryPreviewerFooterComp />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
