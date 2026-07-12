import { use, type CSSProperties } from 'react';

import type { CanvasItemBiblePropsType } from '../CanvasItemBibleItem';
import CanvasItemBibleItem from '../CanvasItemBibleItem';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { handleError } from '../../../helper/errorHelpers';
import { useCanvasItemPropsContext } from '../CanvasItem';
import BoxEditorNormalWrapperComp from './BoxEditorNormalWrapperComp';
import { CanvasControllerContext } from '../CanvasController';

import type CanvasController from '../CanvasController';
import BibleItem from '../../../bible-list/BibleItem';
import { showBibleKeyOption } from '../../../bible-lookup/BibleKeySelectionComp';

export function formatBibleKeys(
    div: HTMLElement,
    canvasController: CanvasController,
) {
    div.querySelectorAll('[data-bible-key]').forEach((element) => {
        const bibleKey = (element.getAttribute('data-bible-key') || '').trim();
        if (bibleKey === '' || !(element instanceof HTMLElement)) {
            return;
        }
        const canvasItemId =
            element
                .closest('[data-app-box-editor-id]')
                ?.getAttribute('data-app-box-editor-id') || '';
        if (canvasItemId === '' || Number.isNaN(Number(canvasItemId))) {
            return;
        }
        let title = element.parentElement?.innerText || '';
        title = title.replace(`(${bibleKey})`, '').trim();
        if (title === '') {
            return;
        }
        element.classList.add('app-caught-hover-pointer');
        element.title = `${bibleKey}, chose with Ctrl+Click to add a new Bible item`;
        element.onclick = (event: any) => {
            event.stopPropagation();
            showBibleKeyOption(
                event,
                async (newBibleKey, newEvent: any) => {
                    const bibleItem = await BibleItem.fromTitleText(
                        bibleKey,
                        title,
                    );
                    if (bibleItem === null) {
                        return;
                    }
                    bibleItem.bibleKey = newBibleKey;
                    if (newEvent.ctrlKey) {
                        canvasController.addNewBibleItem(bibleItem);
                    } else {
                        canvasController.replaceBibleItem(
                            Number.parseInt(canvasItemId, 10),
                            bibleItem,
                        );
                    }
                },
                [bibleKey],
            );
        };
    });
}

export default function BoxEditorNormalViewBibleModeComp({
    style,
}: Readonly<{
    style: CSSProperties;
}>) {
    return (
        <BoxEditorNormalWrapperComp style={style}>
            <BoxEditorNormalBibleRender />
        </BoxEditorNormalWrapperComp>
    );
}

export function BoxEditorNormalBibleRender() {
    const props = useCanvasItemPropsContext<CanvasItemBiblePropsType>();
    try {
        CanvasItemBibleItem.validate(props);
    } catch (error) {
        handleError(error);
        return <BENViewErrorRender />;
    }
    const canvasController = use(CanvasControllerContext);
    return (
        <div
            ref={(div) => {
                if (canvasController === null || div === null) {
                    return;
                }
                formatBibleKeys(div, canvasController);
            }}
            title={props.id.toString()}
            style={{
                width: '100%',
                height: '100%',
                ...CanvasItemBibleItem.genStyle(props),
            }}
            dangerouslySetInnerHTML={{
                __html: props.html,
            }}
        />
    );
}
