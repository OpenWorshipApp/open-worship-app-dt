import './graphView.scss';

import { lazy } from 'react';
import { createPortal } from 'react-dom';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { tran } from '../lang/langHelpers';
import { useLookupLangPresentation } from '../location-name-lookup/lookupLangHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useThemeSource } from '../others/themeHelpers';
import type { GraphViewType } from './core';
import { GRAPH_PREVIEW_ICON_CLASS } from './graphContextMenuHelpers';
import { closeGraphPreview, useOpenGraphList } from './graphViewStore';
import { LOOKUP_GRAPH_SOURCE_ID } from './lookupGraphIds';

// Bigger than the detail panels because a graph is a picture rather than a
// column of text: at 760x540 a twenty-box fan had to be read at a third scale.
const GRAPH_PANEL_WIDTH = 940;
const GRAPH_PANEL_HEIGHT = 620;
// Each further panel is nudged down-left from the last, the way the detail
// panels cascade, so opening several graphs does not bury them on one spot.
const CASCADE_STEP = 28;

/**
 * Bodies are per SOURCE and loaded lazily.
 *
 * Each one acquires its own data — the lookup body reference-counts the
 * ~34MB lookup dataset — so a graph over some other source must never mount
 * this one. That is why the acquisition lives down here rather than in the
 * shell above it.
 */
const LazyLookupGraphBodyComp = lazy(() => {
    return import('./LookupGraphBodyComp');
});

function RenderGraphBodyComp({ graph }: Readonly<{ graph: GraphViewType }>) {
    if (graph.sourceId === LOOKUP_GRAPH_SOURCE_ID) {
        return (
            <AppSuspenseComp>
                <LazyLookupGraphBodyComp graph={graph} />
            </AppSuspenseComp>
        );
    }
    return <div className="p-3">{tran('Record not found')}</div>;
}

/**
 * The panel's title is the ROOT RECORD's name, so it is written in the source
 * dataset's language — but it renders in the widget CHROME, outside the body
 * that carries that font. Set here or a Khmer name falls back to whatever the
 * chrome happens to use.
 *
 * Resolved per source, mirroring the body switch below: the font a record is
 * written in is the source's business, and the shell must not assume the
 * lookup dataset's answer holds for the next one.
 */
function RenderGraphTitleComp({
    graph,
    fontFamily,
}: Readonly<{ graph: GraphViewType; fontFamily?: string }>) {
    return (
        <span
            className={
                'd-inline-flex align-items-center gap-2 text-truncate px-2'
            }
            style={{ fontFamily }}
        >
            <i className={GRAPH_PREVIEW_ICON_CLASS} />
            <span className="text-truncate">{graph.title}</span>
        </span>
    );
}

function RenderLookupGraphTitleComp({
    graph,
}: Readonly<{ graph: GraphViewType }>) {
    // Only the language PACK, never the dataset: the title must not be what
    // pulls 34MB of records into a window that has not opened a body yet.
    const { fontFamily } = useLookupLangPresentation();
    return <RenderGraphTitleComp graph={graph} fontFamily={fontFamily} />;
}

function RenderGraphPanelComp({
    graph,
    index,
}: Readonly<{ graph: GraphViewType; index: number }>) {
    return (
        <FloatingWidgetComp
            title={
                graph.sourceId === LOOKUP_GRAPH_SOURCE_ID ? (
                    <RenderLookupGraphTitleComp graph={graph} />
                ) : (
                    <RenderGraphTitleComp graph={graph} />
                )
            }
            onClose={() => {
                closeGraphPreview(graph.key);
            }}
            raiseToken={graph.raiseCount}
            options={{
                width: GRAPH_PANEL_WIDTH,
                height: GRAPH_PANEL_HEIGHT,
                minWidth: 360,
                minHeight: 280,
                initialOffset: index * CASCADE_STEP,
                extraClassName: 'graph-view-widget',
                // Opened from a name in verse text or from the lookup panel,
                // both of which live inside the Bible Lookup popup — which
                // would otherwise bury the graph the click just asked for.
                isAboveModal: true,
                // NEVER set this true: it flips the content's
                // `data-no-widget-drag` to "false", and then every node drag
                // and every pan would drag the whole widget instead.
                isBodyDraggable: false,
            }}
        >
            <RenderGraphBodyComp graph={graph} />
        </FloatingWidgetComp>
    );
}

export default function GraphViewPanelsComp() {
    const graphList = useOpenGraphList();
    const { theme } = useThemeSource();
    if (graphList.length === 0) {
        return null;
    }
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            {graphList.map((graph, index) => {
                return (
                    <RenderGraphPanelComp
                        key={graph.key}
                        graph={graph}
                        index={index}
                    />
                );
            })}
        </div>,
        document.body,
    );
}
