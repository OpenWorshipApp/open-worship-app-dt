import type { CSSProperties } from 'react';
import { useState } from 'react';

import { useAppEffect } from '../../../helper/debuggerHelpers';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import CanvasItemText from '../CanvasItemText';

function calcAlignmentStyle(props: CanvasItemTextPropsType) {
    let height = 0;
    if (props.textVerticalAlignment !== 'start') {
        height = props.height / 2 - props.fontSize;
    }
    const style: CSSProperties = {
        ...{
            textAlign: props.textHorizontalAlignment,
        },
        ...{
            padding: height + 'px 0',
            overflow: 'hidden',
        },
    };
    return style as CSSProperties;
}

export default function BoxEditorTextAreaComp({
    props,
    setText,
}: Readonly<{
    props: CanvasItemTextPropsType;
    setText: (newText: string) => void;
}>) {
    const [localText, setLocalText] = useState(props.text);
    useAppEffect(() => {
        setLocalText(props.text);
    }, [props.text]);
    const style = CanvasItemText.genStyle(props);
    return (
        <textarea
            style={{
                width: '100%',
                height: '100%',
                ...style,
                ...calcAlignmentStyle(props),
                overflow: 'auto',
            }}
            value={localText}
            autoFocus
            onFocus={(event) => {
                const target = event.target as HTMLTextAreaElement;
                target.selectionStart = target.selectionEnd =
                    target.value.length;
            }}
            onChange={(event) => {
                const newText = event.target.value;
                setLocalText(newText);
                setText(newText);
            }}
        />
    );
}
