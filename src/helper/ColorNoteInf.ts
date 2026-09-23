interface ColorNoteInf {
    getColorNote(): Promise<string | null>;
    setColorNote(color: string | null): Promise<void>;
    /**
     * The colour note already read for this item, where it keeps one
     * (`FileSource` does, once its list has read it). A renderer seeds from it
     * instead of reading the disk again per item. `undefined` means not read
     * yet -- the renderer falls back to `getColorNote()`; `null` means none.
     */
    colorNote?: string | null;
}

export default ColorNoteInf;
