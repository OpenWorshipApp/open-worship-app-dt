// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type AudioPropsType = {
    src: string | undefined | null;
    onStart: () => void;
    onEnd: () => void;
    refreshAudio: () => void;
};

const h = vi.hoisted(() => ({
    getVerseTextLookupLangCode: vi.fn(),
    audioProps: null as null | AudioPropsType,
}));

vi.mock('../../helper/domHelpers', () => ({
    HoverMotionHandler: { lowVisibleClassname: 'app-low-hover-visible' },
}));
vi.mock('../../location-name-lookup/verseTextIndexHelpers', () => ({
    getVerseTextLookupLangCode: h.getVerseTextLookupLangCode,
}));
vi.mock('../../location-name-lookup/RenderVerseLookupTextComp', () => ({
    default: (props: {
        text: string;
        kjvShortVerse: string;
        lookupLangCode: string;
    }) => (
        <span
            className="test-lookup"
            data-kjv={props.kjvShortVerse}
            data-lang={props.lookupLangCode}
        >
            {props.text}
        </span>
    ),
}));
vi.mock('../../location-name-lookup/RenderCustomVerseLookupComp', () => ({
    default: (props: {
        customHtml: string;
        kjvShortVerse: string;
        lookupLangCode: string;
    }) => (
        <span
            className="test-custom-lookup"
            data-kjv={props.kjvShortVerse}
            data-lang={props.lookupLangCode}
        >
            {props.customHtml}
        </span>
    ),
}));
vi.mock('../RenderCustomVerseComp', () => ({
    default: ({ customHtml }: { customHtml: string }) => (
        <span className="test-custom">{customHtml}</span>
    ),
}));
vi.mock('./AudioPlayerComp', () => ({
    default: (props: AudioPropsType) => {
        h.audioProps = props;
        return <span className="test-audio" />;
    },
}));

import RenderVerseTextViewComp from './RenderVerseTextViewComp';

const BIBLE_ITEM = { id: 3, bibleKey: 'KJV' } as any;

