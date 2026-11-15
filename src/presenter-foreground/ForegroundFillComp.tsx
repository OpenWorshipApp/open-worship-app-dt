import FillPickerComp from '../background/FillPickerComp';
import { genFillLabel } from '../background/fillLabelHelpers';
import { compareFillSrc, parseFill } from '../background/fillValueHelpers';
import ForegroundPaintShowComp, {
    genPaintHideLabel,
    type PaintPickerPropsType,
} from './ForegroundPaintShowComp';

function genLabel(src: string) {
    const fill = parseFill(src);
    return fill === null ? src : genFillLabel(fill);
}

function renderPicker(props: PaintPickerPropsType) {
    return <FillPickerComp {...props} />;
}

/** Fill Show: the Background panel's Fills, over the slide. */
export default function ForegroundFillComp() {
    return (
        <ForegroundPaintShowComp
            kind="fill"
            hideLabel={genPaintHideLabel('fill')}
            genLabel={genLabel}
            compareSrc={compareFillSrc}
            renderPicker={renderPicker}
        />
    );
}
