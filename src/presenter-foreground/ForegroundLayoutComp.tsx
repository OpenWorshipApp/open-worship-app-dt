import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { useStateSettingBoolean } from '../helper/settingHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ForegroundLayoutComp({
    target,
    fullChildHeaders,
    childHeadersOnHidden,
    extraHeaderStyle,
    extraHeaderClassName,
    children,
    extraBodyClassName,
    extraBodyStyle,
    isOnScreen = false,
}: Readonly<{
    target: string;
    fullChildHeaders?: ReactNode;
    extraHeaderStyle?: CSSProperties;
    extraHeaderClassName?: string;
    childHeadersOnHidden?: ReactNode;
    children?: ReactNode;
    extraBodyClassName?: string;
    extraBodyStyle?: CSSProperties;
    isOnScreen?: boolean;
}>) {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${target}-show-opened`,
        false,
    );
    const isOpenedRef = useAppCurrentRef(isOpened);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggleOpened = useCallback(() => {
        setIsOpenedRef.current(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="card m-2">
            <div
                className={'card-header d-flex' + (extraHeaderClassName ?? '')}
                style={extraHeaderStyle}
            >
                <div
                    className="d-flex app-ellipsis app-caught-hover-pointer flex-grow-1"
                    onClick={handleToggleOpened}
                >
                    <i
                        className={
                            'app-caught-hover-pointer bi bi-chevron-' +
                            (isOpened ? 'down' : 'right')
                        }
                    />
                    <div
                        className={
                            'd-flex align-items-center' +
                            (isOnScreen ? ' app-on-screen' : '')
                        }
                    >
                        {fullChildHeaders}
                    </div>
                </div>
                {isOpened ? null : (
                    <div className="d-flex">{childHeadersOnHidden}</div>
                )}
            </div>
            {isOpened ? (
                <div
                    className={
                        'card-body app-inner-shadow p-2 ' +
                        (extraBodyClassName ?? '')
                    }
                    style={extraBodyStyle}
                >
                    {children}
                </div>
            ) : null}
        </div>
    );
}
