import BibleItem from '../../bible-list/BibleItem';
import type { CanvasItemTextPropsType } from './CanvasItemText';
import CanvasItemText from './CanvasItemText';
import { cloneJson } from '../../helper/helpers';
import { CanvasItemError } from './CanvasItem';
import { handleError } from '../../helper/errorHelpers';
import type { BibleTargetType } from '../../bible-list/bibleRenderHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';

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
        const text = await bibleItem.toText();
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
