import appProvider from '../server/appProvider';
import { copyToClipboard } from '../server/appHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    elementDivider,
    genContextMenuItemIcon,
} from '../context-menu/AppContextMenuComp';
import { getBibleLocale } from './bible-helpers/bibleLogicHelpers2';
import { getLangCode, tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

function getSelectedTextElement() {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const selectedElement = range.commonAncestorContainer;
    if (selectedElement.nodeType === Node.TEXT_NODE) {
        return selectedElement.parentElement;
    }
    return selectedElement as HTMLElement;
}

async function getSelectedTextLanguageCode() {
    const selectedElement = getSelectedTextElement();
    const bibleKeys = Array.from(
        new Set(
            selectedElement
                ? (Array.from(
                      selectedElement.querySelectorAll('[data-bible-key]'),
                  )
                      .concat([selectedElement])
                      .map((element) => {
                          if (element instanceof HTMLElement === false) {
                              return null;
                          }
                          const bibleKey = element.dataset.bibleKey;
                          return bibleKey ? bibleKey.trim() : null;
                      })
                      .filter((bibleKey) => {
                          return bibleKey !== null && bibleKey !== '';
                      }) as string[])
                : [],
        ),
    );
    const locales = await Promise.all(
        bibleKeys.map((bibleKey) => {
            return getBibleLocale(bibleKey);
        }),
    );
    const langCodes = locales
        .map((locale) => {
            return getLangCode(locale);
        })
        .filter((langCode) => {
            return langCode !== null && langCode !== '';
        }) as string[];
    return langCodes;
}

export function getSelectedText() {
    const selection = globalThis.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    return selection.toString();
}

export function genSelectedTextContextMenus(
    extraContextMenuItems: ContextMenuItemType[] = [],
): ContextMenuItemType[] {
    const selectedText = getSelectedText();
    if (!selectedText) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('copy'),
            menuElement: tran('Copy Selected Text'),
            onSelect: () => {
                copyToClipboard(selectedText);
            },
        },
        {
            childBefore: genContextMenuItemIcon('google'),
            menuElement: tran('Search Selected Text on Google'),
            onSelect: () => {
                const url = new URL('https://www.google.com/search');
                url.searchParams.set('q', selectedText);
                appProvider.browserUtils.openExternalURL(url.toString());
            },
        },
        {
            childBefore: genContextMenuItemIcon('journal-arrow-up'),
            menuElement: tran('Dictionary for Selected Text'),
            onSelect: async () => {
                const langCodes = await getSelectedTextLanguageCode();
                if (langCodes.length === 0) {
                    showSimpleToast(
                        'Cannot Open Dictionary',
                        'No language code found for the selected text.',
                    );
                    return;
                }
                for (const langCode of langCodes) {
                    const url = new URL(
                        `https://${langCode}.wiktionary.org/wiki/${selectedText}`,
                    );
                    appProvider.browserUtils.openExternalURL(url.toString());
                }
            },
        },
        ...extraContextMenuItems,
        {
            menuElement: elementDivider,
        },
    ];
}
