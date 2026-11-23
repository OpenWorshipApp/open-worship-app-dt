/**
 * The file an office program keeps beside a document while it has it open
 * (2026-11-21, `EC-781` after `EC-766`, the goal _chatbot can change do everything on a
 * given pptx_). PowerPoint and Word write `~$` and the file's name -- Word
 * dropping the name's first one or two letters when it is long -- and
 * LibreOffice `.~lock.<name>#`. On Windows the open file itself refuses a
 * write; on a Mac or Linux nothing does, and the program's next save puts
 * its own copy back over the change, so that file beside it is what says
 * the document is open. Pure.
 */

export type OfficeOwnerFileType = { name: string; program: string };

/** The names such a file may have beside `name`, the likeliest first. */
export function listOfficeOwnerFiles(name: string): OfficeOwnerFileType[] {
    const program = /\.docx$/i.test(name) ? 'Word' : 'PowerPoint';
    const stem = name.replace(/\.[^.]+$/, '');
    const list: OfficeOwnerFileType[] = [{ name: `~$${name}`, program }];
    for (const cut of [1, 2]) {
        if (stem.length > cut) {
            list.push({ name: `~$${name.slice(cut)}`, program });
        }
    }
    list.push({ name: `.~lock.${name}#`, program: 'LibreOffice' });
    return list;
}

/** Why nothing was written while the document is open in a program. */
export function genOfficeOpenElsewhereReason(
    fileName: string,
    owner: OfficeOwnerFileType,
) {
    return (
        `"${fileName}" is open in ${owner.program}, on this computer or on ` +
        `another sharing its folder (${owner.program} keeps ` +
        `"${owner.name}" beside it while it is open), and ` +
        `${owner.program}'s next save would put its own copy back over a ` +
        'change made now. Ask them to close it there and ask again. If it ' +
        'is not open anywhere, that hidden file was left behind: once it ' +
        'is deleted the change can be made.'
    );
}
