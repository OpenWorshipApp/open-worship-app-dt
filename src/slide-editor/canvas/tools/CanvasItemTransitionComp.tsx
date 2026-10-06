import { useCallback, useState } from 'react';

import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasItemPropsSetterContext } from '../CanvasItem';
import { useAppCurrentRef, useAppEffect } from '../../../helper/appHooks';
import EventHandler from '../../../event/EventHandler';
import ScreenEffectManager, {
    SCREEN_EFFECT_CHANGED_EVENT,
} from '../../../_screen/managers/ScreenEffectManager';
import type { TransitionEffectType } from '../../../_screen/transitionEffectHelpers';
import { toValidTransitionEffect } from '../../../_screen/transitionOverrideHelpers';
import TransitionOverrideComp from '../../../others/TransitionOverrideComp';
import { useSlideTransitionMap } from '../../../others/slideTransitionMenuHelpers';
import { slideTransitionManager } from '../../../others/SlideTransitionManager';
import { tran } from '../../../lang/langHelpers';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';

export default function CanvasItemTransitionComp() {
    const [props, setProps] = useCanvasItemPropsSetterContext();
    const { canvas } = useCanvasControllerContext();
    const { slide } = canvas;
    const data = useSlideTransitionMap(slide.filePath, true);
    const [, setRevision] = useState(0);
    useAppEffect(() => {
        const events = EventHandler.registerEventListener(
            [SCREEN_EFFECT_CHANGED_EVENT],
            () => setRevision((n) => n + 1),
        );
        return () => EventHandler.unregisterEventListener(events);
    }, []);
    const slideEffect = data?.[slideTransitionManager.toKey(slide.id)];
    const documentEffect = data?.[slideTransitionManager.toKey()];
    const inherited = {
        effect:
            slideEffect ??
            documentEffect ??
            ScreenEffectManager.getCommonEffectType('vary-app-document'),
        sourceLabel:
            slideEffect !== undefined
                ? tran('Slide transition')
                : documentEffect !== undefined
                  ? tran('Slides preview')
                  : tran('Screen setting'),
    };
    const setPropsRef = useAppCurrentRef(setProps);
    const handleChange = useCallback(
        (transitionEffect: TransitionEffectType | undefined) => {
            setPropsRef.current({ transitionEffect: transitionEffect ?? null });
        },
        [setPropsRef],
    );
    return (
        <SlideEditorToolTitleComp title={tran('Canvas item transition')}>
            <TransitionOverrideComp
                value={toValidTransitionEffect(props.transitionEffect)}
                inherited={inherited}
                onChange={handleChange}
                choicesClassName="w-100"
            />
            <small className="text-muted d-block mt-1">
                {tran('Used when changing slides.')}
            </small>
        </SlideEditorToolTitleComp>
    );
}
