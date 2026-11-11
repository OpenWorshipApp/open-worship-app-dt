/**
 * The KJV words a lay preacher stumbles on, each explained by a verse that
 * says what it is (BN-91, 2026-11-11, the goal _chatbot completely smart
 * enough to help prepare a best preaching lesson_).
 *
 * Read blind, the lessons' factual errors after BN-86 were the model's own
 * memory of a word: the hundred pence of Matthew 18:28 was "a small amount a
 * day's wage might cover" in three runs of four (a penny WAS the day's wage,
 * Matthew 20:2), the sling "a shepherd's tool rather than a soldier's"
 * (Judges 20:16), the priest and the Levite "the highest officials". A
 * new lesson's passage read carries the entries whose words it holds, so a
 * What it means line has the Bible's own explanation in front of it.
 *
 * English, the KJV's words: a passage read from a Bible in another language
 * matches none and gets none. Only words whose meaning holds wherever they
 * stand: "anoint" (a host's oil in Psalm 23:5, a king's in 1 Samuel 16) and
 * "firstborn" (Christ's place in Colossians 1) are left out, and an entry
 * says where its sense holds ("in Israel", "in the Gospels") or names every
 * sense the Bible gives it: the first run's "a shekel is a weight of silver
 * paid as money" was said of Goliath's coat of brass. Pure.
 */

type LessonWordGlossType = {
    // The words as the KJV writes them, whole words, any case.
    pattern: RegExp;
    // What is shown: the words, then what Scripture says they are.
    text: string;
};

