import type { MouseEvent } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import { useAppEffectAsync, useAppCurrentRef } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import ScreenEffectManager from '../_screen/managers/ScreenEffectManager';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import SlideTransitionManager, {
    slideTransitionManager,
    type SlideTransitionMapType,
} from './SlideTransitionManager';
import {
    genTransitionMenuItem,
    getTransitionIconName,
    showTransitionOverrideDialog,
    toTransitionLabel,
    type TransitionInheritedType,
} from './TransitionOverrideComp';

/**
 * What a slides preview falls back to: the screen's `Slide:` effect.
 */
export function genSlidesPreviewInherited(): TransitionInheritedType {
    return {
        effect: ScreenEffectManager.getCommonEffectType('vary-app-document'),
        sourceLabel: tran('Screen setting'),
    };
}

/**
 * What one slide falls back to: its slides preview's own transition when it
 * has one, else the screen's.
 */
export function genSlideInherited(
    documentEffect: TransitionEffectType | undefined,
): TransitionInheritedType {
    if (documentEffect !== undefined) {
        return { effect: documentEffect, sourceLabel: tran('Slides preview') };
    }
    return genSlidesPreviewInherited();
}

/**
 * Opens the checkbox for a slide (`id`) or its whole slides preview (no `id`)
 * and saves what was chosen into the document's `.transition.json`.
 */
export async function openSlideTransitionDialog(
    filePath: string,
    id?: string | number,
) {
    const data = await slideTransitionManager.getAllTransitions(filePath);
    const isDocument = id === undefined;
    const result = await showTransitionOverrideDialog({
        title: isDocument
            ? tran('Slides preview transition')
            : tran('Slide transition'),
        value: data[slideTransitionManager.toKey(id)],
        inherited: isDocument
            ? genSlidesPreviewInherited()
            : genSlideInherited(data[slideTransitionManager.toKey()]),
        description: isDocument
            ? tran(
                  'Every slide of this document comes in with it, unless the slide has its own.',
              )
            : undefined,
    });
    if (result === null) {
        return;
    }
    await slideTransitionManager.setTransition(filePath, id, result.value);
}

/**
 * The document's `.transition.json`, read once per document through the
 * short-lived cache and re-read when the sidecar changes. `isEnabled` false
 * reads nothing: only the presenter offers the control, and the editor's
 * cards have no need of the badge.
 */
export function useSlideTransitionMap(
    filePath: string,
    isEnabled = appProvider.isPagePresenter,
) {
    const [data, setData] = useState<SlideTransitionMapType>();
    useAppEffectAsync(
        async (contextMethods) => {
            if (!isEnabled) {
                return;
            }
            const newData =
                await slideTransitionManager.getAllTransitions(filePath);
            contextMethods.setData(newData);
        },
        [filePath, isEnabled],
        { setData },
    );
    const handleFileUpdate = useCallback(() => {
        if (!isEnabled) {
            return;
        }
        slideTransitionManager.getAllTransitions(filePath).then(setData);
    }, [filePath, isEnabled]);
    useFileSourceEvents(
        ['update'],
        handleFileUpdate,
        [handleFileUpdate],
        SlideTransitionManager.genMetaDataFilePath(filePath),
    );
    return data;
}

export type SlideTransitionStateType = {
    own: TransitionEffectType | undefined;
    documentOwn: TransitionEffectType | undefined;
};

export function useSlideTransition(
    filePath: string,
    id: string | number,
): SlideTransitionStateType {
    const data = useSlideTransitionMap(filePath);
    return {
        own: data?.[slideTransitionManager.toKey(id)],
        documentOwn: data?.[slideTransitionManager.toKey()],
    };
}

/** A slide card's `Transition: …` row. Presenter only (it has a popup host). */
export function genSlideTransitionMenuItems(
    filePath: string,
    id: string | number,
    state: SlideTransitionStateType,
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        genTransitionMenuItem({
            value: state.own,
            inherited: genSlideInherited(state.documentOwn),
            onSelect: () => {
                openSlideTransitionDialog(filePath, id);
            },
        }),
    ];
}

/**
 * The slides preview's `Transition: …` row, for the previewer's own ⋮ and
 * right-click. The current state is read now, through the cache, because the
 * row has to say what the document does before it is chosen.
 */
export async function genDocumentTransitionMenuItems(
    filePath: string,
): Promise<ContextMenuItemType[]> {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    const data = await slideTransitionManager.getAllTransitions(filePath);
    return [
        genTransitionMenuItem({
            value: data[slideTransitionManager.toKey()],
            inherited: genSlidesPreviewInherited(),
            onSelect: () => {
                openSlideTransitionDialog(filePath);
            },
        }),
    ];
}

/**
 * The badge in a slide card's header while that slide has its OWN transition;
 * pressing it opens the same checkbox the menu row does.
 */
export function SlideTransitionIconComp({
    filePath,
    id,
    effect,
}: Readonly<{
    filePath: string;
    id: string | number;
    effect: TransitionEffectType | undefined;
}>) {
    const filePathRef = useAppCurrentRef(filePath);
    const idRef = useAppCurrentRef(id);
    const handleClicking = useCallback((event: MouseEvent) => {
        // The card behind it presents the slide on a click.
        event.stopPropagation();
        event.preventDefault();
        openSlideTransitionDialog(filePathRef.current, idRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (effect === undefined) {
        return null;
    }
    const title = `${tran('Transition')}: ${toTransitionLabel(effect)}`;
    return (
        <button
            type="button"
            className="btn btn-secondary btn-sm p-0 mx-1"
            title={title}
            aria-label={title}
            onClick={handleClicking}
            onContextMenu={handleClicking}
        >
            <i className={`bi bi-${getTransitionIconName(effect)}`} />
        </button>
    );
}
