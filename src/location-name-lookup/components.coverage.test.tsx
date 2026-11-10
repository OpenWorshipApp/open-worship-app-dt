// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// One mock surface for the small lookup components that had no test: the
// managers context, the header toggle, the window-level detail host, a record
// row and the custom-verse decorator. Every collaborator that would pull the
// dataset, the bible database or a real widget in is replaced here; the real
// `appHooks` (on plain `useEffect`) and the real detail-panel store run.
const h = vi.hoisted(() => {
    type DeferredType = {
        langCode: string;
        resolve: (value: any) => void;
        reject: (error: any) => void;
    };
    return {
        langCode: 'en',
        bibleKey: 'KJV',
        localeByBibleKey: {} as Record<string, string>,
        deferredList: [] as DeferredType[],
        releaseList: [] as string[],
        handleError: vi.fn(),
        widgetPropsList: [] as any[],
        langButtonPropsList: [] as any[],
        openedList: [] as any[],
        menuList: [] as { event: any; target: any }[],
        matcherArgsList: [] as [string, string][],
        matcher: null as null | ((text: string) => any[]),
        customVersePropsList: [] as any[],
        decorateCallList: [] as any[][],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../helper/loggerHelpers', () => ({ appWarning: () => undefined }));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => {
        return h.handleError(...args);
    },
}));
vi.mock('./lookupDataHelpers', () => ({
    acquireLookupData: (langCode: string) => {
        return new Promise((resolve, reject) => {
            h.deferredList.push({ langCode, resolve, reject });
        });
    },
    releaseLookupData: (langCode: string) => {
        h.releaseList.push(langCode);
    },
}));
vi.mock('./lookupLangHelpers', () => ({
    useLookupLangCode: () => h.langCode,
    getSelectedLookupLangCode: () => h.langCode,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `t(${key})`,
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="mock-loading" />,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => h.bibleKey,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: async (bibleKey: string) => {
        return h.localeByBibleKey[bibleKey];
    },
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        h.widgetPropsList.push(props);
        return (
            <section
                className="mock-widget"
                data-widget-name={props.widgetName}
            >
                <header>{props.title}</header>
                <button
                    type="button"
                    className="mock-widget-close"
                    onClick={props.onClose}
                >
                    close
                </button>
                {props.children}
            </section>
        );
    },
}));
vi.mock('./LookupLangCodeButtonComp', () => ({
    default: (props: any) => {
        h.langButtonPropsList.push(props);
        return (
            <button type="button" className="mock-lang-button">
                {props.bibleLocale ?? 'no locale'}
            </button>
        );
    },
}));
vi.mock('./LocationNameLookupPanelComp', () => ({
    default: () => <div className="mock-lookup-panel">lookup panel</div>,
}));
vi.mock('./LocationNameDetailPanelsComp', () => ({
    default: () => <div className="mock-detail-panels">detail panels</div>,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: (props: any) => (
        <button
            type="button"
            className={`mock-dots ${props.className}`}
            onClick={(event) => {
                props.onOpening?.(event);
            }}
        />
    ),
}));
vi.mock('./lookupRecordMenuHelpers', () => ({
    openLookupRecordDetailPanel: (target: any) => {
        h.openedList.push(target);
    },
    showLookupRecordContextMenu: (event: any, target: any) => {
        h.menuList.push({ event, target });
    },
}));
vi.mock('./RenderVerseLookupTextComp', () => ({
    useVerseLookupMatcher: (langCode: string, kjvShortVerse: string) => {
        h.matcherArgsList.push([langCode, kjvShortVerse]);
        return h.matcher;
    },
    handleMatchClicking: () => undefined,
}));
vi.mock('./verseTextIndexHelpers', () => ({
    decorateLookupMatchesInElement: (...args: any[]) => {
        h.decorateCallList.push(args);
    },
}));
vi.mock('../bible-reader/RenderCustomVerseComp', () => ({
    default: (props: any) => {
        h.customVersePropsList.push(props);
        return (
            <span
                className="mock-custom-verse"
                ref={(element) => {
                    if (element !== null) {
                        props.decorateElement?.(element);
                    }
                }}
                dangerouslySetInnerHTML={{ __html: props.customHtml }}
            />
        );
    },
}));

