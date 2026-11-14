/**
 * What sermons say of a passage and the passage does not (BN-142,
 * 2026-11-11, the goal _chatbot completely smart enough to help prepare a
 * best preaching lesson_).
 *
 * The blind readers' errors that outlived every instruction were details
 * told in a thousand sermons and given by no verse: the stone "found the
 * only gap in the giant's armour", Jesus "had just spoken to the people of
 * Capernaum" before the Good Samaritan -- told so with the word table's
 * correction in front of the model (BN-138). A lesson's own words are read
 * for them, a sentence at a time: the person it is about (Goliath, the
 * elder son) and the claim, in the same sentence. Each found is said under
 * the change, with what the verses say, for one more edit. English, the
 * KJV's stories: a lesson in another language matches none. Pure.
 */

type LessonLegendType = {
    // The story the LESSON is about: Capernaum named in a lesson on Mark 1
    // is where Jesus taught, and a gap in "the armour of God" a picture.
    story: RegExp;
    // Who or what the sentence is about.
    topic: RegExp;
    // What the sermon says and the verses do not.
    claim: RegExp;
    // What the verses say instead.
    text: string;
    // Who the sentence is about may be named in the one before it: "This
    // time, Jonah went. He told the people they must stop doing bad
    // things." (ab29).
    isTopicBefore?: boolean;
    // A sentence that says what the verses do: the king's decree DID say
    // "turn every one from his evil way" (Jonah 3:8).
    except?: RegExp;
};

