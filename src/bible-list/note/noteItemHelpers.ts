export type NoteItemMetadataType = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    isOpened?: boolean;
};
export type NoteItemType = {
    title: string;
    content: string;
    metadata: NoteItemMetadataType;
};
