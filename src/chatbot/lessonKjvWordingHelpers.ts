/**
 * A verse quoted in a modern translation's words, put back into the King
 * James Version's (BN-137, 2026-11-11, the goal _chatbot completely smart
 * enough to help prepare a best preaching lesson_).
 *
 * Read blind, the factual errors left in the lessons were quotations of a
 * verse OUTSIDE the passage -- in Pointing to Jesus most -- in the words a
 * modern translation gives it: Philippians 2:7 as "emptied himself" (both
 * readers), John 1:14 as "became flesh". The passage is read from the KJV
 * and quoted as it reads; a verse remembered from elsewhere names no
 * reference, so no check reads it, and is too short for the passage's
 * misquote check. These are the wordings of the verses quoted most, each
 * with the KJV's own words for it and the verse they stand in -- every one
 * held to the app's own KJV by a test.
 *
 * A quotation is changed only when its other words are that verse's own:
 * a hymn's "emptied Himself of all but love" is not Scripture and is left
 * as written. English, the KJV's words: a note in another Bible's language
 * matches none. Pure.
 */

export type KjvWordingType = {
    // As a modern translation words it: whole words, any case, any marks
    // between them.
    modern: string;
    // The KJV's words for the same.
    kjv: string;
    ref: string;
    // The verse as the KJV reads it, whole.
    verse: string;
};

const KJV_JOHN_1_14 =
    'And the Word was made flesh, and dwelt among us, (and we beheld his ' +
    'glory, the glory as of the only begotten of the Father,) full of grace ' +
    'and truth.';
const KJV_JOHN_3_16 =
    'For God so loved the world, that he gave his only begotten Son, that ' +
    'whosoever believeth in him should not perish, but have everlasting ' +
    'life.';
const KJV_PHILIPPIANS_4_13 =
    'I can do all things through Christ which strengtheneth me.';
const KJV_PSALM_51_10 =
    'Create in me a clean heart, O God; and renew a right spirit within me.';
const KJV_PROVERBS_3_5 =
    'Trust in the LORD with all thine heart; and lean not unto thine own ' +
    'understanding.';
const KJV_PROVERBS_3_6 =
    'In all thy ways acknowledge him, and he shall direct thy paths.';
const KJV_ISAIAH_40_31 =
    'But they that wait upon the LORD shall renew their strength; they ' +
    'shall mount up with wings as eagles; they shall run, and not be weary; ' +
    'and they shall walk, and not faint.';

const KJV_1_PETER_2_24 =
    'Who his own self bare our sins in his own body on the tree, that we, ' +
    'being dead to sins, should live unto righteousness: by whose stripes ' +
    'ye were healed.';
const KJV_1_CORINTHIANS_11_23 =
    'For I have received of the Lord that which also I delivered unto you, ' +
    'That the Lord Jesus the same night in which he was betrayed took bread:';
const KJV_1_CORINTHIANS_11_24 =
    'And when he had given thanks, he brake it, and said, Take, eat: this ' +
    'is my body, which is broken for you: this do in remembrance of me.';
const KJV_1_CORINTHIANS_11_25 =
    'After the same manner also he took the cup, when he had supped, ' +
    'saying, This cup is the new testament in my blood: this do ye, as oft ' +
    'as ye drink it, in remembrance of me.';
const KJV_1_CORINTHIANS_11_26 =
    'For as often as ye eat this bread, and drink this cup, ye do shew the ' +
    "Lord's death till he come.";

const KJV_RUTH_1_16 =
    'And Ruth said, Entreat me not to leave thee, or to return from ' +
    'following after thee: for whither thou goest, I will go; and where ' +
    'thou lodgest, I will lodge: thy people shall be my people, and thy God ' +
    'my God:';
const KJV_ISAIAH_53_7 =
    'He was oppressed, and he was afflicted, yet he opened not his mouth: ' +
    'he is brought as a lamb to the slaughter, and as a sheep before her ' +
    'shearers is dumb, so he openeth not his mouth.';

