import './Tools.scss';

import { ReactChild, useState } from 'react';
import { slideListEventListenerGlobal, useSlideBoxEditing } from '../event/SlideListEventListener';
import ColorPicker from '../others/ColorPicker';
import {
    HAlignmentEnum,
    HTML2ReactChild,
    VAlignmentEnum,
} from '../helper/slideHelper';
import { useStateSettingString } from '../helper/settingHelper';
import { useTranslation } from 'react-i18next';

export function tooling2BoxProps(toolingData: ToolingType, state: {
    parentWidth: number, parentHeight: number, width: number, height: number,
}) {
    const { box } = toolingData;
    const boxProps: { top?: number, left?: number } = {};
    if (box) {
        if (box.verticalAlignment === VAlignmentEnum.Top) {
            boxProps.top = 0;
        } else if (box.verticalAlignment === VAlignmentEnum.Center) {
            boxProps.top = (state.parentHeight - state.height) / 2;
        } else if (box.verticalAlignment === VAlignmentEnum.Bottom) {
            boxProps.top = state.parentHeight - state.height;
        }
        if (box.horizontalAlignment === HAlignmentEnum.Left) {
            boxProps.left = 0;
        } else if (box.horizontalAlignment === HAlignmentEnum.Center) {
            boxProps.left = (state.parentWidth - state.width) / 2;
        } else if (box.horizontalAlignment === HAlignmentEnum.Right) {
            boxProps.left = state.parentWidth - state.width;
        }
    }
    console.log(boxProps);

    return boxProps;
}

export type ToolingType = {
    text?: {
        color?: string,
        fontSize?: number,
        horizontalAlignment?: HAlignmentEnum,
        verticalAlignment?: VAlignmentEnum,
    }
    box?: {
        backgroundColor?: string,
        rotate?: number,
        horizontalAlignment?: HAlignmentEnum,
        verticalAlignment?: VAlignmentEnum,
        layerBack?: boolean,
        layerFront?: boolean,
    }
};

