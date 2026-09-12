import { useCallback, useState } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { getMenuTitleRevealFile } from '../helper/helpers';
import appProvider from '../server/appProvider';
import { copyToClipboard, showFileOrDirExplorer } from '../server/appHelpers';
import { pathBasename } from '../server/fileHelpers';
import ResourcesFileLinksComp from './ResourcesFileLinksComp';
import type { ResourceLinksResultType } from './resourceLinksHelpers';
import {
    checkIsResourceLinkList,
    checkIsResourceLinksName,
    readResourceLinks,
} from './resourceLinksHelpers';
import {
    checkIsBookLevelName,
    toResourceIcon,
    toResourceNameParts,
} from './resourcesScanHelpers';

export default function ResourcesFileRowComp({
    filePath,
    bookKey,
    canAutoExpandLinks = false,
}: Readonly<{
    filePath: string;
    /**
     * The book this row was matched for, so a book-level file can be tagged.
     * A free-text hit was matched for no book and carries none.
     */
    bookKey?: string;
    /**
     * May a `.json` be READ as the row appears, to see whether it is a link
     * list and show its links straight away?
     *
     * True for the rows this panel EXISTS for -- the files of the chapter being
     * read, a handful by construction -- and false for free-text hits, where a
     * one-letter search can put 200 rows on screen and 200 eager file reads
     * with them. Those read on the first press instead.
     */
    canAutoExpandLinks?: boolean;
}>) {
    const fileFullName = pathBasename(filePath);
    const [iconName, color] = toResourceIcon(fileFullName);
    const [nameStem, dotExtension] = toResourceNameParts(fileFullName);
    const isBookLevel =
        bookKey !== undefined && checkIsBookLevelName(fileFullName, bookKey);
    // A CANDIDATE only. `.json` is a general-purpose format, so the name can
    // never settle this: the content decides, below, and anything that is not a
    // list of links stays an ordinary file -- same icon, same click, opened by
    // whatever application the machine uses for it.
    const isLinksCandidate = checkIsResourceLinksName(fileFullName);
    const [linksResult, setLinksResult] =
        useState<ResourceLinksResultType | null>(null);
    // Open once the links are known, and toggled from there. Not persisted per
    // file, deliberately: this panel already writes a setting per folder, and
    // one more per `.json` anybody ever expanded would be a settings directory
    // that grows with the user's library and never shrinks.
    const [isLinksShowing, setIsLinksShowing] = useState(true);
    const isLinkList =
        linksResult !== null && checkIsResourceLinkList(linksResult);
    const isLinksCandidateRef = useAppCurrentRef(isLinksCandidate);
    const isLinksShowingRef = useAppCurrentRef(isLinksShowing);
    const linksResultRef = useAppCurrentRef(linksResult);
    const filePathRef = useAppCurrentRef(filePath);
    useAppEffect(() => {
        if (!isLinksCandidate || !canAutoExpandLinks) {
            // Nothing is read here for a row that is not a candidate, and
            // nothing for a free-text hit either -- 200 of those are 200 reads
            // for rows nobody has looked at yet.
            return;
        }
        // A read abandoned mid-flight must not land in state: the folder can be
        // re-scanned, or the panel moved to another chapter, while the file is
        // being read.
        let isCancelled = false;
        readResourceLinks(filePath).then((newResult) => {
            if (isCancelled) {
                return;
            }
            setLinksResult(newResult);
        });
        return () => {
            isCancelled = true;
        };
    }, [filePath, isLinksCandidate, canAutoExpandLinks]);
    const handleOpening = useCallback(() => {
        appProvider.systemUtils.openFile(filePathRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClicking = useCallback(async () => {
        if (!isLinksCandidateRef.current) {
            handleOpening();
            return;
        }
        let result = linksResultRef.current;
        if (result === null) {
            // A free-text hit, pressed for the first time: read it NOW and let
            // the content decide what the press meant. A link list opens here;
            // anything else is a file, and goes to the machine's own
            // application for it exactly as the row's icon promised.
            result = await readResourceLinks(filePathRef.current);
            setLinksResult(result);
            if (!checkIsResourceLinkList(result)) {
                handleOpening();
                return;
            }
            // Not a toggle: the links have only just appeared.
            setIsLinksShowing(true);
            return;
        }
        if (!checkIsResourceLinkList(result)) {
            handleOpening();
            return;
        }
        setIsLinksShowing(!isLinksShowingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClickingSync = useCallback(() => {
        void handleClicking();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('box-arrow-up-right'),
                // The OS route stays in the menu for a link list too: its row
                // expands instead of opening, and editing the file is still a
                // thing to want.
                menuElement: tran('Open'),
                onSelect: () => {
                    handleOpening();
                },
            },
            // The two items `genCommonMenu` builds, inline rather than
            // imported: that helper lives in `FileItemHandlerComp`, a whole
            // file-list ROW component, and importing it here would pull
            // `FileSource`, the dir-source watcher and the screen helpers into
            // the bible lookup panel to draw two menu entries.
            {
                childBefore: genContextMenuItemIcon('clipboard'),
                menuElement: tran('Copy Path to Clipboard'),
                onSelect: () => {
                    copyToClipboard(filePathRef.current);
                },
            },
            {
                childBefore: genContextMenuItemIcon('folder2-open'),
                menuElement: getMenuTitleRevealFile(),
                onSelect: () => {
                    showFileOrDirExplorer(filePathRef.current);
                },
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        // The row and, for a link list, what is inside it. The rail's ticks are
        // drawn by the row's own button against the body's padding, so this
        // wrapper adds no box of its own and shifts nothing.
        <div className="app-resources-file-item">
            {/*
             * A row of two siblings: the ⋮ cannot be nested inside the file
             * button, and a press on it must not open the file.
             */}
            <div className="app-resources-file-row">
                <button
                    className="app-resources-file app-caught-hover-pointer"
                    type="button"
                    // The whole path, because the name alone cannot tell two matches in
                    // two subfolders apart -- and the folder it sits in is usually what
                    // says which one this is.
                    title={filePath}
                    aria-expanded={isLinkList ? isLinksShowing : undefined}
                    onClick={handleClickingSync}
                    onContextMenu={handleContextMenuOpening}
                >
                    {isLinkList ? (
                        // Only once the content has PROVED to be a list of
                        // links: a chevron on a row that turns out to open in
                        // another application would be a promise the row
                        // cannot keep.
                        <i
                            className={
                                'app-resources-file-chevron bi bi-chevron-' +
                                (isLinksShowing ? 'down' : 'right')
                            }
                        />
                    ) : null}
                    <i
                        className={
                            'bi app-resources-file-icon bi-' +
                            // A proven link list is drawn as what pressing it
                            // gives you; every other `.json` keeps the icon of
                            // the file it is.
                            (isLinkList ? 'link-45deg' : iconName)
                        }
                        style={{ color: isLinkList ? undefined : color }}
                    />
                    {/*
                     * Split, not styled as one string: the stem is the reference the
                     * user came here for, and a column of identical `.pdf`s should not
                     * be competing with it for the same weight. `app-data` because
                     * these names are mostly numbers -- tabular figures keep a column
                     * of chapter numbers from shifting as it scrolls.
                     */}
                    <span className="app-resources-file-stem app-ellipsis app-data">
                        {nameStem}
                    </span>
                    {dotExtension ? (
                        <span className="app-resources-file-extension">
                            {dotExtension}
                        </span>
                    ) : null}
                    {isBookLevel ? (
                        <span
                            className="app-resources-file-tag"
                            title={tran(
                                'Book-level files are shown in every chapter',
                            )}
                        >
                            {tran('Introduction')}
                        </span>
                    ) : null}
                </button>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
            {isLinkList && isLinksShowing && linksResult !== null ? (
                <ResourcesFileLinksComp result={linksResult} />
            ) : null}
        </div>
    );
}
