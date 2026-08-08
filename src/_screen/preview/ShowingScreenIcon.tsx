import { genColorFromScreenId } from './screenIdColorHelpers';

// Re-exported from where it has always been imported: the colour itself had to
// move to a leaf module so the screen managers could reach it (see there).
export { genColorFromScreenId };

export default function ShowingScreenIconComp({
    screenId,
    onClick,
    title,
}: Readonly<{
    screenId: number;
    onClick?: (event: any, screenId: number) => void;
    title?: string;
}>) {
    const color = genColorFromScreenId(screenId);
    return (
        <span
            className={
                'd-flex align-items-center px-1' +
                ` ${onClick ? 'app-caught-hover-pointer' : ''}`
            }
            title={title ?? `Screen: ${screenId}`}
            data-screen-id={screenId}
            onClick={
                onClick
                    ? (event: any) => {
                          onClick(event, screenId);
                      }
                    : undefined
            }
        >
            <span
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                }}
            >
                <i
                    className="bi bi-collection"
                    style={{ color, fontSize: '1.8em', opacity: 0.3 }}
                    data-screen-icon-id={screenId}
                />
                <span
                    style={{
                        position: 'absolute',
                        top: '58%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color,
                        fontSize: '1.05em',
                        lineHeight: 1,
                    }}
                >
                    {screenId}
                </span>
            </span>
        </span>
    );
}
