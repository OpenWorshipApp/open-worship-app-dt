import { bringDomToNearestView } from '../helper/helpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';

export default function ForegroundLayoutComp({
    target,
    fullChildHeaders,
    childHeadersOnHidden,
    extraHeaderStyle,
    extraHeaderClassName,
    children,
    extraBodyClassName,
    extraBodyStyle,
}: Readonly<{
    target: string;
    fullChildHeaders?: React.ReactNode;
    extraHeaderStyle?: React.CSSProperties;
    extraHeaderClassName?: string;
    childHeadersOnHidden?: React.ReactNode;
    children?: React.ReactNode;
    extraBodyClassName?: string;
    extraBodyStyle?: React.CSSProperties;
}>) {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${target}-show-opened`,
        false,
    );
    return (
        <div className="card m-2">
            <div
                className={'card-header d-flex' + (extraHeaderClassName ?? '')}
                style={extraHeaderStyle}
            >
                <div
                    className="d-flex app-ellipsis app-caught-hover-pointer flex-grow-1"
                    onClick={() => {
                        setIsOpened(!isOpened);
                    }}
                >
                    <i
                        className={
                            'app-caught-hover-pointer bi bi-chevron-' +
                            (isOpened ? 'down' : 'right')
                        }
                    />
                    {fullChildHeaders}
                </div>
                {!isOpened ? (
                    <div className="d-flex">{childHeadersOnHidden}</div>
                ) : null}
            </div>
            {isOpened ? (
                <div
                    className={
                        'card-body app-inner-shadow p-2 ' +
                        (extraBodyClassName ?? '')
                    }
                    ref={(div) => {
                        if (div !== null) {
                            bringDomToNearestView(div);
                        }
                    }}
                    style={extraBodyStyle}
                >
                    {children}
                </div>
            ) : null}
        </div>
    );
}