function genVerseInfo(overrides: Record<string, unknown> = {}) {
    return {
        verse: 1,
        localeVerse: '1',
        text: 'In the beginning',
        customText: null,
        bibleKey: 'KJV',
        kjvBibleVersesKey: 'GEN 1:1',
        bibleVersesKey: '(KJV) GEN 1:1',
        isRtl: false,
        style: { color: 'red' },
        locale: 'en',
        ...overrides,
    } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.audioProps = null;
    h.getVerseTextLookupLangCode.mockReturnValue(null);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

const handlers = {
    refreshAudio: vi.fn(),
    handleAudioStarting: vi.fn(),
    handleAudioEnding: vi.fn(),
};

async function render({
    verseInfo = genVerseInfo(),
    isAudioEnabled = false,
    isExtraVerses = false,
    audioSrcMap = {} as { [key: string]: string | undefined | null },
} = {}) {
    await act(async () => {
        root.render(
            <RenderVerseTextViewComp
                bibleItem={BIBLE_ITEM}
                verseInfo={verseInfo}
                isAudioEnabled={isAudioEnabled}
                isExtraVerses={isExtraVerses}
                audioSrcMap={audioSrcMap}
                {...handlers}
            />,
        );
    });
}

function getAnchor() {
    return host.querySelector<HTMLSpanElement>('[data-bible-verse-key]')!;
}

describe('the verse text', () => {
    test('plain text sits in the mark anchor of its own bible', async () => {
        await render();
        const anchor = getAnchor();
        expect(anchor.getAttribute('data-bible-verse-key')).toBe(
            '(KJV) GEN 1:1',
        );
        expect(anchor.dataset.dictLocale).toBe('en');
        expect(anchor.style.color).toBe('red');
        expect(anchor.textContent).toBe('In the beginning');
        expect(h.getVerseTextLookupLangCode).toHaveBeenCalledWith('KJV', 'en');
    });

    test('text with a lookup index is decorated in its language', async () => {
        h.getVerseTextLookupLangCode.mockReturnValue('km');
        await render();
        const lookup = getAnchor().querySelector('.test-lookup')!;
        expect(lookup.textContent).toBe('In the beginning');
        expect(lookup.getAttribute('data-kjv')).toBe('GEN 1:1');
        expect(lookup.getAttribute('data-lang')).toBe('km');
    });

    test('custom verse html renders as custom html', async () => {
        await render({
            verseInfo: genVerseInfo({ customText: '<i>Jesus wept</i>' }),
        });
        expect(getAnchor().querySelector('.test-custom')!.textContent).toBe(
            '<i>Jesus wept</i>',
        );
        expect(host.querySelector('.test-custom-lookup')).toBeNull();
    });

    test('custom verse html is decorated too when it can carry matches', async () => {
        h.getVerseTextLookupLangCode.mockReturnValue('en');
        await render({
            verseInfo: genVerseInfo({ customText: '<i>Jesus wept</i>' }),
        });
        const lookup = getAnchor().querySelector('.test-custom-lookup')!;
        expect(lookup.textContent).toBe('<i>Jesus wept</i>');
        expect(lookup.getAttribute('data-kjv')).toBe('GEN 1:1');
        expect(host.querySelector('.test-custom')).toBeNull();
    });
});

describe('a verse among compared bibles', () => {
    test('the bible key label stays out of the marked text', async () => {
        await render({
            verseInfo: genVerseInfo({ bibleKey: 'KHM', isRtl: true }),
            isExtraVerses: true,
        });
        const row = host.querySelector<HTMLDivElement>('.text.d-flex')!;
        expect(row.dataset.dictLocale).toBe('en');
        expect(row.firstElementChild!.className).toBe(
            'app-top-hover-motion-10 flex-fill rtl',
        );
        // Marks are offsets into the anchor's text: the label is not in it.
        expect(getAnchor().textContent).toBe('In the beginning');
        const label = getAnchor().nextElementSibling as HTMLSpanElement;
        expect(label.textContent).toBe('KHM');
        expect(label.className).toBe(
            'text-muted px-1 app-low-hover-visible-10',
        );
    });

    test('a left-to-right bible is not flipped', async () => {
        await render({ isExtraVerses: true });
        expect(
            host.querySelector('.text.d-flex')!.firstElementChild!.className,
        ).toBe('app-top-hover-motion-10 flex-fill');
    });
});

describe('the audio player', () => {
    test('plays the verse once audio is on and the verse has a source', async () => {
        await render({
            isAudioEnabled: true,
            audioSrcMap: { '(KJV) GEN 1:1': 'src://a.mp3' },
        });
        expect(host.querySelector('.test-audio')).not.toBeNull();
        expect(h.audioProps).toEqual({
            src: 'src://a.mp3',
            onStart: handlers.handleAudioStarting,
            onEnd: handlers.handleAudioEnding,
            refreshAudio: handlers.refreshAudio,
        });
    });

    test('a verse still loading its audio gets the player too', async () => {
        await render({
            isAudioEnabled: true,
            audioSrcMap: { '(KJV) GEN 1:1': undefined },
        });
        expect(host.querySelector('.test-audio')).not.toBeNull();
        expect(h.audioProps!.src).toBeUndefined();
    });

    test('no player without audio, or for a verse never asked for', async () => {
        await render({
            isAudioEnabled: false,
            audioSrcMap: { '(KJV) GEN 1:1': 'src://a.mp3' },
        });
        expect(host.querySelector('.test-audio')).toBeNull();
        await render({
            isAudioEnabled: true,
            audioSrcMap: { '(KJV) GEN 1:2': 'src://b.mp3' },
        });
        expect(host.querySelector('.test-audio')).toBeNull();
    });
});
