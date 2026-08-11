import { createContext, use } from 'react';
import { type OpenLyric } from 'open-lyric';

import type Lyric from './Lyric';
import { notifyElementHighlight } from '../helper/domHelpers';
import { bringDomToCenterView } from '../helper/helpers';

class LyricManager {
    lyric: Lyric;
    private _openLyricPreviewer: OpenLyric;

    /**
     * The lyric previewer's own root — the element `LyricHandlerComp` renders,
     * holding BOTH the rendered song and the slide panes below it.
     *
     * Everything this class looks up in the DOM is scoped to it, because more
     * than one previewer can be mounted at a time (a floating preview of the
     * same `.owl`, or a second song) and they all render the same markup and
     * the same slide classes. Owned by the component, which clears it on
     * unmount.
     */
    containerElement: HTMLElement | null = null;

    /**
     * Called with the structure index of the verse whose section was clicked in
     * the rendered song. One slot rather than an app-wide event: the only thing
     * interested is the component that owns THIS previewer, and a broadcast
     * would have every other mounted previewer answer for it too.
     */
    onSectionSelected: ((index: number) => void) | null = null;

    constructor(lyric: Lyric, openLyricPreviewer: OpenLyric) {
        this.lyric = lyric;
        this._openLyricPreviewer = openLyricPreviewer;
        this.initLyricPreviewEvent();
    }

    get openLyricPreviewer() {
        return this._openLyricPreviewer;
    }
    set openLyricPreviewer(value: OpenLyric) {
        this._openLyricPreviewer.onRendered = null;
        this._openLyricPreviewer = value;
        this.initLyricPreviewEvent();
    }

    get previewPanel() {
        const panelElement =
            this.openLyricPreviewer.container?.querySelector(
                '.ol-song-view__sections',
            ) ?? null;
        return panelElement as HTMLElement | null;
    }

    // Public and idempotent (a plain assignment, re-run at no cost) so that
    // `destroy()` can be undone. The presenter renders under `StrictMode`,
    // which runs an effect's cleanup and then mounts it again — a one-shot
    // constructor-only install would leave the previewer un-clickable from the
    // second mount on.
    initLyricPreviewEvent() {
        this._openLyricPreviewer.onRendered = () => {
            const panelElement = this.previewPanel;
            if (panelElement === null) {
                return;
            }
            // One delegated listener and one inherited `cursor` for the whole
            // song, instead of a handler plus an inline style written onto
            // every section: this re-runs on EVERY render of the previewer
            // (each keystroke in the attached editor, each theme change), and a
            // long song is a hundred sections.
            panelElement.style.cursor = 'pointer';
            panelElement.onclick = (event) => {
                const { target } = event;
                if (!(target instanceof Node)) {
                    return;
                }
                const index = Array.from(panelElement.children).findIndex(
                    (child) => {
                        return child.contains(target);
                    },
                );
                if (index === -1) {
                    return;
                }
                this.onSectionSelected?.(index);
            };
        };
    }

    /**
     * Scrolls the rendered song to the section standing for structure index
     * `index`, and flashes it. A no-op for an index no section answers to (the
     * First/Info/None slides and the attachment slides, which carry `-1`).
     */
    notifyLyricElement(index: number) {
        const targetElement = this.previewPanel?.children.item(index) ?? null;
        if (targetElement === null) {
            return;
        }
        notifyElementHighlight(
            () => {
                return targetElement;
            },
            {
                moveToView: bringDomToCenterView,
            },
        );
    }

    /**
     * Releases what outlives this manager. The `OpenLyric` instance is handed
     * to the cached `LyricAppDocument`s, so a live `onRendered` closure would
     * keep this manager — and the container element it points at — reachable
     * long after the previewer that made it is gone.
     */
    destroy() {
        this._openLyricPreviewer.onRendered = null;
        this.onSectionSelected = null;
        this.containerElement = null;
    }

    get filePath() {
        return this.lyric.filePath;
    }

    get fileSource() {
        return this.lyric.fileSource;
    }
}
export default LyricManager;

export const LyricManagerContext = createContext<LyricManager | null>(null);

export function useLyricManagerContext() {
    const context = use(LyricManagerContext);
    if (context === null) {
        throw new Error(
            'useLyricManagerContext must be used within a ' +
                'LyricManagerProvider',
        );
    }
    return context;
}
