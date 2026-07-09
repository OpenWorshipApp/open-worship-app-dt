import { useCallback, type ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';
import { useAppCurrentRef } from '../helper/appHooks';

export default function BibleCrossRefWrapperComp({
    title,
    children,
    settingName,
    onRefresh,
}: Readonly<{
    title: ReactNode;
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
        <div
            className="card w-100 my-1"
            style={{
                border: '1px dotted var(--bs-info-text-emphasis)',
            }}
        >
            <div
                className="card-header app-ellipsis p-1 app-caught-hover-pointer"
                style={{
                    height: '2rem',
                }}
                onClick={handleToggleShowing}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={`bi bi-chevron-${isShowing ? 'down' : 'right'}`}
                />
                {title} (<span style={{ fontFamily }}>{bibleKey}</span>)
            </div>
            {isShowing ? (
                <div className="card-body app-inner-shadow px-1 d-flex flex-wrap gap-1">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
