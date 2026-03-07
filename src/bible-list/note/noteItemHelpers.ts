import { AnyObjectType } from '../../helper/typeHelpers';

export type NoteItemType = {
    id: number;
    content: string;
    metadata: AnyObjectType;
};
