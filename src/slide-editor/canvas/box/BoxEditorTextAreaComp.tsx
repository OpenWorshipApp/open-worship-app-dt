import type { ChangeEvent, CSSProperties, FocusEvent } from 'react';
import { useCallback } from 'react';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import CanvasItemText from '../CanvasItemText';
import { SCRIPT_SAFE_LINE_HEIGHT } from '../canvasHelpers';
import { useAppCurrentRef } from '../../../helper/appHooks';

function calcAlignmentStyle(props: CanvasItemTextPropsType) {
    const basePadding = props.fontSize / 10;
    const lineHeight = props.fontSize * SCRIPT_SAFE_LINE_HEIGHT;
    const lineCount = Math.max(1, props.text.split('\n').length);
    const estimatedTextHeight = lineHeight * lineCount;
    const availableHeight = Math.max(0, props.height - basePadding * 2);
    const extraHeight = Math.max(0, availableHeight - estimatedTextHeight);

    let topPadding = basePadding;
    if (props.textVerticalAlignment === 'center') {
        topPadding += extraHeight / 2;
    } else if (props.textVerticalAlignment === 'end') {
        topPadding += extraHeight;
    }

    const style: CSSProperties = {
        textAlign: props.textHorizontalAlignment,
        paddingTop: `${topPadding}px`,
        paddingRight: `${basePadding}px`,
        paddingBottom: `${basePadding}px`,
        paddingLeft: `${basePadding}px`,
    };
    return style;
}

export default function BoxEditorTextAreaComp({
    props,
    text,
    onTextChange,
    onBlur,
}: Readonly<{
    props: CanvasItemTextPropsType;
    text: string;
    onTextChange: (newText: string) => void;
    onBlur: () => void;
}>) {
    const handleTextAreaFocus = useCallback(
        (event: FocusEvent<HTMLTextAreaElement>) => {
            const target = event.target as HTMLTextAreaElement;
            target.selectionStart = target.selectionEnd = target.value.length;
        },
        [],
    );
    const onTextChangeRef = useAppCurrentRef(onTextChange);
    const handleTextChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const newText = event.target.value;
            onTextChangeRef.current(newText);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const style = CanvasItemText.genStyle(props);
    return (
        <textarea
            style={{
                width: '100%',
                height: '100%',
                ...style,
                ...calcAlignmentStyle(props),
                display: 'block',
                margin: 0,
                border: 'none',
                borderRadius: 0,
                outline: 'none',
                boxShadow: 'none',
                background: 'transparent',
                resize: 'none',
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
            value={text}
            autoFocus
            onFocus={handleTextAreaFocus}
            onChange={handleTextChange}
            onBlur={onBlur}
        />
    );
}
