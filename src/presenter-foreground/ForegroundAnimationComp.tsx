import AnimationPickerComp from '../background/AnimationPickerComp';
import { genAnimationLabel } from '../background/animationLabelHelpers';
import {
    compareAnimationSrc,
    parseAnimation,
} from '../background/animationValueHelpers';
import ForegroundPaintShowComp, {
    genPaintHideLabel,
    type PaintPickerPropsType,
} from './ForegroundPaintShowComp';

function genLabel(src: string) {
    const animation = parseAnimation(src);
    return animation === null ? src : genAnimationLabel(animation);
}

// An animation has no "No Color": its picker never presses `null`.
function renderPicker({ onPick, ...props }: PaintPickerPropsType) {
    return <AnimationPickerComp {...props} onPick={onPick} />;
}

/** Animation Show: the Background panel's Animations, over the slide. */
export default function ForegroundAnimationComp() {
    return (
        <ForegroundPaintShowComp
            kind="animation"
            hideLabel={genPaintHideLabel('animation')}
            genLabel={genLabel}
            compareSrc={compareAnimationSrc}
            renderPicker={renderPicker}
        />
    );
}