const LESSON_LEGEND_LIST: readonly LessonLegendType[] = [
    // BN-233 (the second held-out set, ab75 and ab76): four sermon tellings
    // no verse gives, each counted an error by a reader.
    {
        // "'Go forward' ... is the step of faith taken before the water has
        // actually moved" -- the Jordan's crossing (Joshua 3:15-16), not
        // the Red Sea's. BN-239 (ab79): told also as "acting on God's word
        // even while the sea is still a wall of water" and "As they obey and
        // move, the LORD causes the sea to go back" -- the waters stood "a
        // wall unto them" only once divided (14:22), which is let be.
        story: /\bExodus 14\b|\bRed Sea\b/i,
        topic: /\b(?:go forward|step|water|sea|feet|obey(?:ed)?|move)\b/i,
        claim: /\bbefore\b[^.]{0,30}\b(?:the )?(?:water|waters|sea)\b[^.]{0,20}\b(?:moved|parted|divided|opened|split)\b|\b(?:stepp?ed|walk(?:ed)?|went)\b[^.]{0,30}\binto the (?:water|sea)\b[^.]{0,40}\bbefore\b[^.]{0,30}\b(?:parted|divided|opened|split)\b|\b(?:while|when|though)\b[^.]{0,30}\b(?:sea|water|waters)\b[^.]{0,20}\b(?:still|yet)\b[^.]{0,20}\b(?:a wall|closed|in place|undivided|whole)\b|\bas (?:they|the people|israel|the israelites|the children of israel)\b[^.]{0,30}\b(?:obey(?:ed)?|move[ds]?|stepp?(?:ed)?|walk(?:ed)?|went|go(?:es)?)\b[^.]{0,60}\b(?:sea|water|waters)\b[^.]{0,30}\b(?:go back|went back|goes back|part(?:s|ed)?|divide[sd]?|open(?:s|ed)?|split)\b/i,
        text:
            'Exodus 14:21-22: Moses stretched out his hand, "and the waters ' +
            'were divided. And the children of Israel went into the midst ' +
            'of the sea upon the dry ground" -- the sea parted first; feet ' +
            'in the water before it parted is the Jordan (Joshua 3:15-16)',
    },
    {
        // "Why did Elijah have to pray seven times before the rain came?"
        story: /\b1 Kings 18\b|\bCarmel\b|\bElijah\b/i,
        topic: /\bElijah\b|\bhe\b/i,
        claim: /\bpray(?:ed|s|ing)?\b[^.?]{0,20}\bseven times\b/i,
        text:
            '1 Kings 18:42-44: Elijah "cast himself down upon the earth, and ' +
            'put his face between his knees", and said to his servant "Go ' +
            'again seven times" -- the servant went up seven times to look',
    },
    {
        // "Why do you think Jesus waited four days before going to Lazarus?"
        story: /\bJohn 11\b|\bLazarus\b/i,
        topic: /\bJesus\b|\bhe\b/i,
        claim: /\b(?:waited|stayed|delayed|tarried|abode)\b[^.?]{0,30}\bfour days\b/i,
        text:
            'John 11:6: "he abode two days still in the same place where he ' +
            'was"; Lazarus "had lain in the grave four days already" when ' +
            'he came (11:17)',
    },
    {
        // "Jesus is the one who 'poured out' the Spirit upon us [Acts 2:33]"
        story: /\bActs 2\b|\bPentecost\b/i,
        topic: /\b(?:poured|pour)\b/i,
        claim: /\bpou?r(?:ed)? out\b[^.]{0,80}\bActs 2:33\b/i,
        text:
            'Acts 2:33: "he hath shed forth this, which ye now see and ' +
            'hear"; "I will pour out of my Spirit" is God\'s word in 2:17-18',
    },
    // BN-234 (ab77): "How do you think the boy felt when Jesus used his
    // small lunch to feed everyone?" in a lesson on Matthew 14, told
    // after BN-232's prompt line. The lad is John's alone (John 6:9); a
    // lesson that names John 6 anywhere is let be.
    {
        story: /^(?![\s\S]*\bJohn 6\b)[\s\S]*\b(?:Matthew 14|Mark 6|Luke 9)\b/i,
        topic: /\b(?:boy|lad|boy's|lad's)\b/i,
        claim: /\b(?:boy|lad)(?:'s)?\b[^.?]{0,80}\b(?:lunch|loaves|fish(?:es)?|bread|basket|food|meal)\b|\b(?:lunch|loaves|fish(?:es)?)\b[^.?]{0,60}\b(?:boy|lad)\b/i,
        text:
            'Matthew 14:17: the disciples say "We have here but five ' +
            'loaves, and two fishes" -- Matthew, Mark and Luke name no boy; ' +
            'the lad with "five barley loaves, and two small fishes" is ' +
            'John 6:9, named with its verse or left out',
    },
    // BN-242 (ab81, the third held-out set, M-01 in both batches, Opus: an
    // error): Gideon's lappers told as the vigilant and the kneelers as the
    // careless -- the verses give no reason for the test, only God's.
    // BN-249 (batch MG): a point's heading, "God removes the fearful and
    // the careless", names no water -- the sifting words are the topic too.
    {
        story: /\bJudges 7\b|\bGideon\b/i,
        topic: /\b(?:lapp?\w*|knees|bowed|kneel\w*|drank|drink\w*|water|fearful|afraid|remov\w*|sift\w*|sent home|sends? home)\b/i,
        claim: /\b(?:alert|vigilan\w*|watchful\w*|on guard|careless\w*|complacen\w*|eyes (?:open|up|on)|ready for (?:battle|action)|aware of (?:their |his )?surroundings|(?:let|letting|lowered|lowering) (?:their |his )?guard|kept (?:their |his )?(?:head|eyes) up|self-indulgen\w*|undisciplined)\b/i,
        text:
            'Judges 7:5-7: "Every one that lappeth of the water with his ' +
            'tongue, as a dog lappeth, him shalt thou set by himself" -- ' +
            '"By the three hundred men that lapped will I save you"; the ' +
            'verses give no reason in the men, only God\'s: "lest Israel ' +
            'vaunt themselves against me, saying, Mine own hand hath saved ' +
            'me" (7:2)',
        except: /\b(?:does not say|doesn't say|do not say|not told|may have|might have|perhaps|possibly|some (?:think|suggest|say))\b/i,
    },
    // BN-248 (ab81..ab84, set 3, both readers): three tellings that came
    // back batch after batch.
    {
        // "After ... tested God with a fleece ..., he gathered an army" --
        // Judges 6 calls the tribes first. BN-249 (batch MG): "a fleece
        // ... before gathering an army", and "summoned ... after the
        // fleece", the same order told the other way round.
        story: /\bJudges [67]\b|\bGideon\b/i,
        topic: /\bfleece\b/i,
        claim: /\bafter\b[^.]{0,140}\bfleece\b[^.]{0,80}\b(?:gathered|called|summoned|raised|assembled)\b[^.]{0,40}\b(?:army|tribes|men|Manasseh)\b|\bfleece\b[^.]{0,60}\b(?:then|and then)\b[^.]{0,30}\b(?:gathered|called|summoned|raised|assembled)\b|\bfleece\b[^.]{0,80}\bbefore\b[^.]{0,20}\b(?:gather|call|summon|rais|assembl|muster)\w*\b[^.]{0,40}\b(?:army|tribes|men|troops|forces|Manasseh)\b|\b(?:gathered|called|summoned|raised|assembled|mustered)\b[^.]{0,60}\b(?:army|tribes|men|troops|Manasseh|Asher)\b[^.]{0,40}\bafter\b[^.]{0,60}\bfleece\b/i,
        text:
            'Judges 6:34-36: Gideon "blew a trumpet; and Abiezer was ' +
            'gathered after him. And he sent messengers throughout all ' +
            'Manasseh ... and they came up to meet them. And Gideon said ' +
            'unto God, If thou wilt save Israel by mine hand" -- the tribes ' +
            'were called before the fleece (6:36-40), not after it',
    },
    {
        // "this man hath done nothing amiss" said of the thief, or of a man
        // who "realizes he has done nothing amiss" -- the thief says it of
        // Jesus.
        story: /\bLuke 23\b|\bthief\b|\bmalefactor/i,
        topic: /\bnothing amiss\b/i,
        claim: /\bof the (?:thief|malefactor|criminal)\b[^.]{0,12}["“]this man hath done nothing amiss\b|\b(?:he|himself|she|herself)\b[^.]{0,30}\b(?:has|had|hath)\s+["“]?done nothing amiss\b/i,
        text:
            'Luke 23:41: "And we indeed justly; for we receive the due ' +
            'reward of our deeds: but this man hath done nothing amiss" -- ' +
            'the thief says it of Jesus, not of himself',
        // Said OF Jesus is right; "the holiness of Christ" is not that.
        except: /\b(?:says?|said|spoke|speaks)\s+(?:it\s+)?(?:of|about)\s+(?:Jesus|Christ|the Lord)\b|\breferring to (?:Jesus|Christ|the Lord)\b/i,
    },
    {
        // "the veil ... was torn from top to bottom" in a lesson on Luke 23.
        story: /\bLuke 23\b/i,
        topic: /\bveil\b|\bcurtain\b/i,
        claim: /\b(?:from )?(?:the )?top to (?:the )?bottom\b/i,
        text:
            'Luke 23:45: "the veil of the temple was rent in the midst" -- ' +
            '"from the top to the bottom" is Matthew 27:51 and Mark 15:38, ' +
            'named with its verse or left out',
        isTopicBefore: true,
        except: /\bMatthew 27:51\b|\bMark 15:38\b/,
    },
    // BN-251 (ab84, ab85, Opus): love "the only true evidence" that we
    // know God, in eight 1 John 4 lessons of five batches -- the chapter
    // gives the Spirit and the confession beside it.
    // Batch MH: with the big idea put right, "the only way to prove we know
    // Him" and "the only way to truly know God" in the same lesson -- love
    // as the only way to KNOW Him; "the only way to prove love for the
    // unseen God" is 4:20's own argument and is let be.
    {
        story: /\b1 John 4\b/i,
        topic: /\b(?:evidence|proof|prove|know)\b/i,
        // Batch MK: `the only way to "know" God`, the word in quotes.
        claim: /\bonly\s+(?:true\s+|real\s+|sure\s+|genuine\s+)?(?:evidence|proof)\b|\bonly way\b[^.?]{0,25}\b(?:prove|show)\b[^.?]{0,15}\bknow\b|\bonly way\b[^.?]{0,12}\b(?:truly |really )?["“']?know["”']? (?:God|Him|the Father)\b/i,
        text:
            '1 John 4:13, 15: "Hereby know we that we dwell in him, and he ' +
            'in us, because he hath given us of his Spirit"; "Whosoever ' +
            'shall confess that Jesus is the Son of God, God dwelleth in ' +
            'him" -- love is one mark the chapter gives (4:7, 4:12), not ' +
            'the only one',
    },
    // BN-251 (ab81, ab85): "each time Eli said, I called not" -- twice; the
    // third time Eli perceived the LORD had called.
    {
        story: /\b1 Samuel 3\b|\bSamuel\b/i,
        topic: /\bEli\b/,
        claim: /\b(?:each|every) time\b[^.]{0,60}\bEli\b[^.]{0,30}\b(?:said|answered|told)\b[^.]{0,40}\b(?:called not|had not called|did not call|didn't call)\b|\b(?:all )?three times\b[^.]{0,60}\bEli\b[^.]{0,40}\b(?:called not|had not called|did not call)\b/i,
        text:
            '1 Samuel 3:5-9: Eli said "I called not; lie down again" the ' +
            'first two times; the third time "Eli perceived that the LORD ' +
            'had called the child" and told him what to answer',
    },
    // BN-254 (ab85, ab86, Opus): three more tellings that came back.
    {
        // "the three hundred men followed the Lord's command" by breaking
        // the pitchers -- the plan is Gideon's in the verses.
        story: /\bJudges 7\b|\bGideon\b/i,
        // Batch MI: "tools of a divine strategy", the same in softer words.
        topic: /\b(?:trumpets?|pitchers?|lamps?)\b/i,
        claim: /\b(?:God|the LORD|the Lord)(?:'s|’s)\s+(?:\w+,?\s+){0,2}(?:command|commands|instructions?|orders?|plan|strategy)\b|\b(?:commanded|instructed|ordered)\s+by\s+(?:God|the LORD|the Lord)\b|\bdivine\s+(?:strategy|plan|command|instructions?|orders?)\b/i,
        text:
            'Judges 7:16-18: Gideon "put a trumpet in every man\'s hand, with ' +
            'empty pitchers" and said "Look on me, and do likewise" -- the ' +
            "verses give the plan as Gideon's; the LORD's word was \"Arise, " +
            'get thee down unto the host" (7:9)',
    },
    {
        // A point's heading, "God removes the fearful and the
        // overconfident" -- the men sent home were the fearful (7:3); the
        // verses call the rest neither proud nor overconfident. God's own
        // reason, "lest Israel vaunt themselves" (7:2), is let be.
        story: /\bJudges 7\b|\bGideon\b/i,
        topic: /\b(?:fearful|afraid|remov\w*|sends? home|sent home)\b/i,
        // Batch MK: "those who are fearful and those who would boast".
        claim: /\b(?:fearful|afraid)\s+and\s+the\s+(?:proud|overconfiden\w*|self-reliant|boastful|arrogant)\b|\b(?:proud|overconfiden\w*|self-reliant|boastful|arrogant)\s+and\s+the\s+(?:fearful|afraid)\b|\bremov\w*\s+the\s+(?:proud|overconfiden\w*|self-reliant|boastful|arrogant)\b|\b(?:fearful|afraid)\s+and\s+those\s+who\s+(?:are|were|would|might)\s+(?:be\s+)?(?:proud|overconfiden\w*|self-reliant|boastful|arrogant|boast|brag)\b/i,
        text:
            'Judges 7:3, 7:5-7: "Whosoever is fearful and afraid, let him ' +
            'return" -- then the three hundred "that lapped"; the verses ' +
            "name the men sent home fearful, nothing more, and give God's " +
            'reason, "lest Israel vaunt themselves against me" (7:2)',
    },
    {
        // "I will be found" cited to Jeremiah 29:12-13 -- it is 29:14.
        story: /\bJeremiah 29\b/i,
        topic: /\bfound\b/i,
        claim: /\bwill be found\b[^.]{0,80}\bJeremiah 29:(?:12|13|12-13)(?![-–\d])/i,
        text:
            'Jeremiah 29:14: "And I will be found of you, saith the LORD" -- ' +
            '29:12-13 say "ye shall seek me, and find me"',
        except: /\bJeremiah 29:14\b|\bJeremiah 29:1[23]-14\b/,
    },
    // BN-258 (ab90, the fourth held-out set, Opus, both batches): Christ
    // called "the bond of perfectness" in Pointing to Jesus -- Colossians
    // 3:14 says it of charity.
    {
        story: /\bColossians 3\b/i,
        topic: /\bbond of perfectness\b/i,
        claim: /\b(?:He|Christ|Jesus|Him)\s+(?:is|was|became|is himself)\s+(?:the\s+)?["“]?bond of perfectness\b|\bbond of perfectness["”]?\s*(?:is|was)\s+(?:Christ|Jesus)\b/i,
        text:
            'Colossians 3:14: "And above all these things put on charity, ' +
            'which is the bond of perfectness" -- it is charity, love, the ' +
            'verse calls the bond, never Christ himself',
    },
    // BN-260 (ab90..ab92, the fourth held-out set): five tellings a reader
    // counted or marked down. "Daughter" as a word Jesus uses of no one
    // else (two of its four Mark 5 lessons).
    {
        story: /\bMark 5\b|\bLuke 8\b|\bMatthew 9\b|\bissue of blood\b/i,
        topic: /\bDaughter\b/i,
        claim: /\bthe only (?:time|woman|person|one)\b|\b(?:anyone|any one|no one|nobody|none) else\b|\bno other (?:woman|person|one)\b/i,
        except: /\bJairus\b|\b(?:his|little|only|twelve-year-old) daughter\b/i,
        text:
            'Mark 5:34: "Daughter, thy faith hath made thee whole" -- the ' +
            'Gospels keep no count of whom else he called so; he speaks to ' +
            'the "Daughters of Jerusalem" (Luke 23:28) and calls a woman he ' +
            'healed "a daughter of Abraham" (Luke 13:16)',
    },
    // The fourth man in the fire seen and named by the three (both
    // readers, twice): it is the king who says it.
    {
        story: /\bDaniel 3\b|\bfiery furnace\b|\bShadrach\b/i,
        topic: /\bfourth\b|\bSon of God\b|\bfour men\b/i,
        claim: /\b(?:the three (?:friends|men|young men|boys|Hebrews|Hebrew men)|Shadrach,? Meshach,? and Abednego)\s+(?:all\s+)?(?:saw|see|seen|noticed|recogni[sz]ed|said|say|knew)\b/i,
        except: /\b(?:king|Nebuchadnezzar)\b[^.]{0,40}\b(?:saw|said|looked|cried|astonied)\b/i,
        text:
            'Daniel 3:24-25: it is the king who "was astonied" and said "Lo, ' +
            'I see four men loose, walking in the midst of the fire ... and ' +
            'the form of the fourth is like the Son of God" -- the passage ' +
            'says nothing of what the three saw',
    },
    // Abraham sure God would raise Isaac, told as Genesis 22's (a reader's
    // A = 1): Hebrews 11:19 says it.
    {
        story: /\bGenesis 22\b/i,
        topic: /\braise\b|\bfrom the dead\b|\bresurrect\w*\b/i,
        claim: /\b(?:could|would|was able to|is able to|able to|can|might)\s+(?:even\s+)?raise\s+(?:him|Isaac|the lad|his son|the boy)\b|\braise\s+(?:him|Isaac)\s+(?:up\s+)?(?:again|from the dead|back to life)\b/i,
        except: /\bHebrews 11:(?:17-)?19\b|\b(?:Jesus|Christ)\b/,
        text:
            'Hebrews 11:19 says it: "Accounting that God was able to raise ' +
            'him up, even from the dead" -- Genesis 22 gives "I and the lad ' +
            'will go yonder and worship, and come again to you" (22:5) and ' +
            '"God will provide himself a lamb" (22:8); name Hebrews 11:19 ' +
            'where the lesson says it',
    },
    // Peter's own words about men (Acts 10:28) given to the voice of his
    // vision (Opus, an error): the voice spoke of the beasts.
    {
        story: /\bActs 10\b|\bCornelius\b/i,
        topic: /\bcommon\b/i,
        claim: /\b(?:voice|the Lord|God|heaven)\b[^.]{0,30}\b(?:told|telling|tells|said|saying|says|commanded|commanding|commands|warned)\b[^.]{0,30}\bcall\b[^.]{0,15}\b(?:any|no) (?:man|person|one|people)\b/i,
        except: /\b(?:shewed|showed|showing|shown|shew|show|shows)\b/i,
        text:
            'Acts 10:15: the voice said "What God hath cleansed, that call ' +
            'not thou common" -- of the beasts in the sheet; "God hath ' +
            'shewed me that I should not call any man common or unclean" is ' +
            "Peter's own reading of it, at Cornelius' house (10:28)",
    },
    // BN-290 (ab109, ab110, Opus: an error in PJ and PK): covetousness
    // defined as "the belief that a man's life consisteth not in the
    // abundance" -- Luke 12:15's reason AGAINST covetousness made its creed.
    {
        story: /\bLuke 12\b/i,
        topic: /\bcovet|\bbelie/i,
        claim: /\bbelief\s+that\s+["“]?\s*a man'?s life consisteth not\b/i,
        text:
            'Luke 12:15: "beware of covetousness: for a man\'s life ' +
            'consisteth not in the abundance of the things which he ' +
            'possesseth" -- the reason Jesus gives against covetousness, ' +
            'which believes the opposite',
    },
    // BN-287 (ab108, ab109, both readers: PI's an error in one read, A = 1
    // in another; PJ's A = 1): Esther's fast given a theology she is never
    // said to hold -- "the king's heart was in God's hands", "the battle was
    // spiritual", "God's intervention to move the king's heart". The book
    // never names God, and gives no reason for the fast.
    {
        story: /\bEsther 4\b/i,
        topic: /\b(?:king|battle|God|fast|prayer)\b/i,
        claim: /\bking'?s heart\b[^.]{0,30}\bGod\b|\bGod'?s\s+(?:intervention|hand)\b[^.]{0,30}\bking'?s heart\b|\bbattle\s+(?:was|is)\s+spiritual\b|\bspiritual\s+battle\b/i,
        text:
            'Esther 4:16: "fast ye for me … and so will I go in unto the ' +
            'king … and if I perish, I perish" -- the book never names God ' +
            'and gives no reason for the fast; tell what she asked and did, ' +
            'not what she knew of God',
    },
    // BN-286 (ab106..ab108, Sonnet: A = 1 in PG, PH and PI): "God changed
    // the heart of the princess", "God put compassion in her heart" --
    // Exodus 2:6 tells her compassion, never that God put it there.
    {
        story: /\bExodus 2\b/i,
        topic: /\b(?:princess|Pharaoh'?s daughter|her)\b/i,
        claim: /\bGod\b[^.]{0,20}\b(?:changed|softened|moved|touched|opened|put|placed|gave|filled)\b[^.]{0,40}\b(?:(?:her|the princess'?s?|Pharaoh'?s daughter'?s?)\s+heart|heart of (?:the princess|Pharaoh'?s daughter))\b/i,
        text:
            'Exodus 2:6: "she had compassion on him" -- the verse tells her ' +
            'compassion, never that God put it in her heart; tell what she ' +
            "felt and did, and let God's care be seen in the whole story",
    },
    // BN-285 (ab107, both readers: A = 1 in PH): "This act of worship
    // triggered a great earthquake" -- Acts 16:25-26 sets the praise and the
    // earthquake side by side, "and suddenly", and says neither caused the
    // other.
    {
        story: /\bActs 16\b/i,
        topic: /\bearthquake\b/i,
        claim: /\b(?:worship|praise|praising|singing|songs?|hymns?|prayers?|praying)\b[^.]{0,40}\b(?:triggered|caused|brought (?:on|about)|produced|unleashed|set off|led to|resulted in)\b[^.]{0,30}\bearthquake\b|\bearthquake\b[^.]{0,30}\b(?:in (?:response|answer) to|because of|as a result of)\b[^.]{0,30}\b(?:worship|praise|singing|songs?|hymns?|prayers?)\b/i,
        text:
            'Acts 16:25-26: Paul and Silas "prayed, and sang praises unto ' +
            'God … And suddenly there was a great earthquake" -- the verses ' +
            'set the two side by side and never say the praise caused it',
    },
    // BN-283 (ab103, ab105, Opus: an error in PD and PF): the rich fool's
    // asker said to want "his brother's share" -- Luke 12:13 has "speak to
    // my brother, that he divide the inheritance with me".
    {
        story: /\bLuke 12\b/i,
        topic: /\binherit/i,
        claim: /\bbrother'?s\s+(?:share|portion|part|half)\b/i,
        text:
            'Luke 12:13: "Master, speak to my brother, that he divide the ' +
            'inheritance with me" -- he asked for it to be divided, not for ' +
            "his brother's share",
    },
    // BN-283 (ab101, ab105, Opus: an error in PF): a KJV phrase that holds
    // its own "not" quoted after a "does not" -- "life does not "consisteth
    // not in the abundance …"" -- says the opposite of the verse. Any story.
    {
        story: /[\s\S]/,
        topic: /\bnot\b/i,
        claim: /\b(?:does|do|did|is|was|will|shall|can|could|would)(?:n't|\s+not)\s+["“'‘]?\s*\w+eth\s+not\b/i,
        text:
            'two "not"s turn the verse round: "does not … -eth not" says the ' +
            'opposite of it -- quote the verse whole ("a man\'s life ' +
            'consisteth not in the abundance …") or say it plainly with one ' +
            '"not"',
    },
    // BN-283 (ab105, Opus: an error in PF): "The helper went and found the
    // baby's own mother" -- the helper of the story the princess's servant
    // (2:5); the maid who called her is the child's sister (2:7-8). The KJV's
    // own "the maid went and called" is left.
    {
        story: /\bExodus 2\b/i,
        topic: /\bmother\b/i,
        claim: /\b(?:helper|servant|handmaid|princess'?s maid)\b[^.]{0,40}\b(?:found|called|fetched|brought|went)\b[^.]{0,40}\bmother\b/i,
        except: /\bsister\b/i,
        text:
            'Exodus 2:7-8: the child\'s sister asked "Shall I go and call to ' +
            'thee a nurse …?", and "the maid went and called the child\'s ' +
            'mother" -- the maid of verse 8 is his sister, not the ' +
            "princess's servant",
    },
    // BN-281 (ab104, Opus: an error in PE): a discussion question quoting
    // Matthew 6:12 as "as we are forgiven" -- the prayer asks to be forgiven
    // AS we forgive. A prayer's own "forgive as we have been forgiven",
    // unquoted (Ephesians 4:32's thought), is left.
    {
        story: /\bMatthew 6\b|\bLuke 11\b/i,
        topic: /\bforgiv/i,
        claim: /["“]\s*as we (?:are|have been) forgiven\b/i,
        text:
            'Matthew 6:12: "And forgive us our debts, as we forgive our ' +
            'debtors" -- the prayer asks to be forgiven AS we forgive; ' +
            '"as we are forgiven" turns it round',
    },
    // BN-277 (ab101, ab102, Opus: an error in PB and PC): John 3:13 turned
    // round -- "no one has come down from heaven except the Son of man",
    // "the only one who came down from heaven". The verse says no man hath
    // ASCENDED but he that came down; a sentence that says so is left.
    {
        story: /\bJohn 3\b/i,
        topic: /\bheaven\b/i,
        claim: /\b(?:the only one|only one|no one|no man|none|nobody)\b[^.]{0,40}\b(?:come|came|descended)\s+down\s+from\s+heaven\b|\bcame\s+down\s+from\s+heaven\b[^.]{0,20}\b(?:alone|only)\b/i,
        except: /\bascend/i,
        text:
            'John 3:13: "no man hath ascended up to heaven, but he that came ' +
            'down from heaven, even the Son of man" -- no one has gone UP to ' +
            'heaven but the one who came DOWN from it; the verse does not ' +
            'say no one else came down',
    },
    // BN-278 (ab101, ab102, Opus, not counted: PB and PC alike): "When he
    // grew up, he went back to the princess" -- his mother brought him.
    {
        story: /\bExodus 2\b/i,
        topic: /\b(?:he|Moses|boy|child|baby)\b/i,
        claim: /\b(?:he|Moses|the boy|the child|the baby)\s+(?:went|returned|came|moved|ran)\s+back\s+to\s+(?:live\s+with\s+)?(?:the princess|Pharaoh'?s daughter|the king'?s daughter|the palace)\b/i,
        text:
            'Exodus 2:10: "the child grew, and she brought him unto ' +
            'Pharaoh\'s daughter, and he became her son" -- his mother brought ' +
            'him; he did not go back by himself',
    },
    // BN-276 (ab101, both readers: an error in PA): "the very mat he had
    // been confined to for years" -- Mark 2, Matthew 9 and Luke 5 give no
    // length of illness. The man at Bethesda's "thirty and eight years" is
    // John 5:5's, another man, and is left.
    {
        story: /\bMark 2\b|\bLuke 5:(?:1[7-9]|2\d)\b|\bMatthew 9:[1-8]\b/i,
        topic: /\b(?:paraly[sz]\w*|palsy|mat|bed|pallet|cot|lame|crippled|bedridden)\b/i,
        claim: /\b(?:confined|paraly[sz]\w*|bedridden|lain|lying|crippled|lame|unable to (?:walk|move))\b[^.]{0,60}\b(?:for (?:many |long |so many |all those )?years|for decades|from (?:his )?birth|since (?:his )?birth|all his life|his whole life)\b|\bfor (?:many |long |so many )?(?:years|decades)\b[^.]{0,40}\b(?:paraly[sz]\w*|confined|lain|lying|bedridden|crippled|lame)\b/i,
        except: /\bJohn 5\b|\bthirty and eight\b|\b38 years\b|\bBethesda\b/i,
        text:
            'Mark 2:3: "one sick of the palsy, which was borne of four" -- ' +
            'no length of illness is given, in Matthew 9 or Luke 5 either; ' +
            '"an infirmity thirty and eight years" is the man at Bethesda ' +
            '(John 5:5), another man',
    },
    // BN-273 (ab96, ab100, Opus: an error in NG and NL): "In chapter 3 the
    // people worked by sections, each repairing the part of the wall near
    // their own home" -- some did; others came from Jericho, Tekoa, Gibeon
    // and Mizpah. "The priests … every one over against his house" (3:28)
    // is the chapter's own, and left.
    {
        story: /\bNehemiah [34]\b/i,
        topic: /\b(?:home|homes|house|houses)\b/i,
        claim: /\b(?:each|every one|everyone|every family|all)\b[^.]{0,60}\b(?:near|by|beside|in front of|over against|opposite|next to)\b[^.]{0,15}\b(?:their|his|her)\s+(?:own\s+)?(?:home|house)s?\b/i,
        except: /\bpriests?\b|\bsome\b|\bmany\b/i,
        text:
            'Nehemiah 3: some built "over against his house" (3:10, 23) and ' +
            'the priests "every one over against his house" (3:28), but ' +
            'others came from elsewhere -- "the men of Jericho" (3:2), "the ' +
            'Tekoites" (3:5), "the men of Gibeon, and of Mizpah" (3:7)',
    },
    // BN-266 (ab95, Opus: an error): "Nehemiah's people fought with swords"
    // -- no fight came in Nehemiah 4. "Fighting for your brethren" is the
    // chapter's own word (4:14), and is left.
    {
        story: /\bNehemiah 4\b/i,
        topic: /\b(?:swords?|spears?|weapons?|enem(?:y|ies)|Sanballat|builders|people|workers|they)\b/i,
        // The builders as the ones who fought -- "Jesus fought a spiritual
        // battle" in the same sentence is the Christ section's, and left.
        claim: /\b(?:people|builders|workers|they|Jews|Israelites|men)\s+(?:all\s+|bravely\s+|then\s+)?(?:fought|battled|did battle)\b(?!\s+for\b)/i,
        text:
            'Nehemiah 4:15: no fight came -- "God had brought their counsel ' +
            'to nought, that we returned all of us to the wall, every one ' +
            'unto his work"; they built with a weapon at hand and a watch ' +
            'set, told "our God shall fight for us" (4:20)',
    },
    // BN-269 (ab97, Opus: an error in NH and NI alike): Habakkuk 3:3-15 told
    // as Habakkuk watching the Chaldeans come -- "saw the tents of Cushan
    // and Midian tremble" -- where it is God's own coming, in his past
    // deeds; only 3:16 looks to the invader, and is left.
    {
        story: /\bHabakkuk 3\b/i,
        topic: /\b(?:Chaldeans?|Babylonians?|invasion|invad(?:e|ed|er|ers|ing))\b/i,
        claim: /\b(?:Chaldeans?|Babylonians?|invasion|invad(?:e|ed|er|ers|ing))\b[^.]{0,200}(?:\[\^(?:\([^)\n]*\)\s*)?Habakkuk 3:(?:[3-9]|1[0-5])(?!\d)|\bCushan\b|\bMidian\b)/i,
        text:
            'Habakkuk 3:3-15 is God himself coming, "for the salvation of ' +
            'thy people" (3:13), told in his deeds of old -- Cushan and ' +
            'Midian, the sea and the rivers, the sun and moon standing ' +
            "still; the Chaldeans' coming is told in 1:5-11, and only 3:16 " +
            'looks to "the day of trouble" and the invader',
    },
    // BN-267 (ab94, ab96, batch NI): Jehovahjireh given 22:14's saying "In
    // the mount of the LORD it shall be seen" as its meaning -- written so
    // again with the word table's entry in front of the model.
    {
        story: /\bGenesis 22\b/i,
        topic: /\bJehovah-?jireh\b/i,
        claim: /\bJehovah-?jireh\b[^.]{0,80}\b(?:mean(?:s|ing)?|translat\w*|signif\w*)\b[^.]{0,30}\bIn the mount\b/i,
        text:
            'Genesis 22:8, 14: Jehovahjireh means "the LORD will provide" -- ' +
            '"God will provide himself a lamb" (22:8); "In the mount of the ' +
            'LORD it shall be seen" is the saying "to this day" after the ' +
            'name (22:14), never its meaning',
    },
    // BN-271 (ab93, ab98, Opus: A = 1 / noted): Jesus entering Jerusalem
    // "during the Passover feast" -- he came before it; "the Passover
    // season" and "as the Passover drew near" are left.
    {
        story: /\bMatthew 21\b|\bMark 11\b/i,
        topic: /\bPassover\b/i,
        claim: /\b(?:enter(?:s|ed|ing)?|rode|rides|came|comes|arriv(?:es|ed|ing))\b[^.]{0,40}\b(?:during|at|in the middle of) the (?:feast of the )?Passover(?: feast)?\b(?!\s+season)/i,
        text:
            'John 12:1, 12: "six days before the passover" Jesus came to ' +
            'Bethany, and "on the next day" into Jerusalem -- the feast was ' +
            'still to come: "after two days is the feast of the passover" ' +
            '(Matthew 26:2); say "as the Passover drew near"',
    },
    // BN-267 (ab92..ab96, Sonnet an error in ab96): a Palm Sunday crowd in
    // Matthew 21 "waving palm branches" -- Matthew says branches from the
    // trees; the palms are John 12:13's. "Palm Sunday" is left.
    {
        story: /\bMatthew 21\b|\bMark 11\b/i,
        topic: /\bbranch(?:es)?\b|\bpalms?\b/i,
        claim: /\bpalm (?:branch(?:es)?|leaves|fronds)\b|\bwav(?:ed|ing) palms\b|\bpalms (?:were )?(?:waved|spread|laid)\b/i,
        except: /\bJohn 12\b/,
        text:
            'Matthew 21:8: "others cut down branches from the trees, and ' +
            'strawed them in the way" (Mark 11:8 "branches off the trees") ' +
            '-- the palms are John\'s: "Took branches of palm trees" (John ' +
            '12:13); say "branches", or name John 12:13',
    },
    // John's own word about the chief rulers (12:43) given to Jesus (both
    // readers, an error).
    {
        story: /\bJohn 1[23]\b/i,
        topic: /\bpraise of men\b/i,
        claim: /\b(?:Jesus|He|the Lord|Christ)\s+(?:had\s+)?(?:just\s+)?(?:spoke|spoken|speaks|said|says|warned|taught|told)\b[^.]{0,120}\bpraise of men\b/i,
        text:
            'John 12:42-43: "they loved the praise of men more than the ' +
            'praise of God" is John\'s own word about the chief rulers who ' +
            'believed on him and did not confess him -- not words of Jesus',
    },
    // BN-253 (ab81..ab86, six Job 1 lessons, a reader counting it in
    // ab86): Job's ten children cited to Job 1:3, his substance.
    {
        story: /\bJob 1\b/,
        topic: /\b(?:children|sons|daughters)\b/i,
        claim: /\b(?:ten children|seven sons and three daughters|sons and three daughters)\b[^.]{0,120}\bJob 1:3(?![-–\d])/i,
        text:
            'Job 1:2: "And there were born unto him seven sons and three ' +
            'daughters" -- 1:3 is his substance, the sheep, camels, oxen ' +
            'and asses',
        except: /\bJob 1:2\b|\bJob 1:[12]-3\b/,
    },
    // BN-246 (ab81..ab83, M-14, a reader each time): "Will we recognize our
    // loved ones?" answered "Yes" from 1 Thessalonians 4:17 -- in four
    // funeral lessons of six; the verse promises being together, not
    // knowing one another.
    {
        story: /\b1 Thessalonians 4\b/i,
        topic: /\b(?:recogni[sz]e|know)\b[^.?]{0,50}\b(?:loved ones|each other|one another|them again)\b/i,
        claim: /\bpassage answers:?\**\s*Yes\b|^\W*Yes\b[^.?]{0,40}\bcaught up\b/i,
        text:
            '1 Thessalonians 4:17: "caught up together with them in the ' +
            'clouds, to meet the Lord in the air: and so shall we ever be ' +
            'with the Lord" -- together with them and with the Lord; the ' +
            'passage does not say whether we shall know one another',
        isTopicBefore: true,
    },
    // BN-245 (ab81, ab82, M-12, both readers): Samuel told as answering
    // "exactly as Eli told him", or with Eli's "Speak, LORD" -- in three
    // lessons of four; 1 Samuel 3:10 has him leave out "LORD".
    {
        story: /\b1 Samuel 3\b|\bSamuel\b/i,
        topic: /\bSamuel\b|\bhe\b/i,
        claim: /\b(?:exactly|just|precisely)\s+as\s+Eli\b|\bas Eli (?:had )?(?:told|taught|instructed|said)\b|\b(?:answered|said|replied|responded)\b[^.]{0,10}["“]Speak,? LORD\b/i,
        text:
            '1 Samuel 3:9-10: Eli told him to say "Speak, LORD; for thy ' +
            'servant heareth"; "Then Samuel answered, Speak; for thy servant ' +
            'heareth" -- without "LORD", not word for word as Eli said',
        isTopicBefore: true,
        except: /\bEli (?:said|told|taught)\b[^.]{0,40}["“]Speak,? LORD\b|\bleft out\b|\bwithout\b/i,
    },
    // BN-235 (ab75..ab77, J-06): the woman at the well told as shunned --
    // "avoiding the eyes of her neighbors", drawing water at noon "instead
    // of the usual time", "avoided by her own people" -- each marked by a
    // reader; the city heard her at once. A telling given as a
    // possibility is let be.
    {
        story: /\bJohn 4\b|\bwoman at the well\b|\bSychar\b/i,
        topic: /\b(?:woman|she|her)\b/i,
        claim: /\b(?:avoided|avoiding|shunned|ostraci[sz]ed|scorned|outcast)\b[^.?]{0,40}\b(?:her (?:own )?(?:people|town|village|neighbou?rs|community)|the (?:other )?(?:women|townspeople|villagers)|the eyes of)\b|\b(?:noon|midday|heat of the day|sixth hour|middle of the day)\b[^.?]{0,80}\b(?:to avoid|avoiding|when no one|so no one|so that no one|instead of the usual|rather than the usual|not the usual|unusual|when the other women)\b|\b(?:to avoid|avoiding)\b[^.?]{0,40}\b(?:other women|the women|her neighbou?rs|the townspeople|gossip|the crowds?)\b/i,
        text:
            'John 4:6-7 gives the hour and no reason: "it was about the ' +
            'sixth hour. There cometh a woman of Samaria to draw water"; ' +
            'the city heard her at once, "Come, see a man" (4:28-29), and ' +
            '"many of the Samaritans of that city believed on him for the ' +
            'saying of the woman" (4:39) -- no verse says her people ' +
            'shunned her or that she came to avoid them',
        except: /\b(?:does not say|doesn't say|do not say|not told|may have|might have|perhaps|possibly|some (?:think|suggest|say))\b/i,
    },
    // BN-236 (ab75..ab77, J-09): James 1:7 quoted from "shall receive",
    // its "let not ... think" left out or moved -- "'shall receive any
    // thing of the Lord' not", "should 'not that man think'" -- marked in
    // five reads of eight.
    {
        story: /\bJames 1\b/i,
        topic: /\b(?:receive|think)\b/i,
        claim: /["“‘]\s*shall receive any thing of the Lord\b|\bshould\s+["“‘]?not that man think\b/i,
        text:
            'James 1:7: "For let not that man think that he shall receive ' +
            'any thing of the Lord" -- quoted whole from "let not"; "shall ' +
            'receive any thing of the Lord" alone says the opposite',
    },
    // BN-235 (ab77, J-11): "is not easily provoked" read as keeping no
    // score of wrongs -- the modern rendering of the phrase after it.
    {
        story: /\b1 Corinthians 13\b/i,
        topic: /\bprovoked\b/i,
        claim: /\b(?:score|record|list|account|tally|track)\b[^.]{0,12}\bof (?:wrongs?|offen[cs]es|hurts|grudges)\b/i,
        text:
            '1 Corinthians 13:5: "is not easily provoked, thinketh no ' +
            'evil" -- "keeps no record of wrongs" is a modern rendering ' +
            'of "thinketh no evil", not of "is not easily provoked"',
        isTopicBefore: true,
        except: /\bthinketh no evil\b/i,
    },
    {
        // BN-230 (the held-out reads ab73, ab74: three Christmas lessons, in
        // the Background that reads the verses before Luke 2): "the
        // dayspring from on high would visit his people to give knowledge
        // of salvation through the remission of sins [Luke 1:78-79]" --
        // that is the child John's task, 1:76-77; the dayspring of 1:78
        // gives light and guides the feet (1:79).
        story: /\bLuke [12]\b|\bChristmas\b|\bdayspring\b/i,
        topic: /\bdayspring\b/i,
        claim: /\bdayspring\b[^.]{0,140}\b(?:knowledge of salvation|remission of (?:their )?sins)\b/i,
        text:
            'Luke 1:76-77: "thou, child" -- John -- "shalt go before the ' +
            'face of the Lord to prepare his ways; To give knowledge of ' +
            'salvation unto his people by the remission of their sins"; the ' +
            'dayspring from on high (1:78) is "To give light to them that ' +
            'sit in darkness ... to guide our feet into the way of peace" ' +
            '(1:79)',
    },
    {
        // BN-229 (the held-out reads ab69..ab73, five batches): a talents
        // or ten virgins lesson set "his disciples and a crowd" on the
        // Mount of Olives -- 24:3 has the disciples come "privately", and
        // the verses a lesson reads before 25:14 never say so.
        story: /\bMatthew 2[45]\b|\b(?:talents|ten virgins|Olivet|Mount of Olives)\b/i,
        topic: /\b(?:Mount of Olives|Olivet|discourse|disciples|Jesus)\b/i,
        claim: /\b(?:crowds?|multitudes?|people gathered|the people|a large group)\b[^.]{0,50}\b(?:Mount of Olives|Olivet)\b|\b(?:Mount of Olives|Olivet)\b[^.]{0,60}\b(?:crowds?|multitudes?)\b|\bdisciples\s+and\s+(?:a|the)\s+(?:crowds?|multitudes?)\b/i,
        text:
            'Matthew 24:3: on the Mount of Olives "the disciples came unto ' +
            'him privately" -- this teaching, the parable with it, is given ' +
            'to the disciples alone, no crowd',
    },
    {
        // ab28: "the stone found the only gap in the giant's armour".
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\b(?:Goliath|giant|Philistine|stone|David)\b/i,
        // BN-161 (ab35): "directed it to the only vulnerable spot on
        // Goliath's head", no armour named.
        claim: /\b(?:gap|chink|weak (?:spot|point)|opening|crack|unprotected (?:spot|place)|exposed (?:spot|place))\b[^.]{0,60}\barmou?r\b|\barmou?r\b[^.]{0,60}\b(?:gap|chink|weak (?:spot|point)|opening|unprotected|exposed)\b|\b(?:only|one|single) (?:vulnerable|weak|unprotected|exposed|uncovered) (?:spot|place|point|part)\b/i,
        text:
            '1 Samuel 17:49 says only that the stone "sunk into his ' +
            'forehead"; no verse gives a gap in his armour -- he wore "an ' +
            'helmet of brass upon his head" (17:5)',
    },
    {
        // ab27, ab28: the Good Samaritan's background, twice.
        story: /\bSamaritan\b|\bLuke 10\b|\bthe seventy\b/i,
        topic: /\b(?:Capernaum|Chorazin|Bethsaida)\b/i,
        claim: /\b(?:spoken|spoke|speaking|speaks|talking|talked|preached|preaching|said|saying|warned|warning)\b[^.]{0,40}\b(?:to|with)\s+(?:the\s+)?(?:people|crowds?|towns?|city|cities|residents|men)\s+of\s+(?:Capernaum|Chorazin|Bethsaida)\b/i,
        text:
            'Luke 10:13-15 (and Matthew 11:21-23): the woe on Chorazin, ' +
            'Bethsaida and Capernaum is said OF those towns to those with ' +
            'Jesus -- in Luke, the seventy he is sending out, who then ' +
            'return with joy (10:17) -- never to their people',
    },
    {
        // ab28: "David hid his sin for a year".
        story: /\bPsalm 51\b|\bBathsheba\b|\bNathan\b/i,
        topic: /\b(?:David|Bathsheba|Nathan|Uriah)\b/i,
        claim: /\bfor (?:about |nearly |almost |over |a whole |a full )?(?:a|one|a whole|a full) (?:whole |full )?year\b|\ba (?:whole|full) year\b|\bnine months\b/i,
        text:
            '2 Samuel 11:27-12:1 gives no length of time: the child was ' +
            'born, "And the LORD sent Nathan unto David"',
    },
    {
        // ab28: "Why was the father upset with the son who had always
        // obeyed?"
        story: /\bLuke 15\b|\bprodigal\b|\bfar country\b/i,
        topic: /\b(?:elder|older|eldest|first) (?:son|brother)\b|\bson who (?:stayed|had always obeyed|never left)\b/i,
        claim: /\bfather\b[^.?!]{0,40}\b(?:upset|angry|cross|furious|annoyed|disappointed|rebuked?|scolded?)\b/i,
        text:
            'Luke 15:28-32: the elder son "was angry"; "therefore came his ' +
            'father out, and intreated him", and said "Son, thou art ever ' +
            'with me" -- the father pleads, he is not angry',
    },
    {
        // ab26: "Jesus told his friends that just as Jonah was in the
        // whale's belly ...".
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\b(?:Jonah|Jonas)\b/i,
        claim: /\b(?:told|tells|telling|said|says|taught|explained|answered)\b[^.]{0,20}\b(?:his|the) (?:friends|disciples|followers)\b[^.]{0,80}\b(?:Jonah|Jonas|whale|fish)\b/i,
        text:
            'Matthew 12:38-40: "certain of the scribes and of the Pharisees" ' +
            'asked him for a sign, and he gave them the sign of the prophet ' +
            'Jonas -- not his friends',
    },
    {
        // ab29 (BN-145): a children's Noah, "when the dove returned with an
        // olive leaf, Noah knew the land was dry and they all stepped out".
        story: /\bNoah\b|\bGenesis [6-9]\b/i,
        topic: /\b(?:dove|olive)\b/i,
        claim: /\bdry\b/i,
        text:
            'Genesis 8:11-16: the olive leaf showed "the waters were abated ' +
            'from off the earth"; the ground was dry later (8:13-14), and ' +
            'Noah went out when God said "Go forth of the ark" (8:15-16)',
    },
    {
        // ab29 (BN-145): a children's Jonah, "He told the people they must
        // stop doing bad things" -- the call to turn was the king's.
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\b(?:Jonah|Jonas|Nineveh)\b/i,
        isTopicBefore: true,
        // ...nor what Jonah feared he would have to say (BN-199, ab56: "He
        // was afraid that if he told the people to be sorry, God would
        // forgive them" is 4:2's fear, not 3:4's words).
        except: /\b(?:king|decree|proclaimed)\b|\bif (?:he|Jonah) (?:told|preached|warned|said|called|went)\b/i,
        // BN-173 (ab41, Opus: an error): "God would destroy Nineveh in forty
        // days if they did not stop" -- 3:4 sets no condition.
        claim: /\b(?:told|tells|preached|preaches|warned|warns|said|says|shouted|cried|called)\b[^.]{0,60}\b(?:stop (?:doing|being|their|his|your)|turn (?:away )?from (?:their|his|your)|change (?:their|his|your) ways|be (?:good|sorry)|say sorry)\b|\bforty days\b[^.]{0,40}\b(?:if|unless)\b|\b(?:if|unless)\b[^.]{0,30}\b(?:did not|didn't|do not|don't|would not)\s+(?:stop|turn|change|repent)\b/i,
        text:
            'Jonah 3:4: Jonah\'s whole message was "Yet forty days, and ' +
            'Nineveh shall be overthrown", with no "if"; the call to "turn ' +
            'every one from his evil way" was the king\'s decree (3:8)',
    },
    {
        // ab41 (BN-173, Opus: an error): "Inside the fish Jonah prayed and
        // said he was sorry" -- 2:1-9 cries out and gives thanks.
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\b(?:fish|whale|belly)\b/i,
        isTopicBefore: true,
        claim: /\b(?:sorry|apologi[sz](?:e|ed|es|ing)|repented|admitted (?:he was wrong|his sin)|confessed|asked (?:God )?(?:for )?(?:forgiveness|to forgive))\b/i,
        text:
            'Jonah 2:1-9: his prayer "out of the fish\'s belly" is a cry ' +
            'heard ("I cried by reason of mine affliction unto the LORD, and ' +
            'he heard me"), a look "toward thy holy temple", and thanks and a ' +
            'vow -- "Salvation is of the LORD" -- with no word of sorrow for ' +
            'running; say what the prayer says',
    },
    {
        // ab31 (BN-156, Opus: an error in both runs): "Why did David refuse
        // the sword and spear?" answered "He wanted the world to know that
        // the battle is the LORD's" -- verse 39 gives his own reason.
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\b(?:armou?r|sword and spear|sling)\b/i,
        isTopicBefore: true,
        // Verse 39's reason in other words is the verse (BN-199, ab56: "he
        // had not tried it out" was named, a true line made over).
        except: /\bnot (?:proved|tried|tested)\b|\bnever (?:proved|tried|tested|used)\b|\bhad(?:n't| not) (?:proved|tried|tested|used)\b|\buntested\b|\bnot used to\b/i,
        // David's reason, never a hearer's: "take off your own armour so
        // that others see" is an application. BN-163 (ab36, Opus): "He
        // rejects the brass helmet and coat of mail because they are not the
        // tools God used to give him victory in the past" -- any "because"
        // but verse 39's.
        claim: /\b(?:David|he)\b[^.]{0,40}\b(?:wanted|so that|so the|to show|to prove|in order that)\b[^.]{0,80}\b(?:know|see|show|clear)\b|\b(?:David|he)\s+(?:rejects?|rejected|refuses?|refused|puts? off|put (?:them|it) off|takes? off|took off|lays? aside|laid aside|sets? aside)\b[^.]{0,80}\bbecause\b/i,
        text:
            "1 Samuel 17:39: David put off Saul's armour for his own " +
            'reason, "I cannot go with these; for I have not proved them" -- ' +
            'he had not tried them; "the battle is the LORD\'s" (17:47) is ' +
            'what he says to Goliath, never why he went without armour',
    },
    {
        // ab56 (BN-200, Sonnet: an error): "declaring that the battle is
        // "of the LORD"" -- only the end of 17:47 in quotes, so the KJV
        // wording table, which reads inside a quotation, never saw "the
        // battle is of the LORD".
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\bbattle\b/i,
        claim: /\bbattle is\s*[«“"]\s*of the LORD\b/i,
        text:
            '1 Samuel 17:47 reads "for the battle is the LORD\'s" -- never ' +
            '"of the LORD"; quote the verse\'s own words whole',
    },
    {
        // ab31, ab32, ab35 (BN-161, both readers): Psalm 46's Christ
        // section, "Jesus took the 'desolations' of our sin / of the earth /
        // of the cross upon Himself" -- the desolations are the LORD's own.
        story: /\bPsalm 46\b|\bvery present help\b/i,
        topic: /\bdesolations?\b/i,
        claim: /\b(?:Jesus|Christ|cross|sins?|He|Himself)\b/,
        text:
            'Psalm 46:8: "Come, behold the works of the LORD, what ' +
            'desolations he hath made in the earth" -- the LORD\'s own works ' +
            'that make "wars to cease" (46:9), never what Christ bore or our ' +
            'sin',
    },
    {
        // ab35 (BN-162, Opus: an error): "The psalm celebrates the Lord of
        // hosts as the protector of the God of Jacob."
        story: /\bPsalm 46\b|\bvery present help\b/i,
        topic: /\bGod of Jacob\b/i,
        claim: /\b(?:protector|guardian|keeper|defender|shield|helper) of (?:the )?God of Jacob\b|\b(?:protects?|protected|guards?|guarded|defends?|defended) (?:the )?God of Jacob\b/i,
        text:
            'Psalm 46:7, 11: "The LORD of hosts is with us; the God of Jacob ' +
            'is our refuge" -- the LORD of hosts IS the God of Jacob, and he ' +
            "is OUR refuge; no one is the God of Jacob's protector",
    },
    {
        // ab35 (BN-162, both readers: an error): "In Jonah 3:10, we see
        // that God is "merciful"" -- the word is Jonah's, in 4:2.
        story: /\bJonah\b|\bNineveh\b/i,
        topic: /\b3:10\b/,
        claim: /\bmerciful\b/i,
        except: /\b4:2\b/,
        text:
            'Jonah 3:10 says "God repented of the evil, that he had said ' +
            'that he would do unto them; and he did it not" -- "merciful" is ' +
            'Jonah\'s own word for God in 4:2 ("thou art a gracious God, and ' +
            'merciful"); name 4:2 for it',
    },
    {
        // ab35 (BN-162, both readers: an error): "This miracle drew a
        // multitude that followed Jesus into the city of Jericho."
        story: /\bZacchaeus\b|\bJericho\b/i,
        topic: /\b(?:multitudes?|crowds?|press)\b/i,
        claim: /\b(?:miracle|healing|healed|sight)\b[^.]{0,40}\b(?:drew|draws|drawn|brought|gathered|attracted)\b|\b(?:drew|drawn|brought|gathered|attracted)\b[^.]{0,30}\bby (?:the |this |his |that )?(?:miracle|healing)\b/i,
        text:
            'Luke 18:36: the blind man, "hearing the multitude pass by" -- ' +
            'the crowd was there before he was healed; after it "he ... ' +
            'followed him, glorifying God" and "all the people, when they ' +
            'saw it, gave praise unto God" (18:43); no verse says the healing ' +
            'drew a crowd into Jericho',
    },
    {
        // ab59 (BN-205, Sonnet: an error): "He is not too small in height to
        // be noticed" -- 19:3 gives his being little as why he could not see.
        story: /\bZacchaeus\b/i,
        topic: /\b(?:height|stature|size|small|short|little)\b/i,
        claim: /\bnot (?:too |so |very |that )?(?:small|short|little) in (?:height|stature|size)\b|\b(?:was|is) not (?:really |actually )?(?:small|short)\b/i,
        text:
            'Luke 19:3: he "sought to see Jesus who he was; and could not ' +
            'for the press, because he was little of stature" -- he was ' +
            'short; never say he was not',
    },
    {
        // ab35 (BN-162, Sonnet: an error): ""little of stature" means
        // Zacchaeus was short, but it also pictures his low standing among
        // the people."
        story: /\bZacchaeus\b/i,
        topic: /\bstature\b|\bshort\b/i,
        // BN-170 (ab40, Opus: A 1): "mirrors his social standing". BN-185
        // (ab48, Opus: A 1): "it also hints at how he was viewed by the
        // community".
        claim: /\b(?:pictures?|symboli[sz](?:es|ed|ing)?|represents?|stands? for|spiritual(?:ly)?|mirrors?|mirrored|reflects?|reflected|echoes|matches|hints?|suggests?)\b|\b(?:low|social) (?:standing|status|position|place|esteem)\b|\b(?:standing|status|reputation) (?:among|with|in)\b|\bhow (?:he was|people|others|the (?:people|community|town|crowd)) (?:viewed|saw|regarded|seen|looked)\b|\b(?:viewed|regarded) by\b/i,
        text:
            '"little of stature" (Luke 19:3) is his height -- he "could not ' +
            'for the press" see Jesus and "climbed up into a sycomore tree" ' +
            '(19:4); never a picture of his standing: what the people said ' +
            'of him is that he was "a man that is a sinner" (19:7)',
    },
    {
        // ab45 (Opus: noted), ab46 (BN-181, Sonnet: an error): "In the
        // Gospels, Jesus showed the ultimate "abasing" when He emptied
        // Himself, taking the form of a servant [Philippians 2:5-8]" -- in
        // three Philippians 4 lessons running. BN-189 (ab51, Sonnet: an
        // error): "In the Gospels, Jesus ... though being rich, "for him
        // poor became"" -- 2 Corinthians 8:9, misquoted.
        story: /\bGospels?\b/i,
        topic: /\b(?:in|from) the Gospels?\b|\bthe Gospels? (?:says?|tells?|shows?|records?|describes?)\b|\bGospel writers?\b/i,
        // A book named inside a verse token is the line's citation, not its
        // claim (BN-203, shape60: "In the Gospels, Jesus showed he had power
        // over the "former things" [^(KJV) Revelation 21:4] by raising
        // Lazarus" was named, and true).
        claim: /(?<!\[\^(?:\([^)\]]*\)\s*)?)\b(?:Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation|Acts)\b|\bemptied (?:him|Him)self\b|\bform of a servant\b|\bno reputation\b|\bthough (?:he was|being) rich\b|\b(?:became poor|poor became)\b/i,
        text:
            "Philippians 2:5-8 and 2 Corinthians 8:9 are Paul's letters, " +
            'not a Gospel -- say "Paul writes": Christ "made himself of no ' +
            'reputation, and took upon him the form of a servant ... and ' +
            'became obedient unto death, even the death of the cross" ' +
            '(Philippians 2:7-8); "though he was rich, yet for your sakes he ' +
            'became poor" (2 Corinthians 8:9)',
    },
    {
        // ab55 (BN-198, Sonnet: A 1): "the father ignored the request to be
        // a "hired servant"" -- 15:21 has the son never make it.
        story: /\bprodigal\b|\bfar country\b|\bcame to himself\b|\bLuke 15\b/i,
        topic: /\bhired servants?\b/i,
        claim: /\b(?:ignor\w*|refus\w*|den(?:y|ied)|interrupt\w*|cut (?:him |it )?(?:off|short)|stopp?ed him)\b[^.]{0,40}\bhired servants?\b/i,
        text:
            'Luke 15:19, 21: the son meant to say "make me as one of thy ' +
            'hired servants", and said only "Father, I have sinned against ' +
            'heaven, and in thy sight, and am no more worthy to be called ' +
            'thy son" -- the father answered no request about servants; say ' +
            'what the son said',
    },
    {
        // ab56 (BN-201, Opus: A 1): "the father "ran, and fell on his neck,
        // and kissed him" while the son was still "a great way off"" --
        // 15:20 has him SEEN a great way off, then the running.
        story: /\bprodigal\b|\bfar country\b|\bcame to himself\b|\bLuke 15\b/i,
        topic: /\bgreat way off\b/i,
        claim: /\b(?:kissed|kiss|embraced|fell on his neck)\b[^.]{0,60}\b(?:while|when|as) (?:the son|he|his son|the boy) was (?:still |yet )?["“]?(?:still |yet )?a great way off\b/i,
        text:
            'Luke 15:20: "when he was yet a great way off, his father saw ' +
            'him, and had compassion, and ran, and fell on his neck, and ' +
            'kissed him" -- seen a great way off, then run to and kissed; ' +
            'never kissed while still far away',
    },
    {
        // ab55 (BN-198, Sonnet: A 1): a children's Jonah -- "the men feared
        // the LORD exceedingly and obeyed [Jonah 1:16]".
        story: /\bJonah\b/i,
        topic: /\bJonah 1:16\b|\bfeared the LORD\b|\bsailors\b|\bthe men\b/i,
        claim: /\bobey(?:ed|ing|s)?\b/i,
        except: /\bJonah (?:obey|did not obey|disobey)/i,
        text:
            'Jonah 1:16: "Then the men feared the LORD exceedingly, and ' +
            'offered a sacrifice unto the LORD, and made vows" -- what the ' +
            'verse says the sailors did',
    },
    {
        // ab54 (BN-196, Opus: an error): a funeral's background -- "the dead
        // were judged according to the book of life" -- 20:12 says by their
        // works.
        story: /\bRevelation 2[01]\b|\bgreat white throne\b|\bnew heaven\b/i,
        topic: /\bjudged\b/i,
        claim: /\bjudged\b[^.]{0,30}\b(?:according to|by|from|out of)\s+the book of life\b/i,
        text:
            'Revelation 20:12: "the dead were judged out of those things ' +
            'which were written in the books, according to their works"; the ' +
            'book of life is who is not cast out, "whosoever was not found ' +
            'written in the book of life was cast into the lake of fire" ' +
            '(20:15)',
    },
    {
        // ab54 (BN-195, Sonnet: A 1): a children's lost sheep -- "He did it
        // because the one lost sheep was in danger" -- 15:4 gives that it
        // is lost.
        story: /\bninety and nine\b|\bninety-nine\b/i,
        topic: /\bbecause\b|\bwhy\b/i,
        // Of the sheep or the shepherd: a child in an example who hides
        // "because they are scared" is another story.
        // BN-202 (ab57, Opus: A 1): "Because the one that was lost was
        // special" -- the same answer, the sheep unnamed.
        claim: /\bbecause (?:the|that|this) (?:one|lost one|little one)\b[^.]{0,30}\bwas (?:so )?(?:special|precious|valuable|important)\b|\bbecause\b[^.]{0,30}\bsheep\b[^.]{0,30}\b(?:danger|hurt|wolf|wolves|scared|afraid|alone|cold|hungry)\b|\b(?:sheep|shepherd|He did it|he did it)\b[^.]{0,60}\bbecause\b[^.]{0,40}\b(?:danger|hurt|wolf|wolves|scared|afraid|alone|cold|hungry)\b/i,
        text:
            'Luke 15:4: he "doth not leave the ninety and nine in the ' +
            'wilderness, and go after that which is lost, until he find it?" ' +
            '-- the reason the verse gives is that it is lost, and 15:6 ' +
            '"Rejoice with me; for I have found my sheep which was lost"',
    },
    {
        // ab54 (BN-195, Sonnet: A 1): "Paul speaks of "want" not as a lack
        // of money, but as a state of dependency" -- 4:12 names hunger and
        // need.
        story: /\bPhilippians 4\b|\bin whatsoever state\b/i,
        topic: /\bwant\b/i,
        claim: /\bwant\b[^.]{0,30}\bnot\b[^.]{0,30}\b(?:lack|money|need|poverty)\b|\bwant\b[^.]{0,60}\bdependen(?:cy|ce)\b/i,
        text:
            'Philippians 4:11-12: "Not that I speak in respect of want ... I ' +
            'know both how to be abased ... both to be full and to be ' +
            'hungry, both to abound and to suffer need" -- want is lack and ' +
            'need, hunger among them',
    },
    {
        // ab53 (BN-194, Opus: A 1, three batches): "He is the "fountain of
        // the water of life" [Revelation 21:6]" -- 21:6 has him GIVE of it.
        story: /\bRevelation 21\b|\bwater of life\b/i,
        topic: /\bfountain\b/i,
        claim: /\b(?:He|Jesus|Christ|he)\b\s+(?:is|was|became)\s+(?:the|our)\s+["']?fountain\b/,
        text:
            'Revelation 21:6: "I will give unto him that is athirst of the ' +
            'fountain of the water of life freely" -- he GIVES of the ' +
            'fountain; say "the one who gives of the fountain of the water ' +
            'of life", never that he is it',
    },
    {
        // ab53 (BN-194, Opus: A 1, two batches): "over ninety and nine who
        // think they need no repentance [Luke 15:7]" -- "think" is a
        // reading, not the verse.
        story: /\bninety and nine\b|\bLuke 15\b/i,
        topic: /\bneed no repentance\b/i,
        claim: /\b(?:think|thinks|thought|believe|believed|feel|felt)\b[^.]{0,20}\bneed no repentance\b/i,
        text:
            'Luke 15:7: "joy shall be in heaven over one sinner that ' +
            'repenteth, more than over ninety and nine just persons, which ' +
            'need no repentance" -- quote it as it reads; that they only ' +
            'think so is a reading to say as one, never his words',
    },
    {
        // ab38 (Sonnet: noted), ab53 (BN-193, Sonnet: an error): "Just as
        // Jesus climbed the social ladder to find a lonely tax collector"
        // -- Zacchaeus climbed; Jesus told him to come down.
        story: /\bZacchaeus\b/i,
        topic: /\b(?:Jesus|Christ|He)\b/,
        claim: /\b(?:Jesus|Christ|He)\b[^.]{0,20}\bclimb(?:ed|s|ing)?\b[^.]{0,30}\b(?:ladder|tree|up)\b/,
        text:
            'Luke 19:4-5: Zacchaeus "climbed up into a sycomore tree"; ' +
            'Jesus "looked up, and saw him, and said unto him, Zacchaeus, ' +
            'make haste, and come down" -- it is Zacchaeus who climbed; ' +
            'Jesus came to him and called him down',
    },
    {
        // ab52 (BN-192, Opus: an error): "To restore "fourfold" means to pay
        // back far more than the law required for stolen goods [Exodus
        // 22:1]" -- 22:1 itself asks fourfold for a sheep.
        story: /\bZacchaeus\b|\bfourfold\b/i,
        topic: /\bfourfold\b|\bfour times\b/i,
        // BN-204 (ab58, Opus: noted): "far more than the law required for
        // stolen goods [Leviticus 6:5]" -- for a stolen sheep the law asks
        // fourfold.
        claim: /\b(?:more than|beyond|above|exceed\w*)\b[^.]{0,40}\blaw\b[^.]{0,80}\bExodus 22:1\b|\b(?:more than|beyond|above|exceed\w*)\b[^.]{0,40}\blaw\b[^.]{0,30}\b(?:stolen|theft|stealing|thie(?:f|ves))\b/i,
        text:
            'Exodus 22:1 asks fourfold itself -- "he shall restore five oxen ' +
            'for an ox, and four sheep for a sheep"; the law that asks less ' +
            'is Numbers 5:7, "the principal thereof, and add unto it the ' +
            'fifth part thereof" (Leviticus 6:5 the same) -- cite that one ' +
            'for "more than the law asked", and never "for stolen goods": ' +
            'for a stolen sheep the law asks fourfold',
    },
    {
        // ab52 (BN-192, Opus: an error): a children's Jonah -- "they helped
        // him by throwing him into the sea" -- 1:13-14 has them row hard
        // not to.
        story: /\bJonah\b/i,
        topic: /\b(?:sailors|mariners|shipmen|the men)\b/i,
        claim: /\bhelp(?:ed|ing|s)?\b[^.]{0,40}\b(?:throw|threw|thrown|throwing|cast|casting|toss(?:ed|ing)?)\b|\b(?:threw|cast|tossed)\b[^.]{0,40}\bto help\b/i,
        text:
            'Jonah 1:12-14: Jonah said "cast me forth into the sea; so shall ' +
            'the sea be calm unto you"; the men "rowed hard to bring it to ' +
            'the land; but they could not" and cried "let us not perish for ' +
            'this man\'s life" -- they cast him in that the sea might be ' +
            'calm, never to help him',
    },
    {
        // ab52 (BN-191, Sonnet: an error): "while the giant comes with a
        // sword, and a spear, and a javelin [1 Samuel 17:45]" -- a modern
        // translation's list, told as the KJV's.
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\bjavelin\b/i,
        claim: /\bsword\b[^.]{0,30}\bspear\b[^.]{0,30}\bjavelin\b/i,
        text:
            '1 Samuel 17:45 in the KJV: "Thou comest to me with a sword, ' +
            'and with a spear, and with a shield: but I come to thee in the ' +
            'name of the LORD of hosts" -- javelin is a modern translation\'s ' +
            'word there',
    },
    {
        // ab51 (BN-190, Opus: an error): "In the Gospels, Jesus uses these
        // very words to invite us: "Come unto me ..." [Matthew 11:28]" --
        // under Isaiah 40, whose words 11:28 does not use.
        story: /./,
        // Jesus or Christ named, never a verse quoted ("(23): ... spake
        // according to the same words" is 1 Samuel 17's own).
        topic: /\b(?:Jesus|Christ)\b/,
        except: /\(\d{1,3}\):/,
        // "very", "exact" or "same" words: "Jesus spoke these words to the
        // Pharisees" is a setting, and "these words are true" Revelation's.
        // BN-191 (ab52, Sonnet: an error): "these same words" too.
        claim: /\b(?:these|those|his|its|Isaiah's|David's)\s+(?:very|exact|same)\s+words\b|\bthe (?:very\s+)?same words\b/i,
        text:
            'a verse that says the same in other words is no quotation -- ' +
            'say "Jesus makes the same promise" and quote his own words, ' +
            'as "Come unto me, all ye that labour and are heavy laden, and ' +
            'I will give you rest" (Matthew 11:28) beside Isaiah 40:29\'s ' +
            '"He giveth power to the faint"; "these very words" only where ' +
            'the New Testament quotes the verse word for word',
    },
    {
        // ab51 (BN-189, Sonnet: an error): "God reminds them that he is the
        // Holy One who created the stars and brings princes to nothing
        // [Isaiah 40:25-26]" -- the princes are 40:23.
        story: /\bIsaiah 40\b/i,
        topic: /\bprinces\b/i,
        // Not when 40:23 is cited between (BN-221, shape70: "the princes to
        // nothing [40:23] and calls the stars by name [40:26]" -- each its
        // own, as the entry asks, and named).
        claim: /\bprinces\b(?:(?!Isaiah 40:23\b)[^.]){0,80}\bIsaiah 40:(?:2[4-9]|3\d)\b/i,
        text:
            'Isaiah 40:23: "That bringeth the princes to nothing; he maketh ' +
            'the judges of the earth as vanity" -- 40:25-26 is "To whom ' +
            'then will ye liken me" and the stars he "calleth them all by ' +
            'names"; give each its own verse',
    },
    {
        // ab51 (BN-189, Sonnet: an error): "a Levite was from the tribe of
        // Levi, appointed to serve the temple [Numbers 3:10]" -- 3:10 is
        // Aaron and his sons.
        story: /\bLevites?\b/i,
        topic: /\bLevites?\b/i,
        claim: /\bNumbers 3:10\b/i,
        text:
            'Numbers 3:10 appoints "Aaron and his sons" to the priest\'s ' +
            'office; the Levites were "given unto Aaron and to his sons" ' +
            '(Numbers 3:9), and in the temple "their office was to wait on ' +
            'the sons of Aaron for the service of the house of the LORD" (1 ' +
            'Chronicles 23:28)',
    },
    {
        // ab51 (BN-189, Sonnet: A 1): "the Father requires that we "from
        // your hearts forgive not every one"" -- 18:35's warning quoted as
        // what he asks.
        story: /\bMatthew 18\b|\bseventy times seven\b|\bunforgiving servant\b/i,
        topic: /\bforgive not\b/i,
        claim: /\b(?:requires?|asks?|commands?|wants?|calls? us|tells? us|expects?)\b[^.]{0,40}\bforgive not\b/i,
        text:
            'Matthew 18:35 warns: "So likewise shall my heavenly Father do ' +
            'also unto you, if ye from your hearts forgive not every one his ' +
            'brother their trespasses" -- what he will do if we do not ' +
            'forgive; say what he asks in plain words, "from your hearts" to ' +
            'forgive',
    },
    {
        // ab46 (Sonnet: noted), ab48 (BN-185, Opus: A 1): the children's
        // lost sheep -- "Does God get angry when we are lost?" answered
        // "No", and the story told as "he did not get angry".
        // The lost sheep's own words: a lesson on the prodigal names "a
        // lost sheep" in its background, and its father's coming out is
        // another question.
        story: /\bninety and nine\b|\bninety-nine\b/i,
        topic: /\bangry\b|\banger\b/i,
        claim: /\b(?:not|never|no)\b[^.?]{0,40}\b(?:angry|anger)\b|n't\b[^.?]{0,40}\b(?:angry|anger)\b|^\W*(?:\*\*[^*]*\*\*\s*)?No\b/i,
        isTopicBefore: true,
        text:
            'Luke 15:5-7 tells only joy at the finding: "he layeth it on his ' +
            'shoulders, rejoicing" and "joy shall be in heaven over one ' +
            'sinner that repenteth" -- the parable says nothing of anger, so ' +
            'never tell or answer whether God or the shepherd is angry; say ' +
            'what it does say, how glad he is',
    },
    {
        // ab45 (Sonnet: noted), ab46 (BN-183, Sonnet: A 1): a funeral
        // message on Revelation 21 -- "the one person you miss most is
        // waiting there with a smile".
        story: /\bRevelation 21\b|\bnew heaven\b|\bnew Jerusalem\b|\bholy city\b/i,
        // A person missed, never a home waiting (a grandfather's story of
        // "a home ... waiting for them" is a picture of John 14:2).
        topic: /\bmiss\b|\bloved ones?\b|\bthe one (?:you|we) (?:love|lost)\b|\b(?:those|the ones?) (?:who|that) (?:died|have died|went before|have gone)\b/i,
        claim: /\bwait(?:s|ing)\b[^.]{0,40}\b(?:there|for (?:you|us|them)|with a smile|to (?:greet|welcome|meet))\b/i,
        text:
            'Revelation 21 names no one waiting: it promises "the tabernacle ' +
            'of God is with men" and "God shall wipe away all tears from ' +
            'their eyes" (21:3-4) -- for meeting again those who died in ' +
            'Christ, the verse is 1 Thessalonians 4:17, "caught up together ' +
            'with them ... and so shall we ever be with the Lord"',
    },
    {
        // ab46 (BN-181, Sonnet: A 1): "As the New Testament shows, we are
        // forgiven because Christ was delivered to the tormentors of the
        // cross for us" -- the parable's tormentors put on Christ. BN-186
        // (ab49, Sonnet: an error): "On the cross, he was delivered to the
        // tormentors" -- the cross first, and "he".
        story: /\btormentors\b/i,
        topic: /\btormentors\b/i,
        claim: /\b(?:Christ|Jesus|the Son|our Lord)\b[^.]{0,60}\btormentors\b|\btormentors\b[^.]{0,40}\b(?:cross|Calvary)\b|\b(?:cross|Calvary)\b[^.]{0,60}\btormentors\b/i,
        text:
            'the tormentors are the unforgiving servant\'s, "delivered him ' +
            'to the tormentors, till he should pay all that was due" ' +
            "(Matthew 18:34) -- never Christ's; for the cross say what a " +
            'verse says: "Who his own self bare our sins in his own body on ' +
            'the tree" (1 Peter 2:24)',
    },
    {
        // ab50 (BN-187, Sonnet: an error): "the "Creator of the ends of the
        // earth" [Isaiah 40:28], meaning he made everything from the dust
        // of the ground [Genesis 2:7]".
        story: /\bIsaiah 40\b|\bwait upon the LORD\b|\bends of the earth\b/i,
        topic: /\bdust\b/i,
        claim: /\b(?:everything|all things|the (?:world|earth|heavens)|all of creation)\b[^.]{0,40}\bdust\b/i,
        text:
            'Genesis 2:7 says only that "the LORD God formed man of the ' +
            'dust of the ground"; "the Creator of the ends of the earth" ' +
            '(Isaiah 40:28) is his making the whole earth to its edges -- ' +
            '"he that sitteth upon the circle of the earth" (40:22)',
    },
    {
        // ab50 (BN-187, Sonnet: an error): a children's Jonah -- "Jonah did
        // not want to go because the people there were mean" -- 4:2 gives
        // his own reason.
        story: /\bJonah\b/i,
        topic: /\b(?:did(?:n't| not) want|ran away|run away|running away|fled|flee|fleeing|tried to hide)\b/i,
        claim: /\bbecause\b[^.]{0,60}\b(?:mean|wicked|bad|evil|enemies|cruel|hurt(?:ing)?|scared|afraid|feared|frightened)\b/i,
        except: /\bgracious\b|\bmerciful\b|\b4:2\b/i,
        text:
            'Jonah 4:2: "I fled before unto Tarshish: for I knew that thou ' +
            'art a gracious God, and merciful" -- his own reason; 1:2\'s ' +
            '"their wickedness is come up before me" is why God sent him, ' +
            'never why he ran',
    },
    {
        // ab49 (BN-186, Sonnet: an error; Opus: A 1): "The lawyer cannot
        // even bring himself to say the word "Samaritan"" -- a motive no
        // verse gives.
        story: /\bSamaritan\b/i,
        topic: /\blawyer\b|\bSamaritan\b/i,
        claim: /\b(?:cannot|can't|could not|couldn't|would not|wouldn't|unable to|refuses? to|refused to)\b[^.]{0,30}\b(?:say|speak|utter|name)\b|\bbring himself to\b/i,
        text:
            'Luke 10:37: "And he said, He that shewed mercy on him" -- the ' +
            "lawyer's answer as the text gives it; no verse says why he " +
            'put it so',
    },
    {
        // ab49 (BN-186, Opus: A 1): "Jesus became our ultimate refuge,
        // taking the "rage" of judgment upon Himself" -- Psalm 46:6's
        // raging is the nations'.
        story: /\bPsalm 46\b|\bGod is our refuge\b/i,
        topic: /\brag(?:e|ed|eth|ing)\b/i,
        claim: /\b(?:Christ|Jesus|he|He|Himself|himself)\b[^.]{0,60}\brag(?:e|ed|eth|ing)\b|\brag(?:e|ed|eth|ing)\b[^.]{0,40}\b(?:judgment|wrath|cross|Himself|himself)\b/i,
        except: /\bheathen raged\b|\bthe nations raged\b/i,
        text:
            'Psalm 46:6: "The heathen raged, the kingdoms were moved: he ' +
            'uttered his voice, the earth melted" -- the raging is the ' +
            "nations', never God's judgment nor a rage Christ bore",
    },
    {
        // ab49 (BN-186, Opus: A 1): the prodigal's "came to himself" told
        // as "the moment ... he stopped blaming his circumstances".
        story: /\bcame to himself\b|\bprodigal\b|\bfar country\b/i,
        topic: /\bcame to himself\b|\bprodigal\b|\bthe (?:younger )?son\b/i,
        claim: /\bblam(?:e|ed|es|ing)\b/i,
        text:
            'Luke 15:17-18: "when he came to himself, he said, How many ' +
            "hired servants of my father's have bread enough and to spare, " +
            'and I perish with hunger! I will arise and go to my father" -- ' +
            'what he saw and said, and no blaming the text tells of',
    },
    {
        // ab49 (BN-186, Opus: A 1): "Paul says his "care of me hath
        // flourished again"" -- 4:10's care is the Philippians'.
        story: /\bPhilippians 4\b|\bcare of me\b/i,
        topic: /\bcare of me\b/i,
        claim: /\b(?:his|Paul's)\b[^.]{0,6}\bcare of me\b|\bPaul says his\b/i,
        text:
            'Philippians 4:10: "your care of me hath flourished again" -- ' +
            "the Philippians' care for Paul (their gift, 4:18), never his own",
    },
    {
        // ab45 (BN-179, Opus: an error): "In the Gospels, Jesus tells his
        // followers that whoever abides in him will find rest." -- two
        // sayings made one, in a lesson on Psalm 46.
        story: /\babid(?:e|es|eth|ing)\b/i,
        topic: /\babid(?:e|es|eth|ing)\b/i,
        claim: /\b(?:find|finds|found|finding|have|has|enter|enters|receive|receives|gives?|given)\s+(?:[\w']+\s+){0,2}rest\b/i,
        text:
            'no saying of Jesus joins abiding and rest: "Abide in me ... ' +
            'he that abideth in me ... bringeth forth much fruit" (John ' +
            '15:4-5) is fruit; rest is for those who come, "Come unto me, ' +
            'all ye that labour and are heavy laden, and I will give you ' +
            'rest" (Matthew 11:28); quote the one meant',
    },
    {
        // ab45 (BN-178, Sonnet: A 1): "He "could not for the press" of the
        // crowd, and because of who he was, the people would not have made
        // room for him." -- 19:3 gives his height as the reason.
        story: /\bZacchaeus\b/i,
        topic: /\b(?:crowds?|press|multitudes?|people)\b/i,
        claim: /\b(?:make|made|making|give|gave|giving|let)\b[^.]{0,20}\b(?:room|way)\b[^.]{0,60}\b(?:who he was|tax|publicans?|hated|despised|sinner|reputation|collector)\b|\b(?:who he was|tax|publicans?|hated|despised|sinner|reputation|collector)\b[^.]{0,60}\b(?:make|made|making|give|gave|giving|let)\b[^.]{0,20}\b(?:room|way)\b|\bwould(?:n't| not)\b[^.]{0,20}\b(?:make|made|let|give|gave)\b[^.]{0,20}\b(?:room|way|him through)\b/i,
        text:
            'Luke 19:3: he "sought to see Jesus who he was; and could not ' +
            'for the press, because he was little of stature" -- the ' +
            'reason the verse gives is his height; no verse says the people ' +
            'would not make room for him',
    },
    {
        // ab41 (BN-173, Opus: A 1): Jesus declared salvation "because the
        // change in his heart led to a change in his actions" -- 19:9 gives
        // its own reason.
        story: /\bZacchaeus\b/i,
        topic: /\bsalvation\b|\bsaved\b/i,
        claim: /\b(?:because|since|as a result of|due to)\b[^.]{0,60}\b(?:change|changed|actions?|giving|gave|restor(?:e|ed|ing)|repent(?:ed|ance)?|deeds?|works?|half of (?:his|my) goods)\b/i,
        except: /\bson of Abraham\b/i,
        text:
            'Luke 19:9-10: "This day is salvation come to this house, ' +
            'forsomuch as he also is a son of Abraham. For the Son of man is ' +
            'come to seek and to save that which was lost" -- the reason ' +
            'Jesus gives, never his giving or his changed life',
    },
    {
        // ab35 (Opus), ab37 (BN-165, Sonnet: an error): "a gatherer of
        // taxes who was often counted with sinners [^(KJV) Luke 3:12-13]"
        // -- those verses are the publicans' question to John.
        story: /\bpublicans?\b|\bZacchaeus\b/i,
        topic: /\bLuke 3:1[23]\b/i,
        // The sinners given their own verse (BN-207, shape62: "counted with
        // sinners [Luke 5:30], [Luke 15:1-2] and told to exact no more
        // [Luke 3:12-13]" was named, and true).
        except: /\b(?:Luke (?:5:3[0-2]|7:34|15:[12]|19:7)|Matthew (?:9:1[0-3]|11:19|21:3[12])|Mark 2:1[5-7])\b/,
        claim: /\bsinners?\b/i,
        text:
            'Luke 3:12-13: "Then came also publicans to be baptized, and said ' +
            'unto him, Master, what shall we do? And he said unto them, ' +
            'Exact no more than that which is appointed you" -- publicans ' +
            'are named with sinners in Luke 5:30 ("with publicans and ' +
            'sinners") and 15:1-2; name those for it',
    },
    {
        // ab37 (BN-166, Opus: an error): "received his sight through faith
        // [^(KJV) Luke 18:34-43]".
        story: /\bZacchaeus\b|\bJericho\b|\bLuke 1[89]\b/i,
        topic: /\bLuke 18:34\b/i,
        claim: /\b(?:blind|sight|see|healed|healing|Jericho|beggar)\b/i,
        text:
            'Luke 18:34 is the twelve, who "understood none of these ' +
            'things"; the blind man by Jericho is Luke 18:35-43',
    },
    {
        // ab36, ab37 (BN-166, Opus: an error, then A 1): God "makes the
        // princes of the earth as vanity" -- two halves of 40:23 made one.
        story: /\bIsaiah 40\b|\bwait upon the LORD\b/i,
        topic: /\bprinces\b/i,
        claim: /\bprinces\b[^.;]{0,40}\bvanity\b|\bvanity\b[^.;]{0,40}\bprinces\b/i,
        except: /\bjudges\b/i,
        text:
            'Isaiah 40:23: "That bringeth the princes to nothing; he maketh ' +
            'the judges of the earth as vanity" -- the princes brought to ' +
            'nothing, the JUDGES made as vanity',
    },
    {
        // ab40 (BN-170, Opus: an error): "David served as Saul's
        // armourbearer while the Philistines gathered for war" -- 16:21 made
        // him one, and 17:15 has him home with the sheep.
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\barmou?rbearer\b/i,
        claim: /\b(?:while|when|as|during)\b[^.]{0,60}\b(?:Philistines?|gathered|war|battle|army|armies|Elah)\b|\b(?:Philistines?|battle|war)\b[^.]{0,60}\barmou?rbearer\b/i,
        except: /\b(?:sheep|home|Bethlehem|returned|went back)\b/i,
        text:
            "1 Samuel 16:21 makes David Saul's armourbearer, but when the " +
            'Philistines gathered "the three eldest sons of Jesse went and ' +
            'followed Saul to the battle" and "David went and returned from ' +
            'Saul to feed his father\'s sheep at Bethlehem" (17:13-15), till ' +
            'Jesse sent him with food to his brothers (17:17-20)',
    },
    {
        // ab40 (BN-170, Opus: A 1): Matthew 18's answer given "when a
        // brother repents" -- that condition is Luke 17:3's.
        story: /\bseventy times seven\b|\bMatthew 18\b|\bten thousand talents\b/i,
        // BN-174 (ab42, Opus: an error): "when a brother sins and asks for
        // forgiveness", "whenever a brother repents".
        topic: /\brepent(?:s|ed|ing|ance)?\b|\basks? (?:for )?(?:forgiveness|to be forgiven)\b|\bsays? (?:he is )?sorry\b|\bapologi[sz]es?\b/i,
        // The brother's repenting, never ours: "God forgives us when we
        // repent" is no misreading of this passage.
        claim: /\b(?:when|whenever|if|as long as|once|provided|only)\b[^.]{0,20}\b(?:brother|he|she|they|someone|the other person|the offender|the one who)\b[^.]{0,30}\b(?:repent(?:s|ed|ing)?|asks? (?:for )?(?:forgiveness|to be forgiven)|says? (?:he is )?sorry|apologi[sz]es?)\b/i,
        except: /\bLuke 17\b/i,
        text:
            'Matthew 18:21-22 sets no condition: "I say not unto thee, Until ' +
            'seven times: but, Until seventy times seven"; "if he repent, ' +
            'forgive him" is Luke 17:3, said another day -- name Luke 17:3 ' +
            'for it, or leave the condition out',
    },
    {
        // ab38 (BN-167, Opus: an error): a funeral message's Christ section,
        // Jesus "made him live again, saying, "I am the resurrection"".
        story: /\bI am the resurrection\b|\bJohn 11:25\b/i,
        topic: /\bresurrection\b|\bJohn 11:25\b/i,
        claim: /\b(?:raising|raised|raises|made him (?:live|alive)|called him (?:out|forth)|at the (?:tomb|grave)|by the (?:tomb|grave)|before the (?:tomb|grave))\b[^.]{0,80}\b(?:saying|said|declared|cried)\b|\b(?:said|saying|declared|cried)\b[^.]{0,40}\b(?:at|by|before) the (?:tomb|grave)\b/i,
        except: /\bMartha\b/i,
        text:
            'John 11:25: "I am the resurrection, and the life" is said to ' +
            'Martha on the way, before he came to the grave (11:20-27); at ' +
            'the grave he "cried with a loud voice, Lazarus, come forth" ' +
            '(11:43)',
    },
    {
        // ab38 (BN-167, Opus: an error): a Psalm 51 sermon's Christ section,
        // Jesus "eating with sinners and telling them that "They that be
        // whole need not a physician"".
        story: /\bwhole need not a physician\b|\bMatthew 9:1[0-3]\b|\bMark 2:17\b|\bLuke 5:31\b/i,
        topic: /\bphysician\b/i,
        claim: /\b(?:told|telling|tells|said to|saying to|says to|assured|assuring)\b[^.]{0,30}\b(?:them|sinners|publicans|tax (?:collectors|gatherers))\b/i,
        except: /\b(?:Pharisees|scribes|religious leaders|critics)\b/i,
        text:
            'Matthew 9:11-12: when the Pharisees asked his disciples why he ' +
            'ate "with publicans and sinners", Jesus "heard that" and said ' +
            'to the Pharisees, "They that be whole need not a physician, but ' +
            'they that are sick"',
    },
    {
        // ab38 (BN-167, Opus: A 1): "the call to bind mercy and truth upon
        // the heart".
        story: /\bProverbs 3\b|\bTrust in the LORD with all thine heart\b/i,
        topic: /\bbind\b/i,
        claim: /\bbind\b[^.;]{0,50}\b(?:upon|on|in|to|around|about) (?:the |thy |your |our )?heart\b/i,
        except: /\bneck\b/i,
        text:
            'Proverbs 3:3: "bind them about thy neck; write them upon the ' +
            'table of thine heart" -- bound about the neck, written upon the ' +
            'heart',
    },
    {
        // ab44 (BN-177, Opus: an error): a children's Jonah's Christ
        // section, "the grave was the place where Jesus died and then rose".
        story: /\bJonah\b|\bJonas\b|\bMatthew 12:40\b/i,
        topic: /\b(?:grave|tomb)\b/i,
        claim: /\b(?:grave|tomb)\b[^.]{0,40}\bwhere\b[^.]{0,20}\b(?:he|Jesus|Christ)\b[^.]{0,10}\bdied\b|\bdied in the (?:grave|tomb)\b/i,
        text:
            'Matthew 12:40: "so shall the Son of man be three days and three ' +
            'nights in the heart of the earth" -- he died on the cross and ' +
            'was laid in the tomb, from which he rose',
    },
    {
        // ab44 (BN-177, Opus: an error): "He tells David that the sacrifices
        // of God are a broken spirit" -- 51:17 is David's prayer.
        story: /\bPsalm 51\b|\bbloodguiltiness\b|\bBath-?sheba\b/i,
        topic: /\bbroken spirit\b|\bsacrifices of God\b|\bcontrite heart\b/i,
        claim: /\b(?:God|He|the LORD|the Lord)\s+(?:tells|told|says|said|answers|answered|reminds|reminded)\s+(?:David|him)\b/,
        text:
            'Psalm 51:17 is David\'s own prayer to God: "The sacrifices of God ' +
            'are a broken spirit: a broken and a contrite heart, O God, thou ' +
            'wilt not despise" -- David says it, never God to David',
    },
    {
        // ab44 (BN-177, Opus: A 1): "the servant asked for 'patience' twice"
        // -- the servant once (18:26), his fellowservant once (18:29).
        story: /\bseventy times seven\b|\bMatthew 18\b|\bten thousand talents\b/i,
        topic: /\bpatience\b/i,
        claim: /\btwice\b|\btwo times\b/i,
        except: /\bboth\b|\beach\b|\bfellow ?servant\b/i,
        text:
            'Matthew 18:26, 29: the servant asked once -- "Lord, have patience ' +
            'with me, and I will pay thee all" -- and his fellowservant once, ' +
            'in the same words',
    },
    {
        // ab44 (BN-177, Opus: A 1): the eagles' wings "to see things from his
        // perspective" -- 40:31's wings are strength renewed.
        story: /\bIsaiah 40\b|\bwait upon the LORD\b/i,
        topic: /\beagles?\b/i,
        claim: /\bperspective\b|\bsee (?:things|life|everything|the whole)\b|\bview from\b|\babove the (?:storms?|clouds|problems|trouble)\b|\bsoar(?:s|ing)? above\b/i,
        text:
            'Isaiah 40:31: "they shall mount up with wings as eagles; they ' +
            'shall run, and not be weary; and they shall walk, and not faint" ' +
            '-- strength renewed, never a view from above',
    },
    {
        // ab57, ab58 (BN-204, Opus: noted three times): "He now turns to the
        // whole church to encourage them to stand fast in the Lord" -- after
        // Euodias and Syntyche; 4:1 comes before them.
        story: /\bPhilippians 4\b|\bEuodias\b|\bSyntyche\b/i,
        topic: /\bstand fast\b/i,
        claim: /\b(?:now turns|turns (?:now )?to|then (?:turns|tells|urges|encourages|calls|asks)|goes on|moves on|next|afterwards?|after (?:this|that|these|them|the))\b[^.]{0,60}\bstand fast\b/i,
        text:
            'Philippians 4:1, "stand fast in the Lord, my dearly beloved", ' +
            'comes BEFORE 4:2\'s "I beseech Euodias, and beseech Syntyche" -- ' +
            'tell them in that order',
    },
    {
        // ab57 (BN-202, Opus: A 1): "Isaiah wrote these words to the people
        // of Israel who were in exile in Babylon, having been told that the
        // king's house would be carried away" -- 39:6 is days to come, and
        // 40:2 speaks to Jerusalem. "Facing exile" was let by.
        story: /\bIsaiah 40\b|\bwait upon the LORD\b/i,
        topic: /\bexile\b|\bcaptivity\b|\bBabylon\b/i,
        // BN-211 (ab62, both readers: A 1): named, the line came back as
        // "who had been carried away to Babylon" -- the same exile, past.
        claim: /\b(?:who were|were|was|living|lived|sitting|sat)\s+(?:now |already |still |then )?(?:in exile|in captivity)\b|\b(?:had been|have been|were|was|been)\s+(?:carried|taken|led|deported)\s+(?:away\s+)?(?:captive\s+)?(?:to|into)\s+(?:Babylon|exile|captivity)\b|\b(?:already|now)\s+in\s+Babylon\b/i,
        text:
            'Isaiah 39:6 foretells it as days to come, "Behold, the days ' +
            'come, that all that is in thine house ... shall be carried to ' +
            'Babylon", and 40:2 says "Speak ye comfortably to Jerusalem" -- ' +
            'say they were warned of exile, never that they were in it',
    },
    {
        // ab56 (BN-201, Opus: A 1): "different ways of moving: some "mount
        // up," some "run," and some "walk"" -- 40:31 promises all three to
        // the same people.
        story: /\bIsaiah 40\b|\bwait upon the LORD\b/i,
        topic: /\bmount(?:s|ing)? up\b|\brun\b|\bwalk\b/i,
        // BN-205 (ab59, Sonnet: A 1): "a gradual restoration: first mounting
        // up ... finally walking" -- three stages the verse does not give.
        claim: /\bsome (?:people |of us |believers |Christians )?["“]?(?:mount|run|walk|soar|fly)\w*\b[^.]{0,60}\b(?:some|others)\b|\b(?:gradual|stages?|sequence|progression|step by step|first)\b[^.]{0,60}\bmount\w*\b[^.]{0,80}\b(?:then|finally|lastly|last of all)\b[^.]{0,30}\bwalk\w*\b/i,
        text:
            'Isaiah 40:31 gives all three to the same people: "they that ' +
            'wait upon the LORD ... shall mount up with wings as eagles; ' +
            'they shall run, and not be weary; and they shall walk, and not ' +
            'faint" -- never some who mount up and others who walk, nor ' +
            'stages one after another',
    },
    {
        // ab62 (BN-212, Opus: an error): a funeral's Revelation 21 -- "the
        // "holy city" brings everyone home to God" -- 21:3, 7 promise it to
        // his people, "he that overcometh".
        story: /\bRevelation 21\b|\ball things new\b|\bholy city\b/i,
        topic: /\bhome\b|\beveryone\b|\beverybody\b/i,
        claim: /\b(?:brings?|bring|takes?|gathers?|welcomes?)\s+(?:everyone|everybody|all people|every person|all of humanity|the whole world)\b|\b(?:everyone|everybody|all people|every person)\b[^.]{0,20}\b(?:will be|is|are) (?:brought |taken |welcomed )?home\b/i,
        text:
            'Revelation 21:3, 7: "they shall be his people, and God himself ' +
            'shall be with them"; "He that overcometh shall inherit all ' +
            'things" -- the promise is to his people',
    },
    {
        // ab62 (BN-212, Opus: an error): the unforgiving servant -- the
        // king's "compassion" is "not a feeling of pity, but a decision" --
        // 18:33: "even as I had pity on thee".
        story: /\bMatthew 18\b|\bseventy times seven\b|\bunforgiving servant\b|\bten thousand talents\b/i,
        topic: /\bcompassion\b|\bpity\b/i,
        // Of the compassion: "not a feeling of sadness" of 18:34's wrath is
        // another line.
        claim: /\b(?:compassion|pity|mercy)\W{0,3}\s+(?:is|was)\s+not\s+(?:just |merely |only |simply )?(?:a )?(?:feeling|emotion|sentiment)\b|\bnot (?:just |merely |only |simply )?(?:a )?feeling of pity\b/i,
        text:
            'Matthew 18:27: "moved with compassion"; 18:33: "even as I had ' +
            'pity on thee" -- pity is the verse\'s own word for it',
    },
    {
        // ab62 (BN-211, Sonnet: A 1): Psalm 23:6's goodness and mercy "like
        // guards following us home" -- a picture the verse does not give.
        story: /\bPsalm 23\b|\bmy shepherd\b/i,
        topic: /\bgoodness and mercy\b/i,
        claim: /\bgoodness and mercy\b[^.]{0,30}\b(?:like|as)\s+(?:two\s+)?(?:guards?|bodyguards?|sheepdogs?|dogs?|soldiers?|escorts?)\b/i,
        text:
            'Psalm 23:6: "Surely goodness and mercy shall follow me all the ' +
            'days of my life" -- say what it says, with no picture it does ' +
            'not give',
    },
    {
        // ab61 (BN-210, Opus: an error): Philippians 4:12 quoted as being
        // content whether one has "plenty" -- not a word of the verse.
        story: /\bPhilippians 4\b|\bEuodias\b|\bthink on these things\b|\bcontent\b/i,
        topic: /\b4:12\b|\babound\b|\bsuffer need\b|\babased\b/i,
        isTopicBefore: true,
        claim: /["“]plenty["”]/i,
        text:
            'Philippians 4:12: "I know both how to be abased, and I know how ' +
            'to abound: every where and in all things I am instructed both ' +
            'to be full and to be hungry, both to abound and to suffer need" ' +
            '-- "plenty" is not a word of it',
    },
    {
        // ab61 (BN-210, Opus: A 1): "He tells the lawyer that the one who
        // "shewed mercy" is the true neighbor" -- 10:37's answer is the
        // lawyer's own; then Jesus says "Go, and do thou likewise".
        story: /\bSamaritan\b|\bLuke 10\b/i,
        topic: /\bshewed mercy\b|\bshowed mercy\b/i,
        claim: /\b(?:Jesus|He|he)\s+(?:tells?|told|says?|said|answers?|answered|shows?|showed)\s+(?:the lawyer|him)\b[^.]{0,40}\b(?:shewed|showed) mercy\b/,
        text:
            'Luke 10:37: the lawyer answers, "He that shewed mercy on him"; ' +
            'then said Jesus unto him, "Go, and do thou likewise" -- the ' +
            "answer is the lawyer's own",
    },
    {
        // ab66 (BN-219, Sonnet: an error): a children's Jonah -- Nineveh "had
        // been cruel to God's people", stock as "very mean to God's people"
        // -- the book names their wickedness and violence, never Israel.
        // "Enemies of God's people" is let be: Assyria carried Israel away
        // (2 Kings 17:6).
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\bNineveh\b|\bAssyria\b/i,
        isTopicBefore: true,
        claim: /\b(?:cruel|mean|unkind|nasty|harsh|wicked)\b[^.]{0,20}\bto (?:God(?:'s|’s)|his) people\b|\b(?:hurt|attacked|bullied|hurting|attacking)\b[^.]{0,20}\bGod(?:'s|’s) people\b/i,
        text:
            'Jonah 1:2: "their wickedness is come up before me", and 3:8 "the ' +
            'violence that is in their hands" -- the book names no deed to ' +
            'Israel; that Assyria later carried Israel away is 2 Kings 17:6',
    },
    {
        // ab66 (BN-219, Sonnet: an error): the rout of the Philistines cited
        // as 1 Samuel 17:54 -- 17:51-53 is the rout; 17:54 the head brought
        // to Jerusalem.
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\b17:54\b/,
        claim: /\b(?:defeat\w*|rout\w*|fled|flight|victory|pursu\w*|spoil\w*)\b[^.]{0,60}\b1 Samuel 17:54\b/i,
        text:
            '1 Samuel 17:51-53: the Philistines "fled", Israel "pursued" them ' +
            'and "spoiled their tents"; 17:54 is David bringing the head to ' +
            'Jerusalem and the armour to his tent',
    },
    {
        // ab65 (BN-218, Opus: an error): David's victory "brought peace to
        // all Israel" -- 17:52-53 is a rout and a spoiling, and the wars
        // with the Philistines went on (18:30).
        story: /\bGoliath\b|\b1 Samuel 17\b/i,
        topic: /\bpeace\b/i,
        claim: /\b(?:brought|brings|bring|won|gave|secured|meant)\b[^.]{0,30}\bpeace\b[^.]{0,20}\b(?:Israel|the land|the nation|his people)\b|\bpeace to (?:all )?Israel\b/i,
        text:
            '1 Samuel 17:52-53: Israel "pursued the Philistines ... and they ' +
            'spoiled their tents" -- a rout; "the princes of the Philistines ' +
            'went forth" again (18:30), and the passage names no peace',
    },
    {
        // ab65 (BN-218, Opus: an error): a children's Jonah -- ""the
        // presence of the LORD" means that God is everywhere" -- 1:3's
        // phrase is what Jonah fled; God everywhere is Psalm 139:7-10.
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\bpresence of the LORD\b/i,
        claim: /\bpresence of the LORD\W{0,3}\s+(?:means?|is|shows?|tells? us)\b[^.]{0,30}\beverywhere\b/i,
        text:
            'Jonah 1:3: "Jonah rose up to flee unto Tarshish from the ' +
            'presence of the LORD" -- from his service and the word sent to ' +
            'him; that God is everywhere is Psalm 139:7-10, never what this ' +
            'phrase means',
    },
    {
        // ab65 (BN-217, Sonnet: A 1, B 1): the Proverbs sermon's big idea,
        // "God knows the end from the beginning" -- Isaiah 46:10's words,
        // stock in that lesson since ab4x, carried as Proverbs 3:5-6's.
        story: /\bProverbs 3\b|\blean not unto thine own\b/i,
        topic: /\bend from the beginning\b/i,
        claim: /\bend from the beginning\b/i,
        except: /\bIsaiah 46\b/i,
        text:
            'Isaiah 46:10 says "Declaring the end from the beginning"; ' +
            'Proverbs 3:5-6 gives its own: "Trust in the LORD with all thine ' +
            'heart ... and he shall direct thy paths" -- build on its words',
    },
    {
        // ab64 (BN-216, Opus: A 1): a funeral's Christ section, "Jesus
        // himself died and rose again, defeating the "second death"
        // [Revelation 20:14]" -- 20:14 says what the second death is.
        story: /\bRevelation 2[01]\b|\ball things new\b|\bholy city\b/i,
        topic: /\bsecond death\b/i,
        claim: /\b(?:defeat\w*|conquer\w*|destroy\w*|overc[ao]me|abolish\w*|end\w*)\b[^.]{0,20}\bsecond death\b/i,
        text:
            'Revelation 20:14: "death and hell were cast into the lake of ' +
            'fire. This is the second death"; 21:8 the same, and 2:11 "He ' +
            'that overcometh shall not be hurt of the second death" -- say ' +
            'what the verses say of it',
    },
    {
        // ab64 (BN-215, Sonnet: an error): the Sower's Christ section,
        // "Jesus is the only truly good ground" -- and ab63's "the only
        // truly perfect Seed": the ground is a hearer (13:23), the seed the
        // word (13:19); in the parables of the chapter Christ is the one who
        // sows (13:37).
        story: /\bsower\b|\bMatthew 13\b|\bgood ground\b/i,
        topic: /\bground\b|\bsoil\b|\bseed\b/i,
        claim: /\b(?:Jesus|Christ|He)\s+(?:is|was|became)\s+(?:the\s+)?(?:only\s+|one\s+)?(?:truly\s+|perfectly\s+|perfect\s+|true\s+)*["“]?(?:good\s+ground|good\s+soil|soil|ground|Seed)\b|\bonly one\b[^.]{0,30}\b(?:perfectly\s+)?["“]?(?:good\s+ground|good\s+soil)\b/,
        text:
            'Matthew 13:19, 23: the seed is "the word of the kingdom" and ' +
            'the good ground "he that heareth the word, and understandeth ' +
            'it" -- a hearer; "He that soweth the good seed is the Son of ' +
            'man" (13:37)',
    },
    {
        // ab60 (BN-209, Sonnet: an error): the Sower's Christ section, "He is
        // the only one who perfectly fulfilled the "hundredfold" fruit" --
        // 13:23's hundredfold is the good ground's yield.
        story: /\bsower\b|\bMatthew 13\b|\bgood ground\b/i,
        topic: /\bhundredfold\b/i,
        claim: /\b(?:Jesus|Christ|He|Him)\b[^.]{0,40}\b(?:fulfilled|perfectly|bore|bears|produced|yielded|is)\b[^.]{0,40}\bhundredfold\b/,
        text:
            'Matthew 13:23: the hundredfold is the good ground\'s yield, "he ' +
            'that heareth the word, and understandeth it; which also beareth ' +
            'fruit" -- never said of Christ',
    },
    {
        // ab60 (BN-209, Sonnet: an error): the lawyer as "a man of high
        // status and religious knowledge" -- 10:25 gives "a certain lawyer".
        story: /\bSamaritan\b|\bLuke 10\b/i,
        topic: /\blawyer\b|\bstatus\b/i,
        isTopicBefore: true,
        claim: /\b(?:high|great|important|wealthy|powerful) (?:status|rank|standing|position)\b|\b(?:man|expert) of (?:high |great )?(?:status|rank|standing)\b/i,
        text:
            'Luke 10:25: "a certain lawyer stood up, and tempted him" -- the ' +
            'passage gives his calling and his question, never his rank',
    },
    {
        // ab60 (BN-209, both readers: an error, then A 1): the prodigal's
        // father, "His love was greater than his anger" -- 15:20 gives him
        // none; the one angry is the elder son (15:28).
        story: /\bprodigal\b|\bfar country\b|\bcame to himself\b|\bLuke 15\b/i,
        topic: /\banger\b|\bangry\b/i,
        claim: /\b(?:love|compassion|mercy|joy)\b[^.]{0,30}\b(?:greater|stronger|bigger) than\b[^.]{0,20}\b(?:his |the )?(?:anger|wrath)\b|\bfather(?:'s|’s)? (?:anger|wrath)\b|\bfather (?:was|felt|must have been|might have been) (?:angry|furious)\b/i,
        except: /\belder (?:son|brother)\b|\b15:28\b/i,
        text:
            'Luke 15:20 gives the father no anger -- "his father saw him, and ' +
            'had compassion, and ran" -- the one "angry" is the elder son ' +
            '(15:28)',
    },
    {
        // ab60 (BN-209, Opus: A 1): "Jesus Christ, who died to remove the
        // 'former things' of our sin" -- 21:4's former things are death,
        // sorrow, crying and pain.
        story: /\bRevelation 21\b|\ball things new\b/i,
        topic: /\bformer things\b/i,
        // Sin alone: "of sin and death" names one thing 21:4 lists, and no
        // reader marked it.
        claim: /\bformer things\W{0,3}\s+(?:of|is|are|means?)\s+(?:our |the )?(?:sins?|guilt|wrongs?|evil)\b(?!\s+and death)/i,
        text:
            'Revelation 21:4: "there shall be no more death, neither sorrow, ' +
            'nor crying, neither shall there be any more pain: for the former ' +
            'things are passed away" -- those are the former things',
    },
    {
        // ab60 (BN-209, Opus: A 1): Philippians 4:9 as "learned, and
        // received, and heard, and seen" in the faith -- the verse says "in
        // me".
        story: /\bPhilippians 4\b|\bEuodias\b|\bthink on these things\b/i,
        topic: /\bheard, and seen\b|\breceived, and heard\b/i,
        claim: /\bseen\W{0,3}\s+in (?:the faith|Christ|church|scripture|the word|God)\b/i,
        text:
            'Philippians 4:9: "Those things, which ye have both learned, and ' +
            'received, and heard, and seen in me, do" -- seen in Paul',
    },
    {
        // ab59 (BN-206, Opus: noted): "He spoke to great multitudes gathered
        // by the sea, some standing on the shore" -- 13:2 has them all there.
        story: /\bsower\b|\bMatthew 13\b|\bgood ground\b/i,
        topic: /\bshore\b/i,
        claim: /\bsome (?:of them )?(?:were )?(?:standing|stood|stand)\b[^.]{0,20}\bshore\b/i,
        text:
            'Matthew 13:2: "he went into a ship, and sat; and the whole ' +
            'multitude stood on the shore"',
    },
    {
        // ab59 (BN-206, Opus: A 1): Psalm 51 -- ""sacrifices of
        // righteousness" are not just animal offerings, but a heart that is
        // truly broken" -- 51:19's come with burnt offerings; the broken
        // spirit is 51:17's.
        story: /\bPsalm 51\b|\bclean heart\b|\bhyssop\b/i,
        topic: /\bsacrifices of righteousness\b/i,
        claim: /\b(?:not (?:just|only|merely)|rather than|instead of)\b[^.]{0,30}\b(?:animals?|offerings?|sacrifices?|burnt)\b[^.]{0,20}\bbut\b[^.]{0,20}\b(?:heart|spirit)\b|\bsacrifices of righteousness\W{0,3}\s+(?:are|is|means?)\s+(?:a |the )?(?:broken|contrite|humble)\w*\s+(?:heart|spirit)\b/i,
        text:
            'Psalm 51:19: "Then shalt thou be pleased with the sacrifices of ' +
            'righteousness, with burnt offering and whole burnt offering" -- ' +
            'offerings at the altar, pleasing once the heart is made right; ' +
            'the broken spirit is 51:17\'s "sacrifices of God"',
    },
    {
        // ab59 (BN-206, Opus: noted): "Jesus took the debt of our trespasses
        // upon himself so that the Father could be "moved with compassion""
        // -- 18:27's compassion comes first, and is why he forgave.
        story: /\bMatthew 18\b|\bseventy times seven\b|\bunforgiving servant\b|\bten thousand talents\b/i,
        topic: /\bmoved with compassion\b/i,
        claim: /\bso (?:that )?(?:the Father|God|he|the king|the lord)\b[^.]{0,30}\b(?:could|would|might|can)\s+(?:now\s+)?(?:be\s+)?["“]?moved with compassion\b/i,
        text:
            'Matthew 18:27: "the lord of that servant was moved with ' +
            'compassion, and loosed him, and forgave him the debt" -- the ' +
            'compassion comes first and is why he forgave; never say the ' +
            'cross made him compassionate',
    },
    {
        // ab59 (BN-205, Sonnet: A 1): the good ground's "harvest varies
        // according to the grace and circumstances of the person" -- 13:23
        // gives the yields and no reason for them.
        story: /\bsower\b|\bMatthew 13\b|\bgood ground\b/i,
        topic: /\bhundredfold\b|\bsixty\w*\b|\bthirty\w*\b|\bharvest\b|\byields?\b|\bfruit\b/i,
        claim: /\b(?:var(?:y|ies|ied)|differs?|different)\b[^.]{0,40}\b(?:according to|because of|depend\w* on|due to)\b[^.]{0,40}\b(?:grace|circumstances?|effort|faith|gifts?|abilit(?:y|ies)|obedience|maturity|commitment)\b/i,
        text:
            'Matthew 13:23 gives the yields, "some an hundredfold, some ' +
            'sixty, some thirty", and no reason for the difference -- say ' +
            'what it says',
    },
    {
        // ab35 (BN-162, Sonnet: an error): the Sower's Christ section,
        // "he allowed himself to be "scorched" by the tribulations of the
        // cross".
        story: /\bsower\b|\bMatthew 13\b|\bstony places\b/i,
        topic: /\bscorched\b/i,
        claim: /\b(?:cross|crucified|Calvary|Golgotha|Saviou?r)\b|\b(?:allowed|let) himself\b|\b(?:Jesus|Christ) (?:was|is) (?:himself )?["“]?scorched\b/i,
        text:
            'Matthew 13:6: "when the sun was up, they were scorched; and ' +
            'because they had no root, they withered away" -- the seed on ' +
            'stony places, the hearer who "dureth for a while: for when ' +
            'tribulation or persecution ariseth because of the word, by and ' +
            'by he is offended" (13:21); never Christ or his cross',
    },
    {
        // ab43 (BN-176, Opus: A 1 twice): "A Levite was a man ... who served
        // in the tabernacle" in the Good Samaritan -- in Jesus' day, the
        // temple.
        story: /\bSamaritan\b|\bLuke 10\b/i,
        topic: /\bLevites?\b|\bpriests?\b/i,
        claim: /\btabernacle\b/i,
        // ...and the Levites as Numbers gives them (BN-214, shape66: "given
        // to the priests to serve the tabernacle [Numbers 3:6-10]" -- true,
        // where "the temple" with Numbers 3 had been marked).
        except: /\b(?:Moses|wilderness|once|first)\b|\bNumbers (?:1|3|4|8|18):/i,
        text:
            "Luke 10:31-32: in Jesus' day a priest and a Levite served at " +
            'the temple in Jerusalem, the road going "down from Jerusalem to ' +
            'Jericho" (10:30); the tabernacle was the tent of Moses\' day',
    },
    {
        // ab34 (BN-159, Sonnet: an error; Opus in ab32 and ab33): "The
        // lawyer ... was speaking to Jesus in front of a crowd", "to a crowd
        // that included both his peers and the disciples" -- Luke names none.
        // BN-172 (ab41, Sonnet: an error): "He is a legal expert of the
        // Jewish law, speaking to Jesus in front of a crowd" -- the lawyer
        // named in the sentence before, so the claim is the speaking.
        story: /\bSamaritan\b|\bLuke 10\b/i,
        topic: /\blawyer\b|\b(?:legal|law) expert\b|\bexpert (?:in|of|on) the (?:Jewish )?law\b/i,
        isTopicBefore: true,
        claim: /\b(?:in front of|before|among|to|with|addressing) (?:a |the |his )?(?:large |watching )?(?:crowds?|peers|audience|onlookers)\b|\b(?:crowds?|peers|audience|onlookers)\b[^.]{0,30}\b(?:watch|watched|watching|listen|listened|listening|heard|looked on)\b/i,
        text:
            'Luke 10:23-25: Jesus "turned him unto his disciples, and said ' +
            'privately", and then "a certain lawyer stood up, and tempted ' +
            'him" -- Luke names no crowd and no peers of his',
    },
    {
        // ab33 (BN-158, both readers: an error): a Psalm 51 sermon's Christ
        // section, "Jesus tells the Pharisees that 'blessed are the poor in
        // spirit'" -- he taught them to his disciples on the mount.
        story: /\bpoor in spirit\b|\bBeatitudes\b|\bMatthew 5\b/i,
        topic: /\b(?:poor in spirit|blessed are|Beatitudes|Sermon on the Mount)\b/i,
        // Said TO them: "Later the Pharisees murmured" is another telling.
        claim: /\b(?:tells?|told|says?|said|teaches|taught|speaks|spoke|preached|preaches)\b[^.]{0,20}\b(?:Pharisees?|scribes|religious leaders|lawyers?)\b/i,
        text:
            'Matthew 5:1-2: "seeing the multitudes, he went up into a ' +
            'mountain: and when he was set, his disciples came unto him: And ' +
            'he opened his mouth, and taught them" -- the Beatitudes are ' +
            'taught to his disciples, never said to the Pharisees',
    },
    {
        // ab62 (BN-212, Opus: an error): a children's Jonah -- "he came out
        // to tell people about God's mercy" -- he preached overthrow (3:4)
        // and was angry at the mercy (4:1-2).
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\bfish\b|\bwhale\b|\bcame out\b/i,
        // "To save" and "a message of" are BN-156's.
        except: /\bto save\b|\bmessage of\b/i,
        claim: /\bcame out\b[^.]{0,30}\bto (?:tell|preach|share|bring|teach|show)\b[^.]{0,30}\b(?:God(?:'s|’s)? |his )?(?:mercy|love|forgiveness|grace|salvation|kindness)\b/i,
        text:
            'Jonah 3:4: "Yet forty days, and Nineveh shall be overthrown" -- ' +
            'his message; the mercy was God\'s, and "it displeased Jonah ' +
            'exceedingly" (4:1)',
    },
    {
        // ab31 (BN-156, Opus: loose in both children's Jonahs): "Jonah came
        // out of the fish to save Nineveh" -- he was sent to cry against it.
        story: /\bJonah\b|\bJonas\b/i,
        topic: /\b(?:Nineveh|the city|its people)\b/i,
        // BN-202 (ab57, Opus: A 1): "Just as Jonah came out of the fish to
        // bring a message of salvation to Nineveh".
        claim: /\b(?:came|went|sent|go|goes|going)\b[^.]{0,50}\bto save\b|\b(?:bring|brought|carry|carried|preach|preached|take|took|give|gave|share|shared|deliver|delivered)\b[^.]{0,20}\b(?:message|news|word)s? of (?:salvation|hope|mercy|forgiveness|grace|love)\b/i,
        text:
            'Jonah 1:2, 3:2-4: God sent Jonah to "cry against" Nineveh with ' +
            '"the preaching that I bid thee" -- "Yet forty days, and Nineveh ' +
            'shall be overthrown"; God spared the city when it turned (3:10), ' +
            'and "it displeased Jonah exceedingly" (4:1)',
    },
];

// The most said under one change: the rest are found by the next.
const MAX_LESSON_LEGENDS = 4;

export type LessonLegendFoundType = { sentence: string; text: string };

/**
 * The sentences of a lesson's words that tell a sermon's detail no verse
 * gives, each with what the verses say: the story and the claim in the
 * same sentence.
 */
export function findLessonLegends(text: string): LessonLegendFoundType[] {
    const found: LessonLegendFoundType[] = [];
    // A legend told again further on (BN-252, batch MH: named in the big
    // idea alone, "the only true evidence" was put right there and stayed,
    // in other words, two sentences on): every sentence it fits is named,
    // each legend's first before any second, within the cap.
    const moreList: LessonLegendFoundType[] = [];
    const sentenceList = String(text ?? '')
        .split(/(?<=[.!?])\s+|\n+/)
        .map((sentence) => {
            return sentence.trim();
        })
        .filter((sentence) => {
            return sentence !== '';
        });
    for (const legend of LESSON_LEGEND_LIST) {
        if (!legend.story.test(String(text ?? ''))) {
            continue;
        }
        const matchedList = sentenceList.filter((one, index) => {
            const isAbout =
                legend.topic.test(one) ||
                (legend.isTopicBefore === true &&
                    index > 0 &&
                    legend.topic.test(sentenceList[index - 1]));
            return (
                isAbout &&
                legend.claim.test(one) &&
                legend.except?.test(one) !== true
            );
        });
        if (matchedList.length > 0) {
            found.push({ sentence: matchedList[0], text: legend.text });
            for (const sentence of matchedList.slice(1)) {
                moreList.push({ sentence, text: legend.text });
            }
        }
        if (found.length >= MAX_LESSON_LEGENDS) {
            break;
        }
    }
    for (const more of moreList) {
        if (found.length >= MAX_LESSON_LEGENDS) {
            break;
        }
        if (!found.some((one) => one.sentence === more.sentence)) {
            found.push(more);
        }
    }
    return found;
}

/** What the model is told under the change, for one more edit. */
// A line's words for telling it again, its mark-up and spacing aside.
function toLegendLineKey(line: string) {
    return line
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .slice(0, 80);
}

/**
 * The named lines a note still holds after the edit that answered their
 * note (BN-191, ab52: shape53's Zacchaeus kept "his low standing in the
 * eyes of his community" though the edit after its note fixed two other
 * lines it named) -- read off the whole note, kept only where the line is
 * one the window named.
 */
export function findLessonLegendsLeft(
    noteText: string,
    saidLineList: readonly string[],
): LessonLegendFoundType[] {
    const keyList = saidLineList.map(toLegendLineKey).filter((key) => {
        return key.length >= 12;
    });
    return findLessonLegends(noteText).filter((found) => {
        const key = toLegendLineKey(found.sentence);
        return keyList.some((said) => {
            return said === key || said.startsWith(key) || key.startsWith(said);
        });
    });
}

/**
 * The legends a note holds that were NOT named before (BN-288, 2026-11-14,
 * batch PJ): the one more edit that put a named line right wrote another in
 * its place -- a baby Moses' story rewritten for "God changed her heart"
 * came back with "the princess's maid went and called the child's mother"
 * (Opus: an error) -- and only the lines named before were read again.
 */
export function findLessonLegendsNew(
    noteText: string,
    saidLineList: readonly string[],
): LessonLegendFoundType[] {
    const keyList = saidLineList.map(toLegendLineKey).filter((key) => {
        return key.length >= 12;
    });
    return findLessonLegends(noteText).filter((found) => {
        const key = toLegendLineKey(found.sentence);
        return !keyList.some((said) => {
            return said === key || said.startsWith(key) || key.startsWith(said);
        });
    });
}

export function genLessonLegendNote(
    found: readonly LessonLegendFoundType[],
    // The block each line is in now, where the window read the note
    // (BN-152: told only the words, a model counted its own lines).
    blockNumbers: readonly (number | null)[] = [],
    // Said again of a line the edit after its note left (BN-191).
    isLeft = false,
) {
    const said = found.map((item, index) => {
        const sentence =
            item.sentence.length > 160
                ? `${item.sentence.slice(0, 160)}…`
                : item.sentence;
        const block = blockNumbers[index] ?? null;
        return (
            (block === null ? '' : `block ${block}: `) +
            `"${sentence}" -- ${item.text}`
        );
    });
    const numberList = blockNumbers
        .slice(0, found.length)
        .filter((block, index, list) => {
            return block !== null && list.indexOf(block) === index;
        });
    const isEveryNumbered =
        blockNumbers.length >= found.length &&
        !blockNumbers.slice(0, found.length).includes(null);
    // The change spelt out, as `text` (BN-152: a model sent a new line as
    // `words`, the field a style picks words with, and was refused).
    const target = isEveryNumbered
        ? `that line with ONE more edit -- {block: ` +
          (numberList.length === 1 ? numberList[0] : '<each>') +
          ', text: <its words, that line saying what the verses say>}' +
          (numberList.length === 1
              ? ''
              : ` for each of blocks ${numberList.join(' and ')}`) +
          ' --'
        : 'that line with ONE more edit, saying what the verses say,';
    const lead = isLeft
        ? '(The change is made, but it left a line the window named, still ' +
          'telling what sermons say and the verses do not: '
        : '(The change is made, but a line tells what sermons say and the ' +
          'verses do not: ';
    return (
        `${lead}${said.join('; ')}. Change ONLY ${target} every ` +
        'other block as it is now -- then answer.)'
    );
}
