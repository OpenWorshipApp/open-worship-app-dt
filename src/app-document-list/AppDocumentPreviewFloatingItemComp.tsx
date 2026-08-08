import './AppDocumentPreviewFloatingComp.scss';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { VaryAppDocumentPreviewerCardComp } from '../app-document-presenter/items/AppDocumentPreviewerComp';
import { ThumbnailScaleSettingContext } from '../app-document-presenter/items/slidesPreviewerScopeHelpers';
import FileSource from '../helper/FileSource';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { onSlideItemsKeyboardEvent } from '../slide-editor/slideEditingKeyboardEventHelpers';
import {
    SelectedEditingSlideContext,
    varyAppDocumentFromFilePath,
} from './appDocumentHelpers';
import type { SelectedSlideContextType } from './appDocumentHelpers';
import {
    closeAppDocumentPreviewFloating,
    DEFAULT_PREVIEW_THUMBNAIL_SCALE,
    toAppDocumentPreviewRectSettingName,
    toAppDocumentPreviewScaleSettingName,
} from './appDocumentPreviewFloatingHelpers';

// So a second widget opened before either has been moved does not land exactly
// on top of the first. It shifts the FIRST-EVER position only — once a widget
// has been dragged, its own persisted rect wins.
const WIDGET_STAGGER_STEP = 24;
const WIDGET_STAGGER_COUNT = 6;

export default function AppDocumentPreviewFloatingItemComp({
    filePath,
    index,
}: Readonly<{
    filePath: string;
    index: number;
}>) {
    const { theme } = useThemeSource();
    // Re-resolved on the file's own `update` event, exactly as the list row
    // does, so a save or a reload swaps in the fresh document instead of
    // leaving a stale one rendering.
    const [reloadCount, setReloadCount] = useState(0);
    const varyAppDocument = useMemo(() => {
        return varyAppDocumentFromFilePath(filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filePath, reloadCount]);
    useFileSourceEvents(
        ['update'],
        () => {
            setReloadCount((oldCount) => {
                return oldCount + 1;
            });
        },
        [],
        filePath,
    );

    // The app-wide editing context is bound to the SELECTED document, so a
    // Ctrl+V or a Ctrl+Z with this widget focused would land in the wrong file.
    // Same shape `layoutHelpers` builds for a non-editor page, bound to the
    // document this widget shows.
    const editingSlideContextValue = useMemo((): SelectedSlideContextType => {
        return {
            selectedSlideEditing: null,
            holdingSlides: [],
            setSelectedSlide: () => {},
            onSlideItemsKeyboardEvent: (event: any) => {
                onSlideItemsKeyboardEvent(
                    {
                        holdingSlides: [],
                        setHoldingSlides: () => {},
                        varyAppDocument,
                        selectedSlideEditing: null,
                    },
                    event,
                );
            },
        };
    }, [varyAppDocument]);

    const thumbnailScaleSetting = useMemo(() => {
        return {
            settingName: toAppDocumentPreviewScaleSettingName(filePath),
            defaultSize: DEFAULT_PREVIEW_THUMBNAIL_SCALE,
        };
    }, [filePath]);

    const handleClosing = useCallback(() => {
        closeAppDocumentPreviewFloating(filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fileSource = FileSource.getInstance(filePath);
    const staggerOffset = (index % WIDGET_STAGGER_COUNT) * WIDGET_STAGGER_STEP;
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={`${tran('Slides')}: ${fileSource.name}`}
                persistKey={toAppDocumentPreviewRectSettingName(filePath)}
                onClose={handleClosing}
                options={{
                    width: 620,
                    height: 520,
                    minWidth: 280,
                    minHeight: 220,
                    initialOffset: staggerOffset,
                    extraClassName: 'app-document-preview-floating',
                }}
            >
                <ThumbnailScaleSettingContext value={thumbnailScaleSetting}>
                    <SelectedEditingSlideContext
                        value={editingSlideContextValue}
                    >
                        <VaryAppDocumentPreviewerCardComp
                            varyAppDocument={varyAppDocument}
                            // The file name is a label here, not a document
                            // switcher: clicking it must not re-point the main
                            // panel.
                            isDisableChanging
                            // One module-level slot backs the history strip, so
                            // only the main panel's may claim it.
                            shouldShowHistory={false}
                            flexSizeNamePrefix="floating-preview-"
                        />
                    </SelectedEditingSlideContext>
                </ThumbnailScaleSettingContext>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
