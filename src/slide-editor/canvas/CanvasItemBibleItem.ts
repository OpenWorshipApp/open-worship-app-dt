import BibleItem from '../../bible-list/BibleItem';
import CanvasItemText, { CanvasItemTextPropsType } from './CanvasItemText';
import { cloneJson } from '../../helper/helpers';
import { CanvasItemError } from './CanvasItem';
import { HAlignmentType, VAlignmentType } from './canvasHelpers';
import { handleError } from '../../helper/errorHelpers';
import {
    BibleTargetType,
    bibleRenderHelper,
} from '../../bible-list/bibleRenderHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';

export type CanvasItemBiblePropsType = CanvasItemTextPropsType & {
    bibleKeys: string[];
    bibleItemTarget: BibleTargetType;
    bibleRenderingList: {
        title: string;
        text: string;
    }[];
};
export default class CanvasItemBibleItem extends CanvasItemText {
    props: CanvasItemBiblePropsType;
    constructor(props: CanvasItemBiblePropsType) {
        super(props);
        this.props = cloneJson(props);
    }
    toJson(): CanvasItemBiblePropsType {
        return this.props;
    }
    static fromJson(json: CanvasItemBiblePropsType) {
        try {
            this.validate(json);
            return new CanvasItemBibleItem(json);
        } catch (error) {
            handleError(error);
            return CanvasItemError.fromJsonError(json);
        }
    }
    static async fromBibleItem(id: number, bibleItem: BibleItem) {
        const title = await bibleItem.toTitle();
        const text = await bibleRenderHelper.toText(
            bibleItem.bibleKey,
            bibleItem.target,
        );
        const newTextItem = super.genDefaultItem();
        const props = newTextItem.toJson();
        props.id = id;
        const json: CanvasItemBiblePropsType = {
            ...props,
            bibleKeys: [bibleItem.bibleKey],
            bibleItemTarget: bibleItem.toJson().target,
            bibleRenderingList: [
                {
                    title,
                    text,
                },
            ],
            horizontalAlignment: 'left' as HAlignmentType,
            verticalAlignment: 'top' as VAlignmentType,
            textHorizontalAlignment: 'left' as HAlignmentType,
            textVerticalAlignment: 'top' as VAlignmentType,
            type: 'bible',
        };
        return CanvasItemBibleItem.fromJson(json);
    }
    static validate(json: AnyObjectType) {
        super.validate(json);
        BibleItem.validate({
            id: -1,
            target: json.bibleItemTarget,
            bibleKey: json.bibleKeys[0],
        });
    }
}
