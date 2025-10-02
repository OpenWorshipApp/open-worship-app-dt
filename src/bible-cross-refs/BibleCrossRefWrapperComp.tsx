import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';

export default function BibleCrossRefWrapperComp({
    title,
    children,
    settingName,
    onRefresh,
}: Readonly<{
    title: React.ReactNode;
    children: React.ReactNode;
    settingName: string;
    onRefresh: () => void;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(settingName, true);
    const handleContextMenuOpening = (event: any) => {
        if (!isShowing) {
            return;
        }
        showAppContextMenu(event, [
            {
                menuElement: '`Refresh',
                onSelect: onRefresh,
            },
        ]);
    };
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
                onClick={() => {
                    setIsShowing(!isShowing);
                }}
                onContextMenu={handleContextMenuOpening}
            >
                <i
                    className={`bi bi-chevron-${isShowing ? 'down' : 'right'}`}
                />
                {title}
            </div>
            {isShowing ? (
                <div className="card-body app-inner-shadow px-1">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
