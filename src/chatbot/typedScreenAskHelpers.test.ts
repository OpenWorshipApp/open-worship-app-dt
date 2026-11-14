import { afterEach, describe, expect, it } from 'vitest';

import { setChatTranslator } from './chatTranHelpers';
import {
    readScreenAsk,
    readTypedScreenAsk,
    type ScreenAskWordsType,
} from './typedScreenAskHelpers';

// A made-up language, so that no language is named here: its words are
// nonsense, written the way a package writes them.
const WORDS: ScreenAskWordsType = {
    howTo: ['quomx'],
    screen: ['zorp*'],
    bible: ['biblx*'],
    transition: ['flazz*'],
    lineSync: ['synqx'],
    display: ['monx*'],
    group: ['klump*'],
    lock: ['blik*'],
    stage: ['stagx'],
    versions: ['vrinx*'],
    select: ['tikx … zorp*'],
    clear: ['wumpo*'],
    style: ['biggx'],
    exclude: ['songx*'],
};

describe('readTypedScreenAsk', () => {
    it('reads a control with a screen named, or the Bible on the Presenter', () => {
        expect(readTypedScreenAsk('biggx zorp 1', WORDS, true)).toBe('style');
        expect(readTypedScreenAsk('biggx biblxa', WORDS, true)).toBe('style');
        expect(readTypedScreenAsk('biggx biblxa', WORDS, true, 'reader')).toBe(
            null,
        );
        expect(readTypedScreenAsk('blik zorpa 2', WORDS, true)).toBe('lock');
        expect(readTypedScreenAsk('tikx the zorp 1', WORDS, true)).toBe(
            'select',
        );
        expect(readTypedScreenAsk('blik it', WORDS, true)).toBe(null);
    });

    it('reads a transition and Line Sync alone, on the Presenter only', () => {
        expect(readTypedScreenAsk('flazz now', WORDS, true)).toBe('transition');
        expect(readTypedScreenAsk('synqx', WORDS, true)).toBe('lineSync');
        expect(readTypedScreenAsk('flazz now', WORDS, true, 'reader')).toBe(
            null,
        );
    });

    it('takes the first control in the order the English reader reads', () => {
        expect(readTypedScreenAsk('flazz klump zorp', WORDS, true)).toBe(
            'transition',
        );
        expect(readTypedScreenAsk('wumpo biggx zorp', WORDS, true)).toBe(
            'clear',
        );
    });

    it('reads nothing in a how-to, another subject, a command or a long line', () => {
        expect(readTypedScreenAsk('quomx biggx zorp', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('songxa biggx zorp', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('/clear zorp', WORDS, true)).toBe(null);
        expect(
            readTypedScreenAsk(`blik zorp ${'x'.repeat(600)}`, WORDS, true),
        ).toBe(null);
        expect(readTypedScreenAsk('', WORDS, true)).toBe(null);
    });

    // A Bible's short name is in both lists: beside a number it is the
    // passage put up in that Bible, unless a version word, a second Bible
    // or a screen is named.
    it('reads a Bible named beside a number as the passage, not versions', () => {
        const nameWords: ScreenAskWordsType = {
            ...WORDS,
            bible: ['biblx*', 'nivx', 'kjvx'],
            versions: ['vrinx*', 'nivx', 'kjvx'],
        };
        expect(readTypedScreenAsk('show psalmx 23 nivx', nameWords, true)).toBe(
            null,
        );
        expect(readTypedScreenAsk('nivx please', nameWords, true)).toBe(
            'versions',
        );
        expect(
            readTypedScreenAsk('nivx and kjvx for psalmx 23', nameWords, true),
        ).toBe('versions');
        expect(
            readTypedScreenAsk('vrinx nivx for psalmx 23', nameWords, true),
        ).toBe('versions');
        expect(
            readTypedScreenAsk('show psalmx 23 nivx zorp 2', nameWords, true),
        ).toBe('versions');
    });

    // EC-623: a screen called by its number is the screens' whatever the
    // words beside it, which no list holds.
    it('reads a screen called by its number as the screens, with no control named', () => {
        expect(readTypedScreenAsk('wibble zorp 1', WORDS, true)).toBe('screen');
        expect(readTypedScreenAsk('zorpa #2 wibble', WORDS, true)).toBe(
            'screen',
        );
        expect(readTypedScreenAsk('zorp 0, wibble', WORDS, true)).toBe(
            'screen',
        );
        // A control named beside it is still the control.
        expect(readTypedScreenAsk('blik zorp 1', WORDS, true)).toBe('lock');
        // No number, a verse's number or a longer one: nothing.
        expect(readTypedScreenAsk('wibble zorp', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('wibble zorp 3:16', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('wibble zorp 3.16', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('wibble zorp 123', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('wibble 1 zorp', WORDS, true)).toBe(null);
        // A number with no screen's word: nothing.
        expect(readTypedScreenAsk('wibble 1', WORDS, true)).toBe(null);
        // A how-to and another subject: nothing.
        expect(readTypedScreenAsk('quomx zorp 1', WORDS, true)).toBe(null);
        expect(readTypedScreenAsk('songxa zorp 1', WORDS, true)).toBe(null);
    });

    // A language whose word for a screen is also an everyday word lists it
    // only with a number after it, as one entry: the number is the entry's.
    it('reads a screen word that holds its own number', () => {
        const numberWords: ScreenAskWordsType = {
            ...WORDS,
            screen: ['glub 1', 'glub 2'],
        };
        expect(readTypedScreenAsk('wibble glub 1', numberWords, true)).toBe(
            'screen',
        );
        expect(readTypedScreenAsk('glub 2, wibble', numberWords, true)).toBe(
            'screen',
        );
        expect(readTypedScreenAsk('wibble glub 12', numberWords, true)).toBe(
            null,
        );
        expect(readTypedScreenAsk('wibble glub 1:16', numberWords, true)).toBe(
            null,
        );
    });

    // A made-up script whose letters and digits are its own: the number is
    // read where the screen's word ends, in the script's own digits too.
    it('reads the number after a screen word of other letters, in any digits', () => {
        const ownLetterPattern = /[x\u{1D7D8}-\u{1D7E1}]/u;
        const ownWords: ScreenAskWordsType = { screen: ['tv'] };
        expect(
            readTypedScreenAsk(
                'xxtv 1xx',
                ownWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe('screen');
        // A double-struck digit, of the script, two code units long.
        expect(
            readTypedScreenAsk(
                'x\u{1D7D8}xtv \u{1D7D9}xx',
                ownWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe('screen');
        expect(
            readTypedScreenAsk(
                'xxtvxx',
                ownWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe(null);
    });

    it('matches inside words where the script does not space them', () => {
        expect(readTypedScreenAsk('xxblikxxzorpxx', WORDS, false)).toBe('lock');
        expect(readTypedScreenAsk('xxblikxxzorpxx', WORDS, true)).toBe(null);
    });

    // A made-up script whose one letter is "x": its words glue to each
    // other, and a word of other letters among them -- a "tv" written in
    // Latin -- is a whole word of those letters.
    it('matches its own letters anywhere, other letters as a whole word', () => {
        const ownLetterPattern = /[x]/u;
        const ownWords: ScreenAskWordsType = {
            screen: ['xzorx'],
            lock: ['xblikx'],
        };
        expect(
            readTypedScreenAsk(
                'qqxblikxqqxzorxqq',
                ownWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe('lock');
        // Touched by the script's own letters, as it is written.
        expect(
            readTypedScreenAsk(
                'xxblikxxzorpxx',
                WORDS,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe('lock');
        // Inside a longer word of its own letters: another word.
        expect(
            readTypedScreenAsk(
                'ablikb zorp',
                WORDS,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe(null);
        const shortWords = { ...WORDS, versions: ['rin'] };
        expect(
            readTypedScreenAsk(
                'the vrinxer of the zorpa',
                shortWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe(null);
        expect(
            readTypedScreenAsk(
                'the rin of the zorpa',
                shortWords,
                false,
                'presenter',
                ownLetterPattern,
            ),
        ).toBe('versions');
    });
});

describe('readScreenAsk', () => {
    it('reads English by the English reader, a how-to included', () => {
        expect(readScreenAsk('lock screen 1', 'presenter', 'en')).toBe('lock');
        expect(
            readScreenAsk('how do I lock screen 1?', 'presenter', 'en'),
        ).toBe(null);
        expect(readScreenAsk('put John 3:16 up', 'presenter', 'en')).toBe(null);
    });

    it('leaves a numbered screen in English to the English reader', () => {
        expect(readScreenAsk('is screen 1 on?', 'presenter', 'en')).toBe(null);
    });
});

// EC-630: in another language a screen added is read by the Mini Screen
// menu's own words alone, as the window shows them -- the label most of
// the line -- never by a line that only holds them. The label here is
// made up, so that no language is named.
describe('a screen added, by the menu label', () => {
    afterEach(() => {
        setChatTranslator(
            (key) => {
                return key;
            },
            (key) => {
                return key;
            },
        );
    });

    function plugLabel(label: string) {
        setChatTranslator(
            (key) => {
                return key === 'Add New Screen' ? label : key;
            },
            (key) => {
                return key;
            },
        );
    }

    it('reads the label typed, alone or with a word or two', () => {
        plugLabel('Zzadd Zznew Zzscreen');
        for (const text of [
            'zzadd zznew zzscreen',
            'Zzadd Zznew Zzscreen',
            'Zzadd Zznew Zzscreen please',
            'zzadd zznew zzscreen!',
        ]) {
            expect(readScreenAsk(text, 'presenter', 'xx'), text).toBe(
                'newScreen',
            );
        }
        // English still reads by its own words.
        expect(readScreenAsk('add a new screen', 'presenter', 'xx')).toBe(
            'newScreen',
        );
    });

    it('leaves a line that only holds the label, or holds part of it', () => {
        plugLabel('Zzadd Zznew Zzscreen');
        for (const text of [
            'zzadd zznew zzscreen for the lobby and the hall',
            'zzadd zzscreen',
            'zznew zzscreen',
            'zzaddzznewzzscreenzz',
        ]) {
            expect(readScreenAsk(text, 'presenter', 'xx'), text).toBe(null);
        }
    });

    it('reads nothing when the label has no letters', () => {
        plugLabel('+');
        expect(readScreenAsk('+', 'presenter', 'xx')).toBe(null);
    });
});
