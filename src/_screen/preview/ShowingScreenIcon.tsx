import { freezeObject } from '../../helper/helpers';
import colorList from '../../others/color-list.json';

freezeObject(colorList);

const screenIdColorMap: Record<string, string> = {};
export function genColorFromScreenId(screenId: number) {
    if (screenIdColorMap[screenId]) {
        return screenIdColorMap[screenId];
    }
    const allColors = Object.values(colorList.main).concat(
        Object.values(colorList.extension),
    );
    const colorIndex = screenId % allColors.length;
    const color = allColors[colorIndex];
    screenIdColorMap[screenId] = color;
    return color;
}

export default function ShowingScreenIconComp({
    screenId,
}: Readonly<{
    screenId: number;
}>) {
    const color = genColorFromScreenId(screenId);
    return (
        <span
            className="d-flex align-items-center px-1"
            title={`Screen: ${screenId}`}
            data-screen-id={screenId}
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
