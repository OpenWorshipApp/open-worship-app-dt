import { createContext, use } from 'react';
import { type OpenLyric } from 'open-lyric';

import type Lyric from './Lyric';
import { notifyElementHighlight } from '../helper/domHelpers';
import { bringDomToCenterView } from '../helper/helpers';

class LyricManager {
    lyric: Lyric;
    private readonly _openLyricPreviewer: OpenLyric;

    /**
     * The lyric previewer's own root — the element `LyricHandlerComp` renders,
     * holding BOTH the rendered song and the slide panes below it.
     *
     * Everything this class looks up in the DOM is scoped to it, because more
     * than one previewer can be mounted at a time (a floating preview of the
     * same `.owl`, or a second song) and they all render the same markup and
     * the same slide classes. It also carries the song's click delegation — see
     * `initLyricPreviewEvent`. Owned by the component, which clears it on
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

    get previewPanel() {
        const panelElement =
            this.openLyricPreviewer.container?.querySelector(
                '.ol-song-view__sections',
            ) ?? null;
        return panelElement as HTMLElement | null;
    }

    /**
     * Installs the song → slide click delegation.
     *
     * The listener sits on `containerElement` — the app's OWN element — and not
     * on the rendered `.ol-song-view__sections` panel, which open-lyric replaces
     * wholesale on every render (each keystroke in the attached editor, each
     * theme or font change, the context menu's Reload). open-lyric offers no
     * post-render hook to re-install it with, and one listener for the life of
     * the previewer is cheaper than re-writing a handler onto a hundred-section
     * song each time anyway. The panel is resolved when a click ARRIVES, so it
     * is always the markup currently on screen; the `cursor` affordance the
     * panel used to be given inline is a stylesheet rule for the same reason
     * (`LyricRenderPreviewBodyComp.scss`).
     *
     * Public and idempotent (a plain assignment, re-run at no cost) so that
     * `destroy()` can be undone. The presenter renders under `StrictMode`,
     * which runs an effect's cleanup and then mounts it again — a one-shot
     * constructor-only install would leave the previewer un-clickable from the
     * second mount on. It is also why the owning component calls this right
     * after it assigns `containerElement`: in the constructor there is no
     * element yet, and this is a no-op without one.
     */
    initLyricPreviewEvent() {
        const { containerElement } = this;
        if (containerElement === null) {
            return;
        }
        containerElement.onclick = (event) => {
            // The container holds the slide panes too, so most clicks reaching
            // here are not the song's. Both guards below settle that, and the
            // panel lookup only happens on a real click.
            const panelElement = this.previewPanel;
            const { target } = event;
            if (panelElement === null || !(target instanceof Node)) {
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
     * Re-feeds the previewer the song as it now stands on disk.
     *
     * The one place this belongs: the `OpenLyric` instance is SHARED — the
     * rendered song reads it, and every cached `LyricAppDocument` stage derives
     * its slides from it — so exactly one thing may decide when its text moves.
     * Reading it back per render instead (which `getOpenLyricPreviewer` briefly
     * did) makes open-lyric re-parse the whole song on the per-slide path.
     *
     * Assignment is skipped when the text has not actually changed: a `value`
     * write re-parses and re-renders regardless of whether anything differs.
     */
    async refreshOpenLyricContent() {
        const content = await this.lyric.getContent();
        if (this._openLyricPreviewer.value === content) {
            return;
        }
        this._openLyricPreviewer.value = content;
    }

    /**
     * Releases what outlives this manager. The delegated `onclick` closure holds
     * this manager, and the element it is written onto is the app's — it is NOT
     * torn down with the previewer's markup — so leaving it behind would keep
     * the manager, and the song it points at, reachable long after the component
     * that made it is gone.
     */
    destroy() {
        if (this.containerElement !== null) {
            this.containerElement.onclick = null;
        }
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
