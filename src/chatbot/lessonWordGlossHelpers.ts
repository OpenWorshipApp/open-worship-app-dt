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
        // "The highest religious leaders in Israel", of Luke 10:31's "a
        // certain priest", in two blind reads (BN-106): it opens on ONE of
        // many. Not said of the chief priests or the high priest.
        pattern: /(?<!\b(?:chief|high) )\bpriests?\b/i,
        text:
            'priest: in Israel, ONE of the many sons of Aaron, who served in ' +
            'turn -- Zacharias "executed the priest\'s office before God in ' +
            'the order of his course" (Luke 1:8) -- and offered the ' +
            'sacrifices (Leviticus 1:5); one among them was "the high priest ' +
            'among his brethren" (Leviticus 21:10)',
    },
    {
        pattern: /\bsamaritans?\b/i,
        text:
            'Samaritan: people the Jews kept apart from -- "the Jews have no ' +
            'dealings with the Samaritans" (John 4:9)',
    },
    {
        pattern: /\bpharisees?\b/i,
        // BN-116: the entry was Paul's words alone, and a lesson made them
        // John's: Nicodemus "a member of the most straitest sect" (John
        // 3:1 says "a man of the Pharisees"). The meaning first, the words
        // in Paul's mouth.
        text:
            "Pharisee: of the strictest party of the Jews' religion -- Paul, " +
            'once one, called it "the most straitest sect of our religion" ' +
            '(Acts 26:5)',
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
            // Each use with its own verse (BN-216, ab64, Opus: A 1 -- copied,
            // "for cleansing, as seen in Exodus 12:22", the Passover door).
            'hyssop: a plant dipped to strike the Passover blood on the ' +
            'doorposts (Exodus 12:22), and to sprinkle blood or water for ' +
            'cleansing (Leviticus 14:4-7; Numbers 19:18)',
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
        // BN-242 (ab81, M-16, both readers: an error): "like an ox kicking
        // against the sharp spikes of a yoke" -- the pricks are the goad.
        pattern: /\bpricks\b/i,
        text:
            // BN-244 (ab82, both readers): a second verse here (Shamgar's
            // "ox goad", Judges 3:31) was cited for what it does not say --
            // "only to injure itself further [Judges 3:31]". One verse.
            'pricks: the goad, the pointed stick a driver prods an ox with, ' +
            'never part of the yoke -- "it is hard for thee to kick against ' +
            'the pricks" (Acts 9:5)',
    },
    // BN-241 (ab78..ab80, a reader each: A 1): KJV words given another
    // sense -- "charity" left as giving to the poor, "under the heaven" made
    // God's jurisdiction, faith as evidence God's word supplies, a soul
    // "humbled in me" as pride put away.
    {
        pattern: /\bcharity\b/i,
        text:
            'charity: love, given to God and to others -- never alms alone: ' +
            '"Charity suffereth long, and is kind" (1 Corinthians 13:4), ' +
            '"above all these things put on charity, which is the bond of ' +
            'perfectness" (Colossians 3:14)',
    },
    {
        pattern: /\bunder (?:the )?heaven\b/i,
        text:
            'under the heaven: in Ecclesiastes, in this world, as "under the ' +
            'sun" -- "all things that are done under heaven" (Ecclesiastes ' +
            '1:13); elsewhere the sky above the earth',
    },
    {
        pattern: /\bevidence\b/i,
        text:
            'evidence: in Hebrews 11:1 faith itself is the evidence -- "faith ' +
            'is the substance of things hoped for, the evidence of things not ' +
            'seen"; in Jeremiah 32:10 the deed of a purchase, "I subscribed ' +
            'the evidence, and sealed it"',
    },
    {
        pattern: /\bhumbled in me\b/i,
        text:
            'humbled (in me): bowed down in grief -- "My soul hath them still ' +
            'in remembrance, and is humbled in me" (Lamentations 3:20): a soul ' +
            'brought low by affliction, not pride put away',
    },
    {
        // BN-239 (ab79, J-10, both readers: an error): "A 'furlong' is a
        // distance of about 1,200 feet". No verse gives its length, so the
        // measure is said beside the verse that uses it.
        pattern: /\bfurlongs?\b/i,
        text:
            'furlong: a measure of distance, the Greek stadion, about 600 ' +
            'feet (185 metres), an eighth of a mile -- Bethany "was nigh ' +
            'unto Jerusalem, about fifteen furlongs off" (John 11:18), ' +
            'under two miles',
    },
    {
        // BN-151 (ab30, Opus: an error): "Goliath's armor was measured in
        // 'shekels' of brass and 'cubits' of length" -- told only "a measure
        // of length", the cubit was given to the armour the shekels weigh.
        pattern: /\bcubits?\b/i,
        text:
            'cubit: a measure of length and height, never of weight -- ' +
            'Goliath\'s HEIGHT "was six cubits and a span" (1 Samuel 17:4), ' +
            'the ark\'s length "three hundred cubits" (Genesis 6:15); "after ' +
            'the cubit of a man" (Deuteronomy 3:11)',
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
            // BN-115: set side by side, "created man" (1:27) "of the dust
            // of the ground" (2:7) was merged into "He created man from the
            // dust in Genesis 2:7", which says formed.
            "create: God's own work, and not only out of nothing -- " +
            '"God created man in his own image" (Genesis 1:27); of the dust ' +
            'he "formed man" (Genesis 2:7), a word of its own; and "I create ' +
            'Jerusalem a rejoicing" (Isaiah 65:18)',
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
        // BN-123 (2026-11-11, the BN-116/117 read): "he had not proved
        // them, meaning he knew they didn't fit", with the entry above
        // beside it. Its own entry: in the one above, David's armour would
        // ride into every lesson that holds "prove".
        pattern: /\bI have not proved them\b/i,
        text:
            'I have not proved them (1 Samuel 17:39): David had not tried ' +
            'the armor out -- never that it did not fit or was too heavy; ' +
            'the passage says no more',
    },
    {
        // "The spiritual agony of a life lived without grace", three times.
        pattern: /\btormentors\b/i,
        text:
            'tormentors: those the angry lord delivered the servant to, "till ' +
            'he should pay all that was due unto him"; and Jesus says, "So ' +
            'likewise shall my heavenly Father do also unto you, if ye from ' +
            'your hearts forgive not" (Matthew 18:34-35) -- ' +
            // BN-123: "left to the consequences of a heart", "one's own
            // bitterness", with this entry beside it.
            "the lord's doing and the Father's, never only the torment of a " +
            // BN-158 (ab33, Opus): "lose the joy and peace of the mercy".
            'bitter heart, never softened into a loss of joy or peace; and ' +
            'the one delivered is the servant who would not forgive, never ' +
            'a picture of Christ or his cross',
    },
    {
        // BN-121 (2026-11-11, the BN-116/117 read): a Psalm 51 lesson
        // never said why David fears being cast away.
        pattern: /\btake not thy holy spirit from me\b/i,
        // BN-161 (ab33, ab35, both readers): the entry's "departed from
        // Saul ... what David begs God not to do to him" was told as the
        // psalm's own reason -- an inference it does not make.
        text:
            'take not thy holy spirit from me (Psalm 51:11): the Spirit of ' +
            'the LORD "came upon David" when Samuel anointed him (1 Samuel ' +
            '16:13); David asks God not to take it -- the psalm gives no ' +
            'other reason, and names no one else it was taken from',
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
        // "A term for wiping a debt off a record". BN-272 (ab99, both
        // readers: an error): with the noun's stain written right after
        // Isaiah 44:22, a lesson made it "as if a stain were removed from a
        // garment [Isaiah 44:22]" -- the verb and the noun kept apart.
        pattern: /\bblot(?:s|ted|teth)?\b/i,
        text:
            'blot out (the verb): to wipe away so it is no more -- sins ' +
            '"as a thick cloud" (Isaiah 44:22), a name "out of my book" ' +
            '(Exodus 32:33); the noun "blot" is a spot on the hands, "if any ' +
            'blot hath cleaved to mine hands" (Job 31:7) -- a sense apart, ' +
            "never Isaiah 44:22's picture, which is a cloud",
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
        // Opening on the sheep, it was read twice more as "the strict
        // penalty for stolen goods": it opens on what Zacchaeus did now.
        text:
            'fourfold: MORE than the law asked -- for goods taken falsely it ' +
            'asked them back "in the principal" and "the fifth part more" ' +
            '(Leviticus 6:5); four times over it asked only for a sheep ' +
            'stolen and killed or sold, "four sheep for a sheep" (Exodus 22:1)',
    },
    {
        // "Interlocking metal rings", in two lessons.
        pattern: /\bcoats? of mail\b/i,
        text:
            'coat of mail: body armour of overlapping metal scales -- ' +
            'Goliath\'s weighed "five thousand shekels of brass" (1 Samuel ' +
            '17:5)',
    },
    // BN-103: Jonah, read wrong in four blind reads running.
    {
        // Jonah 3:10's "God repented of the evil" was read as the PEOPLE
        // changing their hearts. In all eleven places the KJV says it, God
        // is the one who turns.
        pattern: /\brepent(?:ed|eth|est)?(?: (?:him|thee|me))? of the evil\b/i,
        text:
            'repented of the evil (said of God): God turned from the harm he ' +
            'had said he would bring -- "the LORD repented of the evil which ' +
            'he thought to do unto his people" (Exodus 32:14)',
    },
    {
        // Jonah "said he was sorry" in the fish, in three reads.
        pattern: /\bfish's belly\b/i,
        text:
            "Jonah's prayer from the fish's belly (2:2-9): a cry from the deep " +
            'and a thanksgiving -- "Salvation is of the LORD" (Jonah 2:9); it ' +
            'says no word of sorrow for running away',
    },
    {
        // BN-126 (2026-11-11, the BN-118..124 read): a children's Jonah
        // lesson again and again Good -- why Jonah ran given as the
        // lesson's guess, Nineveh "a city" with no setting, and chapter 4,
        // where the big idea lives, never reached. Jonah's own reason, in
        // his own words, is in 4:2.
        pattern: /\bflee unto Tarshish\b/i,
        text:
            'rose up to flee unto Tarshish (Jonah 1:3): the book gives his ' +
            'reason only at its end, in his own words -- "Therefore I fled ' +
            'before unto Tarshish: for I knew that thou art a gracious God, ' +
            'and merciful" (Jonah 4:2); never that he was afraid',
    },
    {
        // Jonah's own words for it (1:2, 3:2, 4:11): "the men of Nineveh"
        // of Matthew 12:41, read before the sower, is no Jonah lesson.
        pattern: /\bNineveh, that great city\b/i,
        text:
            'Nineveh: the city where the king of Assyria dwelt (2 Kings ' +
            '19:36) -- Assyria, which in time "carried Israel away" (2 Kings ' +
            '17:6) -- and the city God would spare: "should not I spare ' +
            'Nineveh, that great city" (Jonah 4:11)',
    },
    {
        // Tied to "John on his island exile" in two reads.
        pattern: /\bno more sea\b/i,
        text:
            'the sea, in "no more sea": the restless deep -- "the wicked are ' +
            'like the troubled sea, when it cannot rest" (Isaiah 57:20); the ' +
            'beast rose "up out of the sea" (Revelation 13:1)',
    },
    // BN-126 (2026-11-11, the BN-118..124 read, both readers): backgrounds
    // left out the one fact of Scripture that changes how the passage is
    // heard -- David already anointed, "my law" the father's, Isaiah 40's
    // people facing Babylon, the Philippians' gift behind "content". Each
    // is put beside the words that need it, by the passage's own phrase.
    {
        pattern: /\bthe armies of the living God\b/i,
        text:
            'the armies of the living God (1 Samuel 17:26): David stood ' +
            'there already anointed -- Samuel "anointed him in the midst of ' +
            'his brethren: and the Spirit of the LORD came upon David from ' +
            'that day forward" (16:13) -- while Saul and all Israel "were ' +
            'dismayed, and greatly afraid" (17:11)',
    },
    {
        pattern: /\bforget not my law\b/i,
        text:
            "my law (Proverbs 3:1): the father's own teaching to his son -- " +
            '"Hear, ye children, the instruction of a father" (Proverbs ' +
            "4:1); these verses never call it the LORD's law or the law of " +
            'Moses',
    },
    {
        pattern: /\bmy way is hid from the LORD\b/i,
        text:
            'My way is hid from the LORD (Isaiah 40:27): the cry of a people ' +
            'the chapter opens by comforting -- "Comfort ye, comfort ye my ' +
            'people" (40:1), "her warfare is accomplished" (40:2) -- a ' +
            'people whose king had been told all his house "shall be ' +
            'carried to Babylon" (39:6)',
    },
    {
        pattern: /\byour care of me hath flourished again\b/i,
        text:
            'your care of me hath flourished again (Philippians 4:10): the ' +
            'church had sent Paul a gift -- "having received of Epaphroditus ' +
            'the things which were sent from you" (4:18) -- and his ' +
            'contentment is said over that gift: "Not that I speak in ' +
            'respect of want" (4:11)',
    },
    {
        // BN-128 (2026-11-11, the BN-118..124 read, Opus: an error; and
        // again in the next run): "The passage answers: Because the gift
        // had to be of equal value to the life being saved", then "To
        // satisfy justice ... to take the place of the sinner" -- reasons
        // the verse never gives, under the line that answers FROM it.
        pattern: /\bthat he gave his only begotten Son\b/i,
        text:
            'that he gave his only begotten Son (John 3:16): the verse gives ' +
            'the reason as love, "For God so loved the world", and the end ' +
            'as life, "should not perish, but have everlasting life"; of how ' +
            'he is given it points back to "even so must the Son of man be ' +
            'lifted up" (3:14) -- never a reason these verses do not give: ' +
            // BN-131 (2026-11-11, the BN-125..129 runs): "Why was it
            // necessary for God to give his Son instead of just forgiving
            // us?" answered "the only way ... that satisfies justice", in
            // three runs running and both blind readers' accuracy 1.
            'why it had to be the Son, an "only way", justice satisfied or ' +
            'a payment of equal value are not in them, so a hearer asks ' +
            'here what they do answer',
    },
    {
        // BN-130 (2026-11-11, the BN-125..127 read, Opus: the one lesson of
        // sixteen held under Best): the Good Samaritan's gospel told as an
        // allegory of Jesus the Samaritan, its background "religious
        // leaders sought to trap him" -- the lawyer's own questions, which
        // the parable answers, never read.
        pattern: /\bwilling to justify himself\b/i,
        text:
            'willing to justify himself (Luke 10:29): the lawyer had asked ' +
            '"what shall I do to inherit eternal life?" (10:25) and been ' +
            'told "this do, and thou shalt live" (10:28) -- the law\'s own ' +
            'answer to one who asked to inherit by doing, never told as ' +
            // BN-158 (ab33, Opus): "eternal life is earned ... by doing".
            'eternal life earned by our doing; the parable ' +
            'answers his "who is my neighbour?" with "Go, and do thou ' +
            'likewise" (10:37) -- told as the answer to him, never an ' +
            'allegory of Christ',
    },
    // BN-106: Luke 15, read wrong in blind read after blind read.
    {
        // The father "ignores the request for servitude", in three reads:
        // the son never made it.
        pattern: /\bmake me as one of thy hired servants\b/i,
        text:
            // BN-126 (2026-11-11, the BN-118..124 read): the father "ran
            // while the son was still speaking his apology", "before the son
            // could finish his plea", on both sides of the read -- the
            // father's words cutting the plea short (15:22) told as his run.
            'make me as one of thy hired servants (Luke 15:19): what the son ' +
            'PLANNED to say, and at home he never said it. The father "ran, ' +
            'and fell on his neck, and kissed him" (15:20) before the son ' +
            'said a word; the son then began, and after "no more worthy to ' +
            'be called thy son" (15:21) the father spoke (15:22)',
    },
    {
        // BN-121 (2026-11-11, the BN-116/117 read): "give the robe, ring
        // and shoes some explanation of what they meant". One place of
        // Scripture only: two side by side are merged.
        pattern: /\bbring forth the best robe\b/i,
        text:
            "the best robe, a ring, shoes (Luke 15:22): the father's answer " +
            'to "no more worthy to be called thy son" (15:21), given before ' +
            'the son had done anything -- a ring on the hand and fine ' +
            'clothing are what Pharaoh put on Joseph when he set him over ' +
            'all the land (Genesis 41:41-42), so the ring and the robe say ' +
            'honour and trust given to him; of the shoes Luke says nothing ' +
            'more',
    },
    {
        // The shepherd "goes into the scary wilderness": Luke leaves the
        // ninety and nine in it. Matthew's shepherd goes "into the
        // mountains", which this does not match.
        pattern: /\bninety and nine in the wilderness\b/i,
        text:
            'the ninety and nine in the wilderness (Luke 15:4): the ' +
            "wilderness is the flock's pasture, where the ninety and nine " +
            'are LEFT -- "with whom hast thou left those few sheep in the ' +
            'wilderness?" (1 Samuel 17:28) -- and the shepherd goes "after ' +
            'that which is lost, until he find it"; ' +
            // BN-123: "because he knew they were safe".
            'Luke gives no reason he could leave them, never "because they ' +
            'were safe"',
    },
    {
        // BN-123 (2026-11-11, the BN-116/117 read): "'Restoreth my soul'
        // means to bring back a sheep that has cast itself on its back" --
        // a preacher's picture held to the verse. BN-270 (ab97, ab98, Opus:
        // an error): "'Restoreth my soul' means he leadeth in the paths of
        // righteousness" -- the clause glossed with the next one.
        pattern: /\brestoreth my soul\b/i,
        text:
            'restoreth my soul (Psalm 23:3): brings my life back, as the ' +
            'women told Naomi her grandson would be "a restorer of thy ' +
            'life" (Ruth 4:15) -- never a sheep cast on its back, a ' +
            "preacher's picture the psalm does not have; a clause of its " +
            'own, never explained by "he leadeth me in the paths of ' +
            'righteousness" after it',
    },
    {
        // "Choosing their ritual purity or safety over a dying man", and a
        // hearer asking why they did not stop: a reason Luke never gives.
        pattern: /\bpassed by on the other side\b/i,
        text:
            'passed by on the other side (Luke 10:31-32): the priest saw him, ' +
            'the Levite "came and looked on him", and each passed by; Luke ' +
            'gives no reason why, so a lesson gives none -- the parable turns ' +
            'on the one who "had compassion on him" (10:33)',
    },
    // BN-108: what the BN-106/107 read found.
    {
        // "Not a mathematical limit of 497": the count got wrong.
        pattern: /\bseventy times seven\b/i,
        text:
            'seventy times seven (Matthew 18:22): four hundred and ninety -- ' +
            'Jesus\' answer to Peter\'s "till seven times?" (18:21), forgiving ' +
            'past any count, as "if he trespass against thee seven times in ' +
            'a day, and seven times in a day turn again to thee, saying, I ' +
            'repent; thou shalt forgive him" (Luke 17:4)',
    },
    {
        // "Can a choked hearer still be a believer? Yes", in two reads: the
        // parable says only that the word bears no fruit.
        pattern: /\bchoke the word\b/i,
        text:
            'choke the word (Matthew 13:22; Mark 4:19): cares and riches ' +
            '"choke the word" and it bears no fruit; the parable calls that ' +
            'hearer one "that heareth the word", never a believer, and says ' +
            'no more -- whether he believes or is saved it does not say, so a ' +
            'lesson neither asks nor answers that',
    },
    // BN-109: Isaiah 40's Christ section, read wrong in three reads.
    {
        // "Jesus fainted under the weight of our sins on the cross", "the
        // ultimate faint one": the Gospels never say he fainted.
        pattern: /\bfainteth not\b/i,
        text:
            'fainteth not, neither is weary (Isaiah 40:28): said of "the ' +
            'everlasting God, the LORD"; it is the youths who "shall faint ' +
            'and be weary" (40:30) -- in the Gospels Jesus was "wearied with ' +
            'his journey" (John 4:6) and calls "all ye that labour and are ' +
            'heavy laden" (Matthew 11:28), but is never said to faint',
    },
    // BN-111: what the BN-106/107 read found (Opus).
    {
        // "Jesus told His friends about Jonah": it was his answer to the
        // scribes and Pharisees who asked him for a sign.
        pattern: /\b(?:belly of the fish|fish's belly)\b/i,
        text:
            "Jonah's three days in the fish, as Jesus told it: his answer to " +
            '"certain of the scribes and of the Pharisees" who asked him for ' +
            'a sign, never told to his friends or disciples -- "as Jonas ' +
            'was three days and three nights in the ' +
            "whale's belly; so shall the Son of man be three days and three " +
            'nights in the heart of the earth" (Matthew 12:38-40)',
    },
    {
        // "Refused to forgive a few pence": the text says an hundred.
        pattern: /\bowed him an hundred pence\b/i,
        text:
            "owed him an hundred pence (Matthew 18:28): a hundred days' pay " +
            '-- a debt that could be paid, and small only beside "ten ' +
            'thousand talents" (18:24); never "a few pence"',
    },
    // BN-115: what the BN-108..112 read found (Opus).
    {
        // "The only place his armour did not protect him": a sermon's gap
        // the text never gives.
        pattern: /\bsunk into his forehead\b/i,
        text:
            'the stone sunk into his forehead (1 Samuel 17:49): the text ' +
            'says no more, and gives no gap in his armour -- he wore "an ' +
            'helmet of brass upon his head" (17:5)',
    },
    {
        // A sower lesson's verses before (Matthew 12) told as "those who
        // were healed by Jonas".
        pattern: /\brepented at the preaching of Jonas\b/i,
        text:
            'repented at the preaching of Jonas (Matthew 12:41): the men of ' +
            'Nineveh turned when Jonah preached, and will condemn the ' +
            'generation that would not -- "a greater than Jonas is here"; ' +
            'no one was healed',
    },
    {
        // "Nicodemus came to Jesus by night to ask about His miracles".
        pattern: /\bcame to Jesus by night\b/i,
        text:
            'Nicodemus came to Jesus by night (John 3:2) owning the ' +
            'miracles, not asking about them: "Rabbi, we know that thou art ' +
            'a teacher come from God: for no man can do these miracles that ' +
            'thou doest, except God be with him"',
    },
    {
        // BN-138 (2026-11-11, the BN-130..132 read, Opus: an error): the
        // Good Samaritan's verses before (Luke 10) told as "Jesus had just
        // spoken to the people of Capernaum".
        pattern: /\bChorazin\b/i,
        text:
            'Chorazin, Bethsaida, Capernaum: the woe "Woe unto thee, ' +
            'Chorazin!" and "thou, Capernaum" is said OF these towns to ' +
            'those with Jesus -- the multitudes in Matthew 11:7-24, the ' +
            'seventy as he sends them out in Luke 10:1-16 -- never to the ' +
            "towns' people",
    },
    {
        // BN-267 (ab94, ab96, Opus: an error in NH): Jehovahjireh "is
        // translated as" "In the mount of the LORD it shall be seen" -- the
        // saying of 22:14, not what the name means.
        // Batch NI: shown the saying beside the name, the model copied
        // "the name Abraham gave the place" and gave it the saying as its
        // meaning again -- the meaning first, the saying left out.
        pattern: /\bJehovah-?jireh\b/i,
        text:
            'Jehovahjireh means "the LORD will provide" (or "will see") -- ' +
            'Abraham named the place for what he had told Isaac, "God will ' +
            'provide himself a lamb" (Genesis 22:8)',
    },
    {
        // BN-264 (ab90..ab94, Opus in three batches: Habakkuk 3's lesson
        // held at Good): "mine high places" read as the trials themselves,
        // the steep places God walks us through.
        pattern: /\bhigh places\b/i,
        text:
            'high places: two senses -- the hilltop altars of idols, which a ' +
            'good king "removed" (2 Kings 18:4); and, in a song of trust, ' +
            'the heights God sets his own on, sure-footed and safe above ' +
            'their enemies: "he will make me to walk upon mine high places" ' +
            '(Habakkuk 3:19), "setteth me upon my high places" (Psalm ' +
            '18:33), "thou shalt tread upon their high places" (Deuteronomy ' +
            '33:29) -- a place of safety and victory, never the trial itself',
    },
];

