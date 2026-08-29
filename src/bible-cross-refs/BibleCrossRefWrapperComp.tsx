import { useCallback, type ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

/**
 * One source of cross references -- the bundled set, or a user's own OpenAI /
 * Anthropic key -- as a collapsible section.
 *
 * `note` is kept out of `title` on purpose: it is a control (it opens the page
 * explaining what the source's text costs you in accuracy), and a control
 * nested inside the collapse button could neither be reached by keyboard nor
 * clicked without swallowing the click.
 */
export default function BibleCrossRefWrapperComp({
    title,
    note,
    children,
    settingName,
    onRefresh,
}: Readonly<{
    title: ReactNode;
    note?: ReactNode;
    children: ReactNode;
    settingName: string;
    onRefresh: () => void;
}>) {
    const bibleKey = useBibleKeyContext();
    const fontFamily = useBibleFontFamily(bibleKey);
    const [isShowing, setIsShowing] = useStateSettingBoolean(settingName, true);
    const isShowingRef = useAppCurrentRef(isShowing);
    const onRefreshRef = useAppCurrentRef(onRefresh);
    const handleContextMenuOpening = useCallback((event: any) => {
        if (!isShowingRef.current) {
            return;
        }
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('arrow-clockwise'),
                menuElement: tran('Refresh'),
                onSelect: onRefreshRef.current,
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setIsShowingRef = useAppCurrentRef(setIsShowing);
    const handleToggleShowing = useCallback(() => {
        setIsShowingRef.current(!isShowingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-xref-card">
            <div
                className="app-xref-card-header"
                onContextMenu={handleContextMenuOpening}
            >
                <button
                    type="button"
                    className="app-xref-card-toggle"
                    aria-expanded={isShowing}
                    onClick={handleToggleShowing}
                >
                    <i
                        className={
                            'app-xref-card-chevron bi bi-chevron-' +
                            (isShowing ? 'down' : 'right')
                        }
                    />
                    <span className="app-xref-card-title">{title}</span>
                </button>
                <span
                    className="app-xref-card-key app-data"
                    style={{ fontFamily }}
                >
                    {bibleKey}
                </span>
                {note}
            </div>
            {isShowing ? (
                <div className="app-xref-card-body">{children}</div>
            ) : null}
        </div>
    );
}
