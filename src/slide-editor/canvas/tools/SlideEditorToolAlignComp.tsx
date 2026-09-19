import { useCallback } from 'react';

import type { VAlignmentType, HAlignmentType } from '../canvasHelpers';
import { useAppCurrentRef } from '../../../helper/appHooks';
import { tran } from '../../../lang/langHelpers';

type AlignmentDataType = {
    verticalAlignment?: VAlignmentType;
    horizontalAlignment?: HAlignmentType;
};

function RendElementComp({
    iconClassname,
    dataKey,
    value,
    label,
    data = {},
    onData,
}: Readonly<{
    iconClassname: string;
    dataKey: string;
    value: string;
    label: string;
    data?: { [key: string]: string };
    onData: (data: { [key: string]: string }) => void;
}>) {
    const isOld = data[dataKey] === value;
    const onDataRef = useAppCurrentRef(onData);
    const dataKeyRef = useAppCurrentRef(dataKey);
    const valueRef = useAppCurrentRef(value);
    const handleClick = useCallback(() => {
        onDataRef.current({ [dataKeyRef.current]: valueRef.current });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={`btn btn-sm btn-${isOld ? '' : 'outline-'}info`}
            disabled={isOld}
            title={label}
            aria-label={label}
            onClick={handleClick}
        >
            <i className={'bi ' + iconClassname} />
        </button>
    );
}

function genElements({
    elements,
    dataKey,
    data,
    onData,
}: Readonly<{
    elements: [string, string, string][];
    dataKey: string;
    data: AlignmentDataType;
    onData: (data: AlignmentDataType) => void;
}>) {
    return elements.map(([iconClassname, value, label]) => {
        return (
            <RendElementComp
                key={iconClassname}
                iconClassname={iconClassname}
                dataKey={dataKey}
                value={value}
                label={label}
                data={data}
                onData={onData}
            />
        );
    });
}

export default function SlideEditorToolAlignComp({
    onData,
    data = {},
    isText,
}: Readonly<{
    data?: AlignmentDataType;
    onData: (data: AlignmentDataType) => void;
    isText?: boolean;
}>) {
    return (
        <div className="d-flex flex-wrap gap-2">
            <div
                className="btn-group btn-group-sm"
                role="group"
                aria-label={tran('Vertical alignment')}
            >
                {genElements({
                    elements: [
                        ['bi-align-top', 'start', tran('Align top')],
                        ['bi-align-middle', 'center', tran('Align middle')],
                        ['bi-align-bottom', 'end', tran('Align bottom')],
                    ],
                    dataKey: 'verticalAlignment',
                    data,
                    onData,
                })}
            </div>
            {isText ? (
                <div
                    className="btn-group btn-group-sm"
                    role="group"
                    aria-label={tran('Horizontal alignment')}
                >
                    {genElements({
                        elements: [
                            ['bi-text-left', 'left', tran('Text align left')],
                            [
                                'bi-text-center',
                                'center',
                                tran('Text align center'),
                            ],
                            [
                                'bi-text-right',
                                'right',
                                tran('Text align right'),
                            ],
                        ],
                        dataKey: 'horizontalAlignment',
                        data,
                        onData,
                    })}
                </div>
            ) : (
                <div
                    className="btn-group btn-group-sm"
                    role="group"
                    aria-label={tran('Horizontal alignment')}
                >
                    {genElements({
                        elements: [
                            ['bi-align-start', 'left', tran('Align left')],
                            ['bi-align-center', 'center', tran('Align center')],
                            ['bi-align-end', 'right', tran('Align right')],
                        ],
                        dataKey: 'horizontalAlignment',
                        data,
                        onData,
                    })}
                </div>
            )}
        </div>
    );
}