import {
    LookupManagersContext,
    useLookupManagers,
    useLookupManagersContext,
} from './lookupManagersContext';
import LocationNameLookupToggleComp from './LocationNameLookupToggleComp';
import LocationNameDetailPanelsHostComp from './LocationNameDetailPanelsHostComp';
import RenderLookupRecordItemComp from './RenderLookupRecordItemComp';
import RenderCustomVerseLookupComp from './RenderCustomVerseLookupComp';
import { handleMatchClicking } from './RenderVerseLookupTextComp';
import {
    closeAllDetailPanels,
    closeDetailPanel,
    openDetailPanel,
} from './detailPanelHelpers';

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
    act(() => {
        root.render(node);
    });
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

// The lazy chunks resolve over a few macrotasks; stop as soon as they have.
async function waitFor(check: () => boolean) {
    for (let i = 0; i < 100 && !check(); i++) {
        await flush();
    }
    expect(check()).toBe(true);
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.langCode = 'en';
    h.bibleKey = 'KJV';
    h.localeByBibleKey = {};
    h.deferredList = [];
    h.releaseList = [];
    h.widgetPropsList = [];
    h.langButtonPropsList = [];
    h.openedList = [];
    h.menuList = [];
    h.matcherArgsList = [];
    h.matcher = null;
    h.customVersePropsList = [];
    h.decorateCallList = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    act(() => {
        closeAllDetailPanels();
    });
    container.remove();
    document.body.innerHTML = '';
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('LookupManagersContext', () => {
    function ManagersConsumerComp() {
        const managers = useLookupManagersContext();
        return <span>{(managers as any).label}</span>;
    }

    test('a consumer outside the provider fails loudly', () => {
        expect(() => {
            renderToStaticMarkup(<ManagersConsumerComp />);
        }).toThrow('LookupManagersContext is not provided');
    });

    test('a consumer reads the managers the provider holds', () => {
        const managers = { label: 'the one dataset' } as any;
        render(
            <LookupManagersContext value={managers}>
                <ManagersConsumerComp />
            </LookupManagersContext>,
        );
        expect(container.textContent).toBe('the one dataset');
    });
});

describe('useLookupManagers', () => {
    function ManagersStateComp(_props: Readonly<{ revision: number }>) {
        const managers = useLookupManagers();
        if (managers === undefined) {
            return <span>loading</span>;
        }
        if (managers === null) {
            return <span>failed</span>;
        }
        return <span>{`loaded ${(managers as any).id}`}</span>;
    }

    test('loads the language in use and releases it on unmount', async () => {
        render(<ManagersStateComp revision={1} />);
        expect(container.textContent).toBe('loading');
        expect(
            h.deferredList.map((deferred) => {
                return deferred.langCode;
            }),
        ).toEqual(['en']);

        await act(async () => {
            h.deferredList[0].resolve({ id: 'en-data' });
        });
        expect(container.textContent).toBe('loaded en-data');
        expect(h.releaseList).toEqual([]);

        act(() => {
            root.unmount();
        });
        expect(h.releaseList).toEqual(['en']);
        root = createRoot(container);
    });

    test('a language change drops the old rows at once and loads the new', async () => {
        render(<ManagersStateComp revision={1} />);
        await act(async () => {
            h.deferredList[0].resolve({ id: 'en-data' });
        });
        expect(container.textContent).toBe('loaded en-data');

        h.langCode = 'xx';
        render(<ManagersStateComp revision={2} />);
        // The English managers are still resident, yet no English row stays
        // on screen while the other language loads.
        expect(container.textContent).toBe('loading');
        expect(h.releaseList).toEqual(['en']);
        expect(h.deferredList[1].langCode).toBe('xx');

        await act(async () => {
            h.deferredList[1].resolve({ id: 'xx-data' });
        });
        expect(container.textContent).toBe('loaded xx-data');
    });

    test('a load superseded by another language is ignored when it lands', async () => {
        render(<ManagersStateComp revision={1} />);
        h.langCode = 'yy';
        render(<ManagersStateComp revision={2} />);
        await act(async () => {
            h.deferredList[0].resolve({ id: 'en-late' });
        });
        expect(container.textContent).toBe('loading');
        await act(async () => {
            h.deferredList[1].resolve({ id: 'yy-data' });
        });
        expect(container.textContent).toBe('loaded yy-data');
    });

    test('a failed load is reported and shown as failed', async () => {
        render(<ManagersStateComp revision={1} />);
        const error = new Error('dataset unreadable');
        await act(async () => {
            h.deferredList[0].reject(error);
        });
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(container.textContent).toBe('failed');
    });

    test('a load failing after unmount is still reported, and only that', async () => {
        render(<ManagersStateComp revision={1} />);
        act(() => {
            root.unmount();
        });
        const error = new Error('too late');
        await act(async () => {
            h.deferredList[0].reject(error);
        });
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(h.releaseList).toEqual(['en']);
        root = createRoot(container);
    });
});

describe('LocationNameLookupToggleComp', () => {
    const getToggle = () => {
        return container.querySelector<HTMLButtonElement>(
            'button[aria-label="t(Names and locations lookup)"]',
        )!;
    };

    test('toggles one floating lookup panel into the body', async () => {
        h.bibleKey = 'XXV';
        h.localeByBibleKey = { XXV: 'xx-XX' };
        render(<LocationNameLookupToggleComp />);
        const toggle = getToggle();
        expect(toggle.title).toBe('t(Names and locations lookup)');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        expect(toggle.className).toBe('btn btn-outline-secondary');
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();
        // The language button gets the bible's locale once it is read.
        expect(h.langButtonPropsList[0].bibleLocale).toBeUndefined();
        await waitFor(() => {
            return container.textContent === 'xx-XX';
        });

        act(() => {
            toggle.click();
        });
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(toggle.className).toBe('btn btn-info');
        const portal = document.body.querySelector<HTMLElement>(
            ':scope > .app.app-floating-widget-portal',
        )!;
        expect(portal.dataset.bsTheme).toBe('dark');
        expect(h.widgetPropsList.at(-1)).toMatchObject({
            title: 't(Names and locations lookup)',
            widgetName: 'Names and locations lookup',
            persistKey: 'floating-widget-rect-location-name-lookup',
            options: {
                width: 340,
                height: 560,
                minWidth: 280,
                minHeight: 260,
            },
        });
        await waitFor(() => {
            return portal.querySelector('.mock-lookup-panel') !== null;
        });
        expect(portal.querySelector('.mock-loading')).toBeNull();

        // Pressing it again closes the panel; so does the widget's own close.
        act(() => {
            toggle.click();
        });
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();
        act(() => {
            toggle.click();
        });
        act(() => {
            document
                .querySelector<HTMLButtonElement>('.mock-widget-close')!
                .click();
        });
        expect(
            document.querySelector('.app-floating-widget-portal'),
        ).toBeNull();
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
});

describe('LocationNameDetailPanelsHostComp', () => {
    test('renders nothing until a record is opened, and again once closed', async () => {
        render(<LocationNameDetailPanelsHostComp />);
        expect(container.innerHTML).toBe('');

        act(() => {
            openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        });
        await waitFor(() => {
            return container.querySelector('.mock-detail-panels') !== null;
        });

        act(() => {
            closeDetailPanel('name:n-1:en');
        });
        expect(container.innerHTML).toBe('');
    });
});

describe('RenderLookupRecordItemComp', () => {
    const record = {
        id: 'n-1',
        name: '✝✝✝✝',
        kjvName: 'Moses',
        title: 'Leader of Israel',
        iconClass: 'bi bi-person',
    };

    test('shows the name, its English name, where it was found and its title', () => {
        render(
            <ul>
                <RenderLookupRecordItemComp
                    kind="name"
                    record={record}
                    extraLabel="Exodus 2:10"
                />
            </ul>,
        );
        const button = container.querySelector<HTMLButtonElement>(
            '.location-name-lookup__record-button',
        )!;
        expect(button.title).toBe('Leader of Israel');
        expect(button.querySelector('i')!.className).toBe(
            'bi bi-person mt-1 text-secondary',
        );
        expect(
            button.querySelector('.location-name-lookup__kjv-name')!
                .textContent,
        ).toBe('(Moses)');
        expect(button.querySelector('.text-truncate')!.textContent).toBe(
            '✝✝✝✝(Moses)Exodus 2:10',
        );
        expect(
            button.querySelector('.location-name-lookup__title')!.textContent,
        ).toBe('Leader of Israel');
    });

    test('without a title it is named by its display name, and nothing else shows', () => {
        render(
            <ul>
                <RenderLookupRecordItemComp
                    kind="location"
                    record={{
                        ...record,
                        id: 'l-1',
                        name: 'Egypt',
                        kjvName: '',
                        title: '',
                    }}
                />
            </ul>,
        );
        const button = container.querySelector<HTMLButtonElement>(
            '.location-name-lookup__record-button',
        )!;
        expect(button.title).toBe('Egypt');
        expect(button.querySelector('.text-truncate')!.textContent).toBe(
            'Egypt',
        );
        expect(button.querySelector('.location-name-lookup__title')).toBeNull();

        render(
            <ul>
                <RenderLookupRecordItemComp
                    kind="name"
                    record={{ ...record, title: '' }}
                />
            </ul>,
        );
        expect(
            container.querySelector<HTMLButtonElement>(
                '.location-name-lookup__record-button',
            )!.title,
        ).toBe('✝✝✝✝ (Moses)');
    });

    test('a click opens the record; right click and the dots open its menu', () => {
        render(
            <ul>
                <RenderLookupRecordItemComp kind="name" record={record} />
            </ul>,
        );
        const target = { kind: 'name', recordId: 'n-1', name: '✝✝✝✝' };
        const button = container.querySelector<HTMLButtonElement>(
            '.location-name-lookup__record-button',
        )!;
        act(() => {
            button.click();
        });
        expect(h.openedList).toEqual([target]);

        const contextEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            button.dispatchEvent(contextEvent);
        });
        act(() => {
            container
                .querySelector<HTMLButtonElement>(
                    '.mock-dots.location-name-lookup__record-menu',
                )!
                .click();
        });
        expect(h.menuList).toHaveLength(2);
        expect(h.menuList[0].event).toBe(contextEvent);
        expect(h.menuList[0].target).toEqual(target);
        expect(h.menuList[1].event).toBeInstanceOf(MouseEvent);
        expect(h.menuList[1].event.type).toBe('click');
        expect(h.menuList[1].target).toEqual(target);
        // The menu never opens the record behind it.
        expect(h.openedList).toHaveLength(1);
    });
});

describe('RenderCustomVerseLookupComp', () => {
    const bibleItem = { bibleKey: 'XXV' } as any;

    test('with no matcher yet the custom HTML is rendered undecorated', () => {
        render(
            <RenderCustomVerseLookupComp
                bibleItem={bibleItem}
                customHtml="<b>Abram</b> went"
                kjvShortVerse="GEN 12:4"
                lookupLangCode="xx"
            />,
        );
        expect(h.matcherArgsList).toEqual([['xx', 'GEN 12:4']]);
        expect(h.customVersePropsList[0]).toMatchObject({
            bibleItem,
            customHtml: '<b>Abram</b> went',
            decorateElement: undefined,
        });
        expect(container.innerHTML).toBe(
            '<span class="mock-custom-verse"><b>Abram</b> went</span>',
        );
        expect(h.decorateCallList).toEqual([]);
    });

    test('a matcher decorates the injected element with the click handler', () => {
        const matcher = (_text: string) => {
            return [];
        };
        h.matcher = matcher;
        render(
            <RenderCustomVerseLookupComp
                bibleItem={bibleItem}
                customHtml="<b>Abram</b> went"
                kjvShortVerse="GEN 12:4"
                lookupLangCode="en"
            />,
        );
        expect(h.decorateCallList).toHaveLength(1);
        const [element, findMatchList, onActivate] = h.decorateCallList[0];
        expect(element).toBe(container.querySelector('.mock-custom-verse'));
        expect(findMatchList).toBe(matcher);
        expect(onActivate).toBe(handleMatchClicking);
    });
});
