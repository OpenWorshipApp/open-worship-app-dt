import appProvider from '../server/appProvider';
import { copyToClipboard } from '../server/appHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    elementDivider,
    genContextMenuItemIcon,
} from '../context-menu/AppContextMenuComp';
import { getLangCode, LocaleType, tran } from '../lang/langHelpers';

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

function getSelectedTextLanguageCode() {
    const selectedElement = getSelectedTextElement();
    if (selectedElement === null) {
        return [];
    }
    const locales = Array.from(
        new Set(
            Array.from(selectedElement.querySelectorAll('[data-dict-locale]'))
                .concat([selectedElement])
                .map((element) => {
                    if (element instanceof HTMLElement === false) {
                        return null;
                    }
                    const dictLocale = element.dataset.dictLocale?.trim();
                    return dictLocale ?? null;
                })
                .filter((dictLocale) => {
                    return dictLocale !== null;
                }) as LocaleType[],
        ),
    );
    const langCodes = locales
        .map((locale) => {
            return getLangCode(locale) ?? null;
        })
        .filter((langCode) => {
            return langCode !== null;
        });
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
) {
    const selectedText = getSelectedText();
    if (!selectedText) {
        return [];
    }
    const selectedTextLangCodes = getSelectedTextLanguageCode();
    const menuItems: ContextMenuItemType[] = [
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
        ...(selectedTextLangCodes.length > 0
            ? [
                  {
                      childBefore: genContextMenuItemIcon('journal-arrow-up'),
                      menuElement: tran('Dictionary for Selected Text'),
                      onSelect: () => {
                          for (const langCode of selectedTextLangCodes) {
                              const url =
                                  `https://${langCode}.wiktionary.org/` +
                                  `wiki/${selectedText}`;
                              appProvider.browserUtils.openExternalURL(url);
                          }
                      },
                  },
              ]
            : []),
        ...extraContextMenuItems,
        {
            menuElement: elementDivider,
        },
    ];
    return menuItems;
}