export const KJV_WORDING_LIST: readonly KjvWordingType[] = [
    // BN-232 (the second held-out set, ab75: both readers counted each): a
    // wedding message quoted Ruth 1:16 and Matthew 28:20 in a modern
    // translation's words, and a James lesson Isaiah 53:7 as "led as a
    // lamb". (1 Kings 18:39 quoted "The LORD, he is God" is left out: it is
    // Deuteronomy 4:35's own KJV wording, which this would rewrite.)
    {
        modern: 'where you go I will go',
        kjv: 'whither thou goest, I will go',
        ref: 'Ruth 1:16',
        verse: KJV_RUTH_1_16,
    },
    {
        modern: 'your people will be my people',
        kjv: 'thy people shall be my people',
        ref: 'Ruth 1:16',
        verse: KJV_RUTH_1_16,
    },
    {
        modern: 'your people shall be my people',
        kjv: 'thy people shall be my people',
        ref: 'Ruth 1:16',
        verse: KJV_RUTH_1_16,
    },
    {
        modern: 'your God shall be my God',
        kjv: 'thy God my God',
        ref: 'Ruth 1:16',
        verse: KJV_RUTH_1_16,
    },
    {
        modern: 'your God my God',
        kjv: 'thy God my God',
        ref: 'Ruth 1:16',
        verse: KJV_RUTH_1_16,
    },
    {
        modern: 'always, to the very end of the age',
        kjv: 'alway, even unto the end of the world',
        ref: 'Matthew 28:20',
        verse:
            'Teaching them to observe all things whatsoever I have ' +
            'commanded you: and, lo, I am with you alway, even unto the end ' +
            'of the world. Amen.',
    },
    {
        // BN-245 (ab82, M-06, Opus: an error): 1 Corinthians 10:4 quoted as
        // "the rock was Christ" in a lesson on the two builders.
        modern: 'the rock was Christ',
        kjv: 'that Rock was Christ',
        ref: '1 Corinthians 10:4',
        verse:
            'And did all drink the same spiritual drink: for they drank of ' +
            'that spiritual Rock that followed them: and that Rock was Christ.',
    },
    // BN-282 (ab105, Sonnet: an error): 1 Peter 2:24 quoted under a KJV
    // label as "For he himself bore our sins in his body on the tree".
    {
        modern: 'For he himself bore our sins in his body',
        kjv: 'Who his own self bare our sins in his own body',
        ref: '1 Peter 2:24',
        verse: KJV_1_PETER_2_24,
    },
    {
        modern: 'He himself bore our sins in his body',
        kjv: 'Who his own self bare our sins in his own body',
        ref: '1 Peter 2:24',
        verse: KJV_1_PETER_2_24,
    },
    {
        modern: 'by his wounds you have been healed',
        kjv: 'by whose stripes ye were healed',
        ref: '1 Peter 2:24',
        verse: KJV_1_PETER_2_24,
    },
    // BN-274 (ab101, P-14, both readers: an error in both batches): the
    // words of the Lord's Supper, read at every communion, written twice
    // from memory in a modern translation's words.
    {
        modern: 'received from the Lord',
        kjv: 'received of the Lord',
        ref: '1 Corinthians 11:23',
        verse: KJV_1_CORINTHIANS_11_23,
    },
    {
        modern: 'the night he was betrayed',
        kjv: 'the same night in which he was betrayed',
        ref: '1 Corinthians 11:23',
        verse: KJV_1_CORINTHIANS_11_23,
    },
    {
        modern: 'my body, which is for you',
        kjv: 'my body, which is broken for you',
        ref: '1 Corinthians 11:24',
        verse: KJV_1_CORINTHIANS_11_24,
    },
    {
        modern: 'do this in remembrance',
        kjv: 'this do in remembrance',
        ref: '1 Corinthians 11:24',
        verse: KJV_1_CORINTHIANS_11_24,
    },
    {
        modern: 'new covenant in my blood',
        kjv: 'new testament in my blood',
        ref: '1 Corinthians 11:25',
        verse: KJV_1_CORINTHIANS_11_25,
    },
    {
        modern: 'do this, as often as you drink it',
        kjv: 'this do ye, as oft as ye drink it',
        ref: '1 Corinthians 11:25',
        verse: KJV_1_CORINTHIANS_11_25,
    },
    {
        modern: "proclaim the Lord's death until he comes",
        kjv: "shew the Lord's death till he come",
        ref: '1 Corinthians 11:26',
        verse: KJV_1_CORINTHIANS_11_26,
    },
    {
        modern: "proclaim the Lord's death",
        kjv: "shew the Lord's death",
        ref: '1 Corinthians 11:26',
        verse: KJV_1_CORINTHIANS_11_26,
    },
    {
        modern: 'led as a lamb to the slaughter',
        kjv: 'brought as a lamb to the slaughter',
        ref: 'Isaiah 53:7',
        verse: KJV_ISAIAH_53_7,
    },
    {
        modern: 'led like a lamb to the slaughter',
        kjv: 'brought as a lamb to the slaughter',
        ref: 'Isaiah 53:7',
        verse: KJV_ISAIAH_53_7,
    },
    {
        // BN-177 (ab44, Opus: an error): quoted twice as "the battle is of
        // the LORD".
        modern: 'the battle is of the LORD',
        kjv: "the battle is the LORD's",
        ref: '1 Samuel 17:47',
        verse:
            'And all this assembly shall know that the LORD saveth not with ' +
            "sword and spear: for the battle is the LORD's, and he will give " +
            'you into our hands.',
    },
    {
        // BN-191 (ab52, Sonnet: an error): "the giant comes with a sword,
        // and a spear, and a javelin" -- a modern translation's javelin.
        modern: 'a spear, and a javelin',
        kjv: 'with a spear, and with a shield',
        ref: '1 Samuel 17:45',
        verse:
            'Then said David to the Philistine, Thou comest to me with a ' +
            'sword, and with a spear, and with a shield: but I come to thee ' +
            'in the name of the LORD of hosts, the God of the armies of ' +
            'Israel, whom thou hast defied.',
    },
    {
        modern: 'sword and spear and javelin',
        kjv: 'a sword, and with a spear, and with a shield',
        ref: '1 Samuel 17:45',
        verse:
            'Then said David to the Philistine, Thou comest to me with a ' +
            'sword, and with a spear, and with a shield: but I come to thee ' +
            'in the name of the LORD of hosts, the God of the armies of ' +
            'Israel, whom thou hast defied.',
    },
    {
        // BN-182 (ab46, Opus: an error, A 1): "This humility is the
        // "sacrifice of God" that He will not despise" -- the KJV's word is
        // plural.
        modern: 'sacrifice of God',
        kjv: 'sacrifices of God',
        ref: 'Psalm 51:17',
        verse:
            'The sacrifices of God are a broken spirit: a broken and a ' +
            'contrite heart, O God, thou wilt not despise.',
    },
    {
        modern: 'emptied himself',
        kjv: 'made himself of no reputation',
        ref: 'Philippians 2:7',
        verse:
            'But made himself of no reputation, and took upon him the form ' +
            'of a servant, and was made in the likeness of men:',
    },
    {
        modern: 'became obedient to death',
        kjv: 'became obedient unto death',
        ref: 'Philippians 2:8',
        verse:
            'And being found in fashion as a man, he humbled himself, and ' +
            'became obedient unto death, even the death of the cross.',
    },
    {
        modern: 'became flesh',
        kjv: 'was made flesh',
        ref: 'John 1:14',
        verse: KJV_JOHN_1_14,
    },
    {
        modern: 'one and only Son',
        kjv: 'only begotten Son',
        ref: 'John 3:16',
        verse: KJV_JOHN_3_16,
    },
    {
        modern: 'whoever believes in him',
        kjv: 'whosoever believeth in him',
        ref: 'John 3:16',
        verse: KJV_JOHN_3_16,
    },
    {
        modern: 'shall not perish but have eternal life',
        kjv: 'should not perish, but have everlasting life',
        ref: 'John 3:16',
        verse: KJV_JOHN_3_16,
    },
    {
        modern: 'lays down his life for the sheep',
        kjv: 'giveth his life for the sheep',
        ref: 'John 10:11',
        verse:
            'I am the good shepherd: the good shepherd giveth his life for ' +
            'the sheep.',
    },
    {
        modern: 'I am the way and the truth and the life',
        kjv: 'I am the way, the truth, and the life',
        ref: 'John 14:6',
        verse:
            'Jesus saith unto him, I am the way, the truth, and the life: no ' +
            'man cometh unto the Father, but by me.',
    },
    {
        modern: 'Do not be anxious about anything',
        kjv: 'Be careful for nothing',
        ref: 'Philippians 4:6',
        verse:
            'Be careful for nothing; but in every thing by prayer and ' +
            'supplication with thanksgiving let your requests be made known ' +
            'unto God.',
    },
    {
        modern: 'Rejoice in the Lord always',
        kjv: 'Rejoice in the Lord alway',
        ref: 'Philippians 4:4',
        verse: 'Rejoice in the Lord alway: and again I say, Rejoice.',
    },
    {
        modern: 'which transcends all understanding',
        kjv: 'which passeth all understanding',
        ref: 'Philippians 4:7',
        verse:
            'And the peace of God, which passeth all understanding, shall ' +
            'keep your hearts and minds through Christ Jesus.',
    },
    {
        modern: 'I can do all this through him who gives me strength',
        kjv: 'I can do all things through Christ which strengtheneth me',
        ref: 'Philippians 4:13',
        verse: KJV_PHILIPPIANS_4_13,
    },
    {
        modern: 'I can do all things through him who strengthens me',
        kjv: 'I can do all things through Christ which strengtheneth me',
        ref: 'Philippians 4:13',
        verse: KJV_PHILIPPIANS_4_13,
    },
    {
        modern: 'he who began a good work in you',
        kjv: 'he which hath begun a good work in you',
        ref: 'Philippians 1:6',
        verse:
            'Being confident of this very thing, that he which hath begun a ' +
            'good work in you will perform it until the day of Jesus Christ:',
    },
    {
        modern: 'Come to me, all you who are weary and burdened',
        kjv: 'Come unto me, all ye that labour and are heavy laden',
        ref: 'Matthew 11:28',
        verse:
            'Come unto me, all ye that labour and are heavy laden, and I ' +
            'will give you rest.',
    },
    {
        modern: 'seek first his kingdom',
        kjv: 'seek ye first the kingdom of God',
        ref: 'Matthew 6:33',
        verse:
            'But seek ye first the kingdom of God, and his righteousness; ' +
            'and all these things shall be added unto you.',
    },
    {
        modern: 'do not worry about tomorrow',
        kjv: 'Take therefore no thought for the morrow',
        ref: 'Matthew 6:34',
        verse:
            'Take therefore no thought for the morrow: for the morrow shall ' +
            'take thought for the things of itself. Sufficient unto the day ' +
            'is the evil thereof.',
    },
    {
        modern: 'seventy-seven times',
        kjv: 'seventy times seven',
        ref: 'Matthew 18:22',
        verse:
            'Jesus saith unto him, I say not unto thee, Until seven times: ' +
            'but, Until seventy times seven.',
    },
    {
        modern: 'love your neighbor as yourself',
        kjv: 'love thy neighbour as thyself',
        ref: 'Matthew 22:39',
        verse:
            'And the second is like unto it, Thou shalt love thy neighbour ' +
            'as thyself.',
    },
    {
        modern: 'came to seek and to save the lost',
        kjv: 'is come to seek and to save that which was lost',
        ref: 'Luke 19:10',
        verse:
            'For the Son of man is come to seek and to save that which was ' +
            'lost.',
    },
    {
        modern: 'God demonstrates his own love',
        kjv: 'God commendeth his love',
        ref: 'Romans 5:8',
        verse:
            'But God commendeth his love toward us, in that, while we were ' +
            'yet sinners, Christ died for us.',
    },
    {
        modern: 'in all things God works for the good',
        kjv: 'all things work together for good',
        ref: 'Romans 8:28',
        verse:
            'And we know that all things work together for good to them ' +
            'that love God, to them who are the called according to his ' +
            'purpose.',
    },
    {
        modern: 'Love is patient, love is kind',
        kjv: 'Charity suffereth long, and is kind',
        ref: '1 Corinthians 13:4',
        verse:
            'Charity suffereth long, and is kind; charity envieth not; ' +
            'charity vaunteth not itself, is not puffed up,',
    },
    {
        modern: 'My grace is sufficient for you',
        kjv: 'My grace is sufficient for thee',
        ref: '2 Corinthians 12:9',
        verse:
            'And he said unto me, My grace is sufficient for thee: for my ' +
            'strength is made perfect in weakness. Most gladly therefore ' +
            'will I rather glory in my infirmities, that the power of Christ ' +
            'may rest upon me.',
    },
    {
        modern: 'by grace you have been saved',
        kjv: 'by grace are ye saved',
        ref: 'Ephesians 2:8',
        verse:
            'For by grace are ye saved through faith; and that not of ' +
            'yourselves: it is the gift of God:',
    },
    {
        modern: 'I lack nothing',
        kjv: 'I shall not want',
        ref: 'Psalm 23:1',
        verse: 'The LORD is my shepherd; I shall not want.',
    },
    {
        modern: 'He refreshes my soul',
        kjv: 'He restoreth my soul',
        ref: 'Psalm 23:3',
        verse:
            'He restoreth my soul: he leadeth me in the paths of ' +
            "righteousness for his name's sake.",
    },
    {
        modern: 'darkest valley',
        kjv: 'valley of the shadow of death',
        ref: 'Psalm 23:4',
        verse:
            'Yea, though I walk through the valley of the shadow of death, I ' +
            'will fear no evil: for thou art with me; thy rod and thy staff ' +
            'they comfort me.',
    },
    {
        modern: 'close to the brokenhearted',
        kjv: 'nigh unto them that are of a broken heart',
        ref: 'Psalm 34:18',
        verse:
            'The LORD is nigh unto them that are of a broken heart; and ' +
            'saveth such as be of a contrite spirit.',
    },
    {
        modern: 'an ever-present help',
        kjv: 'a very present help',
        ref: 'Psalm 46:1',
        verse: 'God is our refuge and strength, a very present help in trouble.',
    },
    {
        modern: 'Create in me a pure heart',
        kjv: 'Create in me a clean heart',
        ref: 'Psalm 51:10',
        verse: KJV_PSALM_51_10,
    },
    {
        modern: 'renew a steadfast spirit within me',
        kjv: 'renew a right spirit within me',
        ref: 'Psalm 51:10',
        verse: KJV_PSALM_51_10,
    },
    {
        modern: 'Trust in the LORD with all your heart',
        kjv: 'Trust in the LORD with all thine heart',
        ref: 'Proverbs 3:5',
        verse: KJV_PROVERBS_3_5,
    },
    {
        modern: 'lean not on your own understanding',
        kjv: 'lean not unto thine own understanding',
        ref: 'Proverbs 3:5',
        verse: KJV_PROVERBS_3_5,
    },
    {
        modern: 'in all your ways submit to him',
        kjv: 'In all thy ways acknowledge him',
        ref: 'Proverbs 3:6',
        verse: KJV_PROVERBS_3_6,
    },
    {
        modern: 'he will make your paths straight',
        kjv: 'he shall direct thy paths',
        ref: 'Proverbs 3:6',
        verse: KJV_PROVERBS_3_6,
    },
    {
        modern: 'those who hope in the LORD',
        kjv: 'they that wait upon the LORD',
        ref: 'Isaiah 40:31',
        verse: KJV_ISAIAH_40_31,
    },
    {
        modern: 'soar on wings like eagles',
        kjv: 'mount up with wings as eagles',
        ref: 'Isaiah 40:31',
        verse: KJV_ISAIAH_40_31,
    },
    {
        modern: 'Do not fear, for I am with you',
        kjv: 'Fear thou not; for I am with thee',
        ref: 'Isaiah 41:10',
        verse:
            'Fear thou not; for I am with thee: be not dismayed; for I am ' +
            'thy God: I will strengthen thee; yea, I will help thee; yea, I ' +
            'will uphold thee with the right hand of my righteousness.',
    },
    {
        modern: 'For I know the plans I have for you',
        kjv: 'For I know the thoughts that I think toward you',
        ref: 'Jeremiah 29:11',
        verse:
            'For I know the thoughts that I think toward you, saith the ' +
            'LORD, thoughts of peace, and not of evil, to give you an ' +
            'expected end.',
    },
    {
        modern: 'Be strong and courageous',
        kjv: 'Be strong and of a good courage',
        ref: 'Joshua 1:9',
        verse:
            'Have not I commanded thee? Be strong and of a good courage; be ' +
            'not afraid, neither be thou dismayed: for the LORD thy God is ' +
            'with thee whithersoever thou goest.',
    },
    {
        modern: 'He will wipe every tear from their eyes',
        kjv: 'God shall wipe away all tears from their eyes',
        ref: 'Revelation 21:4',
        verse:
            'And God shall wipe away all tears from their eyes; and there ' +
            'shall be no more death, neither sorrow, nor crying, neither ' +
            'shall there be any more pain: for the former things are passed ' +
            'away.',
    },
    {
        modern: 'I am making everything new',
        kjv: 'I make all things new',
        ref: 'Revelation 21:5',
        verse:
            'And he that sat upon the throne said, Behold, I make all things ' +
            'new. And he said unto me, Write: for these words are true and ' +
            'faithful.',
    },
    {
        modern: 'the spring of the water of life',
        kjv: 'the fountain of the water of life',
        ref: 'Revelation 21:6',
        verse:
            'And he said unto me, It is done. I am Alpha and Omega, the ' +
            'beginning and the end. I will give unto him that is athirst of ' +
            'the fountain of the water of life freely.',
    },
];

