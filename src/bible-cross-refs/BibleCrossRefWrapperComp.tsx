import { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';

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
    const [isShowing, setIsShowing] = useStateSettingBoolean(settingName, true);
    const handleContextMenuOpening = (event: any) => {
        if (!isShowing) {
            return;
        }
        showAppContextMenu(event, [
            {
                menuElement: tran('Refresh'),
                onSelect: onRefresh,
            },
        ]);
    };
    return (
        <div
            className="card w-100 my-1"
            style={{
                border: '1px dotted var(--bs-info-text-emphasis)',
                maxWidth: '400px',
            }}
        >
            <div
                className="card-header app-ellipsis p-1 app-caught-hover-pointer"
                style={{
                    height: '2rem',
                }}
                onClick={() => {
                    setIsShowing(!isShowing);
                }}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={`bi bi-chevron-${isShowing ? 'down' : 'right'}`}
                />
                {title} (<span data-bible-key={bibleKey}>{bibleKey}</span>)
            </div>
            {isShowing ? (
                <div className="card-body app-inner-shadow px-1">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
