import { tran } from '../lang/langHelpers';
import { GRAPH_PREVIEW_ICON_CLASS } from './graphContextMenuHelpers';
import { LOOKUP_GRAPH_SOURCE_ID } from './lookupGraphIds';
import { openGraphPreview } from './graphViewStore';

/**
 * The clickable icon that opens a record's graph, shown in the detail panel's
 * title bar beside the record's own icon.
 *
 * Kept deliberately light: this renders inside the EAGER detail-panel chunk,
 * so its import chain must not reach `lookupGraphSource`, the path finder or
 * anything that touches `bible-note`. Everything heavy lives behind the lazy
 * panel body.
 */
export default function OpenGraphPreviewButtonComp({
    kind,
    recordId,
    name,
}: Readonly<{
    kind: string;
    recordId: string;
    name: string;
}>) {
    const label = tran('Open Graph Preview');
    return (
        <button
            type="button"
            className={
                'floating-widget__button flex-shrink-0' +
                ' location-name-lookup__title-button'
            }
            title={label}
            aria-label={label}
            onClick={(event) => {
                // The title bar is the widget's drag surface; without this the
                // press would also start moving the panel.
                event.preventDefault();
                event.stopPropagation();
                openGraphPreview(LOOKUP_GRAPH_SOURCE_ID, {
                    kind,
                    recordId,
                    name,
                });
            }}
        >
            <i className={GRAPH_PREVIEW_ICON_CLASS} />
        </button>
    );
}
