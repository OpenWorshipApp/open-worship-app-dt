import { useStateSettingBoolean } from '../helper/settingHelpers';

export default function BibleRefWrapperComp({
    title,
    children,
    settingName,
}: Readonly<{
    title: string;
    children: React.ReactNode;
    settingName: string;
}>) {
    const [isShowing, setIsShowing] = useStateSettingBoolean(settingName, true);
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
