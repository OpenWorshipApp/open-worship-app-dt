import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';
import {
    showAppConfirm,
    showAppInput,
} from '../popup-widget/popupWidgetHelpers';
import type { GraphSourceType, GraphViewType } from './core';
import GraphPathBarComp from './GraphPathBarComp';
import { deletePreset, getPresetList, savePreset } from './graphPresetHelpers';
import { getGraphEngine } from './graphViewStore';

/**
 * The strip above the canvas: relation filters, and the path finder when it is
 * open.
 *
 * The view controls do NOT live here — they float over the canvas itself
 * (`GraphDockComp`), which keeps this row to one job and gives the graph the
 * full height of the panel.
 *
 * The chips double as the edge legend: one control that says both what is shown
 * and what each colour means, instead of a separate key taking more space.
 */
export default function GraphToolbarComp<TContext>({
    graph,
    source,
    context,
    onSaveImage,
    onPrint,
    viewportRef,
}: Readonly<{
    graph: GraphViewType;
    source: GraphSourceType<TContext>;
    context: TContext;
    onSaveImage: () => void;
    onPrint: () => void;
    viewportRef: RefObject<HTMLDivElement | null>;
}>) {
    const engine = getGraphEngine();
    const canFindPath = source.findPath !== undefined;
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Tracked from the event, not from our own click: the user can leave
    // fullscreen with Escape, and a local flag would then be lying.
    useEffect(() => {
        const handleChange = () => {
            const element = viewportRef.current?.closest('.floating-widget');
            setIsFullscreen(
                element !== null &&
                    element !== undefined &&
                    globalThis.document.fullscreenElement === element,
            );
        };
        globalThis.document.addEventListener('fullscreenchange', handleChange);
        return () => {
            globalThis.document.removeEventListener(
                'fullscreenchange',
                handleChange,
            );
        };
    }, [viewportRef]);

    const handleToggleFullscreen = useCallback(() => {
        const element = viewportRef.current?.closest('.floating-widget');
        if (!(element instanceof HTMLElement)) {
            return;
        }
        if (globalThis.document.fullscreenElement === element) {
            globalThis.document.exitFullscreen().catch(() => {
                // Nothing useful to do if the browser refuses; the button state
                // follows `fullscreenchange` either way.
            });
            return;
        }
        element.requestFullscreen().catch(() => {
            // Same.
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Asks for a preset name.
     *
     * `showAppInput` resolves a boolean and leaves the value to the caller, so
     * the current text is tracked in a ref the body writes to.
     */
    const nameRef = useRef('');
    const handleSavePreset = useCallback(() => {
        nameRef.current = graph.title;
        showAppInput(
            tran('Save preset'),
            <input
                className="form-control"
                defaultValue={graph.title}
                onChange={(event) => {
                    nameRef.current = event.target.value;
                }}
            />,
            { escToCancel: true, enterToOk: true },
        )
            .then((isConfirmed) => {
                if (isConfirmed) {
                    savePreset(nameRef.current, graph);
                }
            })
            .catch(handleError);
    }, [graph]);

    const handleShowMenu = useCallback(
        (event: MouseEvent) => {
            const presetList = getPresetList();
            const itemList: ContextMenuItemType[] = [
                {
                    menuElement: tran('Save as image'),
                    childBefore: genContextMenuItemIcon('image'),
                    onSelect: onSaveImage,
                },
                {
                    menuElement: tran('Print'),
                    childBefore: genContextMenuItemIcon('printer'),
                    onSelect: onPrint,
                },
                {
                    menuElement: tran('Save preset'),
                    childBefore: genContextMenuItemIcon('bookmark-plus'),
                    onSelect: handleSavePreset,
                },
                ...presetList.map((preset): ContextMenuItemType => {
                    return {
                        menuElement: preset.name,
                        childBefore: genContextMenuItemIcon('bookmark'),
                        onSelect: () => {
                            // Restoring REPLACES the graph for that record
                            // rather than opening a second panel for it.
                            const engineNow = getGraphEngine();
                            engineNow.restore([
                                ...engineNow.getSnapshot().filter((item) => {
                                    return item.key !== preset.graph.key;
                                }),
                                preset.graph,
                            ]);
                        },
                    };
                }),
                ...(presetList.length === 0
                    ? []
                    : [
                          {
                              menuElement: tran('Delete preset'),
                              childBefore: genContextMenuItemIcon('trash'),
                              onSelect: () => {
                                  showAppConfirm(
                                      tran('Delete preset'),
                                      presetList
                                          .map((preset) => {
                                              return preset.name;
                                          })
                                          .join(', '),
                                  )
                                      .then((isConfirmed) => {
                                          if (!isConfirmed) {
                                              return;
                                          }
                                          for (const preset of presetList) {
                                              deletePreset(preset.name);
                                          }
                                      })
                                      .catch(handleError);
                              },
                          } as ContextMenuItemType,
                      ]),
            ];
            showAppContextMenu(event, itemList);
        },
        [onSaveImage, onPrint, handleSavePreset],
    );

    const fullscreenLabel = isFullscreen
        ? tran('Exit fullscreen')
        : tran('Fullscreen');
    return (
        <div className="graph-view__toolbar">
            <div className="graph-view__chips">
                {source.relationDefList.map((definition) => {
                    const isHidden = graph.hiddenRelationList.includes(
                        definition.kind,
                    );
                    return (
                        <button
                            key={definition.kind}
                            type="button"
                            className={[
                                'graph-view__chip',
                                `graph-view__chip--${definition.styleKey}`,
                                isHidden ? 'graph-view__chip--off' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            aria-pressed={!isHidden}
                            title={
                                `${tran(definition.label)} — ` +
                                tran('Right-click to show only this')
                            }
                            onClick={() => {
                                engine.toggleRelationHidden(
                                    graph.key,
                                    definition.kind,
                                );
                            }}
                            onContextMenu={(event) => {
                                // Solo: everything else off in one gesture, and
                                // the same gesture again puts them all back.
                                event.preventDefault();
                                event.stopPropagation();
                                engine.soloRelation(
                                    graph.key,
                                    definition.kind,
                                    source.relationDefList,
                                );
                            }}
                        >
                            <span className="graph-view__chip-swatch" />
                            {tran(definition.label)}
                        </button>
                    );
                })}
            </div>
            {/* Panel-level chrome, kept in the corner away from the filters. */}
            <div className="graph-view__toolbar-actions">
                {canFindPath ? (
                    <button
                        type="button"
                        className="graph-view__tool-button"
                        aria-pressed={graph.isPathBarOpen}
                        title={tran('Find Connection')}
                        aria-label={tran('Find Connection')}
                        onClick={() => {
                            engine.setPathBarOpen(
                                graph.key,
                                !graph.isPathBarOpen,
                            );
                        }}
                    >
                        <i className="bi bi-signpost-split" />
                    </button>
                ) : null}
                <button
                    type="button"
                    className="graph-view__tool-button"
                    title={fullscreenLabel}
                    aria-label={fullscreenLabel}
                    onClick={handleToggleFullscreen}
                >
                    <i
                        className={`bi bi-${
                            isFullscreen
                                ? 'fullscreen-exit'
                                : 'arrows-angle-expand'
                        }`}
                    />
                </button>
                <button
                    type="button"
                    className="graph-view__tool-button"
                    title={tran('Presets')}
                    aria-label={tran('Presets')}
                    onClick={(event) => {
                        handleShowMenu(event.nativeEvent);
                    }}
                >
                    <i className="bi bi-three-dots" />
                </button>
            </div>
            {graph.isPathBarOpen && canFindPath ? (
                <GraphPathBarComp
                    graph={graph}
                    source={source}
                    context={context}
                    viewportRef={viewportRef}
                />
            ) : null}
        </div>
    );
}
