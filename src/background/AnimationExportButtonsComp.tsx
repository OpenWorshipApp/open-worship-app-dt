import { useSyncExternalStore } from 'react';

import { tran } from '../lang/langHelpers';
import type { AnimationAgentPlaceType } from './animationAgentEditorRegistry';
import type { AnimationExportKindType } from './animationExportOptionHelpers';

/**
 * Save as Image and Save as Video beside Customize's picture of the draft,
 * in the Background tab's picker and Animation Show's alike. All the work
 * is in `animationExportHelpers`, loaded on the first press -- none of it
 * (a WebGL canvas, an encoder, an MP4 writer) is in the Presenter until a
 * person asks for a file. One save at a time across every picker: both
 * buttons everywhere wait while one runs.
 */

let isExporting = false;
const listenerSet = new Set<() => void>();

function setIsExporting(value: boolean) {
    isExporting = value;
    for (const listener of listenerSet) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listenerSet.add(listener);
    return () => {
        listenerSet.delete(listener);
    };
}

function getIsExporting() {
    return isExporting;
}

export async function runAnimationExport(
    src: string,
    place: AnimationAgentPlaceType,
    kind: AnimationExportKindType,
) {
    if (isExporting) {
        return;
    }
    setIsExporting(true);
    try {
        const { exportAnimation } = await import('./animationExportHelpers');
        await exportAnimation({ src, place, kind });
    } finally {
        setIsExporting(false);
    }
}

export default function AnimationExportButtonsComp({
    src,
    place,
}: Readonly<{ src: string; place: AnimationAgentPlaceType }>) {
    const isBusy = useSyncExternalStore(subscribe, getIsExporting);
    // The format in the name: a PNG keeps an overlay's see-through parts.
    const imageLabel = `${tran('Save as image')} (PNG)`;
    const videoLabel = `${tran('Save as video')} (MP4)`;
    return (
        <div className="animation-export-buttons">
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                title={imageLabel}
                aria-label={imageLabel}
                disabled={isBusy}
                onClick={() => {
                    void runAnimationExport(src, place, 'image');
                }}
            >
                <i className="bi bi-image" aria-hidden="true" />
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                title={videoLabel}
                aria-label={videoLabel}
                disabled={isBusy}
                onClick={() => {
                    void runAnimationExport(src, place, 'video');
                }}
            >
                <i className="bi bi-camera-reels" aria-hidden="true" />
            </button>
        </div>
    );
}
