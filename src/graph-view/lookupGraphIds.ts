/**
 * Identifiers for the lookup graph source, split out from the source itself so
 * the EAGER surfaces can name it without pulling the source in.
 *
 * The context-menu item and the detail-panel button both live in chunks that
 * load before any graph is opened; they only need to say WHICH source to open,
 * and `lookupGraphSource` reaches `bible-note` types, the lookup helpers and
 * the path finder that none of them should carry.
 */
export const LOOKUP_GRAPH_SOURCE_ID = 'location-name';

export const LOOKUP_NODE_KIND = {
    NAME: 'name',
    LOCATION: 'location',
} as const;
