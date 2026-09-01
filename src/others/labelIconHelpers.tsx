import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';

// Bootstrap-icon name for every user-visible title, keyed by the ENGLISH label
// key -- the very same key that is handed to `tran`, never the translated text
// (the Khmer text differs per locale). Keying by the English label is what
// makes one label always get the same icon wherever it is rendered: a tab bar,
// a collapsed resizable-widget title, a file-list card header, or the top nav.
// Never bake the `bi bi-*` markup into a `tran` key -- such a key is not in the
// dictionary and `tran` throws in dev.
export const LABEL_ICON_NAME_MAP: Record<string, string> = {
    // -- app documents / slides
    Documents: 'file-earmark-text',
    'Document List': 'list-ul',
    Slides: 'collection',
    'Slide Editor Canvas': 'bounding-box-circles',
    'Slide Editor Ground': 'bounding-box',
    // -- lyrics
    Lyrics: 'music-note-list',
    'Lyric List': 'music-note-list',
    'Stage Previewer': 'easel',
    Stage: 'easel2',
    // -- bible
    Bible: 'book',
    Bibles: 'book',
    'Bibles (Lookup)': 'book',
    'Bible View': 'book-half',
    'Bible and Notes': 'journal-bookmark',
    'Bible and Notes (Lookup)': 'journal-bookmark',
    'Bible Notes': 'journal-text',
    'Bible Notes (Lookup)': 'journal-text',
    Notes: 'journal-text',
    Note: 'sticky',
    'Bible Lookup': 'search',
    'Bible Online Lookup': 'cloud-arrow-down',
    Lookup: 'search',
    Find: 'search',
    'Cross Reference': 'signpost-split',
    'Location-Name (KJV)': 'geo-alt-fill',
    Resources: 'folder2-open',
    // -- backgrounds
    Background: 'card-image',
    'Background Audio': 'file-earmark-music',
    Colors: 'palette',
    Images: 'image',
    Videos: 'film',
    Cameras: 'camera-video',
    Webs: 'globe',
    Audios: 'music-note-beamed',
    // -- presenting
    Presenter: 'display',
    Foreground: 'layers',
    'Mini Screen': 'aspect-ratio',
    'Presenting Flows': 'collection-play',
    'Presenting Flow List': 'collection-play',
    // -- editors / tools
    Editor: 'code-square',
    Previewer: 'eye',
    Tools: 'tools',
    Properties: 'sliders',
    'Canvas Items': 'stack',
    General: 'gear',
    Others: 'three-dots',
    '(dev)Experiment': 'beaker',
    // -- layout panes
    'App Presenter Left': 'layout-sidebar',
    'App Presenter Middle': 'layout-split',
    'App Presenter Right': 'layout-sidebar-reverse',
    'App Editor Left': 'layout-sidebar',
    'App Editor Right': 'layout-sidebar-reverse',
};

export function getLabelIconName(labelKey: string): string | null {
    return LABEL_ICON_NAME_MAP[labelKey] ?? null;
}

// The icon element alone. Returns `null` for a label with no mapped icon so
// callers can drop it in unconditionally.
export function genLabelIcon(
    labelKey: string,
    className = 'px-1',
): ReactNode | null {
    const iconName = getLabelIconName(labelKey);
    if (iconName === null) {
        return null;
    }
    return <i className={`bi bi-${iconName} ${className}`} />;
}

// Translated label with its icon in front, for any `ReactNode` title slot
// (tab bars, card headers, top-nav tabs).
export function toIconedLabel(labelKey: string, className?: string): ReactNode {
    return (
        <>
            {genLabelIcon(labelKey, className)}
            {tran(labelKey)}
        </>
    );
}

// `DataInputType` name + icon pair for a resizable-widget pane. Spread it into
// the `dataInput` entry so the collapsed widget title shows the same icon as
// the tab/header for that label. `widgetName` stays a plain string because
// `RenderHiddenWidgetTitleComp` also interpolates it into a `title` attribute.
export function toWidgetLabel(labelKey: string): {
    widgetName: string;
    widgetKey: string;
    widgetIconName?: string;
} {
    return {
        widgetName: tran(labelKey),
        // The SAME pane, said in English. `widgetName` is translated, and a
        // panel that only answers to its Khmer name is a panel the help
        // chatbot cannot point at once the app is switched over -- while its
        // English key never moves.
        widgetKey: labelKey,
        widgetIconName: getLabelIconName(labelKey) ?? undefined,
    };
}
