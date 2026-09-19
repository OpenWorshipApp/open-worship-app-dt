import './AppDocumentPreviewerFooterComp.scss';

import { useCallback, useState } from 'react';

import { PathPreviewerComp } from '../../others/PathPreviewerComp';
import {
    selectSlide,
    useSelectedAppDocumentSetterContext,
    toKeyByFilePath,
    useVaryAppDocumentContext,
    isInjectedAppDocumentFilePath,
} from '../../app-document-list/appDocumentHelpers';
import AppRangeComp from '../../others/AppRangeComp';
import { useVarySlideThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import appProvider from '../../server/appProvider';
import { showAppAlert } from '../../popup-widget/popupWidgetHelpers';
import { tran } from '../../lang/langHelpers';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    MIN_THUMBNAIL_SCALE,
    MAX_THUMBNAIL_SCALE,
    THUMBNAIL_SCALE_STEP,
} from '../../app-document-list/appDocumentTypeHelpers';
import RenderSlideIndexComp from './RenderSlideIndexComp';
import { useThumbnailScaleSettingOptions } from './slidesPreviewerScopeHelpers';
import { checkIsVaryAppDocumentSwitchRefused } from '../../app-document-list/varyAppDocumentLockHelpers';

export const slidePreviewerMethods = {
    handleSlideItemSelected: (
        _viewIndex: number,
        _varySlide: VarySlideType,
    ) => {},
};

function HistoryPreviewerFooterComp() {
    const [selectedSlideItemHistories, setSelectedSlideItemHistories] =
        useState<[number, string][]>([]);
    useAppEffect(() => {
        slidePreviewerMethods.handleSlideItemSelected = (
            viewIndex: number,
            varySlide: VarySlideType,
        ) => {
            setSelectedSlideItemHistories((oldHistories) => {
                const newHistories = [
                    ...oldHistories,
                    [
                        viewIndex,
                        toKeyByFilePath(varySlide.filePath, varySlide.id),
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
                _varySlide,
            ) => {};
        };
    }, []);
    return (
        <div className="d-flex history me-1">
            {selectedSlideItemHistories.map(([index, itemKey], i) => {
                return (
                    <RenderSlideIndexComp
                        key={itemKey + i}
                        viewIndex={index}
                        dataKey={itemKey}
                        title={itemKey}
                    />
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
export default function AppDocumentPreviewerFooterComp({
    isDisableChanging,
    // `slidePreviewerMethods.handleSlideItemSelected` is one module-level slot
    // that the history strip claims on mount and clears on unmount, so a second
    // mounted strip steals it and closing that one leaves the first dead. A
    // floating preview opts out rather than fighting for the slot.
    shouldShowHistory = appProvider.isPagePresenter,
}: Readonly<{
    isDisableChanging?: boolean;
    shouldShowHistory?: boolean;
}>) {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const setSelectedAppDocument = useSelectedAppDocumentSetterContext();
    const thumbnailScaleSettingOptions = useThumbnailScaleSettingOptions();
    const [thumbnailSizeScale, setThumbnailSizeScale] =
        useVarySlideThumbnailSizeScale(thumbnailScaleSettingOptions);
    const selectedVaryAppDocumentRef = useAppCurrentRef(
        selectedVaryAppDocument,
    );
    const setSelectedAppDocumentRef = useAppCurrentRef(setSelectedAppDocument);
    const handleSlideChoosing = useCallback(async (event: any) => {
        // Checked before the menu opens: the funnel guard would only refuse
        // after the operator had already picked a file.
        if (
            checkIsVaryAppDocumentSwitchRefused(
                selectedVaryAppDocumentRef.current,
                null,
            )
        ) {
            return;
        }
        const slide = await selectSlide(
            event,
            selectedVaryAppDocumentRef.current.filePath,
        );
        if (slide === null) {
            showAppAlert(
                tran('No Slide Available'),
                tran('No other slide found in the slide directory'),
            );
        } else {
            setSelectedAppDocumentRef.current(slide);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="app-document-previewer-footer card-footer w-100 p-0"
            style={{
                height: '28px',
            }}
        >
            <div className="d-flex w-100 h-100">
                <div className="app-flex-item">
                    <AppRangeComp
                        value={thumbnailSizeScale}
                        title={tran('Slide Thumbnail Size Scale')}
                        setValue={setThumbnailSizeScale}
                        defaultSize={defaultRangeSize}
                    />
                    {isInjectedAppDocumentFilePath ? null : (
                        <PathPreviewerComp
                            dirOrFilePath={selectedVaryAppDocument.filePath}
                            isShowingNameOnly
                            onClick={
                                isDisableChanging
                                    ? undefined
                                    : handleSlideChoosing
                            }
                            canOpenFileExplorer
                            isFile
                        />
                    )}
                </div>
                {shouldShowHistory ? (
                    <div className="app-flex-item">
                        <HistoryPreviewerFooterComp />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
