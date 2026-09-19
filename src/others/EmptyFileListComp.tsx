import { tran } from '../lang/langHelpers';
import type DirSource from '../helper/DirSource';
import { useAppStateAsync } from '../helper/appHooks';
import type { DirSourceContextMenuOptionsType } from './droppingFileHelpers';
import { genDirSourceContextMenuItems } from './droppingFileHelpers';

/**
 * The body of a list whose directory holds no file. It used to render nothing
 * at all, which left the only way in (right-click, or the `⋮` button) invisible
 * to anyone who did not already know about it. The very same items the context
 * menu is built from are rendered here as buttons, so an empty folder always
 * advertises what can be put in it.
 *
 * They are generated once per empty list — not per render and never for a list
 * that has files — so nothing is built for the common case of a filled list.
 */
export default function EmptyFileListComp({
    dirSource,
    contextMenuOptions,
}: Readonly<{
    dirSource: DirSource;
    contextMenuOptions: DirSourceContextMenuOptionsType;
}>) {
    const [menuItems] = useAppStateAsync(() => {
        return genDirSourceContextMenuItems(dirSource, contextMenuOptions);
    }, [dirSource.dirPath]);
    if (!menuItems?.length) {
        return null;
    }
    return (
        <div
            className="d-flex flex-fill flex-column align-items-center p-2"
            // `safe` so a short panel (the background tabs are ~4 rows tall)
            // scrolls to the first action instead of centering it out of reach.
            style={{ justifyContent: 'safe center' }}
        >
            <div className="pb-2" style={{ opacity: '0.5' }}>
                <i className="bi bi-folder2-open" />
                <span className="ps-1">{tran('This folder is empty')}</span>
            </div>
            <div
                className="d-flex flex-column w-100"
                // One action per row, reading like the menu they come from. The
                // cap keeps a wide list (the background tabs run the whole
                // window) from stretching them into banners.
                style={{ gap: '4px', maxWidth: '250px' }}
            >
                {menuItems.map((item, index) => {
                    return (
                        <button
                            key={item.id ?? index}
                            className={
                                'btn btn-sm btn-outline-info' +
                                ' d-flex align-items-center text-start'
                            }
                            title={item.title}
                            disabled={item.disabled}
                            onClick={(event) => {
                                item.onSelect?.(event.nativeEvent);
                            }}
                        >
                            {item.childBefore}
                            <span>{item.menuElement}</span>
                            {item.childAfter}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
