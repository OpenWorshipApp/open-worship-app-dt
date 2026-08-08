import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import ScreenBibleTextShadow from './ScreenBibleTextShadow';
import ScreenBibleAppearanceComp from './ScreenBibleAppearanceComp';

function RenderCardComp({
    title,
    children,
}: Readonly<{
    title: string;
    children: ReactNode;
}>) {
    return (
        <div className="card app-border-white-round p-1 m-1">
            <div
                className="card-header p-0"
                style={{
                    height: '30px',
                }}
            >
                {title}
            </div>
            <div className="card-body">{children}</div>
        </div>
    );
}

export default function BibleCustomStyleComp() {
    return (
        <div className="card w-100 h-100">
            <div className="card-body">
                <RenderCardComp title={tran('Appearance')}>
                    <ScreenBibleAppearanceComp />
                </RenderCardComp>
                <RenderCardComp title={tran('Text Shadow')}>
                    <ScreenBibleTextShadow />
                </RenderCardComp>
            </div>
        </div>
    );
}
