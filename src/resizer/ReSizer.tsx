import { Fragment, useState } from 'react';
import { getSetting, setSetting } from '../helper/settingHelper';
import FlexResizer, { ResizerKindType } from './FlexResizer';

export type Size = { [key: string]: string };
export default function ReSizer({
    settingName,
    flexSizeDefault,
    resizerKinds,
    sizeKeys,
    children,
}: {
    settingName: string,
    flexSizeDefault: Size,
    resizerKinds: ResizerKindType[],
    sizeKeys: [string, string, any?][],
    children: any[],
}) {
    const [flexSize, setFlexSize] = useState(getFlexSizeSetting(settingName, flexSizeDefault));
    return (
        <>
            {sizeKeys.map(([key, classList, style = {}], i) => {
                return (
                    <Fragment key={i}>
                        {i !== 0 && <FlexResizer
                            checkSize={() => {
                                const size = saveSize(settingName);
                                setFlexSize(size);
                            }}
                            type={resizerKinds[i - 1]} />}
                        <div data-fs={key} data-fs-default={flexSize[key]}
                            className={classList}
                            style={{ flex: flexSize[key] || 1, ...style }}>
                            {children[i]}
                        </div>
                    </Fragment>
                );
            })}
        </>
    );
}

const saveSize = (settingName: string) => {
    const size: Size = {};
    const rowItems: HTMLDivElement[] = Array.from(document.querySelectorAll('[data-fs]'));
    rowItems.forEach((item) => {
        size[item.getAttribute('data-fs') as string] = item.style.flex;
    });
    setSetting(settingName, JSON.stringify(size));
    return size;
};

function getFlexSizeSetting(settingName: string, defaultSize: Size): Size {
    const sizeStr = getSetting(settingName);
    try {
        const size = JSON.parse(sizeStr);
        if (Object.keys(defaultSize).every((k) => size[k] !== undefined)) {
            return size;
        }
    } catch (error) {
        setSetting(settingName, JSON.stringify(defaultSize));
    }
    return defaultSize;
}