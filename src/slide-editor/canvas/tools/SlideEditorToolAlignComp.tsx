import type { VAlignmentType, HAlignmentType } from '../canvasHelpers';

type AlignmentDataType = {
    verticalAlignment?: VAlignmentType;
    horizontalAlignment?: HAlignmentType;
};

function RendElementComp({
    iconClassname,
    dataKey,
    value,
    data = {},
    onData,
}: Readonly<{
    iconClassname: string;
    dataKey: string;
    value: string;
    data?: { [key: string]: string };
    onData: (data: { [key: string]: string }) => void;
}>) {
    const isOld = data[dataKey] === value;
    return (
        <button
            className={`btn btn-sm btn-${isOld ? '' : 'outline-'}info`}
            disabled={isOld}
            onClick={() => {
                onData({ [dataKey]: value });
            }}
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
    elements: [string, string][];
    dataKey: string;
    data: AlignmentDataType;
    onData: (data: AlignmentDataType) => void;
}>) {
    return elements.map(([iconClassname, value]) => {
        return (
            <RendElementComp
                key={iconClassname}
                iconClassname={iconClassname}
                dataKey={dataKey}
                value={value}
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
        <div className="d-flex">
            <div>
                {genElements({
                    elements: [
                        ['bi-align-top', 'start'],
                        ['bi-align-middle', 'center'],
                        ['bi-align-bottom', 'end'],
                    ],
                    dataKey: 'verticalAlignment',
                    data,
                    onData,
                })}
            </div>
            {isText ? (
                <div>
                    {genElements({
                        elements: [
                            ['bi-text-left', 'left'],
                            ['bi-text-center', 'center'],
                            ['bi-text-right', 'right'],
                        ],
                        dataKey: 'horizontalAlignment',
                        data,
                        onData,
                    })}
                </div>
            ) : (
                <div>
                    {genElements({
                        elements: [
                            ['bi-align-start', 'left'],
                            ['bi-align-center', 'center'],
                            ['bi-align-end', 'right'],
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
