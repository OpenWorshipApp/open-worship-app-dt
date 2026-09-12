import { useCallback } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { copyToClipboard } from '../server/appHelpers';
import type {
    ResourceLinksResultType,
    ResourceLinkType,
} from './resourceLinksHelpers';
import {
    openResourceLinkUrl,
    toResourceLinkHostLabel,
    toResourceLinksDroppedLabel,
} from './resourceLinksHelpers';

/**
 * One link out of a resource `.json`: the TITLE the file gave it, pressable,
 * and the site it goes to after it.
 *
 * A `<button>` rather than an `<a href>`, deliberately. An anchor inside this
 * app would be handed to `will-navigate`, which decides what to do with a URL
 * by comparing origins, and a middle-click or a Ctrl+click on one opens a
 * renderer with `nodeIntegration: true` on a page nobody here wrote. A button
 * has exactly one behaviour -- `shell.openExternal` through
 * `openResourceLinkUrl`, which refuses anything but `http(s)`.
 */
function ResourcesLinkRowComp({ link }: Readonly<{ link: ResourceLinkType }>) {
    const { title, url } = link;
    const linkRef = useAppCurrentRef(link);
    const handleOpening = useCallback(() => {
        openResourceLinkUrl(linkRef.current.url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        showAppContextMenu(event, [
            {
                childBefore: genContextMenuItemIcon('box-arrow-up-right'),
                menuElement: tran('Open Link in Browser'),
                onSelect: () => {
                    openResourceLinkUrl(linkRef.current.url);
                },
            },
            {
                childBefore: genContextMenuItemIcon('clipboard'),
                menuElement: tran('Copy URL to Clipboard'),
                onSelect: () => {
                    copyToClipboard(linkRef.current.url);
                },
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const hostLabel = toResourceLinkHostLabel(url);
    return (
        <div className="app-resources-link-row">
            <button
                className="app-resources-link app-caught-hover-pointer"
                type="button"
                // BOTH, in that order: the title is the row's own words, which
                // the panel is usually too narrow to show whole, and the
                // address is the only thing that says where the press actually
                // goes -- the question to answer BEFORE pressing, not after it
                // in a browser.
                title={`${title} ${url}`}
                onClick={handleOpening}
                onContextMenu={handleContextMenuOpening}
            >
                <i className="bi bi-box-arrow-up-right app-resources-link-icon" />
                <span className="app-resources-link-title app-ellipsis">
                    {title}
                </span>
                {hostLabel ? (
                    // Decorative, and `aria-hidden` for a reason that is not
                    // decoration: without it this button's accessible name is
                    // the title and the host RUN TOGETHER
                    // (`...bare-stringexample.com`), which is what a screen
                    // reader says out loud and what every tool that matches a
                    // control by its words has to match. The address is on the
                    // tooltip and in the title itself when there is nothing
                    // else, so nothing is lost by leaving it out of the name.
                    <span
                        className="app-resources-link-host app-ellipsis"
                        aria-hidden="true"
                    >
                        {hostLabel}
                    </span>
                ) : null}
            </button>
            <ContextMenuDotsButtonComp onOpening={handleContextMenuOpening} />
        </div>
    );
}

/**
 * The links inside one resource `.json`, drawn under its row.
 *
 * A presenter only: the file is read by the ROW, because whether the content
 * is a link list at all is what decides the shape of the row itself -- a
 * `.json` that is not one is an ordinary file, not a file with an empty list
 * inside it. This is mounted only while the row is open, so folding it away
 * lets go of the links.
 */
export default function ResourcesFileLinksComp({
    result,
}: Readonly<{ result: ResourceLinksResultType }>) {
    const { links, droppedCount, isTruncated } = result;
    return (
        <div className="app-resources-links">
            {links.map((link) => {
                return (
                    // The URL, not the title: two rows may well share a title
                    // (`Part 1` twice), and a duplicated key silently drops a
                    // row.
                    <ResourcesLinkRowComp key={link.url} link={link} />
                );
            })}
            {droppedCount > 0 ? (
                // Named rather than hidden: a file where one entry has a typo
                // or a `file:` URL otherwise just shows fewer rows than the
                // person who wrote it can count.
                <div
                    className="app-resources-note text-warning app-ellipsis"
                    title={tran('Only http and https links can be opened')}
                >
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {toResourceLinksDroppedLabel(droppedCount)}
                </div>
            ) : null}
            {isTruncated ? (
                <div className="app-resources-note text-warning app-ellipsis">
                    <i className="bi bi-exclamation-triangle pe-1" />
                    {tran('Too many links')}
                </div>
            ) : null}
        </div>
    );
}
