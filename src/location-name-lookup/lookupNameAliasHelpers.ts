/**
 * One person under several names: the names dataset keeps each KJV spelling
 * and each renaming as a record of its own -- Noe beside Noah, Elias beside
 * Elijah, Sem beside Shem, Abram beside Abraham -- and the main record never
 * points back at them.
 *
 * Found asking the assistant about Noah from the Reader's Names and Places
 * panel (2026-10-22, the user's ask: _make the chatbot to be super smart
 * that can answer everything about location/name_): _did Jesus speak about
 * Noah?_ and _where in the New Testament is Noah?_ came back without
 * Matthew 24:37 and Luke 17:26 -- the KJV says Noe there, and those verses
 * are Noe's record -- and Noah's children listed Sem and Shem as two sons.
 *
 * The pairs were read off the English dataset's titles and descriptions
 * (_Greek KJV form of [Noah]_, _earlier name of [Abraham]_, _Aramaic name
 * given to Simon [Peter]_) and checked one by one: a title of that shape is
 * not always the same person (_name of [Esau]'s wife_, _Babylonian name of
 * [Hananiah]'s companion_), so the list is hand-kept, never matched at run
 * time. The ids are the same in every language's dataset
 * (`lookupNameAliasHelpers.test.ts` holds both to them).
 *
 * A constant of fifty pairs; no dataset is read here.
 */

