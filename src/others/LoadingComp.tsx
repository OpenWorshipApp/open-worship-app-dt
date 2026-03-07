import type { CSSProperties } from 'react';

import loading from '../assets/loading.gif';
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
            <img
                width={'80%'}
                src={loading}
                alt={`${tran('Loading')}...`}
                style={{
                    maxWidth: '30px',
                }}
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
