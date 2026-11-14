import './LoadingComp.css';

import type { CSSProperties } from 'react';

import { tran } from '../lang/langHelpers';

export default function LoadingComp({
    message,
    style,
}: Readonly<{
    message?: string | null;
    style?: CSSProperties;
}>) {
    return (
        <div
            className="d-flex flex-wrap w-100 h-100 justify-content-center align-items-center"
            style={style}
        >
            <span
                className="app-loading-spinner"
                role="img"
                aria-label={`${tran('Loading')}...`}
            />
            {message ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '5px',
                    }}
                >
                    {message}
                </div>
            ) : null}
        </div>
    );
}