// The quotation marks a lesson writes (the passage's own check reads the
// same, `noteChatHelpers.ts`).
// Every pair of marks, a short quote passed over in the code (BN-282): six
// letters asked of the pattern had paired a short quote's closing mark with
// the next one's opening and read the prose between as a quote.
const QUOTE_PATTERN = /([«“"])([^«»“”"\n]{1,400})([»”"])/gu;
const MIN_QUOTE_CHARS = 6;
// A quotation is that verse when most of its other words are the verse's:
// "Even though I walk through the darkest valley" (Psalm 23:4) keeps its
// "Even"; a hymn's "emptied Himself of all but love" shares half.
const VERSE_WORD_SHARE = 0.6;

function toWordPattern(phrase: string) {
    const words = phrase.match(/[A-Za-z']+/g) ?? [];
    return new RegExp(`\\b${words.join("[^A-Za-z']+")}\\b`, 'i');
}

const KJV_WORDING_PATTERN_LIST = KJV_WORDING_LIST.map((entry) => {
    return { entry, pattern: toWordPattern(entry.modern) };
});

function toWordList(text: string) {
    return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

// The KJV's words with the case of the words they stand for: a quotation
// opening on "do not be anxious" lower case takes "be careful for nothing".
function toMatchedCase(matched: string, kjv: string) {
    const first = matched.charAt(0);
    if (first === first.toLowerCase() && first !== first.toUpperCase()) {
        return /^(?:I|LORD|God|Christ)\b/.test(kjv)
            ? kjv
            : kjv.charAt(0).toLowerCase() + kjv.slice(1);
    }
    return kjv.charAt(0).toUpperCase() + kjv.slice(1);
}

export type KjvWordingFixType = { modern: string; kjv: string; ref: string };

/**
 * `text` with every quotation of a verse in a modern translation's words
 * given the KJV's words for them, and what was put back. Only a quotation
 * whose other words are mostly that verse's own is changed.
 */
export function withKjvWording(text: string): {
    text: string;
    fixes: KjvWordingFixType[];
} {
    const fixes: KjvWordingFixType[] = [];
    const fixed = String(text ?? '').replace(
        QUOTE_PATTERN,
        (whole: string, open: string, inner: string, close: string) => {
            if (inner.length < MIN_QUOTE_CHARS) {
                return whole;
            }
            const foundList = KJV_WORDING_PATTERN_LIST.filter(({ pattern }) => {
                return pattern.test(inner);
            });
            if (foundList.length === 0) {
                return whole;
            }
            let rest = inner;
            for (const { pattern } of foundList) {
                rest = rest.replace(pattern, ' ');
            }
            const verseWordSet = new Set(
                foundList.flatMap(({ entry }) => {
                    return toWordList(entry.verse);
                }),
            );
            const restWordList = toWordList(rest);
            const verseWordCount = restWordList.filter((word) => {
                return verseWordSet.has(word);
            }).length;
            if (
                restWordList.length > 0 &&
                verseWordCount / restWordList.length < VERSE_WORD_SHARE
            ) {
                return whole;
            }
            let quote = inner;
            for (const { entry, pattern } of foundList) {
                const before = quote;
                quote = quote.replace(pattern, (matched) => {
                    return toMatchedCase(matched, entry.kjv);
                });
                // A shorter wording inside a longer one already put back
                // ("proclaim the Lord's death" in "... until he comes") is
                // said once.
                if (quote === before) {
                    continue;
                }
                fixes.push({
                    modern: entry.modern,
                    kjv: entry.kjv,
                    ref: entry.ref,
                });
            }
            return `${open}${quote}${close}`;
        },
    );
    return { text: fixed, fixes };
}

/** What the model is told the window put back, under the change made. */
export function genKjvWordingNote(fixes: readonly KjvWordingFixType[]) {
    const said = fixes.slice(0, 6).map((fix) => {
        return `"${fix.modern}" -> "${fix.kjv}" (${fix.ref})`;
    });
    return (
        '(The window put the King James words where a quotation had a ' +
        `modern translation's: ${said.join('; ')}. Quote the KJV as it ` +
        'reads, and read a verse with owa_find_verse when unsure of its ' +
        'words.)'
    );
}