// The most entries one passage read carries: a long story holds many.
const MAX_LESSON_WORD_GLOSSES = 8;

// An entry keyed on words of one verse ("sunk into his forehead") says what
// THAT verse does not say -- the misreading a lesson on it makes -- where
// one keyed on a word explains the word wherever it stands. A lookaround's
// space is no phrase.
function checkIsVerseEntry(gloss: LessonWordGlossType) {
    return gloss.pattern.source.replace(/\(\?<?[=!][^)]*\)/g, '').includes(' ');
}

/**
 * The explanations a passage's text holds, in list order, eight at most --
 * the entries for one of its verses kept before its words' (BN-141,
 * 2026-11-11: 1 Samuel 17 holds eight of the words -- shekel, sling, cubit
 * ... -- and "the stone found the only gap in the giant's armour" was
 * written by a lesson whose read never carried "sunk into his forehead").
 */
export function findLessonWordGlosses(text: string) {
    const passageText = String(text ?? '');
    const foundList = LESSON_WORD_GLOSS_LIST.filter((gloss) => {
        return gloss.pattern.test(passageText);
    });
    const keptSet = new Set(
        [
            ...foundList.filter(checkIsVerseEntry),
            ...foundList.filter((gloss) => {
                return !checkIsVerseEntry(gloss);
            }),
        ].slice(0, MAX_LESSON_WORD_GLOSSES),
    );
    return foundList
        .filter((gloss) => {
            return keptSet.has(gloss);
        })
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