const LESSON_WORD_GLOSS_LIST: LessonWordGlossType[] = [
    {
        // Said as a count: "penny, pence: a labourer's pay for one day" came
        // back as "a hundred pence was roughly a labourer's pay for one day".
        pattern: /\b(?:penny|pence|pennyworth)\b/i,
        text:
            'penny, pence: ONE penny was a labourer\'s pay for one day -- "he ' +
            'had agreed with the labourers for a penny a day" (Matthew 20:2) ' +
            "-- so pence are days' pay: two pence, two days' pay; a hundred " +
            "pence, a hundred days' pay",
    },
    {
        pattern: /\btalents?\b/i,
        text:
            'talent: a great weight of silver or gold -- the whole ' +
            'tabernacle\'s candlestick was made "of a talent of pure gold" ' +
            '(Exodus 25:39)',
    },
    {
        pattern: /\b(?:mites?|farthings?)\b/i,
        text:
            'mite, farthing: the smallest coins -- "two mites, which make a ' +
            'farthing" (Mark 12:42)',
    },
    {
        pattern: /\bshekels?\b/i,
        text:
            'shekel: a measure of weight -- of silver weighed out as money ' +
            '("four hundred shekels of silver", Genesis 23:16), and of brass ' +
            "and iron, as Goliath's coat and spear were weighed (1 Samuel " +
            '17:5, 7)',
    },
    {
        pattern: /\bpublicans?\b/i,
        text:
            'publican: a gatherer of taxes -- "Exact no more than that which ' +
            'is appointed you" (Luke 3:12-13) -- counted with sinners ' +
            '(Matthew 9:11)',
    },
    {
        pattern: /\blevites?\b/i,
        text:
            'Levite: of the tribe of Levi, given to the priests to serve the ' +
            'tabernacle, not a priest himself (Numbers 3:6-10)',
    },
    {
        pattern: /\bpriests?\b/i,
        text:
            "priest: in Israel, of Aaron's sons, who offered the sacrifices " +
            '(Exodus 28:1; Leviticus 1:5)',
    },
    {
        pattern: /\bsamaritans?\b/i,
        text:
            'Samaritan: people the Jews kept apart from -- "the Jews have no ' +
            'dealings with the Samaritans" (John 4:9)',
    },
    {
        pattern: /\bpharisees?\b/i,
        text: 'Pharisee: "the most straitest sect of our religion" (Acts 26:5)',
    },
    {
        pattern: /\bscribes?\b/i,
        text:
            'scribe: in the Gospels, a teacher of the law -- "The scribes ' +
            'and the Pharisees sit in Moses\' seat" (Matthew 23:2)',
    },
    {
        pattern: /\bhyssop\b/i,
        text:
            'hyssop: a plant dipped to sprinkle blood or water for cleansing ' +
            '(Exodus 12:22; Numbers 19:18)',
    },
    {
        // The one: Peter's "three tabernacles" (Matthew 17:4) are booths.
        pattern: /\btabernacle\b/i,
        text:
            'tabernacle: the tent where God dwelt among his people -- "let ' +
            'them make me a sanctuary; that I may dwell among them" (Exodus ' +
            '25:8)',
    },
    {
        pattern: /\b(?:sling|slings|slingers?)\b/i,
        text:
            "sling: a weapon of war as well as a shepherd's -- seven hundred " +
            'chosen men "could sling stones at an hair breadth" (Judges 20:16)',
    },
    {
        pattern: /\bcubits?\b/i,
        text:
            'cubit: a measure of length, "after the cubit of a man" ' +
            '(Deuteronomy 3:11)',
    },
    {
        pattern: /\b(?:lepers?|leprosy|leprous)\b/i,
        text:
            'leper: unclean, to "dwell alone; without the camp" (Leviticus ' +
            '13:45-46)',
    },
    {
        pattern: /\bsackcloth\b/i,
        text:
            'sackcloth: worn in mourning and repentance (Genesis 37:34; Jonah ' +
            '3:5)',
    },
    {
        pattern: /\buncircumcised\b/i,
        text:
            'uncircumcised: outside the covenant whose token God gave Abraham ' +
            '(Genesis 17:10-11)',
    },
    {
        pattern: /\bcenturion\b/i,
        text:
            'centurion: an officer over soldiers -- "having under me ' +
            'soldiers" (Luke 7:8)',
    },
    {
        pattern: /\bsabbath\b/i,
        text: 'sabbath: the seventh day, kept holy to the LORD (Exodus 20:8-10)',
    },
    {
        // As compassion only: Judas' "bowels gushed out" (Acts 1:18).
        pattern: /\bbowels (?:of (?:mercies|compassion)|and mercies)\b/i,
        text:
            'bowels (of mercies): deep-felt compassion -- "bowels of mercies, ' +
            'kindness" (Colossians 3:12)',
    },
    // BN-92: the errors blind readers found again and again after BN-91.
    {
        // Psalm 51:10's "create" was "making something out of nothing" in
        // four reads, and once more when this entry opened on Genesis 1:1:
        // it opens on what corrects that now.
        pattern: /\bcreate(?:d|th)?\b/i,
        text:
            "create: God's own work, and not only out of nothing -- he " +
            '"created man" (Genesis 1:27) "of the dust of the ground" ' +
            '(Genesis 2:7), and says "I create Jerusalem a rejoicing" (Isaiah ' +
            '65:18)',
    },
    {
        // "A span is the width of a hand".
        pattern: /\bspan\b/i,
        text:
            'span: a measure of the hand spread wide, about half a cubit -- God ' +
            '"meted out heaven with the span" (Isaiah 40:12)',
    },
    {
        // Saul's armour "was too heavy" in two lessons.
        pattern: /\b(?:prove|proved|proveth|provest|proving)\b/i,
        text:
            'prove, proved: to test, to try out -- "prove me now herewith, ' +
            'saith the LORD of hosts" (Malachi 3:10); sometimes to show a ' +
            'thing true, "proving that this is very Christ" (Acts 9:22)',
    },
    {
        // "The spiritual agony of a life lived without grace", three times.
        pattern: /\btormentors\b/i,
        text:
            'tormentors: those the angry lord delivered the servant to, "till ' +
            'he should pay all that was due unto him"; and Jesus says, "So ' +
            'likewise shall my heavenly Father do also unto you, if ye from ' +
            'your hearts forgive not" (Matthew 18:34-35)',
    },
    {
        // Jesus had been called "the truly broken and contrite one".
        pattern: /\bcontrite\b/i,
        text:
            'contrite: crushed and humbled in spirit -- over sin, "a broken ' +
            'and a contrite heart" (Psalm 51:17); or crushed by trouble, the ' +
            'LORD "saveth such as be of a contrite spirit" (Psalm 34:18)',
    },
    {
        // "Not animal offerings", with the bullocks in the same verse.
        pattern: /\bsacrifices of righteousness\b/i,
        text:
            'sacrifices of righteousness: offerings brought to the LORD ' +
            'rightly -- "Offer the sacrifices of righteousness, and put your ' +
            'trust in the LORD" (Psalm 4:5); Psalm 51:19 names them with ' +
            '"burnt offering and whole burnt offering"',
    },
    {
        // "A term for wiping a debt off a record".
        pattern: /\bblot(?:s|ted|teth)?\b/i,
        text:
            'blot out: to wipe away, to erase -- "I have blotted out, as a ' +
            'thick cloud, thy transgressions" (Isaiah 44:22); a blot, a stain ' +
            '(Job 31:7)',
    },
    {
        // Psalm 23:5's oil was "a shepherd's treatment for a sheep's wounds".
        pattern: /\bhead with oil\b/i,
        text:
            "a head anointed with oil: a host's honour to a guest at his " +
            'table -- Jesus to the host who had not: "My head with oil thou ' +
            'didst not anoint" (Luke 7:46)',
    },
    {
        // "The biblical standard for restitution when someone has been
        // cheated" (Zacchaeus, Luke 19:8).
        pattern: /\bfourfold\b/i,
        text:
            'fourfold: four times over -- what the law asked for a stolen ' +
            'sheep, "four sheep for a sheep" (Exodus 22:1; 2 Samuel 12:6); ' +
            'for goods taken falsely it asked them back "in the principal" ' +
            'and "the fifth part more" (Leviticus 6:5)',
    },
    {
        // "Interlocking metal rings", in two lessons.
        pattern: /\bcoats? of mail\b/i,
        text:
            'coat of mail: body armour of overlapping metal scales -- ' +
            'Goliath\'s weighed "five thousand shekels of brass" (1 Samuel ' +
            '17:5)',
    },
    {
        // Tied to "John on his island exile" in two reads.
        pattern: /\bno more sea\b/i,
        text:
            'the sea, in "no more sea": the restless deep -- "the wicked are ' +
            'like the troubled sea, when it cannot rest" (Isaiah 57:20); the ' +
            'beast rose "up out of the sea" (Revelation 13:1)',
    },
];

// The most entries one passage read carries: a long story holds many.
const MAX_LESSON_WORD_GLOSSES = 8;

/** The explanations of the words a passage's text holds, in list order. */
export function findLessonWordGlosses(text: string) {
    const passageText = String(text ?? '');
    return LESSON_WORD_GLOSS_LIST.filter((gloss) => {
        return gloss.pattern.test(passageText);
    })
        .slice(0, MAX_LESSON_WORD_GLOSSES)
        .map((gloss) => gloss.text);
}

/** Said over a new lesson's passage read when it holds such words. */
export function genLessonWordGlossNote(glossList: readonly string[]) {
    if (glossList.length === 0) {
        return null;
    }
    // Told only "a What it means line says of them only this", a point
    // whose verses held none of the words wrote "No specific words in
    // these verses require further explanation from Scripture" (BN-92).
    return [
        '(Words in these verses, as Scripture itself explains them -- where ' +
            'a "What it means" line explains one, it says this, never what ' +
            'it remembers; every point still explains the words and ' +
            'pictures of its own verses:',
        ...glossList.map((gloss) => `- ${gloss}`),
        ')',
    ].join('\n');
}
