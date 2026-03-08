export type NoteItemMetadataType = {
    id: number;
    createdAt: Date;
    updatedAt: Date;
};
export type NoteItemType = {
    title: string;
    content: string;
    metadata: NoteItemMetadataType;
};
