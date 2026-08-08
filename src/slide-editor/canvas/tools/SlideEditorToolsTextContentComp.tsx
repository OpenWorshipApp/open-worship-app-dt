import type { ChangeEvent } from 'react';
import { useCallback } from 'react';

import { tran } from '../../../lang/langHelpers';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { useAppCurrentRef } from '../../../helper/appHooks';

export default function SlideEditorToolsTextContentComp() {
    const [props, setProps] =
        useCanvasItemPropsSetterContext<CanvasItemTextPropsType>();
    const setPropsRef = useAppCurrentRef(setProps);
    const handleTextChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            setPropsRef.current({ text: event.target.value });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <SlideEditorToolTitleComp title={tran('Text')}>
            <textarea
                className="form-control"
                rows={4}
                value={props.text}
                onChange={handleTextChange}
                placeholder={tran('Type the slide text here')}
                style={{
                    resize: 'vertical',
                    fontFamily: props.fontFamily || undefined,
                    fontWeight: props.fontWeight || undefined,
                }}
            />
        </SlideEditorToolTitleComp>
    );
}