// The alias record -> the person it is, one line a pair, the names beside.
const LOOKUP_NAME_ALIAS_MAP: Readonly<Record<string, string>> = {
    '0535d63d-8b45-4844-8e9e-c6fba36543b7':
        '0e94a17b-69b1-4148-b7de-72eab8eea4cc', // Abishalom -> Absalom
    'bf42c58c-045a-4131-b8ee-55e7c707040a':
        '4ce14dfc-b652-45d9-ac05-5f0cf716c412', // Abram -> Abraham
    '5a34a5ac-3b59-49af-b1a0-937cd10c2c9d':
        '6c49dd1b-6675-4393-9df4-46e7ab71be60', // Achaz -> Ahaz
    'd19b9050-374b-49ce-a4ce-ec73f31f4d19':
        '75d73f06-2efd-4602-9f27-485b0b2e2697', // Adoram -> Adoniram
    'd5df2861-afe5-41f1-aea6-e36f3092fc37':
        'f90c700d-22eb-4853-88d7-7faca41ee81c', // Agar -> Hagar
    '05fdbed7-29bc-409e-8660-a2110a23fe54':
        '9145db30-27f6-4c46-a2ad-44ce9f259d1c', // Chalcol -> Calcol
    '3975b884-68d0-4703-9c52-fae986728040':
        'c0eeb116-6059-4226-8c37-986646d65006', // Coniah -> Jehoiachin
    'ea77fc3b-03ca-4b88-9bd1-8b719d4a389c':
        'c0eeb116-6059-4226-8c37-986646d65006', // Jeconiah -> Jehoiachin
    '450414d0-cc95-4d26-a605-1894a6c6fc9f':
        '4410806a-411c-4dab-9b1d-93a088d32646', // Dorcas -> Tabitha
    '2a2c5f25-f8bc-4637-9b0d-13a0c7e0d3b2':
        'de373743-d689-4ec5-a3c6-8e97633cf920', // Eliakim -> Jehoiakim
    '6e7984b5-c118-4260-abad-a8e0261858bd':
        'f8f9a290-0e18-4c0f-8f4c-bb8201e8c652', // Elias -> Elijah
    'f24e8345-4f9c-41a9-9a23-86a45d74e6c6':
        'a84e8a56-2f21-4c8a-a20e-49b7134ccdc1', // Emmor -> Hamor
    '1306c388-3c10-4696-8b6d-0f77b271215a':
        '6efb3ddf-1670-4b48-b526-fadabe55474b', // Esaias -> Isaiah
    'efa8c76a-4d8a-4b15-af7f-079ee3c25957':
        '2d9ff281-73b3-4bd8-b94b-b414b234bce7', // Hadarezer -> Hadadezer
    '0d780568-1e39-47d7-9b52-318744abbbc2':
        '2cfd860b-05a0-47d9-9bb8-a6b469859807', // Hadassah -> Esther
    '5f1d1e20-d3f3-400c-85c5-a32d0fc074b8':
        '9fc80c9f-1d80-4cb3-ae53-c8b85f6b7afa', // Imla -> Imlah
    'c4bc81be-360c-4a23-a0b1-8c7bf7b9f02f':
        'c639ae62-acde-4142-a3f5-fd40204fc455', // Jerubbaal -> Gideon
    '395541b8-aac7-4430-a4a2-7c69e443bbac':
        'c639ae62-acde-4142-a3f5-fd40204fc455', // Jerubbesheth -> Gideon
    '22847c43-59a0-4fc7-930b-571b1720df96':
        'ca68bc73-d617-4010-8c81-4cfff8cc650c', // Jonas -> Jonah
    'a79ee25f-ccb7-4266-9bf5-e6d94945d305':
        'd7acbacc-97b5-4d75-9691-080a7cb4c93d', // Jucal -> Jehucal
    '0bcc99dc-fde6-4935-a61d-2dd4c028c1bb':
        'eaedd0f7-7aae-4264-a6e1-3d669f027700', // Kenan -> Cainan
    'f16621a9-bc35-4b5e-8e4d-80fe3a1012a6':
        'd0a77455-6948-4b88-8dd2-2db282f60931', // Lucas -> Luke
    'ad9a7ccf-c6a2-47e4-878b-7d7db13be21d':
        '65a059a5-80ee-48f4-aa15-098e66f9c959', // Maleleel -> Mahalaleel
    'd264e3e7-3a9f-4587-b471-8a90feec7520':
        '015b0331-f138-4c70-a4b9-686b0d19264d', // Naashon -> Nahshon
    'f224da67-2ff5-4eb7-bdb2-4349c0fe4408':
        '015b0331-f138-4c70-a4b9-686b0d19264d', // Naasson -> Nahshon
    '909854ad-75f5-47da-a210-0df93ddb1884':
        'efee19ca-1c94-40af-84ce-f452da778047', // Noe -> Noah
    'dbb98afb-3b84-4917-ad94-d5494671f910':
        'a912e52b-0f61-4f6c-8cb7-d582c3824923', // Perez -> Pharez
    'ccfe19ae-2864-4810-8dec-4d13c4b6e0a3':
        '09272592-f410-4a1d-ba42-3b1de3875a46', // Phalec -> Peleg
    '4713974a-599c-4bec-9f25-4db8652e5c74':
        '9576e976-2198-482d-8431-cfdff949b7c7', // Phallu -> Pallu
    'b4400a97-b514-4006-8a2d-15dd95905535':
        '04b4f116-90d5-4c60-8375-9f5f7ed4d456', // Phaltiel -> Phalti
    'b83bd670-3e12-49a9-93cc-639e4eb65889':
        '45893123-2ccf-4106-8b99-547f4d46910a', // Prisca -> Priscilla
    'caa3e19f-6a06-41af-92a2-0a7c38ac3e3b':
        '1c4724a4-d581-4865-86d4-2119b78c2c37', // Rachab -> Rahab
    '0dfed0d3-bd44-43d1-8e81-5861ed3da972':
        '98263eba-5c81-4610-a47f-e8d1d8e314c6', // Ragau -> Reu
    'db301900-56a7-4ca1-83a2-9f470b0db2cc':
        '7b80e5eb-7532-4d81-8fce-ff05a90ca5c3', // Salathiel -> Shealtiel
    'bd183ac4-5bbb-4679-be00-858bbe15653f':
        '3b881f0a-320a-4065-ba4e-aae92ee71d34', // Sarai -> Sarah
    '0fef4e5e-66c6-4890-8ae6-800426615b1a':
        '31a8dd99-3045-49f1-b974-b5437e70b3be', // Saruch -> Serug
    'ec62956f-b4dc-44ce-b56e-d75b6f25ea31':
        '5599b7b7-bcae-4cde-abd8-70c657daa39b', // Sem -> Shem
    'd97fa7a7-712a-4cbe-aac8-fc16db2a68c4':
        'da1b5f49-c491-48ba-87d9-12925e27b78a', // Shephi -> Shepho
    'fcc40291-5b08-43cf-aa55-9193d677fc5c':
        '46f00a24-cd01-4046-8e65-5e9144e66f50', // Timotheus -> Timothy
    '9d35afb6-5f80-4907-a09d-2e7ac08f4fa3':
        'd87369b1-5738-43c6-84cf-ebaf3a8ad81b', // Zephi -> Zepho
    '247b365e-0ddf-480b-be68-938ad76cadec':
        '0d7601da-e748-429c-96ec-359cc4dd88ba', // Zorobabel -> Zerubbabel
    'a9bb0ba3-5297-4b66-8d1e-32694b8b2258':
        '2bcada1c-b00a-4214-8a2d-5a7b991f6641', // Cephas -> Peter
    'cd6d7c95-6dcb-4f1e-b0f2-1be11d3d4a6e':
        'f5a4422f-ceeb-4400-a563-ea126def1223', // Saul (the apostle's Hebrew name) -> Paul
    'b36478ee-127f-471d-973a-4ef504663228':
        '23ed64d8-8458-49af-9b51-f578ab3262d9', // Israel -> Jacob
    'f90f3e57-766b-4472-95f5-66509e1168af':
        '28e270de-d886-42b6-918b-665be906a816', // Jesus (Acts 7:45, Hebrews 4:8) -> Joshua son of Nun
    '0b8c6747-cf4e-4052-b445-47de1bf433a7':
        'a463bd46-3fbc-418b-9809-a0f157b942ea', // Ozias -> Uzziah
    '46ddfae9-298d-40d0-92fc-2d49806f9b4d':
        '442da2db-6f3f-4be9-8104-6597d9c70157', // Beeliada -> Eliada
    'a54d552b-294d-4576-83f2-7a1ad14d4a2a':
        'e10fc2d4-00a2-420e-b0d8-e8ad0f6d5910', // Kelita -> Kelaiah
};

/** The person a record is: the main record's id for an alias, else itself. */
export function toMainNameId(id: string) {
    return Object.hasOwn(LOOKUP_NAME_ALIAS_MAP, id)
        ? LOOKUP_NAME_ALIAS_MAP[id]
        : id;
}

/**
 * Every record of the person a record is -- the main one first, then its
 * other names in the list's order. A record with no other name is alone.
 */
export function listNameFormIds(id: string) {
    const mainId = toMainNameId(id);
    return [
        mainId,
        ...Object.keys(LOOKUP_NAME_ALIAS_MAP).filter((aliasId) => {
            return LOOKUP_NAME_ALIAS_MAP[aliasId] === mainId;
        }),
    ];
}

/** The pairs themselves, for the test that holds them to the datasets. */
export function getLookupNameAliasMap() {
    return LOOKUP_NAME_ALIAS_MAP;
}
