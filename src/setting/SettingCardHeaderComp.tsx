import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';

export default function SettingCardHeaderComp({
    iconClassName,
    title,
    children,
}: Readonly<{
    iconClassName: string;
    title: string;
    children?: ReactNode;
}>) {
    return (
        <div
            className={
                'card-header d-flex align-items-center' +
                (children ? ' justify-content-between' : '')
            }
        >
            <span className="d-flex align-items-center">
                <i className={`bi ${iconClassName} me-2`} />
                {tran(title)}
            </span>
            {children}
        </div>
    );
}