export default function Tools({ scale, applyScale, setScale, minScale, maxScale, scaleStep }: {
    scale: number, applyScale: (isUp: boolean) => void, setScale: (newScale: number) => void,
    minScale: number, maxScale: number, scaleStep: number
}) {
    const { t } = useTranslation();
    const [data, setData] = useState<HTML2ReactChild | null>(null);
    // t: text, b: box
    const [tabType, setTabType] = useStateSettingString('editor-tools-tab', 't');
    useSlideBoxEditing((newData) => {
        setData(newData);
    });
    return (
        <div className="tools d-flex flex-column w-100 h-100">
            <div className="tools-header d-flex">
                <ul className="nav nav-tabs ">
                    {[['t', 'Text'], ['b', 'Box']].map(([key, title], i) => {
                        return (<li key={i} className="nav-item">
                            <button className={`btn btn-link nav-link ${tabType === key ? 'active' : ''}`}
                                onClick={() => setTabType(key)}>
                                {t(title)}
                            </button>
                        </li>);
                    })}
                </ul>
                <div className='align-self-end flex-fill d-flex justify-content-end'>
                    <span>{scale.toFixed(1)}x</span>
                    <div style={{ maxWidth: '200px' }}>
                        <input type="range" className='form-range'
                            onChange={(e) => setScale(+e.target.value)}
                            min={minScale} max={maxScale} step={scaleStep}
                            value={scale} onWheel={(e) => applyScale(e.deltaY > 0)} />
                    </div>
                </div>
            </div>
            <div className='tools-body d-flex flex-row flex-fill'>
                {data && <>
                    {tabType === 't' && <ToolsText data={data} />}
                    {tabType === 'b' && <ToolsBackground data={data} />}
                </>}
            </div>
        </div>
    );
}
function ToolsText({ data }: { data: HTML2ReactChild }) {
    const [color, setColor] = useState<string>(data.color);
    const [fontSize, setFontSize] = useState<number>(data.fontSize);
    const onColorChange = (newColor: string) => {
        setColor(newColor);
        slideListEventListenerGlobal.tooling({ text: { color: newColor } });
    };
    const onFontSizeChange = (n: number) => {
        setFontSize(n);
        slideListEventListenerGlobal.tooling({ text: { fontSize: n } });
    };
    return (
        <div className='d-flex'>
            <Tool>
                <ColorPicker color={color} onColorChange={onColorChange} />
            </Tool>
            <Tool title='Text Alignment'>
                <Align isText onData={(newData) => slideListEventListenerGlobal.tooling({ text: newData })} />
            </Tool>
            <Tool title='Font Size'>
                <input className='form-control' type="number" style={{ maxWidth: '100px' }}
                    value={fontSize} onChange={(e) => onFontSizeChange(+e.target.value)} />
                <select className="form-select form-select-sm" value={fontSize}
                    onChange={(e) => {
                        onFontSizeChange(+e.target.value);
                    }} >
                    <option>--</option>
                    {Array.from({ length: 20 }, (_, i) => (i + 1) * 15)
                        .reverse().map((n, i) => {
                            return <option key={`${i}`} value={n}>{n}px</option>;
                        })}
                </select>
            </Tool>
            <Tool title='Rotate'>
                <button className='btn btn-info' onClick={() => {
                    slideListEventListenerGlobal.tooling({ box: { rotate: 0 } });
                }}
                >UnRotate</button>
            </Tool>
        </div>
    );
}
function ToolsBackground({ data }: { data: HTML2ReactChild }) {
    const [color, setColor] = useState<string>(data.backgroundColor);
    const onColorChange = (newColor: string) => {
        setColor(newColor);
        slideListEventListenerGlobal.tooling({ box: { backgroundColor: newColor } });
    };
    return (
        <>
            <Tool title='Background Color'>
                <ColorPicker color={color} onColorChange={onColorChange} />
            </Tool>
            <Tool title='Box Alignment'>
                <Align onData={(newData) => {
                    slideListEventListenerGlobal.tooling({ box: newData });
                }} />
            </Tool>
            <Tool title='Box Layer'>
                <button className='btn btn-info' onClick={() => {
                    slideListEventListenerGlobal.tooling({ box: { layerBack: true } });
                }}><i className="bi bi-layer-backward" /></button>
                <button className='btn btn-info' onClick={() => {
                    slideListEventListenerGlobal.tooling({ box: { layerFront: true } });
                }}><i className="bi bi-layer-forward" /></button>
            </Tool>
        </>
    );
}
function Tool({ title, children }: { title?: string, children: ReactChild | ReactChild[] }) {
    return (
        <div className='tool'>
            {title && <div>{title}</div>}
            <div>{children}</div>
        </div>
    );
}
function Align({ onData, isText }: {
    onData: (data: {
        verticalAlignment?: VAlignmentEnum,
        horizontalAlignment?: HAlignmentEnum,
    }) => void,
    isText?: boolean,
}) {
    return (
        <div>
            <button className='btn btn-info' onClick={() => {
                onData({ verticalAlignment: VAlignmentEnum.Top });
            }}><i className="bi bi-align-top" /></button>
            <button className='btn btn-info' onClick={() => {
                onData({ verticalAlignment: VAlignmentEnum.Center });
            }}><i className="bi bi-align-middle" /></button>
            <button className='btn btn-info' onClick={() => {
                onData({ verticalAlignment: VAlignmentEnum.Bottom });
            }}><i className="bi bi-align-bottom" /></button>
            <hr />
            {isText ? <>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Left });
                }}><i className="bi bi-text-left" /></button>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Center });
                }}><i className="bi bi-text-center" /></button>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Right });
                }}><i className="bi bi-text-right" /></button>
            </> : <>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Left });
                }}><i className="bi bi-align-start" /></button>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Center });
                }}><i className="bi bi-align-center" /></button>
                <button className='btn btn-info' onClick={() => {
                    onData({ horizontalAlignment: HAlignmentEnum.Right });
                }}><i className="bi bi-align-end" /></button>
            </>}
        </div>
    );
}