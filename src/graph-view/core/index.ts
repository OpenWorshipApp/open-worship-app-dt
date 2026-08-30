/**
 * The connection-graph core.
 *
 * Everything re-exported here is pure: no React, no DOM, and no import from
 * anywhere else in `src/`. This barrel is the seam the package would be cut
 * along if it is ever lifted out on its own, so keep the boundary honest —
 * app-facing glue belongs one directory up, not in here.
 */

export * from './geometry';
export * from './graphEngine';
export * from './graphModel';
export * from './pathFinder';
export * from './types';
export * from './viewport';
