import appProvider from './appProvider';

// Deliberately a leaf module: the way into the website's help is carried by
// every window (`AppAssistantComp` answers Help -> Open Online Help), and
// `appHelpers`, where `getHelpPageUrl` used to live, brings the file and
// document helpers with it.

export function getHelpPageUrl() {
    return `${appProvider.appInfo.homepage}/help`;
}

/**
 * The help page as THIS window asks for it: the page's own name rides as the
 * fragment (`…/help#presenter`), as the Help button has always sent it.
 */
export function getPageHelpUrl() {
    const helpKey = appProvider.currentHomePage
        .replace(/^\//, '')
        .replace(/\.html$/, '');
    return `${getHelpPageUrl()}#${helpKey}`;
}

/**
 * The website's help, in the system browser. One function behind both ways in
 * -- the Help button's *Open Online Help* and Help -> Open Online Help in the
 * menu bar -- so the two cannot come to open different pages.
 */
export function openOnlineHelp() {
    appProvider.browserUtils.openExternalURL(getPageHelpUrl());
}
