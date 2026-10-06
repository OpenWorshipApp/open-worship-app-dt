// Keys whose `event.key` is not presentable as-is. Arrows are drawn as glyphs
// because they have to be legible from the back of a room; everything else stays
// a word, which survives a projector better than a symbol nobody knows.
//
// One map for the two places that NAME a key to a person -- the keyboard
// screencast and Help -> Keyboard Shortcuts -- so a key is called the same
// thing whether it was pressed or looked up. A leaf on purpose: the shortcut
// list is a lazy chunk and must not pull the screencast in behind it.
export const KEY_LABEL_MAP: { [key: string]: string } = {
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Delete: 'Del',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
};
