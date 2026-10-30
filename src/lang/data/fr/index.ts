import { type LanguageDataType } from '../../langHelpers';

import bibleBooks from './bibleBooks.json';
import bibleKeyMap from './bibleKeyMap.json';
import bbCR from './bb-cr.gz.bundle';
import locationsMapUrl from './location-name-map-data/locationsMap.json?url';
import namesMapUrl from './location-name-map-data/namesMap.json?url';

const numList = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Same keys, same order and same sections as `../km/index.ts`, which
// `tranKeyCoverage.test.ts` holds this file to. Machine-translated
// (2026-09-21); a native speaker should review the phrasing.
const dictionary = {
    'Ask about what you are reading': 'Poser une question sur votre lecture',
    'Use Ask the Assistant About This Passage, Ask the Assistant About This Verse, or Ask the Assistant About This File to ask about that material.':
        'Utilisez Demander à l’assistant à propos de ce passage, Demander à l’assistant à propos de ce verset ou Demander à l’assistant à propos de ce fichier pour interroger ce contenu.',
    'For a missing Bible, choose Create the provided KJV, Let the assistant import a Bible for me, or Go to Bible Setting; you decide what to install.':
        'Pour une Bible absente, choisissez Créer la KJV fournie, Laisser l’assistant importer une Bible pour moi ou Aller aux paramètres de la Bible ; vous décidez quoi installer.',
    // Built-in song draft summaries and extraction notes.
    'Musical key': 'Tonalité',
    Tempo: 'Tempo',
    'Time signature': 'Mesure',
    'Song: {title}': 'Chant : {title}',
    'by {author}': 'de {author}',
    'key {key}': 'tonalité {key}',
    '{tempo} beats/min': '{tempo} battements/min',
    'Sections ({count}): {sections}': 'Parties ({count}) : {sections}',
    '{count} line': '{count} ligne',
    '{count} lines': '{count} lignes',
    'Play order: {order}': 'Ordre de lecture : {order}',
    'there was no title in the text, so it is "Untitled"':
        "le texte n'avait pas de titre ; il est donc nommé « Untitled »",
    'nobody was named as the author': "aucun auteur n'était indiqué",
    'the address the words came from is kept with the song, in its attachments, so whoever opens the file can see where they came from':
        "l'adresse source est conservée dans les pièces jointes du chant, pour que toute personne ouvrant le fichier puisse retrouver son origine",
    'the text had no section labels, so each block of lines was read as a verse':
        "le texte n'avait pas de noms de parties ; chaque bloc de lignes a donc été lu comme un couplet",
    'a block that came round again word for word was written once and played each time it appeared -- check that is really the chorus':
        "un bloc répété à l'identique a été écrit une seule fois et joué à chaque occurrence — vérifiez qu'il s'agit bien du refrain",
    'the sections could not be worked out, so every block was kept as free text with its own label above it -- the words are all there, and the section names may want setting by hand':
        "les parties n'ont pas pu être déterminées ; chaque bloc est conservé en texte libre avec son étiquette — tous les mots sont présents, mais les noms des parties peuvent nécessiter une saisie manuelle",
    'The text did not specify {fields}; add them if needed.':
        'Le texte ne précisait pas {fields} ; ajoutez-les si nécessaire.',
    'The supplied {fields} were not recognized and were left out; set them by hand.':
        "Les valeurs fournies pour {fields} n'ont pas été reconnues et ont été omises ; définissez-les manuellement.",
    '{count} heading lines above the first numbered verse were left out.':
        "{count} lignes d'en-tête au-dessus du premier couplet numéroté ont été omises.",
    '{count} lines in another language were kept as translations of the lines above them.':
        '{count} lignes dans une autre langue ont été conservées comme traductions des lignes qui les précèdent.',
    'The song was taken from "{first}" to "{last}" on the page.':
        'Le chant a été extrait de « {first} » à « {last} » sur la page.',
    '{count} lines of menus, chord charts and links were left out.':
        "{count} lignes de menus, de diagrammes d'accords et de liens ont été omises.",
    'If that includes too much or too little, say where the song starts and ends.':
        'Si cela inclut trop ou trop peu de texte, indiquez où le chant commence et se termine.',
    'Page buttons left out of the song: {words}':
        'Boutons de la page exclus du chant : {words}',
    'Credits left out of the sung words: {words}':
        'Crédits exclus des paroles chantées : {words}',
    '{parts} could not form separate sections and were kept as free text.':
        "{parts} n'ont pas pu former des parties séparées et ont été conservés en texte libre.",
    'Let the assistant import a Bible for me':
        'Laisser l’assistant importer une Bible pour moi',
    // Bible Find's 🤖, at the end of the All Books row.
    'Find a Verse with the Assistant': 'Trouver un verset avec l’assistant',
    'It finds Bibles in your language and asks you a few simple questions.':
        'Il trouve des Bibles dans votre langue et vous pose quelques questions simples.',
    'It will use the link you typed below.':
        'Il utilisera le lien saisi ci-dessous.',
    // --- The "Bible key … is not available!" card: the assistant imports
    // that Bible. `Install it` is a button of the help window, quoted as it
    // reads there -- in the app's language.
    'Or let the assistant import this Bible for you:':
        'Ou laissez l’assistant importer cette Bible pour vous :',
    'Press the button below. The assistant opens and looks for this Bible in a free collection online.':
        'Appuyez sur le bouton ci-dessous. L’assistant s’ouvre et cherche cette Bible dans une collection gratuite en ligne.',
    'Press the Bible you want in its list, or type its language when it asks.':
        'Appuyez sur la Bible voulue dans sa liste, ou saisissez sa langue quand il la demande.',
    'Keep the short name it suggests, answer its other questions, then press Install it. The Bible shows here by itself.':
        'Gardez le nom court qu’il propose, répondez à ses autres questions, puis appuyez sur « Installer ». La Bible s’affiche ici d’elle-même.',
    'Let the assistant import this Bible for me':
        'Laisser l’assistant importer cette Bible pour moi',
    'Or let the assistant import a Bible in your language for you:':
        'Ou l’assistant peut importer une Bible dans votre langue pour vous :',
    'Press the button below. The assistant opens and looks for a Bible in your language in a free collection online.':
        'Appuyez sur le bouton ci-dessous. L’assistant s’ouvre et cherche une Bible dans votre langue dans une collection gratuite en ligne.',
    'Keep the short name it suggests, answer its other questions, then press Install it. Then choose it in the list above; this card goes away.':
        'Gardez le nom court qu’il propose, répondez à ses autres questions, puis appuyez sur « Installer ». Choisissez-la ensuite dans la liste ci-dessus ; cette carte disparaît.',
    'Could not check installed Bible keys':
        'Impossible de vérifier les clés bibliques installées',
    'Saving...': 'Enregistrement...',
    'Find more editions': 'Trouver d’autres éditions',
    'Review Bible import': 'Vérifier l’importation de la Bible',
    'Review the language and mappings before importing. The file name is only a language hint.':
        'Vérifiez la langue et les correspondances avant l’importation. Le nom du fichier est seulement un indice de langue.',
    'Choose a valid locale': 'Choisissez une langue valide',
    'Number mapping': 'Correspondance des chiffres',
    Recommended: 'Recommandé',
    'Book name mapping': 'Correspondance des noms de livres',
    'Keep existing book names': 'Conserver les noms de livres existants',
    'Searching online for Bible book names...':
        'Recherche de noms de livres bibliques en ligne...',
    'Some online sources are unavailable. You can keep the existing names or try another locale.':
        'Certaines sources en ligne sont indisponibles. Vous pouvez conserver les noms existants ou essayer une autre langue.',
    'Preview book names': 'Aperçu des noms de livres',
    'Built-in names': 'Noms intégrés',
    'Search for more book name lists':
        'Rechercher d’autres listes de noms de livres',
    'Invalid Bible key': 'Clé biblique invalide',
    'Screen Mirror': 'Écran miroir',
    'Connection code is incorrect': 'Le code de connexion est incorrect',
    'Disconnected by host': 'Déconnecté par l’hôte',
    'Incompatible or duplicate connection':
        'Connexion incompatible ou en double',
    'Screen Mirror Connection': 'Connexion écran miroir',
    'Full screen': 'Plein écran',
    'Exit full screen': 'Quitter le plein écran',
    'Catching up': 'Rattrapage',
    'behind live': 'de retard sur le direct',
    'Cast to a TV': 'Diffuser sur une TV',
    Cast: 'Diffuser',
    Casting: 'Diffusion en cours',
    'Search again': 'Chercher à nouveau',
    'Looking for TVs…': 'Recherche des TV…',
    'No TV found. Make sure the TV is on and on the same network as this computer.':
        'Aucune TV trouvée. Vérifiez que la TV est allumée et sur le même réseau que cet ordinateur.',
    'Turn on “Let other devices watch” to cast to a TV.':
        'Activez « Laisser d’autres appareils regarder » pour diffuser sur une TV.',
    'That TV was not found. Search again.':
        'Cette TV est introuvable. Cherchez à nouveau.',
    'The TV could not be reached.': 'La TV est injoignable.',
    'The TV could not play this display.':
        'La TV n’a pas pu lire cet affichage.',
    'The TV did not answer.': 'La TV n’a pas répondu.',
    'The TV stopped playing.': 'La TV a arrêté la lecture.',
    'No TV was found that can play this display. It must be on and on the same network.':
        'Aucune TV pouvant lire cet affichage n’a été trouvée. Elle doit être allumée et sur le même réseau.',
    'Turn off sound': 'Couper le son',
    'Voice volume': 'Volume de la voix',
    'Turn on sound': 'Activer le son',
    'Waiting for the display': 'En attente de l’affichage',
    'Watch in a browser': 'Regarder dans un navigateur',
    'Where to watch': 'Où regarder',
    'More addresses': 'Autres adresses',
    'Cast from this browser': 'Diffuser depuis ce navigateur',
    'For a TV on the same network as this device.':
        'Pour une télévision sur le même réseau que cet appareil.',
    'This browser found no TV. It must be on and on the same network as this device.':
        'Ce navigateur n’a trouvé aucune télévision. Elle doit être allumée et sur le même réseau que cet appareil.',
    'This browser cannot cast. Try Chrome, Edge or Safari.':
        'Ce navigateur ne peut pas diffuser. Essayez Chrome, Edge ou Safari.',
    'TVs on the app’s network': 'Télévisions sur le réseau de l’application',
    'Several screens show on this display, stacked: the one shown last is on top.':
        'Plusieurs écrans s’affichent sur cet écran virtuel, empilés : le dernier affiché est au-dessus.',
    'Allow interaction': 'Autoriser l’interaction',
    'Allow again': 'Autoriser à nouveau',
    'This device was disconnected. Ask whoever runs the display to let it back in.':
        'Cet appareil a été déconnecté. Demandez à la personne qui gère l’écran de l’autoriser à nouveau.',
    'Lets this viewer scroll and pick verses in the app':
        'Permet à ce spectateur de faire défiler et de choisir des versets dans l’application',
    'Video for media players (MP4)': 'Vidéo pour lecteurs multimédias (MP4)',
    Browser: 'Navigateur',
    'This computer cannot encode AAC audio, so the video has no sound.':
        'Cet ordinateur ne peut pas encoder l’audio AAC, la vidéo n’a donc pas de son.',
    'Virtual Screens Manager': 'Gestionnaire d’écrans virtuels',
    'Virtual Displays': 'Affichages virtuels',
    'Virtual Display': 'Affichage virtuel',
    Virtual: 'Virtuel',
    'Add Virtual Display': 'Ajouter un affichage virtuel',
    'Manage Virtual Displays': 'Gérer les affichages virtuels',
    'Delete Virtual Display': 'Supprimer l’affichage virtuel',
    'Too many virtual displays': 'Trop d’affichages virtuels',
    'Virtual display not found': 'Affichage virtuel introuvable',
    'Let other devices watch': 'Laisser d’autres appareils regarder',
    'Turn this on to watch virtual displays from phones, TVs and other computers on this network.':
        'Activez cette option pour regarder les affichages virtuels depuis des téléphones, des téléviseurs et d’autres ordinateurs de ce réseau.',
    'Use HTTPS': 'Utiliser HTTPS',
    'Browsers on other devices open the display by an https address, so a phone can keep its screen on and share its microphone and camera. This computer signs its own certificate, so each browser warns once: continue past the warning (Advanced, then Proceed). Media players keep the http address.':
        'Les navigateurs des autres appareils ouvrent l’affichage par une adresse https : un téléphone peut alors garder son écran allumé et partager son micro et sa caméra. Cet ordinateur signe son propre certificat, donc chaque navigateur avertit une fois : passez outre l’avertissement (Paramètres avancés, puis Continuer). Les lecteurs multimédias gardent l’adresse http.',
    'Unable to turn on HTTPS': 'Impossible d’activer HTTPS',
    'Anyone who has a stream address can watch it, and the stream is not encrypted. Turn this off when you are done.':
        'Toute personne qui a une adresse de diffusion peut la regarder, et la diffusion n’est pas chiffrée. Désactivez cette option quand vous avez terminé.',
    'A virtual display is a screen that exists only in this app. Show screens on it like on a real monitor, and watch it from any device as a video.':
        'Un affichage virtuel est un écran qui n’existe que dans cette application. Affichez-y des écrans comme sur un vrai moniteur, et regardez-le depuis n’importe quel appareil sous forme de vidéo.',
    Stopped: 'Arrêté',
    'Starting…': 'Démarrage…',
    Idle: 'Inactif',
    Resolution: 'Résolution',
    Custom: 'Personnalisé',
    'Changing the resolution restarts the stream for everyone watching.':
        'Changer la résolution redémarre la diffusion pour tous ceux qui regardent.',
    Wallpaper: 'Fond d’écran',
    'None (black)': 'Aucun (noir)',
    'This app (preview)': 'Cette application (aperçu)',
    'Watching now': 'Spectateurs actuels',
    'No one is watching': 'Personne ne regarde',
    'Screens showing on this virtual display will be hidden, and everyone watching it will be disconnected.':
        'Les écrans affichés sur cet affichage virtuel seront masqués, et toutes les personnes qui le regardent seront déconnectées.',
    'Screens on this display': 'Écrans sur cet affichage',
    'This computer cannot make MP4 video':
        'Cet ordinateur ne peut pas créer de vidéo MP4',
    'The virtual display stopped': 'L’affichage virtuel s’est arrêté',
    'The virtual display stopped recording':
        'L’affichage virtuel a cessé l’enregistrement',
    'Its virtual display is not available. Choose another display for this screen.':
        'Son affichage virtuel n’est pas disponible. Choisissez un autre affichage pour cet écran.',
    'The firewall is stopping other devices from reaching this app.':
        'Le pare-feu empêche les autres appareils d’atteindre cette application.',
    'This network is set as Public, and the firewall lets this app in only on private networks.':
        'Ce réseau est défini comme public, et le pare-feu n’autorise cette application que sur les réseaux privés.',
    'Set this network to Private, or allow this app on public networks in the firewall.':
        'Définissez ce réseau comme privé, ou autorisez cette application sur les réseaux publics dans le pare-feu.',
    'Click Open firewall settings.':
        'Cliquez sur Ouvrir les paramètres du pare-feu.',
    'Click Change settings.': 'Cliquez sur Modifier les paramètres.',
    'Find this app in the list and tick Private. Tick Public too if this network is public.':
        'Trouvez cette application dans la liste et cochez Privé. Cochez aussi Public si ce réseau est public.',
    'Click OK, then Check again.':
        'Cliquez sur OK, puis sur Vérifier à nouveau.',
    'Click Options.': 'Cliquez sur Options.',
    'Find this app and set it to allow incoming connections, and turn off blocking all incoming connections.':
        'Trouvez cette application et autorisez les connexions entrantes, puis désactivez le blocage de toutes les connexions entrantes.',
    'If another device cannot connect, allow this port in the firewall:':
        'Si un autre appareil ne peut pas se connecter, autorisez ce port dans le pare-feu :',
    'Another security program on this computer may need to allow this app too.':
        'Un autre programme de sécurité sur cet ordinateur doit peut-être aussi autoriser cette application.',
    'Open firewall settings': 'Ouvrir les paramètres du pare-feu',
    'Open network settings': 'Ouvrir les paramètres réseau',
    'Check again': 'Vérifier à nouveau',
    'Screen mirror server is unavailable':
        'Le serveur écran miroir est indisponible',
    'Connect to host': 'Se connecter à l’hôte',
    Rescan: 'Rechercher à nouveau',
    'Host address': 'Adresse de l’hôte',
    Port: 'Port',
    'Port (optional)': 'Port (facultatif)',
    'Connection code': 'Code de connexion',
    Connect: 'Connecter',
    Disconnect: 'Déconnecter',
    'Connection status': 'État de connexion',
    Connected: 'Connecté',
    Disconnected: 'Déconnecté',
    Connecting: 'Connexion en cours',
    'Waiting for host approval': 'En attente de l’autorisation de l’hôte',
    'Connection failed': 'Échec de connexion',
    'Connected guests': 'Invités connectés',
    'No connected guests': 'Aucun invité connecté',
    'Connection request': 'Demande de connexion',
    'Allow connection': 'Autoriser la connexion',
    'Reject connection': 'Refuser la connexion',
    'Host addresses': 'Adresses de l’hôte',
    'Guest access': 'Accès des invités',
    'Approve each connection': 'Autoriser chaque connexion',
    'Require connection code': 'Exiger un code de connexion',
    'Code is set': 'Code défini',
    'Set connection code': 'Définir le code de connexion',
    'Custom port (next launch)': 'Port personnalisé (prochain démarrage)',
    'Save port': 'Enregistrer le port',
    'Let other computers connect':
        'Autoriser d’autres ordinateurs à se connecter',
    'Turn this on to use other computers on this network as extra screens.':
        'Activez ceci pour utiliser d’autres ordinateurs de ce réseau comme écrans supplémentaires.',
    Host: 'Hôte',
    'This computer': 'Cet ordinateur',
    'Choose a host below': 'Choisissez un hôte ci-dessous',
    'On the host, click Allow connection.':
        'Sur l’hôte, cliquez sur « Autoriser la connexion ».',
    'The host can now show its screens on these monitors.':
        'L’hôte peut maintenant afficher ses écrans sur ces moniteurs.',
    'Hosts on this network': 'Hôtes sur ce réseau',
    'Looking for hosts…': 'Recherche des hôtes…',
    'No host found. Open the app on the host and check that both computers are on the same network.':
        'Aucun hôte trouvé. Ouvrez l’application sur l’hôte et vérifiez que les deux ordinateurs sont sur le même réseau.',
    'Connect by address': 'Se connecter par adresse',
    'Leave empty unless the host uses a code.':
        'Laissez vide sauf si l’hôte utilise un code.',
    'Open to the internet': 'Ouvrir à Internet',
    'Anyone who has the address can ask to connect, and the connection is not encrypted. Use a connection code, and turn this off when you are done.':
        'Toute personne qui a l’adresse peut demander à se connecter, et la connexion n’est pas chiffrée. Utilisez un code de connexion et désactivez ceci quand vous avez terminé.',
    Internet: 'Internet',
    'This network': 'Ce réseau',
    Router: 'Routeur',
    'Public address': 'Adresse publique',
    'Public IP': 'IP publique',
    'Public port': 'Port public',
    'The router would not open the chosen port, so it opened another one.':
        'Le routeur n’a pas voulu ouvrir le port choisi : il en a ouvert un autre.',
    Tunnel: 'Tunnel',
    'Share through a Cloudflare tunnel': 'Partager via un tunnel Cloudflare',
    'For when the internet cannot reach this computer, such as behind a VPN or a router that forwards no port. Guests and viewers come in through Cloudflare by an https address that changes each time the tunnel starts.':
        'Pour quand Internet ne peut pas joindre cet ordinateur, par exemple derrière un VPN ou un routeur qui ne redirige aucun port. Invités et spectateurs passent par Cloudflare, à une adresse https qui change à chaque démarrage du tunnel.',
    'Starting the tunnel…': 'Démarrage du tunnel…',
    'The tunnel is up.': 'Le tunnel est actif.',
    'The tunnel stopped. It starts again by itself.':
        'Le tunnel s’est arrêté. Il redémarre tout seul.',
    'The tunnel comes with the Extra Binaries. Install or update them in Settings, and it starts by itself.':
        'Le tunnel est fourni avec les binaires supplémentaires. Installez-les ou mettez-les à jour dans les paramètres : il démarre alors tout seul.',
    'The tunnel is not working.': 'Le tunnel ne fonctionne pas.',
    'Send my microphone': 'Envoyer mon micro',
    'Stop sending my microphone': 'Arrêter d’envoyer mon micro',
    'Play their microphone': 'Écouter leur micro',
    'Their microphone is on': 'Leur micro est ouvert',
    'Speaker volume': 'Volume du haut-parleur',
    'Share my cameras': 'Partager mes caméras',
    'Stop sharing my cameras': 'Arrêter de partager mes caméras',
    Share: 'Partager',
    'Front camera': 'Caméra avant',
    'Back camera': 'Caméra arrière',
    'Microphone access denied': 'Accès au micro refusé',
    'The microphone could not be opened. Allow it for this page, or close another app using it.':
        'Le micro n’a pas pu être ouvert. Autorisez-le pour cette page, ou fermez l’autre application qui l’utilise.',
    'The camera could not be opened. Allow it for this page, or close another app using it.':
        'La caméra n’a pas pu être ouverte. Autorisez-la pour cette page, ou fermez l’autre application qui l’utilise.',
    'Waiting for approval': 'En attente d’autorisation',
    'Waiting for the code': 'En attente du code',
    'Nothing is showing on this display yet.':
        'Rien n’est encore affiché sur cet écran.',
    'Set a connection code: until then no one can come in with a code.':
        'Définissez un code de connexion : d’ici là, personne ne peut entrer avec un code.',
    'QR code': 'Code QR',
    'Copy address': 'Copier l’adresse',
    'Asking the router to open the port…':
        'Demande au routeur d’ouvrir le port…',
    'The router opened the port.': 'Le routeur a ouvert le port.',
    'This router is behind another network, so the internet cannot reach it. A VPN such as Tailscale works instead.':
        'Ce routeur est derrière un autre réseau, Internet ne peut donc pas l’atteindre. Un VPN comme Tailscale fonctionne à la place.',
    'No router answered.': 'Aucun routeur n’a répondu.',
    'The router refused to open the port.':
        'Le routeur a refusé d’ouvrir le port.',
    'Forward the port on the router to this computer, then type the public address below.':
        'Redirigez le port du routeur vers cet ordinateur, puis saisissez l’adresse publique ci-dessous.',
    'Ask the router again': 'Redemander au routeur',
    'An IPv6 address works only if the router lets incoming connections through.':
        'Une adresse IPv6 ne fonctionne que si le routeur laisse passer les connexions entrantes.',
    'Public address (optional)': 'Adresse publique (facultatif)',
    'Save address': 'Enregistrer l’adresse',
    'Connected from the internet': 'Connecté depuis Internet',
    'Connected from this network': 'Connecté depuis ce réseau',
    'Invalid host or port': 'Hôte ou port invalide',
    'Too many hosts': 'Trop d’hôtes',
    'Too many wrong codes. Try again later.':
        'Trop de codes erronés. Réessayez plus tard.',
    'Too many connection requests. Try again later.':
        'Trop de demandes de connexion. Réessayez plus tard.',
    'No host address found in this image.':
        'Aucune adresse d’hôte trouvée dans cette image.',
    'Choose a picture of a QR code, or paste one here.':
        'Choisissez une image de code QR, ou collez-en une ici.',
    'Read QR code': 'Lire un code QR',
    'Paste address': 'Coller l’adresse',
    'Fill in a copied address, link or QR code picture.':
        'Remplir avec une adresse, un lien ou une image de code QR copiés.',
    'No host address found in the clipboard.':
        'Aucune adresse d’hôte trouvée dans le presse-papiers.',
    'Copy image': 'Copier l’image',
    'The QR code image has been copied to the clipboard':
        'L’image du code QR a été copiée dans le presse-papiers',
    'The QR code image could not be copied':
        'L’image du code QR n’a pas pu être copiée',
    'HTML-in-Canvas': 'HTML-in-Canvas',
    'PDF.js': 'PDF.js',
    'Interactive text': 'Texte interactif',
    'Mozilla viewer': 'Visionneuse Mozilla',
    'Messy text': 'Texte varié',
    'Hover for a title; click or right-click a text range to call the app.':
        'Survolez pour voir le titre ; cliquez ou faites un clic droit sur une plage de texte pour appeler l’application.',
    'Extracted PDF text': 'Texte extrait du PDF',
    'Text range source': 'Source des plages de texte',
    'Hover over text for its title; click a Bible reference for a verse.':
        'Survolez le texte pour afficher son titre ; cliquez sur une référence biblique pour voir le verset.',
    'Choose PDF': 'Choisir un PDF',
    'Selected text': 'Texte sélectionné',
    'No matching Bible verse found':
        'Aucun verset biblique correspondant trouvé',
    // Presenter-only practice lessons.
    'Type a complete reference in Bible Lookup':
        'Saisir une référence complète dans la recherche biblique',
    'Enter a book, chapter and verse range together, then check the preview.':
        'Saisissez le livre, le chapitre et les versets ensemble, puis vérifiez l’aperçu.',
    'Keep Bible Lookup open between passages':
        'Garder la recherche biblique ouverte entre les passages',
    'Use Keep Open when preparing several Bible passages in a row.':
        'Utilisez Garder ouvert pour préparer plusieurs passages bibliques à la suite.',
    'Reuse a passage from lookup history':
        'Réutiliser un passage de l’historique de recherche',
    'Bring back an earlier reference from the history above Bible Lookup.':
        'Retrouvez une référence précédente dans l’historique au-dessus de la recherche biblique.',
    'Explore study tools in Bible Lookup':
        'Découvrir les outils d’étude de la recherche biblique',
    'Find words, cross references and local Resources without leaving the Presenter.':
        'Recherchez des mots, des références croisées et des ressources locales depuis le Présentateur.',
    'Find media by its file name': 'Rechercher un média par son nom de fichier',
    'Use the Background name filter to narrow a busy media folder.':
        'Utilisez le filtre par nom d’Arrière-plan pour réduire la liste des médias.',
    'Sort a media folder before the service':
        'Trier un dossier de médias avant le culte',
    'Open Background Sort to choose the order of media files.':
        'Ouvrez Trier dans Arrière-plan pour choisir l’ordre des fichiers multimédias.',
    'Check which media folder is open':
        'Vérifier quel dossier de médias est ouvert',
    'Reveal the Background path editor when an expected file is missing.':
        'Affichez l’éditeur de chemin d’Arrière-plan si un fichier attendu est introuvable.',
    'Find a service flow by name':
        'Rechercher un déroulement de culte par son nom',
    'Filter the Presenting Flow List to find the right service order.':
        'Filtrez la liste des déroulements pour retrouver le bon ordre du culte.',
    'Organize the list of service flows':
        'Organiser la liste des déroulements de culte',
    'Use Presenting Flow List Sort without rearranging the cues inside a flow.':
        'Triez la liste des déroulements sans modifier l’ordre des étapes d’un déroulement.',
    'Prepare several audience messages':
        'Préparer plusieurs messages pour le public',
    'Use Messages for separate notices with their own Show and Hide controls.':
        'Utilisez Messages pour des annonces séparées avec leurs propres commandes Afficher et Masquer.',
    'Rotate notices before the service':
        'Faire défiler les annonces avant le culte',
    'Use Messages Rotate and its seconds setting for a repeating notice board.':
        'Utilisez la rotation des Messages et sa durée en secondes pour répéter les annonces.',
    'Give audience messages room to breathe':
        'Aérer les messages destinés au public',
    'Use Messages Properties and Effects for padding, line height and text contrast.':
        'Utilisez Propriétés et Effets des Messages pour les marges, l’interligne et le contraste.',
    'Find border and shadow effects for an overlay':
        'Trouver les effets de bordure et d’ombre d’une superposition',
    'Open Quick Text, then explore the Effects section inside Properties.':
        'Ouvrez Texte rapide, puis découvrez la section Effets dans Propriétés.',
    'Prepare an image overlay slide show':
        'Préparer un diaporama d’images en superposition',
    'Find Image Show slide show controls and timing options before starting playback.':
        'Repérez les commandes et la durée du diaporama dans Affichage d’images avant de le lancer.',
    'Background > Videos': 'Background > Vidéos',
    'Background > Images': 'Background > Images',
    'Background > Filter by name': 'Background > Filtrer par nom',
    'Background > Sort': 'Background > Trier',
    'Background > Show path editor': 'Background > Show path editor',
    'Presenting Flow List > Sort': 'Presenting Flow List > Trier',
    'Presenting Flow List > Filter by name':
        'Presenting Flow List > Filtrer par nom',
    'Messages > Properties': 'Messages > Propriétés',
    'Quick Text > Properties': 'Quick Text > Propriétés',
    'Image Show > Properties': 'Image Show > Propriétés',
    'Applies to each app page on the next launch.':
        'S’applique à chaque page de l’application au prochain lancement.',
    'Explore General settings': 'Explorer les paramètres généraux',
    'Choose your data folder': 'Choisir votre dossier de données',
    'Path Settings holds your data folder, where your songs, Bibles and settings are kept: choose it under Parent Directory, and copy it to a drive with Copy Data Folder.':
        'Les Paramètres des chemins contiennent votre dossier de données, où sont gardés vos chants, vos Bibles et vos réglages : choisissez-le sous Dossier parent, et copiez-le sur un disque avec Copier le dossier de données.',
    'Manage Bible versions': 'Gérer les versions bibliques',
    'Find AI and extra tools': 'Trouver l’IA et les outils supplémentaires',
    'Bible Note': 'Note biblique',
    'Web Editor': 'Éditeur de page web',
    'Lyric Editor': 'Éditeur de paroles',
    'Local Web Share': 'Partage web local',
    'Explore folders, language, appearance, and automatic tips in General settings.':
        'Découvrez les dossiers, la langue, l’apparence et les astuces automatiques dans les paramètres généraux.',
    'Open Bible settings to manage the installed Bible versions.':
        'Ouvrez les paramètres bibliques pour gérer les versions de la Bible installées.',
    'Find AI features and extra binaries in Others settings.':
        'Retrouvez les fonctions d’IA et les programmes supplémentaires dans les autres paramètres.',
    'Select a slide, then select an item on its canvas to edit it.':
        'Sélectionnez une diapositive, puis un élément sur sa zone de travail pour le modifier.',
    'Review your slide edits before saving. Use Undo to reverse an edit.':
        'Vérifiez vos modifications avant d’enregistrer. Utilisez Annuler pour revenir sur une modification.',
    'Edit your note here, then use Save to keep your changes.':
        'Modifiez votre note ici, puis utilisez Enregistrer pour conserver vos modifications.',
    'Edit the web page beside its preview and review it before saving.':
        'Modifiez la page web à côté de son aperçu et vérifiez-la avant d’enregistrer.',
    'Edit the song sections and check their preview before saving.':
        'Modifiez les sections du chant et vérifiez leur aperçu avant d’enregistrer.',
    'Start the server when you are ready to share, then use its address or QR code on the same network.':
        'Démarrez le serveur lorsque vous êtes prêt à partager, puis utilisez son adresse ou son code QR sur le même réseau.',
    // Reader demo titles and practical tips.
    'Find and replay Reader demos':
        'Trouver et rejouer les démonstrations du Lecteur',
    'Use Help > All tips, search a task, then choose Show it to practise one step at a time.':
        'Dans Aide > Tous les conseils, recherchez une tâche, puis choisissez Montrer pour pratiquer étape par étape.',
    'Copy only the passage reference':
        'Copier uniquement la référence du passage',
    'Use Copy Title when you need a reference for an outline without the verse text.':
        'Utilisez Copier le titre pour insérer une référence dans un plan sans le texte des versets.',
    'Copy only the Bible words': 'Copier uniquement les mots de la Bible',
    'Use Copy Text to paste the passage into your study notes without its title.':
        'Utilisez Copier le texte pour coller le passage dans vos notes sans son titre.',
    'Copy the reference and Bible words':
        'Copier la référence et le texte biblique',
    'Use Copy All to keep the passage reference with the text you paste.':
        'Utilisez Copier tout pour garder la référence avec le texte collé.',
    'Copy a verse key for study files':
        'Copier une clé de verset pour les fichiers d’étude',
    'Use Copy Verse Full Key for a stable book, chapter and verse identifier.':
        'Utilisez Copier la clé complète du verset pour obtenir un identifiant du livre, du chapitre et du verset.',
    'Copy a chapter key for Resources':
        'Copier une clé de chapitre pour les ressources',
    'Use Copy Chapter Full Key as the starting point for a chapter resource filename.':
        'Utilisez Copier la clé complète du chapitre pour commencer le nom d’un fichier de ressource du chapitre.',
    'Read the installed Bible information':
        'Lire les informations de la Bible installée',
    'Clear the reference, then open Bible Information to check the translation and publisher.':
        'Effacez la référence, puis ouvrez Informations bibliques pour vérifier la traduction et l’éditeur.',
    'Adjust or stop automatic scrolling':
        'Régler ou arrêter le défilement automatique',
    'Double-click the bottom chevron to speed up, right-click to slow down, or Alt+right-click to stop.':
        'Double-cliquez sur le chevron du bas pour accélérer, faites un clic droit pour ralentir ou Alt+clic droit pour arrêter.',
    'Remove an extra Bible version':
        'Retirer une version biblique supplémentaire',
    'Use the remove icon beside an extra version when you want one translation again.':
        'Utilisez l’icône de retrait à côté d’une version supplémentaire pour revenir à une seule traduction.',
    'Keep reading panes scrolling together':
        'Faire défiler les volets de lecture ensemble',
    'Give passages the same Color Note to scroll them together; Sync group scrolling turns that on or off.':
        'Donnez la même Note de couleur aux passages pour les faire défiler ensemble ; Défilement synchronisé du groupe l’active ou le coupe.',
    'Split directly into another translation':
        'Diviser directement vers une autre traduction',
    'Use Split Horizontal to or Split Vertical to from a passage menu, then choose a Bible.':
        'Dans le menu du passage, utilisez Diviser horizontalement vers ou Diviser verticalement vers, puis choisissez une Bible.',
    'Move between split passages with the keyboard':
        'Passer d’un passage divisé à l’autre au clavier',
    'Press Ctrl+Shift with an arrow key to work in the passage on that side.':
        'Appuyez sur Ctrl+Maj avec une flèche pour travailler dans le passage de ce côté.',
    'Move between split passages in Bible Lookup':
        'Passer d’un passage divisé à l’autre dans la recherche biblique',
    'Split a passage, then press Ctrl+Shift with an arrow key to work in the passage on that side.':
        'Divisez un passage, puis appuyez sur Ctrl+Maj avec une flèche pour travailler dans le passage de ce côté.',
    'Choose the Bible formatting model':
        'Choisir le modèle de mise en forme biblique',
    'Use Change Bible Model Info in the footer; choosing a different model reloads the Reader.':
        'Utilisez Changer le modèle biblique dans le pied de page ; un autre modèle recharge le Lecteur.',
    'Find the Reader saved-passage folder':
        'Trouver le dossier des passages enregistrés du Lecteur',
    'Use Show path editor in Bibles to see the folder; Choose a folder picks another, and right-click the path to Copy to Clipboard.':
        'Utilisez Show path editor dans Bibles pour voir le dossier ; Choisir un dossier en prend un autre, et un clic droit sur le chemin permet Copier dans le presse-papiers.',
    'Create a saved Bible list': 'Créer une liste de passages bibliques',
    'Open Bibles > More Options > New File to keep passages for a study in their own list.':
        'Ouvrez Bibles > Plus d’options > Nouveau fichier pour regrouper les passages d’une étude.',
    'Reopen a saved passage in the Reader':
        'Rouvrir un passage enregistré dans le Lecteur',
    'Expand a Bibles list, then double-click a passage or use Lookup in its menu; hold Shift to open it beside the current one.':
        'Dépliez une liste de Bibles, puis double-cliquez sur un passage ou utilisez Recherche dans son menu ; maintenez Maj pour l’ouvrir à côté.',
    'Arrange saved Bible passages':
        'Organiser les passages bibliques enregistrés',
    'Use a passage row menu for Duplicate, Move To, Move up, Move down or Delete, and its color circle to group it.':
        'Utilisez le menu d’une ligne de passage pour Dupliquer, Déplacer vers, Monter, Descendre ou Supprimer, et son cercle de couleur pour le grouper.',
    'Import or export a Bible list': 'Importer ou exporter une liste biblique',
    'Export from a list file menu; Import or Import From URL from the Bibles panel menu.':
        'Exportez depuis le menu du fichier ; utilisez Importer ou Importer depuis une URL dans le menu Bibles.',
    'Manage saved Bible list files': 'Gérer les fichiers de listes bibliques',
    'Right-click a list file for Rename, Duplicate, Empty, Copy Path to Clipboard, Reveal in File Explorer or Move to Trash.':
        "Clic droit sur un fichier de liste pour Renommer, Dupliquer, Vide, Copier le chemin dans le presse-papiers, Afficher dans l'Explorateur de fichiers ou Mettre à la corbeille.",
    'Find the Bible Notes folder': 'Trouver le dossier des notes bibliques',
    'Use Show path editor in Bible Notes to locate your note library; Choose a folder picks another one.':
        'Utilisez Show path editor dans Notes bibliques pour trouver votre bibliothèque de notes ; Choisir un dossier en choisit une autre.',
    'Create a Bible Notes file': 'Créer un fichier de notes bibliques',
    'Use Bible Notes > More Options > New File to group notes for a topic or study.':
        'Utilisez Notes bibliques > Plus d’options > Nouveau fichier pour regrouper les notes d’un sujet ou d’une étude.',
    'Add a note to the right file': 'Ajouter une note au bon fichier',
    'Expand your chosen Bible Notes file, press its New Note Item plus button, then double-click a note to open it.':
        'Dépliez le fichier de Notes bibliques choisi, appuyez sur son bouton plus Nouvel élément de note, puis double-cliquez sur une note pour l’ouvrir.',
    'Arrange and move Bible note items':
        'Organiser et déplacer les notes bibliques',
    'Use a note row menu for Edit Title, Duplicate, Move To, Move up or Move down; Discard Change drops unsaved edits.':
        'Utilisez le menu d’une note pour Modifier le titre, Dupliquer, Déplacer vers, Monter ou Descendre ; Abandonner les modifications annule les changements non enregistrés.',
    'Import and export Bible notes': 'Importer et exporter des notes bibliques',
    'Import note files from the panel menu, import an item into a file, or Export the file or item you need.':
        'Importez des fichiers depuis le menu du panneau, un élément dans un fichier, ou exportez le fichier ou l’élément voulu.',
    'Manage Bible Notes files': 'Gérer les fichiers de notes bibliques',
    'Use a note file menu for Rename, Duplicate, Copy All Items, Move All Items To, Reveal in File Explorer or Move to Trash.':
        "Utilisez le menu d'un fichier de notes pour Renommer, Dupliquer, Copier tous les éléments, Déplacer tous les éléments vers, Afficher dans l'Explorateur de fichiers ou Mettre à la corbeille.",
    'Search for words selected in a verse':
        'Rechercher les mots sélectionnés dans un verset',
    'Select Bible words, right-click them, then choose Search in Bible Search.':
        'Sélectionnez des mots bibliques, faites un clic droit, puis choisissez Rechercher dans la recherche biblique.',
    'Choose the verse for cross references':
        'Choisir le verset des références croisées',
    'Open Cross Reference, pick a verse, then click a related verse to open it or Shift+click it to append it.':
        'Ouvrez Référence croisée, choisissez un verset, puis cliquez sur un verset lié pour l’ouvrir ou Maj + clic pour ajouter à la suite.',
    'Filter the people and places lookup':
        'Filtrer les personnes et les lieux bibliques',
    'Switch Names or Locations, use Search names and Filter by name type, and Jump to page in a long list.':
        'Basculez entre Noms et Lieux, utilisez Rechercher des noms et Filtrer par type de nom, et Aller à la page dans une longue liste.',
    'Read a place and open its map':
        'Lire les détails d’un lieu et ouvrir sa carte',
    'Choose Locations in the names lookup, open a place, then use Open in Google Maps if available.':
        'Choisissez Lieux dans la recherche de noms, ouvrez un lieu, puis Ouvrir dans Google Maps si disponible.',
    'Find a resource by filename':
        'Trouver une ressource par son nom de fichier',
    'In Resources, use Search file name to narrow the files; clear the words when finished.':
        'Dans Ressources, utilisez Rechercher un nom de fichier pour filtrer, puis effacez les mots à la fin.',
    'Show resources without chapter names':
        'Afficher les ressources sans nom de chapitre',
    'Toggle Others in Resources to include files that do not use a book and chapter filename.':
        'Activez Autres dans Ressources pour inclure les fichiers sans nom de livre et de chapitre.',
    'Refresh or extend the Resources library':
        'Actualiser ou étendre la bibliothèque de ressources',
    'Use the Resources menu for Add Folder or Reload, and a folder menu for Refresh or Add Files.':
        'Le menu Ressources propose Ajouter un dossier et Recharger ; le menu d’un dossier propose Actualiser et Ajouter des fichiers.',
    'Keep study resources with app data':
        'Conserver les ressources avec les données de l’application',
    'Use a resource folder menu > Copy to Data Directory for a portable copy; Remove Folder takes it off the list, files stay.':
        'Utilisez le menu d’un dossier de ressources > Copier dans le dossier de données pour une copie portable ; Retirer le dossier l’enlève de la liste, les fichiers restent.',
    'Show one kind of graph relationship':
        'Afficher un seul type de relation du graphe',
    'In an open graph, toggle relation chips or right-click a chip to show only that relationship.':
        'Dans un graphe ouvert, activez les étiquettes de relation ou faites un clic droit pour isoler une relation.',
    'Find a connection between Bible records':
        'Trouver un lien entre des personnages ou lieux bibliques',
    'Open Graph Preview, press Find Connection, choose Path to, then run the search.':
        'Ouvrez l’aperçu du graphe, appuyez sur Trouver un lien, choisissez Chemin vers, puis lancez la recherche.',
    'Fit and rearrange a connection graph':
        'Ajuster et réorganiser un graphe de relations',
    'Use Fit to view, Re-layout, Zoom, Collapse all, Undo, Redo and Fullscreen inside the graph.':
        'Utilisez Ajuster à la vue, Réorganiser, Zoom, Tout réduire, Annuler, Rétablir et Plein écran dans le graphe.',
    'Copy or export a connection graph':
        'Copier ou exporter un graphe de relations',
    'In Graph Preview, use Copy for Markdown or Mermaid text; Presets also offers Save as image and Print.':
        'Dans Aperçu du graphe, utilisez Copier pour du texte Markdown ou Mermaid ; Préréglages offre aussi Enregistrer comme image et Imprimer.',
    'Save and revisit a graph preset':
        'Enregistrer et retrouver un préréglage de graphe',
    'Use Presets > Save preset to name your graph, pick it from Presets later, or Delete preset.':
        'Utilisez Préréglages > Enregistrer le préréglage pour nommer votre graphe, reprenez-le plus tard dans Préréglages, ou Supprimer le préréglage.',
    'Resize or close one Reader panel':
        'Redimensionner ou fermer un volet du Lecteur',
    'Drag a panel divider, or right-click it for Reset Size, Close First Widget and Close Second Widget.':
        'Glissez une séparation ou faites un clic droit pour Réinitialiser la taille, Fermer le premier volet et Fermer le second volet.',
    'Are you sure you want to clear all settings?':
        'Voulez-vous vraiment effacer tous les paramètres ?',
    'Reveal Original': "Afficher l'original",
    Sort: 'Trier',
    'Name (A to Z)': 'Nom (A à Z)',
    'Name (Z to A)': 'Nom (Z à A)',
    'Type (A to Z)': 'Type (A à Z)',
    'Type (Z to A)': 'Type (Z à A)',
    'Zoom In': 'Zoom avant',
    'Zoom Out': 'Zoom arrière',
    Type: 'Type',
    Default: 'Par défaut',
    'All Types': 'Tous les types',
    'Filter by name': 'Filtrer par nom',
    'Filter by Type': 'Filtrer par type',
    'No matching files': 'Aucun fichier correspondant',
    'Add Folder': 'Ajouter un dossier',
    'Remove Folder': 'Retirer le dossier',
    'Folder not found': 'Dossier introuvable',
    'Cannot read folder': 'Impossible de lire le dossier',
    'Too many folders to search': 'Trop de dossiers à parcourir',
    'Too many matching files': 'Trop de fichiers correspondants',
    'Search file name': 'Rechercher un nom de fichier',
    'Show files not named after a book and chapter':
        "Afficher les fichiers qui ne portent pas le nom d'un livre et d'un chapitre",
    'Too many other files': "Trop d'autres fichiers",
    // --- Resources: the links inside a `.json` beside the verse.
    'Open Link in Browser': 'Ouvrir le lien dans le navigateur',
    'Too many links': 'Trop de liens',
    'entry was not understood': 'entrée non comprise',
    'entries were not understood': 'entrées non comprises',
    'Only http and https links can be opened':
        'Seuls les liens http et https peuvent être ouverts',
    'Drop folders here': 'Déposez des dossiers ici',
    'Folder is already added': 'Le dossier est déjà ajouté',
    'Drop a folder, not a file': 'Déposez un dossier, pas un fichier',
    // --- Resources: copying a folder into the data directory.
    'Copy to Data Directory': 'Copier dans le dossier de données',
    'Copy this folder, then list the copy here instead?':
        'Copier ce dossier, puis afficher la copie ici à la place ?',
    'Folder is already in the data directory':
        'Le dossier est déjà dans le dossier de données',
    'The data directory is inside this folder':
        'Le dossier de données se trouve dans ce dossier',
    'Cannot copy folder': 'Impossible de copier le dossier',
    'In the data directory': 'Dans le dossier de données',
    // --- Resources: copying picked files INTO one of the user's folders.
    'Add Files': 'Ajouter des fichiers',
    'file copied': 'fichier copié',
    'files copied': 'fichiers copiés',
    'file was not copied': 'fichier non copié',
    'files were not copied': 'fichiers non copiés',
    'Cannot copy file': 'Impossible de copier le fichier',
    'Tick Others to see them': 'Cochez « Autres » pour les voir',
    'They are not shown in this list':
        'Ils ne sont pas affichés dans cette liste',
    // --- Resources: previewing a markdown file and a bible note file in the
    // app, and the Markdown Preview window.
    'Read-only': 'Lecture seule',
    'No notes': 'Aucune note',
    'Not a bible note file': "Ce n'est pas un fichier de notes bibliques",
    'This file is too large to preview':
        'Ce fichier est trop volumineux pour être prévisualisé',
    'Cannot read this file': 'Impossible de lire ce fichier',
    'File not found': 'Fichier introuvable',
    Back: 'Retour',
    'Open in Default App': "Ouvrir dans l'application par défaut",
    // --- Bible Find: the results list and its chunk footer.
    'verses found': 'versets trouvés',
    'verse found': 'verset trouvé',
    'No verses found': 'Aucun verset trouvé',
    Results: 'Résultats',
    'Go to results': 'Aller aux résultats',
    'Load more results': 'Charger plus de résultats',
    'Show pages': 'Afficher les pages',
    'Book-level files are shown in every chapter':
        'Les fichiers au niveau du livre sont affichés dans chaque chapitre',
    Introduction: 'Introduction',
    '{book} chapter {chapter}': '{book} chapitre {chapter}',
    'This folder is empty': 'Ce dossier est vide',
    Dimensions: 'Dimensions',
    'Exporting DOCX Pages': 'Exportation des pages DOCX',
    'Please wait while the DOCX pages are being exported...':
        "Veuillez patienter pendant l'exportation des pages DOCX...",
    'Exporting PPTX Slides': 'Exportation des diapositives PPTX',
    'Please wait while the slides are being exported...':
        "Veuillez patienter pendant l'exportation des diapositives...",
    'Open Bible Reader in a new window':
        'Ouvrir le Lecteur biblique dans une nouvelle fenêtre',
    'Open Slide Editor in a new window':
        "Ouvrir l'Éditeur de diapositives dans une nouvelle fenêtre",
    'Edit Title': 'Modifier le titre',
    'Create KJV Bible XML': 'Créer le XML de la Bible KJV',
    'Remove URL': "Retirer l'URL",
    'Copy URL to Clipboard': "Copier l'URL dans le presse-papiers",
    'Add URL': 'Ajouter une URL',
    'Add New Bible': 'Ajouter une nouvelle Bible',
    'Insert Collapse Bible Text': 'Insérer le texte biblique condensé',
    'Insert Bible Text': 'Insérer le texte biblique',
    'Insert bible item into selected slide':
        "Insérer l'élément biblique dans la diapositive sélectionnée",
    'Insert bible item': "Insérer l'élément biblique",
    'Choose DOCX Preview Background (right click to clear)':
        "Choisir l'arrière-plan de l'aperçu DOCX (clic droit pour effacer)",
    'Open DOCX': 'Ouvrir le DOCX',
    'Refresh DOCX Pages': 'Actualiser les pages DOCX',
    'Delete Note Item': "Supprimer l'élément de note",
    'Are you sure to delete this note item?':
        'Voulez-vous vraiment supprimer cet élément de note ?',
    'Double click to open note': 'Double-cliquez pour ouvrir la note',
    'Reset Selected Books': 'Réinitialiser les livres sélectionnés',
    'Fail to reset search data, please try again':
        'Échec de la réinitialisation des données de recherche, veuillez réessayer',
    'Reset Search Data': 'Réinitialiser les données de recherche',
    'Are you sure to reset search data? This will take a moment to restore':
        'Voulez-vous vraiment réinitialiser les données de recherche ? La restauration prendra un moment',
    'This slide is disabled': 'Cette diapositive est désactivée',
    'This item is disabled': 'Cet élément est désactivé',
    // What a damaged run-sheet entry reads as, both on its own row and in the
    // toast raised when the file was parsed.
    'Invalid item': 'Élément non valide',
    'This item is disabled in this presenting flow':
        'Cet élément est désactivé dans ce déroulé',
    'This item is disabled in its document':
        'Cet élément est désactivé dans son document',
    'Double click to jump to top': 'Double-cliquez pour remonter en haut',
    'Refresh PPTX Slides': 'Actualiser les diapositives PPTX',
    'Open PPTX': 'Ouvrir le PPTX',
    'No Compatible Update Found': 'Aucune mise à jour compatible trouvée',
    'Sorry, we could not find a compatible update for your system.':
        "Désolé, aucune mise à jour compatible n'a été trouvée pour votre système.",
    'On Top': 'Au-dessus',
    'Corrupted Document': 'Document corrompu',
    'The document data is corrupted and cannot be loaded. A new document is shown instead; the file itself is not changed until you press Save.':
        "Les données du document sont corrompues et ne peuvent pas être chargées. Un nouveau document est affiché à la place ; le fichier lui-même n'est pas modifié tant que vous n'appuyez pas sur Enregistrer.",
    'Something wrong during converting, please try again.':
        'Un problème est survenu pendant la conversion, veuillez réessayer.',

    'Something wrong during converting, please check converted file':
        'Un problème est survenu pendant la conversion, veuillez vérifier le fichier converti',
    'and try again.': 'et réessayer.',
    'Error occurred during copying file':
        "Une erreur s'est produite lors de la copie du fichier",
    'Trashing File': 'Mise à la corbeille du fichier',
    'Unable to trash file. Please try again.':
        'Impossible de mettre le fichier à la corbeille. Veuillez réessayer.',
    'Copy to Clipboard': 'Copier dans le presse-papiers',
    'Getting File List': 'Récupération de la liste des fichiers',
    'Error occurred during listing file':
        "Une erreur s'est produite lors de la récupération de la liste des fichiers",
    'Unset Directory Path': 'Retirer le chemin du dossier',
    'Empty Bible List': 'Vider la liste biblique',
    'Empty Note List': 'Vider la liste des notes',
    'Are you sure to empty this note list?':
        'Voulez-vous vraiment vider cette liste de notes ?',
    'Are you sure to empty this bible list?':
        'Voulez-vous vraiment vider cette liste biblique ?',
    'Confirm Key for Bible': 'Confirmer la clé de la Bible',
    'Are you sure you want to quit?': 'Voulez-vous vraiment quitter ?',
    'Do you want to continue with': 'Voulez-vous continuer avec',
    'Search XML': 'Rechercher un XML',
    'Downloading in progress': 'Téléchargement en cours',
    "Can't leave the page while downloading.":
        'Impossible de quitter la page pendant le téléchargement.',
    'Please wait until the download is complete.':
        "Veuillez patienter jusqu'à la fin du téléchargement.",
    'Or attempt 3 times to force leaving.':
        'Ou essayez 3 fois pour forcer la sortie.',
    'Download Completed': 'Téléchargement terminé',
    'The update has been downloaded. Do you want to open the file location?':
        "La mise à jour a été téléchargée. Voulez-vous ouvrir l'emplacement du fichier ?",
    'Error occurred during download':
        "Une erreur s'est produite pendant le téléchargement",
    Error: 'Erreur',
    'Import XML File': 'Importer un fichier XML',
    'XML format example': 'Exemple de format XML',
    'Renaming File': 'Renommage du fichier',
    'Unable to rename file': 'Impossible de renommer le fichier',
    'No Bible XML files': 'Aucun fichier XML de Bible',
    'Bibles XML': 'Bibles XML',
    'Update Available': 'Mise à jour disponible',
    'A new version of the app is available':
        "Une nouvelle version de l'application est disponible",
    'Would you like to download it?': 'Voulez-vous la télécharger ?',
    'You can go to download page.':
        'Vous pouvez aller à la page de téléchargement.',
    'Go to Download Page': 'Aller à la page de téléchargement',
    'Screen Manager is locked': "Le gestionnaire d'écran est verrouillé",
    'No Update Needed': 'Aucune mise à jour nécessaire',
    'You are using the latest version of the app.':
        "Vous utilisez la dernière version de l'application.",
    'Unlock the screen to change what it shows':
        "Déverrouillez l'écran pour modifier ce qu'il affiche",
    'Background Images': "Images d'arrière-plan",
    'Background Videos': "Vidéos d'arrière-plan",
    'Background Audios': "Audios d'arrière-plan",
    'Background Webs': "Sites web d'arrière-plan",
    'Bible Present': 'Présentation biblique',
    'Unable to get online bible list':
        "Impossible d'obtenir la liste des Bibles en ligne",
    'Fail to get find controller!':
        "Impossible d'obtenir le contrôleur de recherche !",
    'No slides to display': 'Aucune diapositive à afficher',
    'Fail to load slides': 'Impossible de charger les diapositives',
    'Reset Size': 'Réinitialiser la taille',
    'Close First Widget': 'Fermer le premier panneau',
    'Close Second Widget': 'Fermer le second panneau',
    'Missing Fonts in': 'Polices manquantes dans',
    'The document is using fonts that are not installed on your system':
        'Le document utilise des polices qui ne sont pas installées sur votre système',
    'Would you like to search for the missing fonts?':
        'Voulez-vous rechercher les polices manquantes ?',
    'Opening Missing Fonts Searching':
        'Ouverture de la recherche des polices manquantes',
    'Open BibleNote': 'Ouvrir BibleNote',
    'No title': 'Sans titre',
    'Background and Color': 'Arrière-plan et couleur',
    'The text color was changed so it stays visible on the new background color.':
        "La couleur du texte a été changée pour rester visible sur la nouvelle couleur d'arrière-plan.",
    'The file was not found at that address.':
        'Le fichier est introuvable à cette adresse.',
    'The server refused the download.':
        'Le serveur a refusé le téléchargement.',
    'Could not reach that address. Check the link and the internet connection.':
        'Impossible de joindre cette adresse. Vérifiez le lien et la connexion Internet.',
    Display: 'Moniteur',
    'Display id': 'ID du moniteur',
    'Screen id': "ID de l'écran",
    primary: 'principal',
    'Fail to create folder': 'Impossible de créer le dossier',
    'New Note Item': 'Nouvel élément de note',
    'This will select': 'Ceci sélectionnera',
    'will create if not exist': "sera créé s'il n'existe pas",
    'No directory selected': 'Aucun dossier sélectionné',
    Notes: 'Notes',
    Note: 'Note',
    'Bible Notes': 'Notes bibliques',
    'Bible Notes (Lookup)': 'Notes bibliques (Recherche)',
    'Bible and Notes': 'Bible et notes',
    'Bible and Notes (Lookup)': 'Bible et notes (Recherche)',
    // Verse marks: highlights and comments made on selected verse text.
    Highlight: 'Surligner',
    'Remove Marks': 'Retirer les marques',
    'No mark in the selected text': 'Aucune marque dans le texte sélectionné',
    'Saving Verse Mark': 'Enregistrement de la marque du verset',
    'Bible notes directory is not set':
        "Le dossier des notes bibliques n'est pas défini",
    'Show what is marked on this verse': 'Afficher les marques de ce verset',
    'Click to reveal the verse': 'Cliquez pour afficher le verset',
    'Add Comment': 'Ajouter un commentaire',
    'Edit Comment': 'Modifier le commentaire',
    'Delete Comment': 'Supprimer le commentaire',
    'Click to edit the comment': 'Cliquez pour modifier le commentaire',
    'No comment yet': "Aucun commentaire pour l'instant",
    'Write a comment': 'Écrire un commentaire',
    'Add to Bible List': 'Ajouter à la liste biblique',
    'Delete Verse Marks': 'Supprimer les marques du verset',
    'Are you sure to delete all marks on this verse?':
        'Voulez-vous vraiment supprimer toutes les marques de ce verset ?',
    'Drag to the Bible list to add this verse':
        'Faites glisser vers la liste biblique pour ajouter ce verset',
    'Drag to the Bible list, or to another note file':
        'Faites glisser vers la liste biblique ou vers un autre fichier de notes',
    'Click to open the verse': 'Cliquez pour ouvrir le verset',
    'Document List': 'Liste des documents',
    'Lyric List': 'Liste des chants',
    'Presenting Flow List': 'Liste des déroulés',
    Previewer: 'Aperçu',
    Slides: 'Diapositives',
    'Slide Notes': 'Notes de diapositive',
    'Slide Document': 'Document de diapositives',
    Canvas: 'Canevas',
    'Slide Editor Ground': "Zone de l'éditeur de diapositives",
    'Slide Editor Canvas': "Canevas de l'éditeur de diapositives",
    Tools: 'Outils',
    'App Editor Left': "Panneau gauche de l'éditeur",
    'App Editor Right': "Panneau droit de l'éditeur",
    'App Presenter Left': 'Panneau gauche du présentateur',
    'App Presenter Middle': 'Panneau central du présentateur',
    'App Presenter Right': 'Panneau droit du présentateur',
    'Mini Screen': 'Mini-écran',
    'Bible View': 'Vue biblique',
    'Bible Online Lookup': 'Recherche biblique en ligne',
    'Background Audio': "Audio d'arrière-plan",
    'Stage Previewer': 'Aperçu des scènes',
    stages: 'scènes',
    'Add Stage': 'Ajouter une scène',
    'Hide Stage': 'Masquer la scène',
    'Base Stage': 'Scène de base',
    'Base stage is always shown': 'La scène de base est toujours affichée',
    'Choose a stage to add': 'Choisir une scène à ajouter',
    'Maximum stages are shown': 'Le nombre maximal de scènes est affiché',
    'Stage Style': 'Style de scène',
    'Reset Stage Style': 'Réinitialiser le style de scène',
    'Applies to every song': "S'applique à tous les chants",
    'Slide Padding (%)': 'Marge de la diapositive (%)',
    'Background Opacity (%)': "Opacité de l'arrière-plan (%)",
    'Extra Font Size': 'Taille de police supplémentaire',
    'Custom CSS': 'CSS personnalisé',
    'Custom CSS is added after this stage own style':
        'Le CSS personnalisé est ajouté après le style propre à cette scène',
    'Browser does not support audio.':
        "Le navigateur ne prend pas en charge l'audio.",
    'Not Supported Item Type': "Type d'élément non pris en charge",
    'Fail to read file data': 'Impossible de lire les données du fichier',
    'No book options available': 'Aucun livre disponible',
    'Fail to get data': "Impossible d'obtenir les données",
    'All Books': 'Tous les livres',
    'Shift + Click to select multiple':
        'Maj + clic pour une sélection multiple',
    'Old Testament': 'Ancien Testament',
    'New Testament': 'Nouveau Testament',
    Find: 'Rechercher',
    'Cross Reference': 'Référence croisée',
    Resources: 'Ressources',
    'Cross References': 'Références croisées',
    // --- Cross Reference panel (2026-08-29 redesign).
    Themes: 'Thèmes',
    'No cross references for this verse':
        'Aucune référence croisée pour ce verset',
    'Open beside the current verse': 'Ouvrir à côté du verset actuel',
    'No verse selected': 'Aucun verset sélectionné',
    'Choose a verse in the reader to see what else in scripture speaks to it.':
        "Choisissez un verset dans le lecteur pour voir ce que l'Écriture en dit ailleurs.",
    'Reveal in File Explorer': "Afficher dans l'Explorateur de fichiers",
    'Saving note': 'Enregistrement de la note',
    'Please wait while the note is being saved.':
        "Veuillez patienter pendant l'enregistrement de la note.",
    'Enter your note here': 'Saisissez votre note ici',
    'Slide is copied': 'Diapositive copiée',
    'Remove Background': "Retirer l'arrière-plan",
    'Timezone Hour Offset': 'Décalage du fuseau horaire (heures)',
    'Choose Color': 'Choisir une couleur',
    'Choose City': 'Choisir une ville',
    'New Slide': 'Nouvelle diapositive',
    'Show on Screens': 'Afficher sur les écrans',
    'Toggle showing screen': "Afficher/masquer l'écran",
    'Reveal Hidden Controls': 'Révéler les commandes masquées',
    'Set Specific Screen': 'Définir un écran spécifique',
    'Remove from screen': "Retirer de l'écran",
    Rename: 'Renommer',
    Reload: 'Recharger',
    'Sync group scrolling': 'Défilement synchronisé du groupe',
    'Enable group sync scrolling':
        'Activer le défilement synchronisé du groupe',
    'Disable group sync scrolling':
        'Désactiver le défilement synchronisé du groupe',
    'Set Line Sync': 'Activer la synchro des lignes',
    'Unset Line Sync': 'Désactiver la synchro des lignes',
    Solo: 'Solo',
    Select: 'Sélectionner',
    Deselect: 'Désélectionner',
    'Copy Path to Clipboard': 'Copier le chemin dans le presse-papiers',
    'Reveal in Finder': 'Afficher dans le Finder',
    'Preview PDF': 'Prévisualiser le PDF',
    'Refresh PDF Images': 'Actualiser les images PDF',
    'Exporting PDF Images': 'Conversion des pages PDF en images',
    'Please wait while the PDF pages are being exported...':
        'Veuillez patienter pendant la conversion des pages PDF en images...',
    'Preparing PDF pages...': 'Préparation des pages PDF...',
    'Add New Screen': 'Ajouter un écran',
    'Refresh Preview': "Actualiser l'aperçu",
    'Show Monitor Wallpaper': "Afficher le fond d'écran du moniteur",
    'The application is started first time':
        "L'application est lancée pour la première fois",
    Close: 'Fermer',
    'Toggle Widget Full View': 'Agrandir/réduire le panneau',
    Floating: 'Panneau flottant',
    'Split Vertical to': 'Diviser verticalement vers',
    'Split Horizontal to': 'Diviser horizontalement vers',
    'Loading Bible Data': 'Chargement des données bibliques',
    'Unable to preview right now': 'Aperçu impossible pour le moment',
    'Open bible lookup popup': 'Ouvrir la recherche biblique',
    Cancel: 'Annuler',
    Ok: 'OK',
    'Choose File': 'Choisir un fichier',
    'No file chosen': 'Aucun fichier choisi',
    Or: 'ou',
    'URL:': 'URL :',
    'Key is already taken': 'Cette clé est déjà utilisée',
    'File saved at:': 'Fichier enregistré à :',
    'Failed to save Bible data':
        "Échec de l'enregistrement des données bibliques",
    'Bible XML data not found': 'Données bibliques XML introuvables',
    'Cancel selection': 'Annuler la sélection',
    'Quick Exit': 'Quitter rapidement',
    'Are you sure you want to quit the app?':
        "Voulez-vous vraiment quitter l'application ?",
    'Items are copied': 'Éléments copiés',
    'Only image and video files are supported':
        'Seuls les fichiers image et vidéo sont pris en charge',
    'Insert Medias': 'Insérer des médias',
    'Insert YouTube': 'Insérer YouTube',
    'Insert Media Link': 'Insérer un lien média',
    'Media URL:': 'URL du média :',
    'Insert Website': 'Insérer un site web',
    'Insert Camera': 'Insérer une caméra',
    'No camera found': 'Aucune caméra trouvée',
    Camera: 'Caméra',
    'Camera Properties': 'Propriétés de la caméra',
    'Camera Device': 'Périphérique caméra',
    'Camera not found': 'Caméra introuvable',
    'Camera Not Available': 'Caméra non disponible',
    'Could not open the camera': 'Impossible d’ouvrir la caméra',
    'A screen cannot show itself': 'Un écran ne peut pas s’afficher lui-même',
    'These screens would show each other':
        'Ces écrans s’afficheraient l’un l’autre',
    'Start Camera': 'Démarrer la caméra',
    'Stop Camera': 'Arrêter la caméra',
    Preview: 'Aperçu',
    Mirror: 'Miroir',
    'Object Fit': 'Ajustement',
    Cover: 'Couvrir',
    Contain: 'Contenir',
    Fill: 'Remplir',
    'Cannot be empty': 'Ne peut pas être vide',
    'YouTube URL:': 'URL YouTube :',
    'Website URL:': 'URL du site web :',
    'Video URL:': 'URL de la vidéo :',
    'Audio URL:': "URL de l'audio :",
    'Image URL:': "URL de l'image :",
    'Web URL:': 'URL web :',
    'Documents URL:': 'URL des documents :',
    'Presenting Flow Archive URL:': "URL de l'archive du déroulé :",
    'Bible Note Archive URL:': "URL de l'archive des notes bibliques :",
    'Open URL': "Ouvrir l'URL",
    'Copy URL': "Copier l'URL",
    New: 'Nouveau',
    'Slides are copied': 'Diapositives copiées',
    Copied: 'Copié',
    'Copy failed': 'Échec de la copie',
    'Could not copy to the clipboard. Try again.':
        'Impossible de copier dans le presse-papiers. Réessayez.',
    'Canvas item copied': 'Élément du canevas copié',
    'Enable Background Audio Handlers':
        "Activer la gestion audio d'arrière-plan",
    'Audio is Playing': 'Audio en cours de lecture',
    'Please pause all background audios before disabling audio handlers':
        "Veuillez mettre en pause tous les audios d'arrière-plan avant de désactiver la gestion audio",
    'Fading at the End': 'Fondu à la fin',
    'Data not available for': 'Données non disponibles pour',
    'No data available': 'Aucune donnée disponible',
    'No verses found for this Bible item':
        'Aucun verset trouvé pour cet élément biblique',
    'Select Default': 'Sélectionner par défaut',
    Reset: 'Réinitialiser',
    'Start Countdown to DateTime': "Compte à rebours jusqu'à une date/heure",
    'Start Countdown': 'Démarrer le compte à rebours',
    'Show Marquee Top': 'Afficher le bandeau défilant haut',
    'Show Marquee Bottom': 'Afficher le bandeau défilant bas',
    'Show Quick Text': 'Afficher le texte rapide',
    'Start Stopwatch': 'Démarrer le chronomètre',
    'Show Time': "Afficher l'heure",
    'Show Countdown': 'Afficher le compte à rebours',
    'Show Stopwatch': 'Afficher le chronomètre',
    'Auto-start': 'Démarrage auto',
    'Start counting as soon as it is shown':
        "Commencer à compter dès qu'il est affiché",
    Start: 'Démarrer',
    Resume: 'Reprendre',
    'Start counting': 'Commencer à compter',
    'Pause counting': 'Mettre le décompte en pause',
    'Resume counting': 'Reprendre le décompte',
    'Reset to the full duration': 'Revenir à la durée complète',
    'Reset to zero and save the time':
        'Remettre à zéro et enregistrer le temps',
    History: 'Historique',
    'Clear stopwatch history': "Effacer l'historique du chronomètre",
    'Remove the saved times of this session?':
        'Supprimer les temps enregistrés de cette session ?',
    Running: 'En cours',
    Paused: 'En pause',
    'Not started': 'Pas démarré',
    Loading: 'Chargement',
    'Something Went Wrong': 'Un problème est survenu',
    "The app ran into a problem. The assistant can look into it and write a report for you, with this computer's system information and the app's console log in it. Nothing is sent until you say so. Open the assistant to report it?":
        "L'application a rencontré un problème. L'assistant peut l'examiner et rédiger un rapport pour vous, avec les informations système de cet ordinateur et le journal de la console de l'application. Rien n'est envoyé tant que vous ne l'avez pas décidé. Ouvrir l'assistant pour le signaler ?",
    'Report a Problem': 'Signaler un problème',
    'Not Now': 'Pas maintenant',
    'Reload is needed': 'Rechargement nécessaire',
    'Sorry, an internal process error occurred. Please refresh the app.':
        "Désolé, une erreur interne s'est produite. Veuillez actualiser l'application.",
    Exporting: 'Exportation en cours',
    'Export to MS Word': 'Exporter vers MS Word',
    'Export to PPTX': 'Exporter en PPTX',
    'Unable to export the document to PPTX':
        "Impossible d'exporter le document en PPTX",
    'Exporting Fonts': 'Exportation des polices',
    'Would you like to export the fonts?': 'Voulez-vous exporter les polices ?',
    'Fail to Get File List': "Impossible d'obtenir la liste des fichiers",
    'No Files Found': 'Aucun fichier trouvé',
    General: 'Général',
    Bible: 'Bible',
    Others: 'Autres',
    About: 'À propos',
    Presenter: 'Présentateur',
    Colors: 'Couleurs',
    Images: 'Images',
    Videos: 'Vidéos',
    Cameras: 'Caméras',
    Webs: 'Sites web',
    // Singular: what ONE attached background is, for the icon that says a
    // slide carries one (`AttachBackgroundIconComp`).
    Image: 'Image',
    Video: 'Vidéo',
    Web: 'Web',
    Text: 'Texte',
    Box: 'Zone',
    Appearance: 'Apparence',
    Shadow: 'Ombre',
    'Text Shadow': 'Ombre du texte',
    Lyric: 'Chant',
    Slide: 'Diapositive',
    Documents: 'Documents',
    'Document Audios': 'Audios du document',
    Lyrics: 'Chants',
    'Presenting Flows': 'Déroulés',
    'Presenting Flow': 'Déroulé',
    'Preview Presenting Flow': 'Prévisualiser le déroulé',
    'Open Preview': "Ouvrir l'aperçu",
    'Open Slides Preview': "Ouvrir l'aperçu des diapositives",
    'Already showing in the main previewer':
        "Déjà affiché dans l'aperçu principal",
    'Add Action': 'Ajouter une action',
    'Apply on Screens': 'Appliquer aux écrans',
    'Clear Screen': "Effacer l'écran",
    'Clear FG Messages': 'Effacer les messages (1er plan)',
    'Clear FG Marquee Top': 'Effacer le bandeau défilant haut (1er plan)',
    'Clear FG Marquee Bottom': 'Effacer le bandeau défilant bas (1er plan)',
    'Clear FG Quick Text': 'Effacer le texte rapide (1er plan)',
    'Clear FG Countdown': 'Effacer le compte à rebours (1er plan)',
    'Clear FG Stopwatch': 'Effacer le chronomètre (1er plan)',
    'Clear FG Time': "Effacer l'heure (1er plan)",
    'Clear FG Camera Show': 'Effacer la caméra (1er plan)',
    'Clear FG Screen Show': 'Effacer l’affichage d’écran (1er plan)',
    'Clear FG Web Show': 'Effacer le site web (1er plan)',
    'Other Clear FG Items': 'Autres effacements (1er plan)',
    'Screen: Show': 'Écran : afficher',
    'Screen: Hide': 'Écran : masquer',
    'Please choose at least one screen': 'Veuillez choisir au moins un écran',
    'No screen is open': "Aucun écran n'est ouvert",
    'Slide: Media Control': 'Diapositive : contrôle média',
    'Add Media Control': 'Ajouter un contrôle média',
    'Media Control Settings': 'Paramètres du contrôle média',
    Play: 'Lire',
    Pause: 'Pause',
    Stop: 'Arrêter',
    Action: 'Action',
    Settings: 'Paramètres',
    'Delay Before': 'Délai avant',
    'Media Start At': 'Début du média à',
    'Then Pause': 'Puis pause',
    Never: 'Jamais',
    After: 'Après',
    'At Media Time': 'À la position du média',
    'Media Pause At': 'Pause du média à',
    'Pause After': 'Pause après',
    Volume: 'Volume',
    Speed: 'Vitesse',
    'Set Volume': 'Régler le volume',
    'Set Speed': 'Régler la vitesse',
    'Please enter a number that is 0 or greater':
        'Veuillez saisir un nombre supérieur ou égal à 0',
    'Please enter a volume between 0 and 100':
        'Veuillez saisir un volume entre 0 et 100',
    'The stop point must be after the start point':
        "Le point d'arrêt doit être après le point de départ",
    'Next: Interval': 'Suivant : intervalle',
    'Next: Clear Interval': "Suivant : arrêter l'intervalle",
    'Next: Timeout': 'Suivant : délai',
    Seconds: 'Secondes',
    'Start Auto Next': "Démarrer l'enchaînement auto",
    'Stop Auto Next': "Arrêter l'enchaînement auto",
    'Pause Auto Next': "Suspendre l'enchaînement auto",
    'Resume Auto Next': "Reprendre l'enchaînement auto",
    'Change Seconds': 'Modifier les secondes',
    'At Time': "À l'heure",
    Timing: 'Minutage',
    'Change Timing': 'Modifier le minutage',
    'Use Element Timing': "Utiliser le minutage de l'élément",
    'Please enter a valid time': 'Veuillez saisir une heure valide',
    'The set time is already due': "L'heure définie est déjà passée",
    'Jump to': 'Aller à',
    'Attach the element to jump to as a CC element':
        "Joindre l'élément cible comme élément CC",
    'The element to jump to is not in this presenting flow':
        "L'élément cible n'est pas dans ce déroulé",
    'Keyboard Event': 'Événement clavier',
    Shortcut: 'Raccourci',
    'Change Shortcut': 'Modifier le raccourci',
    'Press a shortcut': 'Appuyez sur un raccourci',
    'Please press a shortcut': 'Veuillez appuyer sur un raccourci',
    'Hold Ctrl or Shift with the key': 'Maintenez Ctrl ou Maj avec la touche',
    'Only Ctrl and Shift may be used': 'Seuls Ctrl et Maj sont autorisés',
    'This key cannot be used': 'Cette touche ne peut pas être utilisée',
    'This shortcut is already used in this presenting flow':
        'Ce raccourci est déjà utilisé dans ce déroulé',
    'Attach the elements to show as CC elements':
        'Joindre les éléments à afficher comme éléments CC',
    'This element takes only one CC element':
        "Cet élément n'accepte qu'un seul élément CC",
    'This element does not accept CC element':
        "Cet élément n'accepte pas d'élément CC",
    'Open the presenting flow preview to use this action':
        "Ouvrez l'aperçu du déroulé pour utiliser cette action",
    'Please enter a number greater than 0':
        'Veuillez saisir un nombre supérieur à 0',
    'Remove from Presenting Flow': 'Retirer du déroulé',
    'Add CC Elements': 'Ajouter des éléments CC',
    'Remove CC Element': "Retirer l'élément CC",
    'No other elements': 'Aucun autre élément',
    'Adding CC Element': "Ajout d'un élément CC",
    'This item type cannot be a CC element':
        "Ce type d'élément ne peut pas être un élément CC",
    'Collapse floating widget': 'Réduire le panneau flottant',
    'Expand floating widget': 'Agrandir le panneau flottant',
    'Close floating widget': 'Fermer le panneau flottant',
    'Adding Presenting Flow Item': "Ajout d'un élément du déroulé",
    'This item type cannot be added to a presenting flow':
        "Ce type d'élément ne peut pas être ajouté à un déroulé",
    'Showing Presenting Flow Item': "Affichage de l'élément du déroulé",
    'CC element': 'Élément CC',
    'Drop items here': 'Déposez les éléments ici',
    'No items in this presenting flow': 'Aucun élément dans ce déroulé',
    'No slides': 'Aucune diapositive',
    'No slide selected': 'Aucune diapositive sélectionnée',
    'Add Local Files': 'Ajouter des fichiers locaux',
    'Slide Thumbnail Size Scale': 'Échelle des miniatures de diapositive',
    'Collapse All': 'Tout réduire',
    'Expand All': 'Tout développer',
    Bibles: 'Bibles',
    'Bibles (Lookup)': 'Bibles (Recherche)',
    'Full Text': 'Texte intégral',
    'Add Extra Bible': 'Ajouter une autre Bible',
    'Add Time': 'Ajouter une horloge',
    'Advance Bible Lookup': 'Recherche biblique avancée',
    'Advance Lookup': 'Recherche avancée',
    'Apply All Slides': 'Appliquer à toutes les diapositives',
    'Apply changed dimension to this slide':
        'Appliquer la nouvelle dimension à cette diapositive',
    'Apply changed name to this slide':
        'Appliquer le nouveau nom à cette diapositive',
    Apply: 'Appliquer',
    'Are you sure to discard all histories?':
        "Voulez-vous vraiment abandonner tout l'historique ?",
    'Are you sure to discard all change histories?':
        "Voulez-vous vraiment abandonner tout l'historique des modifications ?",
    'Audio playing': 'Lecture audio en cours',
    Audios: 'Audios',
    'Auto Play Audio AI when available':
        "Lire automatiquement l'audio IA si disponible",
    'Backdrop Filter (PX):': "Filtre d'arrière-plan (PX) :",
    'Background Color:': "Couleur d'arrière-plan :",
    'Bible key': 'Clé de Bible',
    'Bible Lookup': 'Recherche biblique',
    'Camera Show': 'Affichage de la caméra',
    'Screen Show': 'Affichage d’écran',
    'Change Bible Model Info': 'Modifier les infos du modèle de Bible',
    'Child Directories': 'Sous-dossiers',
    'Clear All Settings': 'Effacer tous les paramètres',
    'Clear All': 'Tout effacer',
    'Clear Background': "Effacer l'arrière-plan",
    'Clear Long Text': 'Effacer le texte long',
    'Clear Cache': 'Vider le cache',
    'Clear Color Note': 'Effacer la note de couleur',
    'Clear Foreground': 'Effacer le premier plan',
    // --- Messages ---
    Messages: 'Messages',
    'Show All Messages': 'Afficher tous les messages',
    'Hide Messages': 'Masquer les messages',
    Message: 'Message',
    'Add Message': 'Ajouter un message',
    'Type in the empty message first': 'Saisissez d’abord le message vide',
    'Type a message': 'Saisissez un message',
    'No message yet': 'Aucun message pour le moment',
    'Show Message': 'Afficher le message',
    'Hide Message': 'Masquer le message',
    'Remove Message': 'Supprimer le message',
    'Long Text Show': 'Affichage de texte long',
    'Show Long Text': 'Afficher le texte long',
    'Hide Long Text': 'Masquer le texte long',
    'Add Language': 'Ajouter une langue',
    'Remove Language': 'Supprimer la langue',
    'Choose Language': 'Choisir la langue',
    'No language yet': 'Aucune langue pour le moment',
    Source: 'Source',
    'Raw Text': 'Texte saisi',
    'Lyric File': 'Fichier de chant',
    'Choose Lyric': 'Choisir un chant',
    'No lyric file chosen': 'Aucun fichier de chant choisi',
    'No lyric file in the Documents folder':
        'Aucun fichier de chant dans le dossier Documents',
    'This lyric file could not be read':
        'Ce fichier de chant n’a pas pu être lu',
    'This lyric file names a part it does not have':
        'Ce fichier de chant nomme une partie qu’il ne contient pas',
    'The songs do not have the same structure':
        'Les chants n’ont pas la même structure',
    'Every language needs the same number of sections':
        'Chaque langue doit avoir le même nombre de sections',
    Section: 'Section',
    Sections: 'Sections',
    'Add Section': 'Ajouter une section',
    'Remove Section': 'Supprimer la section',
    'Type a section': 'Saisissez une section',
    'No section yet': 'Aucune section pour le moment',
    'This section is empty': 'Cette section est vide',
    'Text Size (%)': 'Taille du texte (%)',
    'Bring to Middle': 'Amener au milieu de l’écran',
    'View as Text Cards': 'Afficher en cartes de texte',
    'Remove Time': 'Supprimer l’horloge',
    Rotate: 'Alterner',
    'Show each message in turn': 'Afficher chaque message à tour de rôle',
    'Seconds each message stays before the next':
        "Secondes d'affichage de chaque message avant le suivant",
    'Tick a screen first, then press the key again':
        "Cochez d'abord un écran, puis appuyez à nouveau sur la touche",
    'Clear Slide': 'Effacer la diapositive',
    Clear: 'Effacer',
    'Click to change Stage Number': 'Cliquer pour changer le numéro de scène',
    'Copy All Items': 'Copier tous les éléments',
    'Copy All': 'Tout copier',
    'Copy Chapter Full Key': 'Copier la clé complète du chapitre',
    'Copy Selected Text': 'Copier le texte sélectionné',
    'Copy Text': 'Copier le texte',
    'Copy Title': 'Copier le titre',
    'Copy Verse Full Key': 'Copier la clé complète du verset',
    'More…': 'Plus…',
    'Every way to copy the title and text':
        'Toutes les façons de copier le titre et le texte',
    'Title and Text': 'Titre et texte',
    'Title Only': 'Titre seul',
    'Text Only': 'Texte seul',
    '(Version) Title': '(Version) Titre',
    'Title (Version)': 'Titre (Version)',
    'Title without Version': 'Titre sans version',
    '(1): Text': '(1): Texte',
    '1: Text': '1: Texte',
    'Text without Numbers': 'Texte sans numéros',
    'Generate Slides': 'Générer des diapositives',
    'Leave empty for Auto. Text shrinks to fit.':
        'Laissez vide pour Auto. Le texte est réduit si nécessaire.',
    'The next verse appears quietly at the bottom right':
        'Le verset suivant apparaît discrètement en bas à droite',
    'Choose Bible versions to include on each slide':
        'Choisissez les versions bibliques à inclure sur chaque diapositive',
    'A title slide, then one verse per slide with all selected Bible versions':
        'Une diapositive de titre, puis un verset par diapositive dans toutes les versions sélectionnées',
    'Bible passage is unavailable in':
        'Ce passage biblique est indisponible dans',
    'Unable to generate slides from this Bible item':
        'Impossible de générer des diapositives à partir de ce passage biblique',
    Copy: 'Copier',
    Countdown: 'Compte à rebours',
    'Create Anthropic api key': 'Créer une clé API Anthropic',
    'Create OpenAI api key': 'Créer une clé API OpenAI',
    'Creating Default Folder': 'Création du dossier par défaut',
    Dark: 'Sombre',
    Decrement: 'Diminuer',
    'Define a Bible key': 'Définir une clé de Bible',
    Delete: 'Supprimer',
    'Dictionary for Selected Text': 'Dictionnaire pour le texte sélectionné',
    Disable: 'Désactiver',
    'Discard Change': 'Abandonner les modifications',
    'Drop every unsaved change in this note file?':
        'Abandonner toutes les modifications non enregistrées de ce fichier de notes ?',
    'Discard changed': 'Abandonner les modifications',
    'Download From URL': 'Télécharger depuis une URL',
    'Import From URL': 'Importer depuis une URL',
    Download: 'Télécharger',
    Duplicate: 'Dupliquer',
    'Edit Parent Path': 'Modifier le chemin parent',
    'Edit this web file': 'Modifier ce fichier web',
    Edit: 'Modifier',
    Editor: 'Éditeur',
    Empty: 'Vide',
    Enable: 'Activer',
    'Exit Full': 'Quitter le plein écran',
    'Fix slide dimension': 'Corriger la dimension de la diapositive',
    'Font Family': 'Famille de police',
    'Font Weight': 'Graisse',
    Foreground: 'Premier plan',
    'Full Width': 'Pleine largeur',
    Full: 'Plein',
    'Generated using AI technology.': "Généré à l'aide de l'IA.",
    'Generated using Google Translate.':
        "Généré à l'aide de Google Traduction.",
    // Follows either of the two lines above, on the cross-reference notes.
    'Results may vary and may not be accurate. Please use with caution.':
        'Les résultats peuvent varier et ne pas être exacts. À utiliser avec prudence.',
    'Go Back to Presenter': 'Retour au Présentateur',
    'Go to Bible Setting': 'Aller aux paramètres de la Bible',
    'Or add bible ': 'Ou ajouter une Bible ',
    'Go to Settings': 'Aller aux paramètres',
    'Hide Camera': 'Masquer la caméra',
    'Hide Screen Show': 'Masquer l’affichage d’écran',
    'Hide Countdown': 'Masquer le compte à rebours',
    'Hide Editor': "Masquer l'éditeur",
    'Hide Marquee Bottom': 'Masquer le bandeau défilant bas',
    'Hide Marquee Top': 'Masquer le bandeau défilant haut',
    'Hide Quick Text': 'Masquer le texte rapide',
    'Hide Stopwatch': 'Masquer le chronomètre',
    'Hide Time': "Masquer l'heure",
    'Hide Web': 'Masquer le Web',
    Import: 'Importer',
    Increment: 'Augmenter',
    'Insert Image or Video': 'Insérer une image ou une vidéo',
    'Insert Image, Video or Audio': 'Insérer une image, une vidéo ou un audio',
    'Invalid Path': 'Chemin invalide',
    'Key is missing': 'Clé manquante',
    Language: 'Langue',
    'Learn More About Web Development':
        'En savoir plus sur le développement web',
    Light: 'Clair',
    Lookup: 'Recherche',
    'Markdown Music Help': 'Aide Markdown pour la musique',
    'Marquee Bottom': 'Bandeau défilant bas',
    'Marquee Top': 'Bandeau défilant haut',
    'Mix Color:': 'Couleur de mélange :',
    'Move All Items To': 'Déplacer tous les éléments vers',
    'Move backward': 'Reculer',
    'Move down': 'Descendre',
    'Move forward': 'Avancer',
    'Move to Bottom': 'Déplacer tout en bas',
    'Move to Top': 'Déplacer tout en haut',
    'Move to Trash': 'Mettre à la corbeille',
    'Move To': 'Déplacer vers',
    'Move up': 'Monter',
    'More Options': "Plus d'options",
    'Mini Screen Options': 'Options du mini-écran',
    'New File Name': 'Nom du nouveau fichier',
    'New File': 'Nouveau fichier',
    'New App Document': 'Nouveau document',
    'New Lyric': 'Nouveau chant',
    'No App Document Selected': 'Aucun document sélectionné',
    'No Bible Available': 'Aucune Bible disponible',
    'No canvas item selected': 'Aucun élément du canevas sélectionné',
    'No Color': 'Aucune couleur',
    'No Specific Screen': 'Aucun écran spécifique',
    'No Lyric Selected': 'Aucun chant sélectionné',
    'No Parent Directory Selected': 'Aucun dossier parent sélectionné',
    'Not Full Width': 'Pas en pleine largeur',
    'Numbers map': 'Table des chiffres',
    'On Screen Width:': "Largeur à l'écran :",
    'Opacity (%)': 'Opacité (%)',
    'Opacity:': 'Opacité :',
    'Open in Cross Reference': 'Ouvrir dans les références croisées',
    'Open in Resources': 'Ouvrir dans les ressources',
    'Open Shared Link': 'Ouvrir le lien partagé',
    Open: 'Ouvrir',
    'Original Size': "Taille d'origine",
    'Other General Options': 'Autres options générales',
    'Parent Directory:': 'Dossier parent :',
    'Parse Markup String (HTML|XML)':
        'Analyser une chaîne de balisage (HTML|XML)',
    'Paste Image': "Coller l'image",
    Paste: 'Coller',
    'Path Settings': 'Paramètres des chemins',
    'Please select an item to edit':
        'Veuillez sélectionner un élément à modifier',
    'Pause the audio first, then try again.':
        "Mettez d'abord l'audio en pause, puis réessayez.",
    Print: 'Imprimer',
    'Unable to prepare the document for printing':
        "Impossible de préparer le document pour l'impression",
    Properties: 'Propriétés',
    'Quick Text': 'Texte rapide',
    Refresh: 'Actualiser',
    Remove: 'Retirer',
    'Repeat this audio': 'Répéter cet audio',
    'Reset All Child Directories': 'Réinitialiser tous les sous-dossiers',
    'Reset Rotate': 'Réinitialiser la rotation',
    'Reset to default display dimension':
        "Réinitialiser à la dimension d'affichage par défaut",
    'Reset Widgets Size': 'Réinitialiser la taille des panneaux',
    'Are you sure to reset every widget size and reopen the widgets?':
        'Voulez-vous vraiment réinitialiser la taille de tous les panneaux et les rouvrir ?',
    Widgets: 'Panneaux',
    'Round (%)': 'Arrondi (%)',
    'Round Size %:': "Taille de l'arrondi % :",
    'Round Size Pixel:': "Taille de l'arrondi en pixels :",
    'Round Size Pixel': "Taille de l'arrondi en pixels",
    'Round:': 'Arrondi :',
    'Save bible item and show on screen':
        "Enregistrer l'élément biblique et l'afficher à l'écran",
    'Save bible item': "Enregistrer l'élément biblique",
    Save: 'Enregistrer',
    'Save or discard unsaved Bible changes before closing the editor.':
        "Enregistrez ou abandonnez les modifications non enregistrées de la Bible avant de fermer l'éditeur.",
    'Save or discard unsaved Bible changes before refreshing.':
        "Enregistrez ou abandonnez les modifications non enregistrées de la Bible avant d'actualiser.",
    'Save or discard unsaved Bible changes before resetting.':
        'Enregistrez ou abandonnez les modifications non enregistrées de la Bible avant de réinitialiser.',
    'Save or discard unsaved Bible changes before switching tabs.':
        "Enregistrez ou abandonnez les modifications non enregistrées de la Bible avant de changer d'onglet.",
    'Unsaved Bible Data': 'Données bibliques non enregistrées',
    'Unsaved changes': 'Modifications non enregistrées',
    'Discard unsaved changes': 'Abandonner les modifications non enregistrées',
    'You have unsaved Bible changes.':
        'Vous avez des modifications de la Bible non enregistrées.',
    'Please save or discard them before reloading.':
        'Veuillez les enregistrer ou les abandonner avant de recharger.',
    Scale: 'Échelle',
    'Scale:': 'Échelle :',
    'Search in Bible Search': 'Rechercher via la recherche dans la Bible',
    'Search Selected Text on Google':
        'Rechercher le texte sélectionné sur Google',
    'Select Default Folder': 'Sélectionner le dossier par défaut',
    'Set AI API Key': "Définir la clé API d'IA",
    Setting: 'Paramètres',
    'shift + click to append': 'Maj + clic pour ajouter à la suite',
    'Shift Click to Add': 'Maj + clic pour ajouter',
    'Show all verses': 'Afficher tous les versets',
    'Show bible item': "Afficher l'élément biblique",
    'Show Editor': "Afficher l'éditeur",
    Show: 'Afficher',
    'Split horizontal': 'Diviser horizontalement',
    'Split vertical': 'Diviser verticalement',
    Stage: 'Scène',
    Stopwatch: 'Chronomètre',
    Strip: 'Ajuster',
    System: 'Système',
    'Text Color:': 'Couleur du texte :',
    'Text Color': 'Couleur du texte',
    Theme: 'Thème',
    'You need to select a parent directory to start using the app.':
        'Vous devez sélectionner un dossier parent pour commencer à utiliser l’application.',
    'There is no parent directory selected':
        "Aucun dossier parent n'est sélectionné",
    'This will change all Slides': 'Cela modifiera toutes les diapositives',
    'Time Second Delay:': 'Délai (secondes) :',
    'Time Second to Live:': "Durée d'affichage (secondes) :",
    Time: 'Heure',
    'Toggle Fading at End': 'Activer/désactiver le fondu à la fin',
    'Whether this video fades out as it ends':
        'Si cette vidéo s’estompe en fondu à la fin',
    Index: 'Numéro',
    'Toggle Wrap Text': 'Activer/désactiver le retour à la ligne',
    Transition: 'Transition',
    'Unsupported file type!': 'Type de fichier non pris en charge !',
    'Web Show': 'Affichage Web',
    'Width (%)': 'Largeur (%)',
    'Width (%):': 'Largeur (%) :',
    'Will reload the app to apply settings':
        "L'application sera rechargée pour appliquer les paramètres",
    'Slide Editor': 'Éditeur de diapositives',
    'Bible Reader': 'Lecteur biblique',
    'Add Bible Item': 'Ajouter un élément biblique',
    'Font Size': 'Taille de police',
    'Bulk Font': 'Police de plusieurs éléments',
    'Apply to text, Bible and HTML items.':
        'Appliquer aux éléments texte, Bible et HTML.',
    'Apply to': 'Appliquer à',
    'All Slides': 'Toutes les diapositives',
    'Choose slides and items': 'Choisir les diapositives et les éléments',
    'Apply Font Size': 'Appliquer la taille de police',
    'Apply Font Family': 'Appliquer la famille de police',
    'Include locked items': 'Inclure les éléments verrouillés',
    'Failed to apply font changes': 'Impossible de modifier la police',
    'No items needed updating': 'Aucun élément à modifier',
    'Updated items:': 'Éléments modifiés :',
    'Keep Open': 'Garder ouvert',
    'Should New Lines': 'Retours à la ligne',
    'Break lines following bible info':
        'Couper les lignes selon les informations de la Bible',
    'Use Model New Lines': 'Utiliser les retours à la ligne du modèle',
    'Break lines following model formatting':
        'Couper les lignes selon la mise en forme du modèle',
    '(dev)Experiment': '(dev)Expérience',
    'Video will fade at the end while screen rendering.':
        "La vidéo s'estompera à la fin pendant l'affichage à l'écran.",
    'Apply Settings': 'Appliquer les paramètres',
    Khmer: 'Khmer',
    English: 'Anglais',
    Background: 'Arrière-plan',
    'Slide transition': 'Transition de diapositive',
    'A stage above 0 cuts between slides, so the Slide transition was set to None.':
        'Une scène au-dessus de 0 passe d’une diapositive à l’autre sans transition : la transition de diapositive a donc été mise sur Aucun.',
    'Background transition': "Transition d'arrière-plan",
    // --- Transition overrides: a slides preview, a slide, a Background tab,
    // one background, a foreground component or one of its sessions can come
    // in with its own transition instead of the screen's.
    'Foreground transition': 'Transition de premier plan',
    'Own transition': 'Transition propre',
    'Canvas item transition': 'Transition de l’élément du canevas',
    'Used when changing slides.': 'Utilisée lors du changement de diapositive.',
    Follows: 'Suit',
    'Varies by screen': "Varie selon l'écran",
    'Screen setting': "Réglage de l'écran",
    'Slides preview': 'Aperçu des diapositives',
    'Slides preview transition': "Transition de l'aperçu des diapositives",
    'Every slide of this document comes in with it, unless the slide has its own.':
        'Chaque diapositive de ce document apparaît avec elle, sauf si la diapositive a la sienne.',
    'Every background from this tab comes in with it, unless the background has its own.':
        "Chaque arrière-plan de cet onglet apparaît avec elle, sauf si l'arrière-plan a la sienne.",
    'Marquee default': 'Par défaut du bandeau',
    'All sessions': 'Toutes les sessions',
    'Transition for all sessions': 'Transition pour toutes les sessions',
    'Every session of this panel comes in with it, unless the session has its own in Properties.':
        'Chaque session de ce panneau apparaît avec elle, sauf si la session a la sienne dans Propriétés.',
    'Clear input': 'Effacer la saisie',
    'Clear input chunk': 'Effacer une partie de la saisie',
    'Keep popup modal open when adding a bible item, useful in presenter mode':
        "Garder la fenêtre contextuelle ouverte lors de l'ajout d'un élément biblique, utile en mode Présentateur",
    'Canvas Items': 'Éléments du canevas',
    'Please change bible key here': 'Veuillez modifier la clé de la Bible ici',
    'Not available': 'Non disponible',
    'is not available!': "n'est pas disponible !",
    'Choose a folder': 'Choisir un dossier',
    'Moving File to Trash': 'Déplacement du fichier vers la corbeille',
    'Are you sure you want to move': 'Voulez-vous vraiment déplacer',
    'to trash?': 'vers la corbeille ?',
    Yes: 'Oui',
    No: 'Non',
    'will be converted to PDF into': 'sera converti en PDF dans',
    Align: 'Aligner',
    'All Files': 'Tous les fichiers',
    'AM/PM': 'AM/PM',
    AM: 'AM',
    PM: 'PM',
    'This camera could not be started. Another app may be using it.':
        "Impossible de démarrer cette caméra. Une autre application l'utilise peut-être.",
    'Apply this dimension to all slides in this document':
        'Appliquer cette dimension à toutes les diapositives de ce document',
    'Are you sure to apply this dimension to all slides?':
        'Voulez-vous vraiment appliquer cette dimension à toutes les diapositives ?',
    Auto: 'Auto',
    'Backdrop Filter': "Filtre d'arrière-plan",
    Blur: 'Flou',
    'Camera Error': 'Erreur de caméra',
    City: 'Ville',
    Collapse: 'Réduire',
    'Corner radius in pixels (0 to use %)':
        'Rayon des coins en pixels (0 pour utiliser %)',
    'Countdown Date': 'Date du compte à rebours',
    'Countdown Time': 'Heure du compte à rebours',
    'Count down for a duration': 'Décompter une durée',
    'Count down to a specific date & time':
        "Décompter jusqu'à une date et heure précises",
    'Count up from zero': 'Compter à partir de zéro',
    Delay: 'Délai',
    'Double click on header to edit':
        "Double-cliquer sur l'en-tête pour modifier",
    Expand: 'Développer',
    Export: 'Exporter',
    'Export Data': 'Exporter les données',
    'Import Data': 'Importer les données',
    'Choose the folders to export': 'Choisir les dossiers à exporter',
    'Choose the folders to import': 'Choisir les dossiers à importer',
    // Every export and import now opens a dialog, and the popup renders its
    // title through `tran` — so each flow's title needs an entry of its own.
    'Export Document': 'Exporter le document',
    'Import Document': 'Importer un document',
    'Export Bible List': 'Exporter la liste biblique',
    'Import Bible List': 'Importer une liste biblique',
    'Export Presenting Flow': 'Exporter le déroulé',
    'Import Presenting Flow': 'Importer un déroulé',
    'Export Bible Note Item': "Exporter l'élément de note biblique",
    'Import Bible Note Item': 'Importer un élément de note biblique',
    // The whole note FILE, as opposed to the two item keys above.
    'Export Bible Note': 'Exporter la note biblique',
    'Import Bible Note': 'Importer une note biblique',
    // The XML bibles of the Bible settings page, as their own bundle.
    'Bible Data': 'Données bibliques',
    'Export Bible Data': 'Exporter les données bibliques',
    'Import Bible Data': 'Importer les données bibliques',
    'Choose the bibles to export': 'Choisir les Bibles à exporter',
    'Choose the bibles to import': 'Choisir les Bibles à importer',
    'Drop an exported bible data file here to import':
        "Déposez ici un fichier de données bibliques exporté pour l'importer",
    // Why a row of the import picker is red and cannot be taken. An existing
    // bible is never overwritten and never duplicated beside itself.
    'Bible key already exists': 'La clé de Bible existe déjà',
    'Unable to read this bible file': 'Impossible de lire ce fichier biblique',
    'Duplicate bible key in this archive':
        'Clé de Bible en double dans cette archive',
    // Export Settings / Import Settings (the Settings window's sidebar), and
    // the sections of its tree (`settingArchiveCatalog.ts`).
    'Export Settings': 'Exporter les paramètres',
    'Import Settings': 'Importer les paramètres',
    'Export settings to a file': 'Exporter les paramètres dans un fichier',
    'Import settings from a file': "Importer les paramètres d'un fichier",
    'Choose the settings to export': 'Choisir les paramètres à exporter',
    'Choose the settings to import': 'Choisir les paramètres à importer',
    'Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default':
        'Chaque section cochée remplace la même section sur cet ordinateur ; ' +
        'ce que le fichier omet revient à sa valeur par défaut',
    'Type a password below to include these':
        'Saisissez un mot de passe ci-dessous pour les inclure',
    'This computer cannot keep them safely':
        'Cet ordinateur ne peut pas les conserver en sécurité',
    'Lets other devices connect to this computer':
        "Permet à d'autres appareils de se connecter à cet ordinateur",
    'All default': 'Tout par défaut',
    'Save or discard unsaved Bible changes before importing settings.':
        "Enregistrez ou abandonnez les modifications non enregistrées de la Bible avant d'importer les paramètres.",
    Folders: 'Dossiers',
    'File Color Notes': 'Couleurs des fichiers',
    'Reading View': 'Vue de lecture',
    'Open Passages': 'Passages ouverts',
    'Bible on Screen': "Bible à l'écran",
    'Screens & Monitors': 'Écrans et moniteurs',
    Transitions: 'Transitions',
    'Drawing & Spotlight': 'Dessin et projecteur',
    'PDF & Pages on Screen': "PDF et pages à l'écran",
    Marquee: 'Bandeau défilant',
    'Messages & Quick Text': 'Messages et texte rapide',
    'Timers & Clocks': 'Minuteurs et horloges',
    'Image, Video & Web Shows':
        "Affichages d'images, de vidéos et de sites web",
    'Foreground Panel': 'Panneau de premier plan',
    'Background Panel': "Panneau d'arrière-plan",
    'Documents & Lyrics': 'Documents et chants',
    Editors: 'Éditeurs',
    Layout: 'Disposition',
    'Panel Sizes': 'Tailles des panneaux',
    'Panel Sizes per Document': 'Tailles des panneaux par document',
    'Windows & Pages': 'Fenêtres et pages',
    'AI & Assistant': 'IA et assistant',
    Connections: 'Connexions',
    'Screen Mirror & Virtual Displays': 'Écran miroir et affichages virtuels',
    'API Keys & Sign-ins': 'Clés API et connexions',
    'AI Keys': 'Clés IA',
    SongSelect: 'SongSelect',
    'Connection Codes': 'Codes de connexion',
    'Other Settings': 'Autres paramètres',
    // The two bodies every export/import toast is built from. The path or the
    // name goes on AFTER the translation, never into the key.
    'Exported to': 'Exporté vers',
    Imported: 'Importé',
    'Imported {copied} file(s); {reused} already up to date':
        '{copied} fichier(s) importé(s) ; {reused} déjà à jour',
    // The optional password protection on every export.
    Password: 'Mot de passe',
    'Confirm Password': 'Confirmer le mot de passe',
    'Show Password': 'Afficher le mot de passe',
    'Hide Password': 'Masquer le mot de passe',
    'Leave empty to export without a password':
        'Laisser vide pour exporter sans mot de passe',
    'Passwords do not match': 'Les mots de passe ne correspondent pas',
    'This archive is password protected':
        'Cette archive est protégée par mot de passe',
    'Wrong password, try again': 'Mot de passe incorrect, veuillez réessayer',
    'Select All': 'Tout sélectionner',
    'Deselect All': 'Tout désélectionner',
    'Nothing is selected': 'Aucune sélection',
    'Fail to get data for': 'Échec de la récupération des données pour',
    'Font size in pixels': 'Taille de police en pixels',
    'Glass Effect': 'Effet verre',
    "Insert today's date as the marquee bottom text":
        'Insérer la date du jour comme texte du bandeau défilant bas',
    "Insert today's date as the marquee top text":
        'Insérer la date du jour comme texte du bandeau défilant haut',
    'Label shown above the time': "Libellé affiché au-dessus de l'heure",
    Live: 'En direct',
    Markdown: 'Markdown',
    'Marquee Bottom font size (0 = auto)':
        'Taille de police du bandeau défilant bas (0 = auto)',
    'Marquee Bottom scroll speed (%)': 'Vitesse du bandeau défilant bas (%)',
    'Marquee Top font size (0 = auto)':
        'Taille de police du bandeau défilant haut (0 = auto)',
    'Marquee Top scroll speed (%)': 'Vitesse du bandeau défilant haut (%)',
    Missing: 'Manquant',
    Name: 'Nom',
    'No languages available.': 'Aucune langue disponible.',
    'No pages to display': 'Aucune page à afficher',
    Normal: 'Normal',
    Opacity: 'Opacité',
    'Pick a city to set its timezone':
        'Choisir une ville pour définir son fuseau horaire',
    'Please install the missing fonts from the opened pages. and restart the app after installation.':
        "Veuillez installer les polices manquantes depuis les pages ouvertes, puis redémarrer l'application après l'installation.",
    'Position offset in pixels': 'Décalage de position en pixels',
    'Preview BG:': "Arrière-plan d'aperçu :",
    'Quick font size': 'Taille de police rapide',
    'Quick scroll speed': 'Vitesse de défilement rapide',
    'Return to Presenter': 'Retourner au Présentateur',
    'Open Worship slide required': 'Diapositive Open Worship requise',
    'The selected document is not an Open Worship slide. Return to Presenter?':
        "Le document sélectionné n'est pas une diapositive Open Worship. Retourner au Présentateur ?",
    'Seconds the text stays on screen':
        "Secondes d'affichage du texte à l'écran",
    'Seconds to wait before showing the text':
        "Secondes d'attente avant d'afficher le texte",
    Size: 'Taille',
    'Slide Id': 'ID de diapositive',
    'Slide index': 'Index de diapositive',
    'This key will be used in custom Bible Cross Ref':
        'Cette clé sera utilisée dans les références croisées bibliques personnalisées',
    'This key will be used in custom Bible Cross Ref and Bible Audio':
        "Cette clé sera utilisée dans les références croisées bibliques personnalisées et l'audio biblique",
    "Today's Date": 'Date du jour',
    'Unable to access the camera for background. Please check your camera settings.':
        "Impossible d'accéder à la caméra pour l'arrière-plan. Veuillez vérifier les paramètres de votre caméra.",
    'Use Current Timezone': 'Utiliser le fuseau horaire actuel',
    'Use this device’s timezone': 'Utiliser le fuseau horaire de cet appareil',
    'UTC Offset': 'Décalage UTC',
    'Start Controlling': 'Démarrer le contrôle',
    'Presenting Control': 'Contrôle de présentation',
    'Presenting tool': 'Outil de présentation',
    Color: 'Couleur',
    'Stroke style': 'Style de trait',
    Straight: 'Droit',
    '3D': '3D',
    Dots: 'Points',
    HQ: 'HQ',
    Fast: 'Rapide',
    Hold: 'Maintenir',
    Follow: 'Suivre',
    Contrast: 'Contraste',
    'High quality drawing (anti-aliased, slower)':
        'Dessin haute qualité (anticrénelé, plus lent)',
    'Fast drawing (lighter, less smooth)':
        'Dessin rapide (plus léger, moins lisse)',
    'Toggle drawing quality': 'Basculer la qualité du dessin',
    'Reset settings': 'Réinitialiser les paramètres',
    'Drag over the drawing to rub it out':
        "Faites glisser sur le dessin pour l'effacer",
    'Drag anywhere on the app to draw':
        "Faites glisser n'importe où sur l'application pour dessiner",
    'Spotlight size': 'Taille du spot',
    'Dim color': "Couleur d'assombrissement",
    'Dim the rest of the app': "Assombrir le reste de l'application",
    'Spotlight edge blur (0 = hard edge)':
        'Flou du bord du spot (0 = bord net)',
    'Contrast: the circle blocks what the pointer is over':
        'Contraste : le cercle masque ce que survole le pointeur',
    'Spotlight: the circle reveals what the pointer is over':
        'Spot : le cercle révèle ce que survole le pointeur',
    'Hold: dim only while the button is down':
        "Maintenir : assombrir seulement pendant l'appui sur le bouton",
    'Follow: the spotlight tracks the pointer':
        'Suivre : le spot suit le pointeur',
    'Hold to spotlight': 'Maintenir pour mettre en lumière',
    'Press and hold on the app to spotlight':
        "Appuyez longuement sur l'application pour mettre en lumière",
    'Move over the app to spotlight':
        "Survolez l'application pour mettre en lumière",
    'Use the app (drawing stays on top)':
        "Utiliser l'application (le dessin reste par-dessus)",
    'Draw on the app': "Dessiner sur l'application",
    'Erase parts of the drawing': 'Effacer des parties du dessin',
    'Spotlight part of the app':
        "Mettre en lumière une partie de l'application",
    'Keyboard screencast': 'Affichage des touches',
    'Available while using the app':
        "Disponible pendant l'utilisation de l'application",
    'Show the keys being pressed': 'Afficher les touches pressées',
    'Drawing history': 'Historique du dessin',
    'Clear drawing': 'Effacer le dessin',
    // The Presenting Control's snapshot, and the three things it can do with
    // the picture it takes.
    'Take a picture of the app': "Prendre une capture de l'application",
    'App Snapshot': "Capture de l'application",
    'Ask the assistant about this': "Interroger l'assistant à ce sujet",
    'Save into your images': 'Enregistrer dans vos images',
    'Copied to clipboard': 'Copié dans le presse-papiers',
    'Saved into your images': 'Enregistré dans vos images',
    'No images folder is set yet': "Aucun dossier d'images n'est encore défini",
    'Cannot save this picture': "Impossible d'enregistrer cette image",
    'Paste Bible Item': "Coller l'élément biblique",
    Unlock: 'Déverrouiller',
    Lock: 'Verrouiller',
    Left: 'Gauche',
    Top: 'Haut',
    Width: 'Largeur',
    Height: 'Hauteur',
    'Horizontal alignment': 'Alignement horizontal',
    'Text align left': 'Aligner le texte à gauche',
    'Text align top': 'Aligner le texte en haut',
    'Text align middle': 'Aligner le texte au milieu',
    'Text align bottom': 'Aligner le texte en bas',
    'Text align center': 'Centrer le texte',
    'Text align right': 'Aligner le texte à droite',
    'Align left': 'Aligner à gauche',
    'Align center': 'Aligner au centre',
    'Align right': 'Aligner à droite',
    'Vertical alignment': 'Alignement vertical',
    'Align top': 'Aligner en haut',
    'Align middle': 'Aligner au milieu',
    'Align bottom': 'Aligner en bas',
    'Box Layer': 'Calque de la zone',
    'Send backward': "Reculer d'un plan",
    'Bring forward': "Avancer d'un plan",
    Saved: 'Enregistré',
    'Saved current text': 'Texte actuel enregistré',
    'Delete this saved session': 'Supprimer cette session enregistrée',
    'Save the current text as a session':
        'Enregistrer le texte actuel comme session',
    'Pick a previously saved session': 'Choisir une session enregistrée',
    'Nothing to save: the text is empty':
        'Rien à enregistrer : le texte est vide',
    'This text is already the latest saved session':
        'Ce texte est déjà la dernière session enregistrée',
    'Replace the current text with this saved session? Your current unsaved text will be lost.':
        'Remplacer le texte actuel par cette session enregistrée ? Votre texte actuel non enregistré sera perdu.',
    'Manual eraser': 'Gomme manuelle',
    'Manual eraser: drag over the drawing to rub out parts of it, or back to painting':
        'Gomme manuelle : faites glisser sur le dessin pour en effacer des parties, ou revenez au dessin',
    'Dim the rest of the screen': "Assombrir le reste de l'écran",
    'Release to stop': 'Relâcher pour arrêter',
    'Press and hold on the screen to spotlight':
        "Appuyez longuement sur l'écran pour mettre en lumière",
    'Choose Drawing or Focusing': 'Choisir Dessin ou Focalisation',
    Drawing: 'Dessin',
    Focusing: 'Focalisation',
    'Missing fonts': 'Polices manquantes',
    'these fonts are not installed on your system, slides may not render as intended. Click a font to search for it:':
        "ces polices ne sont pas installées sur votre système, les diapositives risquent de ne pas s'afficher comme prévu. Cliquez sur une police pour la rechercher :",
    'Search for font': 'Rechercher la police',
    'Full view': 'Vue complète',
    'Exit full view': 'Quitter la vue complète',
    'Full size preview': 'Aperçu en pleine taille',
    'Exit full size preview': "Quitter l'aperçu en pleine taille",
    'Pin document': 'Épingler le document',
    'Unpin document': 'Désépingler le document',
    'Document is pinned': 'Le document est épinglé',
    'Unpin the document to preview another one':
        'Désépinglez le document pour en prévisualiser un autre',
    'Media playing': 'Lecture de média en cours',
    'Media is Playing': 'Un média est en cours de lecture',
    'Please pause all audio and video before leaving the page.':
        'Veuillez mettre en pause tous les audios et vidéos avant de quitter la page.',
    Undo: 'Annuler',
    Redo: 'Rétablir',
    'Undo Saved Change': 'Annuler la modification du fichier',
    'Redo Saved Change': 'Rétablir la modification du fichier',
    Help: 'Aide',
    'Bible Properties': 'Propriétés de la Bible',
    'Thumbnail View': 'Vue en miniatures',
    'List View': 'Vue en liste',
    // --- Untranslated UI strings routed through tran() (audit 2026-08-08).
    '(Under development, please use XML instead)':
        '(En cours de développement, veuillez utiliser XML à la place)',
    'Adding bible': 'Ajout de la Bible',
    'Adding Bible Item': "Ajout d'un élément biblique",
    'Adding Presenting Flow Action': "Ajout d'une action au déroulé",
    'Already in XML': 'Déjà en XML',
    'Background Color': "Couleur d'arrière-plan",
    'Hit "Escape" to jump back to editing input':
        'Appuyez sur "Échap" pour revenir à la saisie',
    'Bible Cross Reference': 'Référence croisée biblique',
    'Bible Download': 'Téléchargement de Bible',
    'Bible extracted': 'Bible extraite',
    'Bible Item': 'Élément biblique',
    'Bible item is added': "L'élément biblique a été ajouté",
    'Bible item is inserted into the editing slide':
        "L'élément biblique a été inséré dans la diapositive en cours de modification",
    'Bible Reference': 'Référence biblique',
    'Bible Text to Speech': 'Synthèse vocale de la Bible',
    'Book Chapter': 'Chapitre du livre',
    // A pane title's parts and the pickers they open.
    Book: 'Livre',
    Chapter: 'Chapitre',
    'Verse Start': 'Verset de début',
    'Verse End': 'Verset de fin',
    'End Chapter': 'Chapitre de fin',
    'Show the next chapter': 'Afficher le chapitre suivant',
    'Books map': 'Correspondance des livres',
    'Box Alignment': 'Alignement de la zone',
    'Box Properties': 'Propriétés de la zone',
    'Cannot find Bible Item': 'Élément biblique introuvable',
    'Cannot find Note Item': 'Élément de note introuvable',
    'Cannot source Bible': 'Impossible de charger la Bible',
    'Cannot source Note': 'Impossible de charger la note',
    'Canvas item not found': 'Élément du canevas introuvable',
    'Canvas Scale': 'Échelle du canevas',
    'Center view': 'Centrer la vue',
    'Chapter data not found.': 'Données du chapitre introuvables.',
    'Choose Bible Books': 'Choisir les livres de la Bible',
    'Choose Locale': 'Choisir la langue',
    'Clear url': "Effacer l'URL",
    'Click to edit this section': 'Cliquez pour modifier cette section',
    'Click to reveal the bible notes of this verse, double click to select verse':
        'Cliquez pour afficher les notes bibliques de ce verset, double-cliquez pour sélectionner le verset',
    'Color Note': 'Note de couleur',
    'Converting to PDF': 'Conversion en PDF',
    'Copy Color': 'Copier la couleur',
    'Copy Error Json': "Copier le Json de l'erreur",
    'Create New Web File': 'Créer un nouveau fichier web',
    'Creating Presenting Flow': 'Création du déroulé',
    'Delete Bible': 'Supprimer la Bible',
    'Delete Bible XML': 'Supprimer le XML de la Bible',
    'Are you sure to delete bible XML "{key}"?':
        'Voulez-vous vraiment supprimer le XML de la Bible « {key} » ?',
    'Are you sure to delete bible "{title}"?':
        'Voulez-vous vraiment supprimer la Bible « {title} » ?',
    'Reset Bible XML': 'Réinitialiser le XML de la Bible',
    'Reset this bible XML with the app embedded KJV?':
        "Réinitialiser le XML de cette Bible avec la KJV intégrée à l'application ?",
    'All your changes will be lost.':
        'Toutes vos modifications seront perdues.',
    'Delete Canvas Items': 'Supprimer les éléments du canevas',
    Deleting: 'Suppression en cours',
    'Document downloaded successfully': 'Document téléchargé avec succès',
    'Document Note': 'Note du document',
    'Download Error': 'Erreur de téléchargement',
    'Downloaded Bible List': 'Liste des Bibles téléchargées',
    'Drag onto the canvas to add a guide line':
        'Faites glisser sur le canevas pour ajouter un repère',
    'Drag to move, double-click to remove':
        'Faites glisser pour déplacer, double-cliquez pour retirer',
    'Drag to resize': 'Faites glisser pour redimensionner',
    'Duplicating File': 'Duplication du fichier',
    'Edit Books Map': 'Modifier la correspondance des livres',
    'Edit Canvas Item': "Modifier l'élément du canevas",
    'Edit Numbers Map': 'Modifier la correspondance des nombres',
    'Error occurred during downloading audio':
        "Erreur lors du téléchargement de l'audio",
    'Error occurred during downloading document':
        'Erreur lors du téléchargement du document',
    'Error occurred during downloading image':
        "Erreur lors du téléchargement de l'image",
    'Error occurred during downloading video':
        'Erreur lors du téléchargement de la vidéo',
    'Error occurred during finishing bible download':
        'Erreur lors de la finalisation du téléchargement de la Bible',
    'Error occurred during generating file name':
        'Erreur lors de la génération du nom de fichier',
    'Error occurred during pasting image': "Erreur lors du collage de l'image",
    'Error occurred during reading file':
        'Erreur lors de la lecture du fichier',
    'Error occurred during saving to XML':
        "Erreur lors de l'enregistrement en XML",
    Extra: 'Suppléments',
    'Extracting Bible': 'Extraction de la Bible',
    'Fail to add bible item': "Échec de l'ajout de l'élément biblique",
    'Fail to add bible to list': "Échec de l'ajout de la Bible à la liste",
    'Fail to delete downloaded file':
        'Échec de la suppression du fichier téléchargé',
    'Fail to ensure data directory for AI data.':
        "Échec de la préparation du dossier de données pour les données d'IA.",
    'Fail to extract bible': "Échec de l'extraction de la Bible",
    'Fail to fetch bible online':
        'Échec de la récupération de la Bible en ligne',
    'Fail to get Anthropic instance':
        "Échec de l'obtention de l'instance Anthropic",
    'Fail to get bible item data':
        "Échec de la récupération des données de l'élément biblique",
    'Fail to get bible list': 'Échec de la récupération de la liste des Bibles',
    'Fail to get default bible file':
        'Échec de la récupération du fichier de Bible par défaut',
    'Fail to get default note file':
        'Échec de la récupération du fichier de notes par défaut',
    'Fail to get OpenAI instance': "Échec de l'obtention de l'instance OpenAI",
    'Fail to insert image': "Échec de l'insertion de l'image",
    'Fail to insert media link': "Échec de l'insertion du lien média",
    'Fail to insert medias': "Échec de l'insertion des médias",
    'Fail to insert website': "Échec de l'insertion du site web",
    'Fail to insert camera': "Échec de l'insertion de la caméra",
    'Fail to insert YouTube': "Échec de l'insertion de YouTube",
    'Failed to convert KJV Bible data to XML text.':
        'Échec de la conversion des données de la Bible KJV en texte XML.',
    'Failed to parse XML data': "Échec de l'analyse des données XML",
    'Failed to save image': "Échec de l'enregistrement de l'image",
    'Fetching Bible Finding Online':
        'Récupération des résultats de recherche en ligne',
    'File already exists': 'Le fichier existe déjà',
    'file name': 'nom de fichier',
    'Close find': 'Fermer la recherche',
    'Drag to move the find panel':
        'Faites glisser pour déplacer le panneau de recherche',
    'Match case': 'Respecter la casse',
    'Match count': 'Nombre de résultats',
    'Next match': 'Résultat suivant',
    'Previous match': 'Résultat précédent',
    'Fit to canvas': 'Ajuster au canevas',
    Font: 'Police',
    'Fork me on GitHub': 'Forkez-moi sur GitHub',
    'Format Submit Error': 'Erreur de soumission du format',
    'Getting Bible Info': 'Récupération des informations de la Bible',
    'Getting bible list': 'Récupération de la liste des Bibles',
    'Getting Default Bible File': 'Récupération du fichier de Bible par défaut',
    'Getting Default Note File': 'Récupération du fichier de notes par défaut',
    'Guessing keys:': 'Clés devinées :',
    'Guessing Names': 'Déduction des noms',
    Hours: 'Heures',
    Info: 'Infos',
    'Instantiating Bible Item': "Création de l'élément biblique",
    'Instantiating Note Item': "Création de l'élément de note",
    'Instantiating Presenting Flow Item': "Création de l'élément du déroulé",
    'Instantiating Slide': 'Création de la diapositive',
    'Invalid file name': 'Nom de fichier invalide',
    'Invalid URL': 'URL invalide',
    'Item ID:': "ID de l'élément :",
    'Jumping Chapter': 'Passage au chapitre',
    'Try Next Chapter': 'Essayer le chapitre suivant',
    'Try Previous Chapter': 'Essayer le chapitre précédent',
    'Unable to find next chapter': 'Impossible de trouver le chapitre suivant',
    'Unable to find previous chapter':
        'Impossible de trouver le chapitre précédent',
    'Leave a markdown text here': 'Saisissez du texte Markdown ici',
    'Leave a marquee bottom text here':
        'Saisissez ici le texte du bandeau défilant bas',
    'Leave a marquee top text here':
        'Saisissez ici le texte du bandeau défilant haut',
    'LibreOffice is not installed': "LibreOffice n'est pas installé",
    Locked: 'Verrouillé',
    'Locked items cannot be deleted':
        'Les éléments verrouillés ne peuvent pas être supprimés',
    Minutes: 'Minutes',
    'Missing Anthropic API Key.': 'Clé API Anthropic manquante.',
    'Missing OpenAI API Key.': 'Clé API OpenAI manquante.',
    'Move Bible Item': "Déplacer l'élément biblique",
    'Move Note Item': "Déplacer l'élément de note",
    'Moving Bible Item': "Déplacement de l'élément biblique",
    'Moving Note Item': "Déplacement de l'élément de note",
    Next: 'Suivant',
    'No bible downloaded': 'Aucune Bible téléchargée',
    'No Data': 'Aucune donnée',
    'No data to process': 'Aucune donnée à traiter',
    'No other bibles found': 'Aucune autre Bible trouvée',
    'No other notes found': 'Aucune autre note trouvée',
    'No other slide found in the slide directory':
        'Aucune autre diapositive trouvée dans le dossier des diapositives',
    'No Slide Available': 'Aucune diapositive disponible',
    'Online Bible List': 'Liste des Bibles en ligne',
    'Only image, video and audio files are supported':
        'Seuls les fichiers image, vidéo et audio sont pris en charge',
    'Only image, video and audio links are supported':
        'Seuls les liens image, vidéo et audio sont pris en charge',
    'Open Folder': 'Ouvrir le dossier',
    'Open Note Item Context Menu':
        "Ouvrir le menu contextuel de l'élément de note",
    'Open Wiki Dictionary': 'Ouvrir le dictionnaire Wiki',
    'Parsing XML': 'Analyse du XML',
    'Pasting Image': "Collage de l'image",
    'PDF Document': 'Document PDF',
    'Play to bottom': "Défiler jusqu'en bas",
    'Toggle Bible Audio': 'Activer ou désactiver l’audio de la Bible',
    'Please open a folder first': "Veuillez d'abord ouvrir un dossier",
    'Please select an Open Worship slide first':
        "Veuillez d'abord sélectionner une diapositive Open Worship",
    'Position & Size': 'Position et taille',
    'PowerPoint Document': 'Document PowerPoint',
    'Preview Size Scale': "Échelle de l'aperçu",
    'Stop rendering preview': "Arrêter le rendu de l'aperçu",
    'Resume rendering preview': "Reprendre le rendu de l'aperçu",
    'No rendering': 'Aucun rendu',
    Previous: 'Précédent',
    'Reset Date and Time to Now':
        "Réinitialiser à la date et l'heure actuelles",
    'That date and time has already passed':
        'Cette date et cette heure sont déjà passées',
    'Pick a date and time later than now, or press Reset.':
        'Choisissez une date et une heure après maintenant, ou appuyez sur Réinitialiser.',
    'Rotate:': 'Rotation :',
    'Saving Bible Data': 'Enregistrement des données de la Bible',
    'Saving File': 'Enregistrement du fichier',
    'Scroll to the top': 'Revenir en haut',
    'Click or Double Click to scroll to the top':
        'Cliquez ou double-cliquez pour revenir en haut',
    'Click to scroll to the bottom, double click to speed up, right click to slow down, Alt + right click to stop':
        "Cliquez pour défiler jusqu'en bas, double-cliquez pour accélérer, clic droit pour ralentir, Alt + clic droit pour arrêter",
    'Auto Scroll Options': 'Options de défilement automatique',
    'Auto Scroll Speed': 'Vitesse de défilement automatique',
    'Speed Up': 'Accélérer',
    'Speed Up Faster': 'Accélérer davantage',
    'Slow Down': 'Ralentir',
    'Stop Auto Scrolling': 'Arrêter le défilement automatique',
    Click: 'Clic',
    'Double Click': 'Double-clic',
    'Right Click': 'Clic droit',
    'Alt + Right Click': 'Alt + clic droit',
    'Seek Item': "Localiser l'élément",
    'Select custom color': 'Choisir une couleur personnalisée',
    'Set according paths': 'Définir les chemins correspondants',
    'Set round size pixel to 0 to use this':
        "Réglez l'arrondi (en pixels) sur 0 pour utiliser ceci",
    'Set to original size': "Remettre à la taille d'origine",
    'Shape Properties': 'Propriétés de la forme',
    'Slide Note': 'Note de diapositive',
    'Target bible not found': 'Bible cible introuvable',
    'Target note not found': 'Note cible introuvable',
    'Text Alignment': 'Alignement du texte',
    'Text has been copied to clipboard':
        'Le texte a été copié dans le presse-papiers',
    'Text Properties': 'Propriétés du texte',
    'Text to Speech': 'Synthèse vocale',
    'This bible is already in XML': 'Cette Bible est déjà au format XML',
    'This item is locked': 'Cet élément est verrouillé',
    'Thumbnail Size': 'Taille des miniatures',
    title: 'titre',
    'Toggle Always On Top': 'Activer/désactiver Toujours visible',
    'Toggle full screen failed': 'Échec du basculement en plein écran',
    'Type the slide text here': 'Saisissez le texte de la diapositive ici',
    'Unable to duplicate file': 'Impossible de dupliquer le fichier',
    'Unable to export BibleNote item':
        "Impossible d'exporter l'élément BibleNote",
    'Unable to find the target bible item':
        "Impossible de trouver l'élément biblique cible",
    'Unable to get bible': "Impossible d'obtenir la Bible",
    'Unable to get bible info list':
        "Impossible d'obtenir la liste des informations des Bibles",
    'Unable to get downloaded bible list':
        "Impossible d'obtenir la liste des Bibles téléchargées",
    'Unable to get note': "Impossible d'obtenir la note",
    'Unable to import BibleNote item':
        "Impossible d'importer l'élément BibleNote",
    'Unable to read file': 'Impossible de lire le fichier',
    'Unable to seek bible item': "Impossible de localiser l'élément biblique",
    'Unfixable Error': 'Erreur irrécupérable',
    'Unsupported image data': "Données d'image non prises en charge",
    Update: 'Mettre à jour',
    'URL already exists': "L'URL existe déjà",
    'Wiki Dictionary': 'Dictionnaire Wiki',
    'Word Document': 'Document Word',
    // --- Names & locations lookup panel (`src/location-name-lookup`).
    // Note `All Types` above
    // already covers the panel's "All types" option after key sanitization.
    'Names and locations lookup': 'Recherche de noms et de lieux',
    // The language the lookup DATASET is read in, which is a separate
    // choice from the language of the interface.
    'Names and locations language': 'Langue des noms et des lieux',
    // Tooltip of that language code while it is red: the bible being read is
    // in another language.
    'Not the language of the Bible': 'Pas la langue de la Bible',
    Names: 'Noms',
    Locations: 'Lieux',
    'Search names': 'Rechercher des noms',
    'Search locations': 'Rechercher des lieux',
    'Search verses': 'Rechercher des versets',
    'Clear search': 'Effacer la recherche',
    'Filter by name type': 'Filtrer par type de nom',
    'Type filter applies to names only':
        "Le filtre par type ne s'applique qu'aux noms",
    'No matches': 'Aucun résultat',
    'Jump to page': 'Aller à la page',
    'Type a page number and press Enter':
        'Saisissez un numéro de page et appuyez sur Entrée',
    'Loading lookup data': 'Chargement des données de recherche',
    'Failed to load lookup data':
        'Échec du chargement des données de recherche',
    // The bible lookup side-panel tab listing what is in the verses on screen.
    'Location-Name (KJV)': 'Lieu-Nom (KJV)',
    'Names and locations in your reading': 'Noms et lieux de votre lecture',
    // Name-type filter options.
    Concepts: 'Concepts',
    Deities: 'Divinités',
    Groups: 'Groupes',
    Life: 'Vie',
    Months: 'Mois',
    People: 'Personnes',
    Places: 'Lieux',
    Supernatural: 'Surnaturel',
    Unknown: 'Inconnu',
    // The same nine types named ONE at a time, for a single record's `Type` row
    // and its fact chip. `Life`, `Supernatural` and `Unknown` read the same
    // either way and are not repeated — a duplicate key throws on module load.
    Concept: 'Concept',
    Deity: 'Divinité',
    Group: 'Groupe',
    Month: 'Mois',
    Person: 'Personne',
    Place: 'Lieu',
    // A name's `gender` and a location's `type`: both kept in English by every
    // dataset (`GENDER_LABEL`, `LOCATION_TYPE_LABEL`). `City` and `Place`
    // already exist and are not repeated — a duplicate throws on module load.
    Male: 'Homme',
    Female: 'Femme',
    Battlefield: 'Champ de bataille',
    Camp: 'Camp',
    Cape: 'Cap',
    Cliff: 'Falaise',
    Encampment: 'Campement',
    Gate: 'Porte',
    Heights: 'Hauteurs',
    Island: 'Île',
    Landmark: 'Repère',
    'Memorial place': 'Lieu commémoratif',
    Mountain: 'Montagne',
    Plain: 'Plaine',
    Pool: 'Bassin',
    Region: 'Région',
    River: 'Rivière',
    Road: 'Route',
    Sea: 'Mer',
    Settlement: 'Localité',
    Site: 'Site',
    Spring: 'Source',
    Street: 'Rue',
    Stronghold: 'Forteresse',
    Territory: 'Territoire',
    Tower: 'Tour',
    Town: 'Bourg',
    Valley: 'Vallée',
    'Body of water': "Étendue d'eau",
    Well: 'Puits',
    Wilderness: 'Désert',
    // A name's `age` and its year ranges, also English in every dataset
    // (`AGE_PATTERN_LIST`, `YEAR_RANGE_TYPE_LABEL`). `{count}` and `{year}` are
    // put back in by the caller.
    '{count} years': '{count} ans',
    '{count} at accession': '{count} ans à son avènement',
    'about {count} at start of ministry':
        'environ {count} ans au début de son ministère',
    Reign: 'Règne',
    Coregency: 'Corégence',
    '{year} BC': '{year} av. J.-C.',
    // Record detail panel. `Title`, `Type`, `Copy` and `Copied` already exist
    // above and resolve after key sanitization, so they are not repeated here —
    // a duplicate would throw when this module loads.
    'Record not found': 'Fiche introuvable',
    Details: 'Détails',
    'Also called': 'Aussi appelé',
    Gender: 'Sexe',
    Age: 'Âge',
    Years: 'Années',
    Parents: 'Parents',
    Spouses: 'Conjoints',
    Children: 'Enfants',
    Siblings: 'Frères et sœurs',
    Cousins: 'Cousins',
    Verse: 'Verset',
    Verses: 'Versets',
    Links: 'Liens',
    'Modern identification': 'Identification moderne',
    'Related locations': 'Lieux associés',
    Coordinates: 'Coordonnées',
    'Approximate location, the marker is an estimated point':
        'Emplacement approximatif, le repère est un point estimé',
    'Open in Google Maps': 'Ouvrir dans Google Maps',
    'Open in bible lookup': 'Ouvrir dans la recherche biblique',
    // A verse detail panel's `(KJV)`: opens the verse in a panel of its own
    // in another installed bible.
    'Open in another Bible': 'Ouvrir dans une autre Bible',
    'Show more': 'Afficher plus',
    // The bible translation info popup, opened from the lookup pane header while
    // no verse has resolved yet. `Title` already exists above and resolves after
    // key sanitization, so it is not repeated here — a duplicate would throw
    // when this module loads.
    'Bible Information': 'Informations sur la Bible',
    Key: 'Clé',
    Version: 'Version',
    Locale: 'Langue',
    Publisher: 'Éditeur',
    'Copy Rights': "Droits d'auteur",
    'Legal Note': 'Mention légale',
    Description: 'Description',
    Books: 'Livres',
    // --- The on-demand media tools pack (Settings > Others > Extra Binaries),
    // and the dialog that sends a user there when they try to download a video
    // or audio without it (2026-08-10).
    // --- Settings > Others, reworked into three service rows (2026-08-24).
    // The state pill of each row speaks that service's own vocabulary rather
    // than one shared word, so the label matches the button that changes it.
    'AI Providers': "Fournisseurs d'IA",
    'Add a key from either provider to use custom Bible Cross Ref and Bible Audio.':
        "Ajoutez une clé de l'un des fournisseurs pour utiliser les références croisées et l'audio biblique personnalisés.",
    'Key set': 'Clé définie',
    'No key set': 'Aucune clé définie',
    // --- Kimi joins the chatbot, and every AI row now says what its key is
    // actually FOR (2026-09-01). The two hints it replaces both named Bible
    // Cross Ref and Bible Audio and forgot the chatbot, which they also drive.
    Kimi: 'Kimi',
    'Kimi API Key': 'Clé API Kimi',
    'Create Kimi api key': 'Créer une clé API Kimi',
    'Answers in the chatbot only':
        "Répond uniquement dans l'assistant conversationnel",
    'Answers in the chatbot, and powers custom Bible Cross Reference':
        "Répond dans l'assistant conversationnel et alimente les références croisées personnalisées",
    'Answers in the chatbot, and powers custom Bible Cross Reference and Bible Audio':
        "Répond dans l'assistant conversationnel et alimente les références croisées et l'audio biblique personnalisés",
    'Used by': 'Utilisé par',
    Chatbot: 'Assistant conversationnel',
    'Bible Audio': 'Audio biblique',
    'Add a key from any one of these. Each row says what its key is used for.':
        "Ajoutez une clé de l'un de ces fournisseurs. Chaque ligne indique à quoi sert sa clé.",
    'Fail to get Kimi instance': "Impossible d'obtenir l'instance Kimi",
    'Missing Kimi API Key.': 'Clé API Kimi manquante.',
    // --- Amazon Bedrock joins the chatbot (2026-10-09), Gemma 4 31B first.
    'Amazon Bedrock': 'Amazon Bedrock',
    'Amazon Bedrock API Key': 'Clé API Amazon Bedrock',
    'Create Amazon Bedrock api key': 'Créer une clé API Amazon Bedrock',
    'Fail to get Amazon Bedrock instance':
        "Impossible d'obtenir l'instance Amazon Bedrock",
    'Missing Amazon Bedrock API Key.': 'Clé API Amazon Bedrock manquante.',
    'AWS Region': 'Région AWS',
    'The region your Bedrock models are enabled in':
        'La région où vos modèles Bedrock sont activés',
    // --- The user's own model servers (LM Studio, Ollama, ...) (2026-10-09).
    'Custom servers': 'Serveurs personnalisés',
    'Your own AI server, such as LM Studio or Ollama on this computer, or any service that speaks the OpenAI API. Each server shows in the chatbot as its own assistant.':
        "Votre propre serveur d'IA, comme LM Studio ou Ollama sur cet ordinateur, ou tout service compatible avec l'API OpenAI. Chaque serveur apparaît dans l'assistant conversationnel comme un assistant à part.",
    'Add server': 'Ajouter un serveur',
    // --- The servers the project's site shares, listed read-only (2026-10-10).
    'Shared servers': 'Serveurs partagés',
    'Servers that openworship.app shares with every copy of the app. They are read-only here, and each one shows in the chatbot as its own assistant.':
        "Serveurs qu'openworship.app partage avec chaque copie de l'application. Ils sont en lecture seule ici, et chacun apparaît dans l'assistant conversationnel comme un assistant à part.",
    'Reload the shared servers': 'Recharger les serveurs partagés',
    'The last read failed:': 'La dernière lecture a échoué :',
    'Last read at': 'Dernière lecture à',
    'No server is shared right now.':
        "Aucun serveur n'est partagé pour le moment.",
    'Shared by openworship.app. It cannot be changed here.':
        'Partagé par openworship.app. Il ne peut pas être modifié ici.',
    'New server': 'Nouveau serveur',
    'Delete this server': 'Supprimer ce serveur',
    'Server name': 'Nom du serveur',
    'The name the chatbot shows for this server, such as LM Studio':
        "Le nom que l'assistant conversationnel affiche pour ce serveur, par exemple LM Studio",
    'Base URL': 'URL de base',
    'The address that ends in /v1, such as http://localhost:1234/v1 for LM Studio or http://localhost:11434/v1 for Ollama':
        "L'adresse qui se termine par /v1, par exemple http://localhost:1234/v1 pour LM Studio ou http://localhost:11434/v1 pour Ollama",
    'Address corrected to': 'Adresse corrigée en',
    'API key (optional)': 'Clé API (facultative)',
    'Only if the server asks for one. It is stored encrypted and never shown to the chatbot window.':
        "Seulement si le serveur en demande une. Elle est chiffrée et jamais transmise à la fenêtre de l'assistant.",
    Test: 'Tester',
    'Load models from server': 'Charger les modèles du serveur',
    'Asking the server…': 'Interrogation du serveur…',
    'The server answered. Chat models it has:':
        'Le serveur a répondu. Modèles de conversation disponibles :',
    'The server did not answer:': "Le serveur n'a pas répondu :",
    'Models loaded from the server:': 'Modèles chargés depuis le serveur :',
    'This is not a web address yet. It should look like http://localhost:1234/v1':
        "Ce n'est pas encore une adresse web. Elle devrait ressembler à http://localhost:1234/v1",
    'Offered in the chatbot': "Proposé dans l'assistant conversationnel",
    'Give it a name, an address and at least one model to offer it in the chatbot.':
        "Donnez-lui un nom, une adresse et au moins un modèle pour le proposer dans l'assistant conversationnel.",
    Models: 'Modèles',
    'Add model': 'Ajouter un modèle',
    'Model id': 'Identifiant du modèle',
    'Model id, as the server names it':
        'Identifiant du modèle, tel que le serveur le nomme',
    'Model name': 'Nom du modèle',
    'Name shown in the chatbot (optional)':
        "Nom affiché dans l'assistant conversationnel (facultatif)",
    'Remove this model': 'Retirer ce modèle',
    'Sees pictures': 'Voit les images',
    'Tick only if this model can look at a picture. Load models from server ticks it for you on LM Studio and Ollama.':
        'Cochez seulement si ce modèle peut regarder une image. Sur LM Studio et Ollama, « Charger les modèles du serveur » la coche pour vous.',
    'Not loaded in LM Studio right now. The first question waits for it to load.':
        "Pas chargé dans LM Studio pour l'instant. La première question attendra qu'il se charge.",
    'Loaded in LM Studio. Context length:':
        'Chargé dans LM Studio. Longueur de contexte :',
    'In LM Studio, load this model again with a Context Length of':
        'Dans LM Studio, rechargez ce modèle avec une longueur de contexte (Context Length) de',
    'Not loaded in llama.cpp right now. The first question waits for it to load.':
        'Pas chargé dans llama.cpp pour le moment. La première question attend son chargement.',
    'Not loaded in Ollama right now. The first question waits for it to load.':
        "Pas chargé dans Ollama pour l'instant. La première question attendra qu'il se charge.",
    'Loaded in Ollama. Context length:':
        'Chargé dans Ollama. Longueur de contexte :',
    'In the Ollama app, set Settings → Context length to':
        "Dans l'application Ollama, réglez Settings → Context length (longueur de contexte) sur",
    'Loaded in llama.cpp. Context length:':
        'Chargé dans llama.cpp. Longueur de contexte :',
    'Start llama-server again with a context size (-c) of':
        'Relancez llama-server avec une taille de contexte (-c) de',
    'Watch how to set up a free AI assistant on your own computer':
        'Voir comment installer un assistant IA gratuit sur votre propre ordinateur',
    'LM Studio videos': 'Vidéos LM Studio',
    'Ollama videos': 'Vidéos Ollama',
    'Opens YouTube videos about LM Studio in your browser':
        'Ouvre des vidéos YouTube sur LM Studio dans votre navigateur',
    'Opens YouTube videos about Ollama in your browser':
        'Ouvre des vidéos YouTube sur Ollama dans votre navigateur',
    'That is too small for the assistant.':
        "C'est trop petit pour l'assistant.",
    'A follow-up question may not fit.':
        'Une question de suivi risque de ne pas tenir.',
    'working on an answer': 'prépare une réponse',
    // --- The keyless assistant, for a user who has typed no key at all
    // (2026-09-01). It answers over free PUBLIC services, so the panel says so.
    'Fail to get free assistant': "Impossible d'obtenir l'assistant gratuit",
    'Free assistant (no key needed)': 'Assistant gratuit (aucune clé requise)',
    'With no key of your own, the chatbot answers through free public AI services. They are shared, slower, and can be busy, and your questions leave this computer. Add a key above for better and more private answers.':
        "Sans clé personnelle, l'assistant conversationnel répond via des services d'IA publics gratuits. Ils sont partagés, plus lents et parfois surchargés, et vos questions quittent cet ordinateur. Ajoutez une clé ci-dessus pour des réponses meilleures et plus confidentielles.",
    // --- The AI master switch and the in-app chatbot (2026-08-31).
    'Enable AI features': "Activer les fonctionnalités d'IA",
    'Turns off the chatbot, the assistant tools and the debugging endpoint they use.':
        "Désactive l'assistant conversationnel, les outils de l'assistant et le point d'accès de débogage qu'ils utilisent.",
    'Restart the app to apply': "Redémarrez l'application pour appliquer",
    'Restart Now': 'Redémarrer maintenant',
    'The app will close and open again. Save your work first.':
        "L'application va se fermer puis se rouvrir. Enregistrez d'abord votre travail.",
    'Turned off': 'Désactivé',
    'AI features are turned off in Settings.':
        "Les fonctionnalités d'IA sont désactivées dans les Paramètres.",
    'Would you like to open Settings to enable them?':
        'Voulez-vous ouvrir les Paramètres pour les activer ?',
    'Only needed if your Anthropic key is identity-linked':
        'Requis uniquement si votre clé Anthropic est liée à une identité',
    'App Assistant': "Assistant de l'application",
    'AI Chat': 'Chat IA',
    // --- The Help button's two answers, and Help -> Open Online Help
    // (2026-10-12).
    'Open Online Help': "Ouvrir l'aide en ligne",
    'Open Chatbot': "Ouvrir l'assistant conversationnel",
    // --- The stay-awake switch in the Presenter's and the Screen Mirror
    // page's header (2026-10-09). The two sentences follow the name on the
    // hover, after a dash, so they start in lower case.
    'Stay Awake': 'Maintenir éveillé',
    'this computer will not sleep while this page is open':
        'cet ordinateur ne se mettra pas en veille tant que cette page est ouverte',
    'turned off, this computer may sleep when no screen is showing':
        "désactivé, cet ordinateur peut se mettre en veille quand aucun écran n'est affiché",
    // --- The caution asked before either AI window opens (2026-09-12).
    'Be careful with AI': "Soyez prudent avec l'IA",
    'Do not show this again for 30 days':
        'Ne plus afficher ceci pendant 30 jours',
    'AI can be confidently wrong.': "L'IA peut se tromper avec assurance.",
    'It can misread the app or describe a button that is not there, and what it offers to do can reach a live projector. Check anything that matters before a service, and read a step yourself before you press it.':
        "Elle peut mal interpréter l'application ou décrire un bouton inexistant, et ce qu'elle propose de faire peut atteindre un projecteur en direct. Vérifiez tout ce qui compte avant un culte, et lisez vous-même chaque étape avant d'appuyer.",
    "This opens a company's own chat website: whatever you type there leaves this computer, and it knows nothing about this app. Check anything that matters before a service.":
        "Ceci ouvre le site de chat d'une entreprise : tout ce que vous y tapez quitte cet ordinateur, et il ne sait rien de cette application. Vérifiez tout ce qui compte avant un culte.",
    'Get key': 'Obtenir une clé',
    'Get ID': "Obtenir l'ID",
    'Find Anthropic workspace id':
        "Trouver l'ID de l'espace de travail Anthropic",
    Hide: 'Masquer',
    'Extra Binaries': 'Binaires supplémentaires',
    'The media tools used to download background video and audio, and the Screen Mirror internet tunnel. They are downloaded separately to keep the app small.':
        "Les outils multimédias servant à télécharger les vidéos et audios d'arrière-plan, et le tunnel Internet de Screen Mirror. Ils sont téléchargés séparément pour garder l'application légère.",
    'Media Tools Required': 'Outils multimédias requis',
    'Downloading video or audio needs the extra binaries, which are not installed yet.':
        "Le téléchargement de vidéos ou d'audios nécessite les binaires supplémentaires, qui ne sont pas encore installés.",
    'Would you like to open Settings to install them?':
        'Voulez-vous ouvrir les Paramètres pour les installer ?',
    Location: 'Emplacement',
    'Installed version': 'Version installée',
    'Latest version': 'Dernière version',
    'Not installed': 'Non installé',
    Installed: 'Installé',
    'Checking...': 'Vérification...',
    'Could not check for updates': 'Impossible de vérifier les mises à jour',
    Archive: 'Archive',
    'Kept on purpose, so the binaries can be extracted again without downloading.':
        'Conservée volontairement, pour pouvoir réextraire les binaires sans les télécharger.',
    'Download and Install': 'Télécharger et installer',
    'Update to': 'Mettre à jour vers',
    Reinstall: 'Réinstaller',
    'Re-extract': 'Réextraire',
    'Reveal Folder': 'Afficher le dossier',
    'No pack is available for this app version':
        "Aucun pack n'est disponible pour cette version de l'application",
    'No local pack was built yet': "Aucun pack local n'a encore été construit",
    'The media tools may be out of date':
        'Les outils multimédias sont peut-être obsolètes',
    'Press Enter to apply this folder':
        'Appuyez sur Entrée pour appliquer ce dossier',
    'Something went wrong here': 'Un problème est survenu ici',
    'Try Again': 'Réessayer',
    // Shown in both credential cards of Settings > Others when the OS has no
    // usable credential store, so nothing can be encrypted at rest (2026-08-24).
    'This system has no secure credential store, so keys are kept only until the app closes':
        "Ce système n'a pas de stockage sécurisé des identifiants, les clés ne sont donc conservées que jusqu'à la fermeture de l'application",
    // --- CCLI SongSelect integration: the Settings > Others credential
    // section with its OAuth sign-in, the documents list's "Import From
    // SongSelect" item, and the search/download popup (2026-08-24).
    'SongSelect Integration': 'Intégration SongSelect',
    'Import song lyrics from CCLI SongSelect':
        'Importer des paroles de chants depuis CCLI SongSelect',
    'The OAuth client ID of your CCLI API application':
        "L'ID client OAuth de votre application API CCLI",
    'Leave empty for a public client': 'Laisser vide pour un client public',
    'The subscription key from the CCLI developer portal':
        "La clé d'abonnement du portail développeur CCLI",
    'Must exactly match the redirect URI registered with CCLI':
        "Doit correspondre exactement à l'URI de redirection enregistrée auprès de CCLI",
    'Open CCLI SongSelect website': 'Ouvrir le site web CCLI SongSelect',
    'Sign In': 'Se connecter',
    'Sign Out': 'Se déconnecter',
    'Signed in': 'Connecté',
    'Not signed in': 'Non connecté',
    'Signing in...': 'Connexion...',
    'Set Client ID, Subscription Key and Redirect URI first':
        "Définissez d'abord l'ID client, la clé d'abonnement et l'URI de redirection",
    'Signed in to SongSelect successfully': 'Connexion à SongSelect réussie',
    'Signed out from SongSelect': 'Déconnecté de SongSelect',
    'Sign in failed': 'Échec de la connexion',
    'Sign in was canceled': 'Connexion annulée',
    'Import From SongSelect': 'Importer depuis SongSelect',
    'Search songs': 'Rechercher des chants',
    'Type to search': 'Tapez pour rechercher',
    'Lyrics not available for this song':
        'Paroles non disponibles pour ce chant',
    'Not authorized for these lyrics': 'Non autorisé pour ces paroles',
    'Public Domain': 'Domaine public',
    'SongSelect sign-in expired, please sign in again in Settings':
        'La connexion SongSelect a expiré, veuillez vous reconnecter dans les Paramètres',
    'Your account is not licensed for this content':
        "Votre compte n'a pas de licence pour ce contenu",
    'Too many requests, please wait a moment':
        'Trop de requêtes, veuillez patienter un instant',
    'Could not reach SongSelect': 'Impossible de joindre SongSelect',
    'SongSelect request failed': 'Échec de la requête SongSelect',
    'Lyric document created successfully': 'Document de chant créé avec succès',
    'This song has no lyrics to import':
        "Ce chant n'a pas de paroles à importer",
    '(dev) Use Mock Data': '(dev) Utiliser des données fictives',
    '(mock)': '(fictif)',
    // --- Public Domain Songs plugin: embedded hymn catalog importable as
    // lyric documents with no sign-in (2026-08-24).
    'Import From Public Domain Songs':
        'Importer depuis les chants du domaine public',
    'Failed to create lyric document':
        'Échec de la création du document de chant',
    // --- Connection graph (src/graph-view): a floating, pannable graph of a
    // record and everything it is related to (2026-08-29). The plural relation
    // labels the filter chips use (Parents, Children, Spouses, Siblings,
    // Cousins, Locations, Related locations) are already in this file and are
    // reused rather than repeated.
    'Open Graph Preview': "Ouvrir l'aperçu du graphe",
    'Graph Preview': 'Aperçu du graphe',
    'Open all Related': 'Ouvrir tous les éléments associés',
    'No related records': 'Aucun enregistrement associé',
    'Open detail': 'Ouvrir le détail',
    'Graph node limit reached': 'Limite de nœuds du graphe atteinte',
    'This will add many boxes to the graph. Continue?':
        'Cela ajoutera de nombreuses cases au graphe. Continuer ?',
    'Use as root': 'Utiliser comme racine',
    'Set as centre': 'Définir comme centre',
    'Fit to view': 'Ajuster à la vue',
    'Re-layout': 'Réorganiser',
    Fullscreen: 'Plein écran',
    'Exit fullscreen': 'Quitter le plein écran',
    Zoom: 'Zoom',
    'Path from': 'Chemin depuis',
    'Path to': 'Chemin vers',
    Swap: 'Inverser',
    'Find Connection': 'Trouver le lien',
    // `{count}` is the walk's step limit, put in by the caller: where the
    // number sits is the translation's to decide.
    'No connection found within {count} steps':
        'Aucun lien trouvé en {count} étapes ou moins',
    'A location cannot be a path endpoint':
        'Un lieu ne peut pas être une extrémité du chemin',
    'Mentioned by': 'Mentionné par',
    'Save as image': 'Enregistrer comme image',
    // The text copies: the document, then one row per diagram language. The
    // format names stay Latin — `Markdown` is already in this file that way
    // (the music help), and every one of them is what the program the text is
    // pasted into calls itself. Only the direction is translated, since that
    // is the part a reader is choosing between.
    'Copy as Markdown': 'Copier en Markdown',
    // A menu row is clipped at 210px, so the two flowchart rows are named
    // short and carry the full name on their hover and on the toast.
    'Copy as Mermaid (across)': 'Copier en Mermaid (horizontal)',
    'Copy as Mermaid (down)': 'Copier en Mermaid (vertical)',
    'Copy as Mermaid Flowchart (left to right)':
        'Copier en organigramme Mermaid (de gauche à droite)',
    'Copy as Mermaid Flowchart (top down)':
        'Copier en organigramme Mermaid (de haut en bas)',
    'Copy as Mermaid Mindmap': 'Copier en carte mentale Mermaid',
    'Copy as Graphviz DOT': 'Copier en Graphviz DOT',
    'Copy as PlantUML': 'Copier en PlantUML',
    // The same five formats named with no verb, for the rows that OPEN a
    // diagram instead of copying it. The three Mermaid shapes are what the
    // Mermaid Live Editor menu is made of; the other two carry a name because
    // the list declares one for every format. `Mindmap` is translated here and
    // in `Copy as Mermaid Mindmap` above, or one menu would name the same
    // shape two ways. The last two are product names and stand as they are.
    'Mermaid (across)': 'Mermaid (horizontal)',
    'Mermaid (down)': 'Mermaid (vertical)',
    'Mermaid Mindmap': 'Carte mentale Mermaid',
    'Graphviz DOT': 'Graphviz DOT',
    PlantUML: 'PlantUML',
    'Open in Mermaid Live': 'Ouvrir dans Mermaid Live',
    'Open the diagram in the Mermaid Live Editor':
        'Ouvrir le diagramme dans Mermaid Live Editor',
    'Opening in the Mermaid Live Editor': 'Ouverture dans Mermaid Live Editor',
    // Said when the diagram is too long to hand the browser as a link; the
    // link goes to the clipboard instead, so the sentence has to say what to
    // do with it.
    'The link is too long for the browser. It has been copied — paste it into the address bar.':
        "Le lien est trop long pour le navigateur. Il a été copié — collez-le dans la barre d'adresse.",
    'Save preset': 'Enregistrer le préréglage',
    'Delete preset': 'Supprimer le préréglage',
    Presets: 'Préréglages',
    'Right-click to show only this': "Clic droit pour n'afficher que celui-ci",
    All: 'Tout',
    // Relation labels drawn on the edges. Lowercase because each reads as a
    // phrase sitting on a line ("son", "wife"), not as a heading — which is
    // also what keeps them distinct from the plural chip keys above.
    father: 'père',
    mother: 'mère',
    parent: 'parent',
    son: 'fils',
    daughter: 'fille',
    child: 'enfant',
    husband: 'mari',
    wife: 'épouse',
    spouse: 'conjoint',
    brother: 'frère',
    sister: 'sœur',
    sibling: 'frère ou sœur',
    cousin: 'cousin',
    'located at': 'situé à',
    'related location': 'lieu associé',
    // No lowercase `mentioned by` twin: keys are matched case-insensitively,
    // so it would collide with `Mentioned by` above and this module throws at
    // load on a duplicate. The one entry serves the chip and any edge label.

    // Verse-highlight colours (`VERSE_HIGHLIGHT_COLOR_KEYS`). They label the
    // selection toolbar's swatches and ARE the visible text of the recolour
    // menu, so without these the menu reads five English words beside a
    // translated `Delete`. Adding a colour there means adding a key here.
    yellow: 'jaune',
    green: 'vert',
    blue: 'bleu',
    pink: 'rose',
    orange: 'orange',
    purple: 'violet',

    // --- Keys on failure paths that had no translation at all (EN-20,
    // 2026-09-18). `src/lang/tranKeyCoverage.test.ts` now fails on a key like
    // these.
    'Failed to apply to screen. Please make sure the screen is open.':
        "Échec de l'application à l'écran. Veuillez vérifier que l'écran est ouvert.",
    'Failed to sync slide. Please make sure the screen is open.':
        "Échec de la synchronisation de la diapositive. Veuillez vérifier que l'écran est ouvert.",
    'Error occurred during reading image data from clipboard':
        "Erreur lors de la lecture des données d'image du presse-papiers",
    'Error occurred during getting image file extension':
        "Erreur lors de l'obtention de l'extension du fichier image",
    'We were sorry, but we are unable to get bible list at the moment please try again later':
        'Désolé, nous ne pouvons pas obtenir la liste des Bibles pour le moment, veuillez réessayer plus tard',
    // --- Tooltips that were English in every language (EN-21, 2026-09-18):
    // the lookup history chips, the verse numbers, the divider arrows, the
    // Mini Screen card, the Bible Note footer.
    'Set to current editing': 'Mettre dans l’édition en cours',
    'Tab to complete': 'Tab pour compléter',
    'Double click to select verses':
        'Double-cliquez pour sélectionner des versets',
    'Click to remove extra Bible':
        'Cliquez pour retirer la Bible supplémentaire',
    'Collapse left panel': 'Réduire le panneau gauche',
    'Collapse right panel': 'Réduire le panneau droit',
    'Collapse top panel': 'Réduire le panneau supérieur',
    'Collapse bottom panel': 'Réduire le panneau inférieur',
    Screen: 'Écran',
    'Open in Markdown Editor': "Ouvrir dans l'éditeur Markdown",
    'Open Bible Lookup': 'Ouvrir la recherche biblique',
    'Change Bible Key': 'Changer la clé de la Bible',
    // --- A data folder carried between computers and operating systems
    // (EN-22..35, 2026-09-19): file names every computer accepts, deleting on
    // a USB stick with no Recycle Bin.
    'Please type a name.': 'Veuillez saisir un nom.',
    'A name cannot contain these characters, which some computers refuse:':
        'Un nom ne peut pas contenir ces caractères, refusés par certains ordinateurs :',
    'A name cannot start with a dot.':
        'Un nom ne peut pas commencer par un point.',
    'A name cannot end with a dot or a space.':
        'Un nom ne peut pas se terminer par un point ou un espace.',
    'This name is reserved by Windows. Please choose another one.':
        'Ce nom est réservé par Windows. Veuillez en choisir un autre.',
    'This name is too long. Please use a shorter one.':
        'Ce nom est trop long. Veuillez en utiliser un plus court.',
    'Creating File': 'Création du fichier',
    'Delete Permanently': 'Supprimer définitivement',
    'could not be moved to the Recycle Bin or Trash. A USB flash drive has none on Windows. Delete it permanently? This cannot be undone.':
        "n'a pas pu être déplacé vers la corbeille. Une clé USB n'en a pas sous Windows. Le supprimer définitivement ? Cette action est irréversible.",
    Retry: 'Réessayer',
    // --- The data folder off the Desktop (2026-10-17): OneDrive backs up
    // the Desktop and took songs off it, so the default is
    // `~/.owa/open-worship-data` and a folder still on the Desktop is asked
    // about at launch (`src/setting/directory-setting/dataDirMove*`).
    'Move Your Data Folder Off the Desktop':
        'Déplacer votre dossier de données hors du Bureau',
    'Copy Data Folder': 'Copier le dossier de données',
    'Copy this data folder to a drive or another folder':
        'Copier ce dossier de données sur un disque ou dans un autre dossier',
    'The data folder was not copied:':
        "Le dossier de données n'a pas été copié :",
    'The data folder was copied to': 'Le dossier de données a été copié dans',
    'Switch to the copy now? Every open window reloads.':
        'Passer à la copie maintenant ? Toutes les fenêtres ouvertes se rechargent.',
    'The copy cannot go inside the data folder itself.':
        'La copie ne peut pas aller dans le dossier de données lui-même.',
    'The Desktop is not a safe place for your data folder: backup and sync tools can move or empty it while the app is using it.':
        "Le Bureau n'est pas un endroit sûr pour votre dossier de données : les outils de sauvegarde et de synchronisation peuvent le déplacer ou le vider pendant que l'application l'utilise.",
    'Your songs, slides, Bibles and settings are kept in a folder on the Desktop:':
        'Vos chants, diapositives, Bibles et paramètres sont conservés dans un dossier sur le Bureau :',
    'On Windows, Microsoft OneDrive often backs up the Desktop. While it syncs, OneDrive can replace your files with online-only copies or take them off this computer, so songs, slides and settings can suddenly go missing or come back empty.':
        'Sous Windows, Microsoft OneDrive sauvegarde souvent le Bureau. Pendant la synchronisation, OneDrive peut remplacer vos fichiers par des copies disponibles uniquement en ligne ou les retirer de cet ordinateur : chants, diapositives et paramètres peuvent alors disparaître soudainement ou revenir vides.',
    'On a Mac, iCloud Drive can keep the Desktop in the cloud. It can take files off this computer and keep them only online, so songs, slides and settings can suddenly go missing.':
        'Sur un Mac, iCloud Drive peut conserver le Bureau dans le cloud. Il peut retirer des fichiers de cet ordinateur et ne les garder qu’en ligne : chants, diapositives et paramètres peuvent alors disparaître soudainement.',
    'Backup and sync tools often watch the Desktop, and can change or remove its files while the app is using them.':
        'Les outils de sauvegarde et de synchronisation surveillent souvent le Bureau et peuvent modifier ou supprimer ses fichiers pendant que l’application les utilise.',
    'To keep your data safe, the app can move it to a folder these backup tools do not touch:':
        'Pour protéger vos données, l’application peut les déplacer dans un dossier auquel ces outils de sauvegarde ne touchent pas :',
    'The app closes and opens again to move it. Nothing is deleted: if the folder has to be copied, the old one stays where it is until you move it to the Recycle Bin (Trash) yourself.':
        'L’application se ferme et se rouvre pour le déplacer. Rien n’est supprimé : si le dossier doit être copié, l’ancien reste à sa place jusqu’à ce que vous le mettiez vous-même à la corbeille.',
    '"Not Now" asks again the next time the app starts.':
        '« Pas maintenant » reposera la question au prochain démarrage de l’application.',
    'Move Now': 'Déplacer maintenant',
    'Data Folder Moved': 'Dossier de données déplacé',
    'Your data folder is now in a safe place:':
        'Votre dossier de données est maintenant en lieu sûr :',
    'The old copy is still at:': 'L’ancienne copie se trouve toujours ici :',
    'The app no longer uses it. When you are sure your songs, slides and settings are all here, move the old folder to the Recycle Bin (Trash) yourself.':
        'L’application ne l’utilise plus. Quand vous êtes sûr que vos chants, diapositives et paramètres sont tous ici, mettez vous-même l’ancien dossier à la corbeille.',
    'Data Folder Not Moved': 'Dossier de données non déplacé',
    'The data folder could not be moved, so the app keeps using it where it is. Nothing was changed.':
        'Le dossier de données n’a pas pu être déplacé ; l’application continue donc de l’utiliser là où il est. Rien n’a été modifié.',
    'The app asks again the next time it starts.':
        'L’application reposera la question à son prochain démarrage.',
    'Old Copy of Your Data Folder':
        'Ancienne copie de votre dossier de données',
    'Your data folder was moved here:':
        'Votre dossier de données a été déplacé ici :',
    'Moved on:': 'Déplacé le :',
    'Show Folder': 'Afficher le dossier',
    'Moving your data folder to a safe place. Please wait…':
        'Déplacement de votre dossier de données en lieu sûr. Veuillez patienter…',
    'Some files in the data folder are only in iCloud Drive. Open the folder in Finder, choose Download Now, then try again.':
        'Certains fichiers du dossier de données ne sont que dans iCloud Drive. Ouvrez le dossier dans le Finder, choisissez Télécharger maintenant, puis réessayez.',
    'The copy is not the same as the data folder, so it was not used.':
        'La copie ne correspond pas au dossier de données ; elle n’a donc pas été utilisée.',
    'Open Worship App moved this data folder here.':
        'Open Worship App a déplacé ce dossier de données ici.',
    'Open Worship App no longer uses this folder: it was copied to the place below. When you are sure everything is there, move this folder to the Recycle Bin (Trash) yourself.':
        'Open Worship App n’utilise plus ce dossier : il a été copié à l’emplacement ci-dessous. Quand vous êtes sûr que tout y est, mettez vous-même ce dossier à la corbeille.',
    'Create and use the standard folders (Documents, Videos, Images and the rest) inside':
        'Créer et utiliser les dossiers standard (Documents, Vidéos, Images, etc.) dans',
    'Repair Links': 'Réparer les liens',
    'Point links to pictures, videos and songs that still name an old location of this data folder at where it is now':
        "Rediriger vers l'emplacement actuel les liens vers les images, vidéos et chants qui désignent encore un ancien emplacement de ce dossier de données",
    'No links to an old location of this data folder were found.':
        "Aucun lien vers un ancien emplacement de ce dossier de données n'a été trouvé.",
    'Links repaired:': 'Liens réparés :',
    'Files changed:': 'Fichiers modifiés :',
    'The app reloads to show them.':
        "L'application se recharge pour les afficher.",
    'Recent Folders': 'Dossiers récents',
    'Found Data Folders': 'Dossiers de données trouvés',
    Suggested: 'Suggéré',
    'Use This Folder': 'Utiliser ce dossier',
    Switch: 'Basculer',
    'Switch Data Folder': 'Changer de dossier de données',
    'Switch to the data folder': 'Basculer vers le dossier de données',
    'Every open window reloads.': 'Toutes les fenêtres ouvertes se rechargent.',
    'Remove from Recent Folders': 'Retirer des dossiers récents',
    'This folder is not there any more.': "Ce dossier n'existe plus.",
    'Type the full path of the folder, for example':
        'Saisissez le chemin complet du dossier, par exemple',
    'Create Data Folder': 'Créer le dossier de données',
    'There is no folder at': "Il n'y a aucun dossier à l'emplacement",
    'Create it and use it as the data folder?':
        "Le créer et l'utiliser comme dossier de données ?",
    Create: 'Créer',
    // --- Page-aware Tips of the Day and their deterministic walkthroughs.
    'Tips of the Day': 'Astuces du jour',
    'Tip of the Day': 'Astuce du jour',
    'Presenter tip': 'Astuce Présentateur',
    'Reader tip': 'Astuce Lecteur',
    'Show it': 'Me montrer',
    'Next tip': 'Astuce suivante',
    'All tips': 'Toutes les astuces',
    'All Presenter tips': 'Toutes les astuces du Présentateur',
    'All Reader tips': 'Toutes les astuces du Lecteur',
    'Back to tip': "Retour à l'astuce",
    'Choose a tip to practise at your own pace.':
        'Choisissez une astuce à pratiquer à votre rythme.',
    'Hide for 30 days': 'Masquer pendant 30 jours',
    'Show Tips of the Day automatically':
        'Afficher automatiquement les astuces du jour',
    'Applies to the Presenter and Bible Reader on the next app launch.':
        "S'applique au Présentateur et au Lecteur biblique au prochain démarrage de l'application.",
    // --- The Settings list of what a hide button put away, for restoring.
    'Put away for 30 days': 'Masqués pendant 30 jours',
    'Tips in the help window': "Astuces de la fenêtre d'aide",
    'The caution before an AI window opens':
        "L'avertissement avant l'ouverture d'une fenêtre IA",
    'The notice about the free AI service': 'La note sur le service IA gratuit',
    'The suggestion to move the data folder':
        'La suggestion de déplacer le dossier de données',
    'Hidden until': "Masqué jusqu'au",
    'Show again': 'Afficher à nouveau',
    'Starting walkthrough…': 'Démarrage du guide…',
    'This tip closes by itself': "L'astuce se ferme toute seule",
    'Could not start this walkthrough.': 'Impossible de démarrer ce guide.',
    'File menu': 'Menu Fichier',
    'Edit menu': 'Menu Édition',
    'Tools menu': 'Menu Outils',
    'Window menu': 'Menu Fenêtre',
    'Help menu': 'Menu Aide',
    'Learn the File menu': 'Découvrir le menu Fichier',
    'Learn Print, Print Without Preview, Export Data, Import Data, Close, and Quit or Exit.':
        'Découvrez Imprimer, Imprimer sans aperçu, Exporter les données, Importer les données, Fermer et Quitter.',
    'Learn the Edit menu': 'Découvrir le menu Édition',
    'Learn Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Find, Delete, Select All, Settings, and Speech.':
        'Découvrez Annuler, Rétablir, Couper, Copier, Coller, Coller et adapter le style, Rechercher, Supprimer, Tout sélectionner, Paramètres et Parole.',
    'Learn the Tools menu': 'Découvrir le menu Outils',
    'Learn Local Web Share, Google Fonts, App Assistant, AI Chat, Khmer Tools, and Start Controlling.':
        "Découvrez le partage web local, Google Fonts, l'assistant, AI Chat, les outils khmers et le contrôle de l'écran.",
    'Learn the Window menu': 'Découvrir le menu Fenêtre',
    'Learn Minimize, Maximize or Zoom, Close, Bring All to Front, window switching, and Reset Position and Size.':
        'Découvrez Réduire, Agrandir ou Zoomer, Fermer, Tout ramener au premier plan, changer de fenêtre et Réinitialiser la position et la taille.',
    'Learn the Help menu': 'Découvrir le menu Aide',
    'Learn Tips of the Day, All tips, Keyboard Shortcuts, Copy Debug Info, App Help (Chatbot), Learn More, Check for Updates, and About Open Worship app.':
        'Découvrez Astuces du jour, Toutes les astuces, Raccourcis clavier, Copy Debug Info, App Help (Chatbot), Learn More, Check for Updates et About Open Worship app.',
    'Look up a Bible passage': 'Rechercher un passage biblique',
    'Open Bible Lookup without leaving the Presenter.':
        'Ouvrez la recherche biblique sans quitter le Présentateur.',
    'Show or hide the Document List':
        'Afficher ou masquer la liste des documents',
    'Toggle the panel that holds your slide documents.':
        'Affichez ou masquez le panneau contenant vos diaporamas.',
    'Show or hide the Presenting Flow List':
        'Afficher ou masquer la liste des déroulés',
    'Toggle the panel used to build and follow a service order.':
        "Affichez ou masquez le panneau servant à préparer et suivre l'ordre du culte.",
    'Show or hide Bibles and Bible Notes':
        'Afficher ou masquer les Bibles et les notes bibliques',
    'Toggle the panel for saved passages and notes.':
        'Affichez ou masquez le panneau des passages et notes enregistrés.',
    'Show or hide the Mini Screen': 'Afficher ou masquer le mini-écran',
    'Toggle the panel that previews and controls audience screens.':
        "Affichez ou masquez le panneau d'aperçu et de contrôle des écrans du public.",
    'Give the Presenter more room': "Agrandir l'espace du Présentateur",
    'Switch the Presenter between normal and full view.':
        'Basculez le Présentateur entre la vue normale et la vue complète.',
    'Open Slide Editor in its own window':
        "Ouvrir l'Éditeur de diapositives dans sa propre fenêtre",
    'Keep the Presenter visible while editing the selected document.':
        'Gardez le Présentateur visible pendant la modification du document sélectionné.',
    'Open Bible Reader in its own window':
        'Ouvrir le Lecteur biblique dans sa propre fenêtre',
    'Read or study without replacing the Presenter page.':
        'Lisez ou étudiez sans remplacer la page du Présentateur.',
    'Open app Settings': "Ouvrir les paramètres de l'application",
    'Change language, theme, folders, screens, and other app options.':
        "Modifiez la langue, le thème, les dossiers, les écrans et d'autres options de l'application.",
    'Open the Help menu': "Ouvrir le menu d'aide",
    'Find app help, tips, updates, and information about the app.':
        "Trouvez l'aide, les astuces, les mises à jour et les informations sur l'application.",
    'Open foreground controls': "Ouvrir les contrôles d'avant-plan",
    'Reach countdowns, clocks, marquees, and quick text.':
        'Accédez aux comptes à rebours, horloges, bandeaux et textes rapides.',
    'Foreground overlays': "Calques d'avant-plan",
    'Count down to the start of a service':
        "Compter à rebours jusqu'au début du culte",
    'Countdown counts a number of minutes, or down to a time on the clock.':
        "Countdown compte un nombre de minutes, ou jusqu'à une heure précise.",
    'Time how long something is running':
        'Chronométrer la durée de quelque chose',
    'Stopwatch counts up from zero on the audience screen.':
        "Stopwatch compte à partir de zéro sur l'écran du public.",
    'Show the time on the audience screen':
        "Afficher l'heure sur l'écran du public",
    'Time puts one clock up, or several for different cities.':
        'Time affiche une horloge, ou plusieurs pour différentes villes.',
    'Scroll a line of text across the top':
        'Faire défiler une ligne de texte en haut',
    'Marquee Top is a moving notice above everything else on the screen.':
        "Marquee Top est un avis en mouvement au-dessus de tout le reste de l'écran.",
    'Scroll a line of text across the bottom':
        'Faire défiler une ligne de texte en bas',
    'Marquee Bottom is the same moving notice, along the foot of the screen.':
        "Marquee Bottom est le même avis en mouvement, au bas de l'écran.",
    'Put a short message up for a moment':
        'Afficher un court message un instant',
    'Quick Text puts a few words up that go again by themselves.':
        "Quick Text affiche quelques mots qui disparaissent d'eux-mêmes.",
    'Play a clip over the slide': 'Lire un clip par-dessus la diapositive',
    'Video Show plays a clip above the background, the slide and the passage.':
        "Video Show lit un clip au-dessus de l'arrière-plan, de la diapositive et du passage.",
    'Lay a picture over the slide': 'Poser une image par-dessus la diapositive',
    'Image Show lays a logo, a frame or an announcement above everything else.':
        'Image Show pose un logo, un cadre ou une annonce au-dessus de tout le reste.',
    'Show a camera over the slide':
        'Afficher une caméra par-dessus la diapositive',
    'Camera Show puts a live camera picture above the slide, not behind it.':
        'Camera Show place une image de caméra en direct au-dessus de la diapositive, pas derrière.',
    'Show one screen inside another': 'Afficher un écran dans un autre',
    'Screen Show puts the live picture of another screen above the slide.':
        'Screen Show place l’image en direct d’un autre écran au-dessus de la diapositive.',
    'Show a web page over the slide':
        'Afficher une page web par-dessus la diapositive',
    'Web Show puts a page or a small web file above the slide.':
        'Web Show place une page ou un petit fichier web au-dessus de la diapositive.',
    'Place and size a foreground item':
        "Placer et dimensionner un élément d'avant-plan",
    'Use Properties for position, size, opacity and blending.':
        "Utilisez Propriétés pour la position, la taille, l'opacité et le fondu.",
    'Keep the lines you use every week':
        'Conserver les lignes utilisées chaque semaine',
    'Save named sessions inside a foreground component.':
        "Enregistrez des sessions nommées dans un composant d'avant-plan.",
    'Take a foreground item back off': "Retirer un élément d'avant-plan",
    'Hide one component, or clear the whole foreground layer.':
        "Masquez un composant, ou effacez toute la couche d'avant-plan.",
    'Open background colors': "Ouvrir les couleurs d'arrière-plan",
    'Choose a solid color for the selected audience screens.':
        'Choisissez une couleur unie pour les écrans du public sélectionnés.',
    'Open background images': "Ouvrir les images d'arrière-plan",
    'Browse still pictures available for screen backgrounds.':
        "Parcourez les images fixes disponibles comme arrière-plans d'écran.",
    'Open background videos': "Ouvrir les vidéos d'arrière-plan",
    'Browse and control moving backgrounds.':
        'Parcourez et contrôlez les arrière-plans animés.',
    'Open camera backgrounds': "Ouvrir les caméras d'arrière-plan",
    'Choose a connected camera as a live background source.':
        "Choisissez une caméra connectée comme source d'arrière-plan en direct.",
    'Open website backgrounds': "Ouvrir les sites web d'arrière-plan",
    'Browse saved web pages used as screen backgrounds.':
        "Parcourez les pages web enregistrées utilisées comme arrière-plans d'écran.",
    'Open the audio library': 'Ouvrir la bibliothèque audio',
    'Browse music and other audio used during a service.':
        'Parcourez la musique et les autres fichiers audio utilisés pendant un culte.',
    'Change the open document folder': 'Changer le dossier de documents ouvert',
    'Show the folder path box above the Document List.':
        'Affichez le champ du chemin de dossier au-dessus de la liste des documents.',
    'Find a document by name': 'Rechercher un document par son nom',
    'Filter a long Document List without moving or deleting anything.':
        'Filtrez une longue liste de documents sans rien déplacer ni supprimer.',
    'Sort the Document List': 'Trier la liste des documents',
    'Change how documents are ordered without changing their files.':
        "Modifiez l'ordre d'affichage des documents sans modifier leurs fichiers.",
    'Filter documents by type': 'Filtrer les documents par type',
    'Show only slides, lyrics, PDFs, or another document kind.':
        'Affichez seulement les diapositives, paroles, PDF ou un autre type de document.',
    'Pin the selected document': 'Épingler le document sélectionné',
    'Keep presenting from one document while selecting another.':
        'Continuez à présenter depuis un document tout en sélectionnant un autre.',
    'Make slide thumbnails larger': 'Agrandir les miniatures des diapositives',
    'Increase the preview size without changing audience output.':
        "Agrandissez l'aperçu sans modifier ce que voit le public.",
    'Fit the selected document to width':
        'Ajuster le document sélectionné à la largeur',
    'Toggle full-width document previews without changing the screen.':
        "Basculez les aperçus en pleine largeur sans modifier l'écran du public.",
    'Write a note on a document or slide':
        'Écrire une note sur un document ou une diapositive',
    'Open the Note panel under the slide previews; it starts closed.':
        'Ouvrez le panneau Note sous les aperçus de diapositives ; il est fermé au départ.',
    'Present a slide from a document':
        'Présenter une diapositive depuis un document',
    'Select a document, then send one of its slide cards to the audience.':
        "Sélectionnez un document, puis envoyez l'une de ses diapositives au public.",
    'Auto-play slides on a timer':
        'Lire automatiquement les diapositives avec une minuterie',
    'Set a slide duration and let the selected document advance itself.':
        'Définissez la durée des diapositives et laissez le document sélectionné avancer seul.',
    'Present song lyrics': 'Présenter les paroles d’un chant',
    'Choose a lyric document and present its generated stage slides.':
        'Choisissez un document de paroles et présentez les diapositives de scène générées.',
    'Look up and present a Bible verse':
        'Rechercher et présenter un verset biblique',
    'Choose a passage, preview it, then send it to selected screens.':
        'Choisissez un passage, prévisualisez-le, puis envoyez-le aux écrans sélectionnés.',
    'Style Bible text on screen': "Mettre en forme le texte biblique à l'écran",
    'Change the Bible layer font, size, colors, spacing, and layout.':
        "Modifiez la police, la taille, les couleurs, l'espacement et la disposition de la couche biblique.",
    'Use a solid background color': "Utiliser une couleur unie d'arrière-plan",
    'Choose a color and apply it only after checking the selected screens.':
        'Choisissez une couleur et appliquez-la seulement après avoir vérifié les écrans sélectionnés.',
    'Use an image background': "Utiliser une image d'arrière-plan",
    'Choose a still picture and preview it before the audience sees it.':
        'Choisissez une image fixe et prévisualisez-la avant que le public ne la voie.',
    'Use a video background': "Utiliser une vidéo d'arrière-plan",
    'Choose a video, preview playback, and control it safely.':
        'Choisissez une vidéo, prévisualisez sa lecture et contrôlez-la en toute sécurité.',
    'Use a camera background': "Utiliser une caméra d'arrière-plan",
    'Choose a connected camera and check its live preview first.':
        "Choisissez une caméra connectée et vérifiez d'abord son aperçu en direct.",
    'Use a website background': "Utiliser un site web d'arrière-plan",
    'Create or choose a saved web item and preview its captured page.':
        'Créez ou choisissez un élément web enregistré et prévisualisez sa page capturée.',
    'Play audio during a service': 'Lire un fichier audio pendant un culte',
    'Choose a saved audio file and use its playback controls.':
        'Choisissez un fichier audio enregistré et utilisez ses commandes de lecture.',
    'Show a countdown, clock, or message':
        'Afficher un compte à rebours, une horloge ou un message',
    'Use Foreground for timers, marquees, and quick text overlays.':
        "Utilisez l'avant-plan pour les minuteries, bandeaux et textes rapides.",
    'Control what the audience sees': 'Contrôler ce que voit le public',
    'Use Mini Screen to show, hide, lock, or clear individual layers.':
        'Utilisez le mini-écran pour afficher, masquer, verrouiller ou effacer chaque couche.',
    'Use more than one audience screen':
        'Utiliser plusieurs écrans pour le public',
    'Add screen cards, choose displays, and decide which screens receive content.':
        'Ajoutez des cartes d’écran, choisissez les affichages et décidez quels écrans reçoivent le contenu.',
    'Draw or spotlight on the app':
        "Dessiner ou mettre en lumière dans l'application",
    'Use Presenting Control for arrows, drawing, erasing, and focus.':
        'Utilisez le contrôle de présentation pour les flèches, le dessin, la gomme et la mise au point.',
    'Show the keys you press': 'Afficher les touches utilisées',
    'Display keyboard shortcuts while teaching or demonstrating the app.':
        "Affichez les raccourcis clavier pendant l'enseignement ou la démonstration de l'application.",
    'Download a background video or song':
        "Télécharger une vidéo d'arrière-plan ou un chant",
    'Use a supported public link to add video or audio to the library.':
        'Utilisez un lien public compatible pour ajouter une vidéo ou un son à la bibliothèque.',
    'Build a service presenting flow':
        'Créer un déroulé de présentation du culte',
    'Arrange documents, passages, actions, and cues into a running order.':
        'Organisez les documents, passages, actions et repères dans un ordre de déroulement.',
    'Share a presenting flow': 'Partager un déroulé de présentation',
    'Export a service order with the documents it references.':
        'Exportez un ordre de culte avec les documents auxquels il fait référence.',
    'Import a song from SongSelect': 'Importer un chant depuis SongSelect',
    'Sign in, search the service, and bring a licensed song into Documents.':
        'Connectez-vous, recherchez dans le service et importez un chant autorisé dans Documents.',
    'Import a public-domain hymn': 'Importer un cantique du domaine public',
    'Browse the built-in hymn collection without an account.':
        'Parcourez la collection intégrée de cantiques sans compte.',
    'Use the More Options buttons': 'Utiliser les boutons Plus d’options',
    'Open the three-dot menu on a document, slide, background, or flow item.':
        "Ouvrez le menu à trois points d'un document, d'une diapositive, d'un arrière-plan ou d'un élément du déroulé.",
    'Ask the App Assistant for help':
        "Demander de l'aide à l'Assistant de l'application",
    'Ask about {name}': 'Demander à propos de {name}',
    '{name} is not in the Resources folders any more.':
        "{name} n'est plus dans les dossiers Ressources.",
    'Ask about the Presenter and request a safe step-by-step walkthrough.':
        'Posez une question sur le Présentateur et demandez un guide sûr, étape par étape.',
    'Open an AI chat website': "Ouvrir un site de discussion avec l'IA",
    'Use ChatGPT, Claude, Gemini, or another supported site in a separate window.':
        'Utilisez ChatGPT, Claude, Gemini ou un autre site compatible dans une fenêtre séparée.',
    'Find text anywhere in the app':
        "Rechercher du texte partout dans l'application",
    'Use the Find bar to locate a document, setting, or visible control.':
        'Utilisez la barre Rechercher pour trouver un document, un paramètre ou une commande visible.',
    'Reload or force-reload the Presenter':
        'Recharger ou forcer le rechargement du Présentateur',
    'Use Reload normally; use Force Reload only to bypass cached app files.':
        "Utilisez Recharger normalement ; utilisez Forcer le rechargement seulement pour ignorer les fichiers d'application en cache.",
    'Use View > Toggle Developer Tools only for technical troubleshooting.':
        'Utilisez Affichage > Basculer les outils de développement seulement pour un dépannage technique.',
    'Zoom the whole Presenter interface':
        "Zoomer toute l'interface du Présentateur",
    'Use Actual Size, Zoom In, or Zoom Out for every panel and control.':
        'Utilisez Taille réelle, Zoom avant ou Zoom arrière pour tous les panneaux et commandes.',
    'Make the whole Presenter full screen':
        'Afficher tout le Présentateur en plein écran',
    'Use View > Toggle Full Screen or F11 for the entire app window.':
        "Utilisez Affichage > Basculer le plein écran ou F11 pour toute la fenêtre de l'application.",
    'Show or hide Presenter panels from View':
        'Afficher ou masquer les panneaux du Présentateur depuis Affichage',
    'Use View > Widgets to choose which Presenter panels are open.':
        'Utilisez Affichage > Panneaux pour choisir les panneaux du Présentateur ouverts.',
    'Restore every Presenter panel layout':
        'Restaurer la disposition de tous les panneaux du Présentateur',
    'Use View > Reset Widgets Size to restore defaults after confirmation.':
        'Utilisez Affichage > Réinitialiser la taille des panneaux pour rétablir les valeurs par défaut après confirmation.',
    'Documents and slides': 'Documents et diapositives',
    'Audience screens': 'Écrans du public',
    'Background and media': 'Arrière-plan et médias',
    'Service planning': 'Planification du culte',
    'Make the words larger': 'Agrandir les mots',
    'Press Reveal Hidden Controls under the passage, then raise Font Size.':
        'Appuyez sur Révéler les commandes masquées sous le passage, puis augmentez la Taille de police.',
    'Find words in the Bible': 'Rechercher des mots dans la Bible',
    'Open Bible Find, then put the caret in its search box.':
        'Ouvrez la recherche biblique, puis placez le curseur dans son champ de recherche.',
    'Look up a Bible person or place':
        'Rechercher une personne ou un lieu biblique',
    'Open the names and locations lookup beside the passage.':
        'Ouvrez la recherche de noms et de lieux à côté du passage.',
    'Put two Bible versions side by side':
        'Placer deux versions de la Bible côte à côte',
    'Open the version picker for a second Bible column.':
        'Ouvrez le sélecteur de version pour une deuxième colonne biblique.',
    'Toggle distraction-free reading': 'Basculer la lecture sans distraction',
    'Enter or leave the full reading view.':
        'Entrez dans la vue de lecture complète ou quittez-la.',
    'Toggle the side panel that keeps saved passages and notes.':
        'Affichez ou masquez le panneau latéral des passages et notes enregistrés.',
    'Search tips': 'Rechercher des astuces',
    'No tips found': 'Aucune astuce trouvée',
    'Getting started': 'Bien débuter',
    'Reading and layout': 'Lecture et disposition',
    'Notes and marks': 'Notes et annotations',
    'Reader shortcuts': 'Outils du Lecteur',
    'View menu': 'Menu Affichage',
    'Study tools': "Outils d'étude",
    'Find a saved Bible list': 'Trouver une liste biblique enregistrée',
    'Use Filter by name and Sort at the top of Bibles to find a passage list quickly.':
        'Utilisez Filtrer par nom et Trier en haut de Bibles pour trouver vite une liste de passages.',
    'Fix a Bible that is not installed':
        'Régler une Bible qui n’est pas installée',
    'When the Reader names a Bible you do not have, pick another, press Let the assistant import this Bible for me, or Go to Bible Setting.':
        'Quand le Lecteur demande une Bible que vous n’avez pas, choisissez-en une autre, appuyez sur Laisser l’assistant importer cette Bible pour moi, ou Aller aux paramètres de la Bible.',
    'Or press Let the assistant import a Bible for me: the Assistant offers the KJV the app itself provides first, then looks for a Bible in your language in a free online collection.':
        'Ou appuyez sur Laisser l’assistant importer une Bible pour moi : l’assistant propose d’abord la KJV fournie par l’application, puis cherche une Bible dans votre langue dans une collection gratuite en ligne.',
    'Use verse numbers inside a passage':
        'Utiliser les numéros de verset dans un passage',
    'Click a verse number to show its notes or double-click it to select the verse; Show the next chapter loads more of a long passage.':
        'Cliquez sur un numéro de verset pour voir ses notes ou double-cliquez pour le sélectionner ; Afficher le chapitre suivant charge la suite d’un long passage.',
    'Open a name from the passage text':
        'Ouvrir un nom depuis le texte du passage',
    'Click a dotted name in the passage to open its details; Full view, collapse or close that floating panel.':
        'Cliquez sur un nom pointillé du passage pour ouvrir sa fiche ; Vue complète, réduisez ou fermez ce panneau flottant.',
    'Make the words smaller': 'Réduire les mots',
    'Press Reveal Hidden Controls under the passage, then lower Font Size.':
        'Appuyez sur Révéler les commandes masquées sous le passage, puis réduisez la Taille de police.',
    'Open John 3:16 with buttons': 'Ouvrir Jean 3:16 avec les boutons',
    'Choose the book, chapter and verse without typing a reference.':
        'Choisissez le livre, le chapitre et le verset sans saisir de référence.',
    'Go back to the previous passage': 'Revenir au passage précédent',
    'Use the passage history without typing the reference again.':
        "Utilisez l'historique sans saisir à nouveau la référence.",
    'Go forward to the next passage': 'Avancer au passage suivant',
    'Move forward again after using passage history.':
        "Avancez de nouveau après avoir utilisé l'historique.",
    'Clear the reference box': 'Effacer le champ de référence',
    "Press Clear input (Shift+Escape) to show this Bible's book buttons and start a fresh lookup.":
        'Appuyez sur Effacer la saisie (Maj+Échap) pour afficher les boutons des livres et recommencer une recherche.',
    'Change names and places language':
        'Changer la langue des noms et des lieux',
    'Remove the last part of a reference':
        "Retirer la dernière partie d'une référence",
    'Press Clear input chunk (Escape) to keep the book or chapter and correct only the last choice.':
        'Appuyez sur Effacer une partie de la saisie (Échap) pour garder le livre ou le chapitre et corriger seulement le dernier choix.',
    'Show or hide saved Bibles': 'Afficher ou masquer les Bibles enregistrées',
    'Use View > Widgets to show or hide only the saved Bibles section.':
        'Utilisez Affichage > Widgets pour afficher ou masquer uniquement la section des Bibles enregistrées.',
    'Show or hide Bible Notes': 'Afficher ou masquer les notes bibliques',
    'Use View > Widgets to show or hide only the Bible Notes section.':
        'Utilisez Affichage > Widgets pour afficher ou masquer uniquement la section des notes bibliques.',
    'Filter Bible Notes by name': 'Filtrer les notes bibliques par nom',
    'Focus Filter by name, then type part of the note you need.':
        'Placez le curseur dans Filtrer par nom, puis saisissez une partie de la note recherchée.',
    'Choose how Bible Notes are sorted': 'Choisir le tri des notes bibliques',
    'Open Sort and choose one of the available list orders.':
        'Ouvrez Trier et choisissez un des ordres disponibles pour la liste.',
    'Open Reader Settings': 'Ouvrir les paramètres du Lecteur',
    'Open Settings from the Reader header without leaving your passage.':
        'Ouvrez les paramètres depuis l’en-tête du Lecteur sans quitter votre passage.',
    'Open Reader Help': "Ouvrir l'aide du Lecteur",
    'Open Help in the Reader header for Open Online Help, Open Chatbot and Report a Problem.':
        "Ouvrez Aide dans l'en-tête du Lecteur pour Ouvrir l'aide en ligne, Ouvrir l'assistant conversationnel et Signaler un problème.",
    'Open Names and locations language to choose the language of people and places data.':
        'Ouvrez Langue des noms et des lieux pour choisir la langue des données sur les personnes et les lieux.',
    'Choose how to copy a passage': 'Choisir comment copier un passage',
    'Open the Copy menu for the passage you are reading.':
        'Ouvrez le menu Copier du passage que vous lisez.',
    'Split the passage side by side': 'Partager le passage côte à côte',
    'Make a second reading pane to the right.':
        'Créez un second volet de lecture à droite.',
    'Split the passage top and bottom': 'Partager le passage en haut et en bas',
    'Make a second reading pane underneath.':
        'Créez un second volet de lecture en dessous.',
    'Save this passage in Bibles': 'Enregistrer ce passage dans Bibles',
    'Keep the passage in your Bibles list for later.':
        'Conservez le passage dans votre liste Bibles pour plus tard.',
    'Put a passage on the audience screens':
        'Mettre un passage sur les écrans du public',
    'The Bible Reader only reads: present a passage from the Presenter, and use F9 there to clear it.':
        "Le Lecteur biblique ne fait que lire : présentez un passage depuis le Présentateur, et utilisez F9 là-bas pour l'effacer.",
    'Start automatic scrolling': 'Démarrer le défilement automatique',
    'Let a long passage move down by itself.':
        'Laissez un long passage défiler tout seul.',
    'Jump back to the top': 'Revenir directement en haut',
    'Return to the beginning of a long passage.':
        "Revenez au début d'un long passage.",
    'Toggle natural Bible line breaks':
        'Basculer les sauts de ligne naturels de la Bible',
    "Choose whether the passage follows the Bible's own line breaks.":
        'Choisissez si le passage suit les sauts de ligne de la Bible.',
    'Toggle model-based line breaks':
        'Basculer les sauts de ligne selon le modèle',
    'Choose whether supported Bibles use their formatting model.':
        'Choisissez si les Bibles compatibles utilisent leur modèle de mise en forme.',
    'Open cross references': 'Ouvrir les références croisées',
    'See AI Cross References for your passage, or right-click a verse you are editing and choose Open in Cross Reference.':
        'Consultez les Références croisées IA de votre passage, ou faites un clic droit sur un verset en cours d’édition et choisissez Ouvrir dans les références croisées.',
    'See people and places in this passage':
        'Voir les personnes et les lieux de ce passage',
    'Open the names and locations found in what you are reading.':
        'Ouvrez les noms et lieux trouvés dans votre lecture.',
    'Open passage resources': 'Ouvrir les ressources du passage',
    'Show study resources for the passage beside the Bible.':
        "Affichez les ressources d'étude du passage à côté de la Bible.",
    'Search only selected Bible books':
        'Rechercher seulement dans certains livres bibliques',
    'Find a verse you half-remember': 'Retrouver un verset à moitié oublié',
    'In Bible Find, press Find a Verse with the Assistant at the end of the All Books row, pick the Bible, then type the words you remember or what the verse is about.':
        'Dans la recherche biblique, appuyez sur Trouver un verset avec l’assistant au bout de la ligne Tous les livres, choisissez la Bible, puis tapez les mots dont vous vous souvenez ou le sujet du verset.',
    'Open All Books in Bible Find to search only some books; its menu offers Reset Selected Books and Reset Search Data.':
        'Ouvrez Tous les livres dans la recherche biblique pour ne chercher que certains livres ; son menu offre Réinitialiser les livres sélectionnés et Réinitialiser les données de recherche.',
    'Type a complete Bible reference': 'Saisir une référence biblique complète',
    'Enter a reference such as John 3:16 and open it directly.':
        'Saisissez une référence comme Jean 3:16 et ouvrez-la directement.',
    'Use the reference box shortcuts':
        'Utiliser les raccourcis du champ de référence',
    'Tab to complete (Tab) finishes a choice, Clear input chunk (Escape) removes one part, Clear input (Shift+Escape) clears all.':
        'Tab pour compléter (Tab) termine un choix, Effacer une partie de la saisie (Échap) retire une partie, Effacer la saisie (Maj+Échap) efface tout.',
    'Reuse and arrange passage history':
        "Réutiliser et organiser l'historique des passages",
    'Click a history chip to read it, or use its More Options: Open beside the current verse, Set to current editing, Save bible item, Remove.':
        "Cliquez sur une puce d'historique pour la lire, ou utilisez ses Plus d'options : Ouvrir à côté du verset actuel, Mettre dans l’édition en cours, Enregistrer l'élément biblique, Retirer.",
    'Change version and read Bible information':
        'Changer de version et lire les informations bibliques',
    'Choose a translation with the version button or Add New Bible, then open Bible Information for its publisher and copyright.':
        "Choisissez une traduction avec le bouton de version ou Ajouter une nouvelle Bible, puis ouvrez Informations sur la Bible pour l'éditeur et les droits.",
    'Choose one verse or a verse range':
        'Choisir un verset ou une plage de versets',
    'Pick a verse for the start and another for the end, Show all verses for the chapter, or Introduction where a book has one.':
        'Choisissez un verset de début et un autre de fin, Afficher tous les versets pour le chapitre, ou Introduction quand le livre en a une.',
    'Use dictionary and Word export':
        "Utiliser le dictionnaire et l'export Word",
    'Look up selected words in Wiki Dictionary or export a passage to Microsoft Word.':
        'Recherchez les mots sélectionnés dans Wiki Dictionary ou exportez le passage vers Microsoft Word.',
    'Use Bible audio and AI reading controls':
        'Utiliser les commandes audio et de lecture IA',
    'Turn on Auto Play Audio AI in Settings; where a Bible has audio, Toggle Bible Audio in its passage header turns the player on or off.':
        'Activez Auto Play Audio AI dans Paramètres ; si une Bible a de l’audio, Activer ou désactiver l’audio de la Bible dans l’en-tête du passage allume ou coupe le lecteur.',
    'Edit and arrange reading panes':
        'Modifier et organiser les volets de lecture',
    "Edit a pane's reference with Click to edit this section or its Book, Chapter and Verse Start buttons, change its version, or close it.":
        'Modifiez la référence d’un volet avec Cliquez pour modifier cette section ou ses boutons Livre, Chapitre et Verset de début, changez sa version ou fermez-le.',
    'Master Bible Find results':
        'Maîtriser les résultats de recherche biblique',
    'Pick the version, page through hits, then Open, Open beside the current verse or Save bible item; Refresh runs the search again.':
        "Choisissez la version, parcourez les pages de résultats, puis Ouvrir, Ouvrir à côté du verset actuel ou Enregistrer l'élément biblique ; Actualiser relance la recherche.",
    'Explore people and place details':
        'Explorer les détails des personnes et des lieux',
    'Select a record, then use Parents, Children and other sections, Open in bible lookup, Open in another Bible, Copy or Open in Google Maps.':
        'Choisissez une fiche, puis Parents, Enfants et les autres sections, Ouvrir dans la recherche biblique, Ouvrir dans une autre Bible, Copier ou Ouvrir dans Google Maps.',
    'Explore the connection graph': 'Explorer le graphe de relations',
    'Open a graph from a record, expand relations, filter, drag, pan, zoom, and find connections.':
        'Ouvrez un graphe depuis une fiche, développez et filtrez les relations, déplacez, zoomez et trouvez des liens.',
    'Organize and share a connection graph':
        'Organiser et partager un graphe de relations',
    'Re-layout, Undo, Set as centre or Use as root, then copy, save, print, or open the drawn view.':
        'Réorganiser, Annuler, Définir comme centre ou Utiliser comme racine, puis copiez, enregistrez, imprimez ou ouvrez la vue dessinée.',
    'Organize passage resources by filename':
        'Organiser les ressources par nom de fichier',
    'Name files by book and chapter so they appear beside the right passage.':
        "Nommez les fichiers par livre et chapitre afin qu'ils apparaissent près du bon passage.",
    'Build and use your Resources library':
        'Créer et utiliser votre bibliothèque de ressources',
    'Add or drop folders, search and reload them, open files or links, add files, or copy them into app data.':
        'Ajoutez ou déposez des dossiers, recherchez et rechargez-les, ouvrez des fichiers ou des liens, ajoutez des fichiers ou copiez-les dans les données de l’app.',
    'Highlight and comment on Bible text':
        'Surligner et commenter le texte biblique',
    'Select words in one verse, then use Highlight, Add Comment or Remove Marks; Delete Comment takes a comment off.':
        'Sélectionnez des mots dans un verset, puis Surligner, Ajouter un commentaire ou Retirer les marques ; Supprimer le commentaire enlève un commentaire.',
    'Work with marked verses in Bible Notes':
        'Utiliser les versets annotés dans Notes bibliques',
    'Open, recolor, edit or move a marked verse, drag it into Bibles, or use Add to Bible List.':
        'Ouvrez, recolorez, modifiez ou déplacez un verset marqué, faites-le glisser dans Bibles, ou utilisez Ajouter à la liste biblique.',
    'Use the Reader header tools': "Utiliser les outils d'en-tête du Lecteur",
    'Use Go Back to Presenter, Setting, App Assistant, AI Chat, and Help: Open Online Help, Open Chatbot or Report a Problem.':
        "Utilisez Retour au Présentateur, Paramètres, Assistant de l'application, Chat IA et Aide : Ouvrir l'aide en ligne, Ouvrir l'assistant conversationnel ou Signaler un problème.",
    'Reload or force-reload the Reader':
        'Recharger ou forcer le rechargement du Lecteur',
    'Use Reload for a normal refresh; use Force Reload only to bypass cached app files.':
        'Utilisez Recharger normalement; utilisez Forcer le rechargement seulement pour ignorer le cache.',
    'Restart the whole app with Relaunch':
        "Redémarrer toute l'application avec Relancer",
    'Use View > Relaunch when every app window needs a clean restart; the app asks first.':
        "Utilisez Affichage > Relancer pour redémarrer toutes les fenêtres; l'application demande confirmation.",
    'Open Developer Tools for diagnostics':
        'Ouvrir les outils de développement pour le diagnostic',
    'Use View > Toggle Developer Tools only when troubleshooting or collecting technical details.':
        'Utilisez Affichage > Outils de développement uniquement pour le dépannage ou les détails techniques.',
    'Zoom the whole Reader interface': "Agrandir toute l'interface du Lecteur",
    'Use Actual Size, Zoom In, or Zoom Out for the whole window; Font Size changes Bible text only.':
        'Utilisez Taille réelle, Zoom avant ou Zoom arrière pour toute la fenêtre; Taille de police ne change que le texte biblique.',
    'Make the whole app window full screen':
        "Mettre toute la fenêtre de l'application en plein écran",
    'Use View > Toggle Full Screen or F11; the passage Full button is the reading-only alternative.':
        'Utilisez Affichage > Plein écran ou F11; le bouton Plein du passage agrandit seulement la lecture.',
    'Show or hide Reader panels from View':
        'Afficher ou masquer les panneaux depuis Affichage',
    'Use View > Widgets to check or uncheck Bible and Notes, Bibles, Bible Notes, Bible Lookup, and study panes.':
        "Utilisez Affichage > Widgets pour afficher ou masquer Bible et notes, Bibles, Notes bibliques, Recherche biblique et les volets d'étude.",
    'Restore every Reader panel layout':
        'Restaurer la disposition de tous les panneaux',
    'Use View > Reset Widgets Size to restore defaults and reopen collapsed panels after confirmation.':
        'Utilisez Affichage > Réinitialiser la taille des widgets pour restaurer les valeurs par défaut et rouvrir les panneaux après confirmation.',
    // --- Foreground media widgets and the blend-mode picker (2026-09-24).
    // The blend names are the compositing senses: `Screen Blend` rather than
    // `Screen`, which is the projector, and `Value` for CSS `luminosity`.
    'Video Show': 'Affichage vidéo',
    'Image Show': "Affichage d'image",
    'Hide Video': 'Masquer la vidéo',
    'Hide Image': "Masquer l'image",
    'Clear FG Video Show': "Effacer l'affichage vidéo au premier plan",
    'Clear FG Image Show': "Effacer l'affichage d'image au premier plan",
    'Foreground Videos': 'Vidéos de premier plan',
    'Foreground Images': 'Images de premier plan',
    'Blend Mode': 'Mode de fusion',
    'Blends this box with the items under it':
        'Fusionne ce cadre avec les éléments en dessous',
    Darker: 'Plus sombre',
    Darken: 'Obscurcir',
    Multiply: 'Multiplier',
    'Color Burn': 'Densité couleur +',
    Brighter: 'Plus clair',
    Lighten: 'Éclaircir',
    'Screen Blend': 'Fusion Superposition claire',
    'Color Dodge': 'Densité couleur -',
    Add: 'Addition',
    'Stronger Contrast': 'Contraste renforcé',
    Overlay: 'Incrustation',
    'Soft Light': 'Lumière tamisée',
    'Hard Light': 'Lumière crue',
    Compare: 'Comparer',
    Difference: 'Différence',
    Exclusion: 'Exclusion',
    'Color Parts': 'Composantes de couleur',
    Hue: 'Teinte',
    Saturation: 'Saturation',
    Value: 'Valeur',
    // --- Canvas item shadow (2026-09-25): a box shadow is the shadow of the
    // RECTANGLE, a drop shadow the shadow of what is painted -- the letters of
    // a box with no backing, or a picture with a see-through edge.
    'No Shadow': 'Aucune ombre',
    'Box Shadow': 'Ombre du cadre',
    'Drop Shadow': 'Ombre portée',
    'A box shadow follows the box, a drop shadow the letters or picture':
        "L'ombre du cadre suit le cadre, l'ombre portée les lettres ou l'image",
    'Shadow Offset X': "Décalage X de l'ombre",
    'Shadow Offset Y': "Décalage Y de l'ombre",
    'Shadow Blur': "Flou de l'ombre",
    'Blur:': 'Flou :',
    // --- Foreground media sessions: one saved set-up (folder, Properties,
    // slide show) per session, several per widget.
    Session: 'Session',
    'Add Session': 'Ajouter une session',
    'Please stop the audio before switching session.':
        'Veuillez arrêter l’audio avant de changer de session.',
    'Rename Session': 'Renommer la session',
    'Remove Session': 'Supprimer la session',
    'Always on Top': 'Toujours au premier plan',
    'Z-Index': 'Ordre de superposition',
    'Behind Slide': 'Derrière la diapositive',
    'Show behind the slide and the Bible text, over the background':
        'Afficher derrière la diapositive et le texte biblique, au-dessus de l’arrière-plan',
    'Always on Top does not apply while it is behind the slide':
        'Toujours au premier plan ne s’applique pas tant qu’il est derrière la diapositive',
    'Slide show is running': 'Le diaporama est en cours',
    'Slide Show': 'Diaporama',
    'Start Slide Show': 'Démarrer le diaporama',
    'Stop Slide Show': 'Arrêter le diaporama',
    'Slide Show Options': 'Options du diaporama',
    'Close Slide Show Options': 'Fermer les options du diaporama',
    'Repeat All': 'Tout répéter',
    'Jumping Step': 'Pas de saut',
    Step: 'Pas',
    'Random Up To': "Aléatoire jusqu'à",
    'Random Up To Seconds': "Aléatoire jusqu'à (secondes)",
    'A New Wait Is Drawn For Each Slide':
        'Une nouvelle attente est tirée au sort pour chaque diapositive',
    'The Wait Drawn For This Slide':
        "L'attente tirée au sort pour cette diapositive",
    'Wait Until The Video Ends': 'Attendre la fin de la vidéo',
    'Next When The Video Ends': 'Suivant à la fin de la vidéo',
    'How Long This Video Runs': 'La durée de cette vidéo',
    'Next In': 'Suivant dans',
    'Play With Sound': 'Lire avec le son',
    'Hide Slide Show Controls': 'Masquer les commandes du diaporama',
    'On Screen': 'Sur l’écran',
    // --- Foreground properties: the 3x3 position pad replaces two rows of
    // align buttons, so each cell needs a name of its own.
    'Top left': 'En haut à gauche',
    'Top center': 'En haut au centre',
    'Top right': 'En haut à droite',
    'Middle left': 'Au milieu à gauche',
    'Middle center': 'Au centre',
    'Middle right': 'Au milieu à droite',
    'Bottom left': 'En bas à gauche',
    'Bottom center': 'En bas au centre',
    'Bottom right': 'En bas à droite',
    Position: 'Position',
    Round: 'Arrondi',
    'No Transition': 'Aucune transition',
    Fade: 'Fondu',
    'Slide In': 'Glissement',
    // --- Foreground Effects: the frame, the shadow, the room around the
    // words and how they are set. One fold under the Properties rows.
    Effects: 'Effets',
    Border: 'Bordure',
    'Border Width': 'Épaisseur de la bordure',
    'Border Color': 'Couleur de la bordure',
    'Shadow Color': "Couleur de l'ombre",
    Padding: 'Marge intérieure',
    'Space inside the box, in text sizes':
        "Espace à l'intérieur du cadre, en tailles de texte",
    'Text Align': 'Alignement du texte',
    'Line Height': 'Hauteur de ligne',
    '0 keeps the screen line spacing': "0 garde l'interligne de l'écran",
    'Letter Spacing': 'Espacement des lettres',
    'Text Shadow Color': "Couleur de l'ombre du texte",
    'Makes words readable over a picture or a video':
        'Rend le texte lisible sur une image ou une vidéo',
    'Text Style': 'Style du texte',
    Italic: 'Italique',
    Underline: 'Souligné',
    Uppercase: 'Majuscules',
    None: 'Aucun',
    Solid: 'Continu',
    Dashed: 'Tirets',
    Dotted: 'Pointillés',
    Double: 'Double',
    Soft: 'Douce',
    Medium: 'Moyenne',
    Strong: 'Forte',
    Glow: 'Halo',
    Outline: 'Contour',
    // Help -> Keyboard Shortcuts (src/keyboard-shortcut).
    'Keyboard Shortcuts': 'Raccourcis clavier',
    'Search shortcuts': 'Rechercher des raccourcis',
    'No shortcuts found': 'Aucun raccourci trouvé',
    'Start or stop Presenting Control':
        'Démarrer ou arrêter le contrôle de présentation',
    'Every window': 'Toutes les fenêtres',
    'Dialogs and menus': 'Boîtes de dialogue et menus',
    'Confirm the dialog': 'Valider la boîte de dialogue',
    'Cancel the dialog': 'Annuler la boîte de dialogue',
    'Move through the right-click menu': 'Parcourir le menu du clic droit',
    'Choose the highlighted menu item':
        "Choisir l'élément de menu en surbrillance",
    'Jump to a menu item by its first letter':
        'Aller à un élément de menu par sa première lettre',
    Screens: 'Écrans',
    'Show or hide the selected screens':
        'Afficher ou masquer les écrans sélectionnés',
    'Show or take down Messages': 'Afficher ou retirer les messages',
    'While the Messages panel is open': 'Quand le panneau Messages est ouvert',
    'Next slide': 'Diapositive suivante',
    'Previous slide': 'Diapositive précédente',
    'Select all slides': 'Sélectionner toutes les diapositives',
    'Copy the selected slides': 'Copier les diapositives sélectionnées',
    'Paste slides': 'Coller des diapositives',
    'Duplicate the selected slides': 'Dupliquer les diapositives sélectionnées',
    'Delete the selected slides': 'Supprimer les diapositives sélectionnées',
    'Clear the slide selection': 'Effacer la sélection de diapositives',
    'While the slides panel has focus':
        'Quand le panneau des diapositives a le focus',
    'While a Presenting Flow preview has focus':
        "Quand l'aperçu d'un déroulé a le focus",
    'Go to the next item': "Passer à l'élément suivant",
    'While the current part of Long Text Show has focus':
        "Quand la partie en cours de l'affichage de texte long a le focus",
    'Bring the next part to the middle':
        "Amener la partie suivante au milieu de l'écran",
    'Bring the previous part to the middle':
        "Amener la partie précédente au milieu de l'écran",
    'Take the keys back to what is being presented':
        'Rendre les touches à ce qui est présenté',
    'Pressed 3 times quickly while another part of the app has focus':
        "Appuyé 3 fois rapidement quand une autre partie de l'application a le focus",
    "While a mini screen's Drawing panel has focus":
        "Quand le panneau Dessin d'un mini-écran a le focus",
    'Back to painting': 'Revenir au pinceau',
    "While a mini screen's Focusing panel has focus":
        "Quand le panneau Focalisation d'un mini-écran a le focus",
    'While Presenting Control is open':
        'Quand le contrôle de présentation est ouvert',
    'Back to using the app': "Revenir à l'utilisation de l'application",
    'While a drawing tool is in use': 'Quand un outil de dessin est actif',
    'Close the Bible Lookup popup': 'Fermer la fenêtre de recherche biblique',
    'Open the typed reference': 'Ouvrir la référence saisie',
    'Complete the typed reference': 'Compléter la référence saisie',
    'Remove the last part of the reference':
        'Retirer la dernière partie de la référence',
    'Clear the reference': 'Effacer la référence',
    'Move through the books and chapters':
        'Parcourir les livres et les chapitres',
    'Move between split passages': "Passer d'un passage divisé à l'autre",
    'Close the selected split passage': 'Fermer le passage divisé sélectionné',
    'Focus the slide canvas': 'Activer le canevas de la diapositive',
    'While the slide canvas has focus':
        'Quand le canevas de la diapositive a le focus',
    'Deselect the boxes': 'Désélectionner les zones',
    'Select the next box': 'Sélectionner la zone suivante',
    'Select the previous box': 'Sélectionner la zone précédente',
    'Move the selected box': 'Déplacer la zone sélectionnée',
    'Hold Shift to move further, Ctrl to move less':
        'Maintenez Maj pour aller plus loin, Ctrl pour aller moins loin',
    'Copy the selected boxes': 'Copier les zones sélectionnées',
    'Paste boxes or a copied Bible passage':
        'Coller des zones ou un passage biblique copié',
    'Duplicate the selected boxes': 'Dupliquer les zones sélectionnées',
    'Delete the selected boxes': 'Supprimer les zones sélectionnées',
    'Finish editing the text': 'Terminer la modification du texte',
    'While typing in a text box': 'Pendant la saisie dans une zone de texte',
    'Cancel editing the text': 'Annuler la modification du texte',
    'While the Bible Lookup is open': 'Quand la recherche biblique est ouverte',
    'Screen not shown': 'Écran non affiché',
    'Its Screen Mirror display is not connected. Connect that computer, or choose another display for this screen.':
        "Son affichage Écran miroir n'est pas connecté. Connectez cet ordinateur ou choisissez un autre affichage pour cet écran.",
    'Failed to load the font list':
        'Impossible de charger la liste des polices',
    'Guest display, not connected': 'Affichage invité, non connecté',
    'Not connected': 'Non connecté',
    'Primary display': 'Affichage principal',
    'Unnamed display': 'Affichage sans nom',
    Assistant: 'Assistant',
    'clicked something': 'a cliqué sur quelque chose',
    'dragged something': 'a fait glisser quelque chose',
    'filled in a box': 'a rempli un champ',
    'filled in a form': 'a rempli un formulaire',
    'pointed at something': 'a pointé quelque chose',
    'pressed a key': 'a appuyé sur une touche',
    'typed something': 'a saisi quelque chose',
    'chose a file': 'a choisi un fichier',
    'answered a message box': 'a répondu à une boîte de message',
    'opened another page': 'a ouvert une autre page',
    'opened a window': 'a ouvert une fenêtre',
    'closed a window': 'a fermé une fenêtre',
    'resized the window': 'a redimensionné la fenêtre',
    'changed how the page is shown': "a modifié l'affichage de la page",
    'ran something in the page': 'a exécuté quelque chose dans la page',
    'took content off a screen': "a retiré du contenu d'un écran",
    'started a walkthrough': 'a démarré un guide',
    'moved the walkthrough on': 'a fait avancer le guide',
    'pointed out a control': 'a montré une commande',
    'switched the window to another page':
        'a fait passer la fenêtre à une autre page',
    'asked you to point at a control': 'vous demande de désigner une commande',
    'read a website': 'a lu un site web',
    'changed a song': 'a modifié un chant',
    'changed a slide document': 'a modifié un document de diapositives',
    'put a Bible passage on the screen':
        "a affiché un passage biblique à l'écran",
    'opened a verse in the Bible Lookup':
        'a ouvert un verset dans la Recherche biblique',
    'put a countdown or a message on the screen':
        "a affiché un compte à rebours ou un message à l'écran",
    'changed the saved Bible passages':
        'a modifié les passages bibliques enregistrés',
    'changed a Bible note': 'a modifié une note biblique',
    'put back an earlier change': 'a annulé une modification précédente',
    'chose a menu item': 'a choisi un élément du menu',
    'scrolled a list': 'a fait défiler une liste',
    'changed a media file': 'a modifié un fichier multimédia',
    'put a song back as saved': 'a remis un chant à son état enregistré',
    'put a slide document back as saved':
        'a remis un document de diapositives à son état enregistré',
    'made a web page': 'a créé une page web',
    'changed a web page': 'a modifié une page web',
    'renamed a media file': 'a renommé un fichier multimédia',
    'moved a media file to the trash':
        'a déplacé un fichier multimédia vers la corbeille',
    'imported a media file from the disk':
        'a importé un fichier multimédia depuis le disque',
    'changed a run sheet': 'a modifié un déroulé',
    'made a run sheet': 'a créé un déroulé',
    'renamed a run sheet': 'a renommé un déroulé',
    'moved a run sheet to the trash': 'a déplacé un déroulé vers la corbeille',
    'added a line to a run sheet': 'a ajouté une ligne à un déroulé',
    'removed a line from a run sheet': "a retiré une ligne d'un déroulé",
    'moved a line in a run sheet': 'a déplacé une ligne dans un déroulé',
    'copied a line in a run sheet': 'a copié une ligne dans un déroulé',
    'parked a line in a run sheet': 'a désactivé une ligne dans un déroulé',
    'put a line of a run sheet back in play':
        "a réactivé une ligne d'un déroulé",
    'started a countdown on the screen':
        "a lancé un compte à rebours à l'écran",
    'started a stopwatch on the screen': "a lancé un chronomètre à l'écran",
    'put a clock on the screen': "a affiché une horloge à l'écran",
    'put a scrolling message on the screen':
        "a affiché un bandeau défilant à l'écran",
    'put a line of text on the screen':
        "a affiché une ligne de texte à l'écran",
    'took a foreground extra off the screen':
        "a retiré un élément de premier plan de l'écran",
    'took every foreground extra off the screen':
        "a retiré tous les éléments de premier plan de l'écran",
    'made a song': 'a créé un chant',
    'made a slide document': 'a créé un document de diapositives',
    'renamed a song': 'a renommé un chant',
    'renamed a slide document': 'a renommé un document de diapositives',
    'moved a song to the trash': 'a mis un chant à la corbeille',
    'moved a slide document to the trash':
        'a mis un document de diapositives à la corbeille',
    'added a slide': 'a ajouté une diapositive',
    'changed a slide': 'a modifié une diapositive',
    'removed a slide': 'a retiré une diapositive',
    'moved a slide': 'a déplacé une diapositive',
    'copied a slide': 'a copié une diapositive',
    'saved a Bible passage': 'a enregistré un passage biblique',
    'changed a saved Bible passage': 'a modifié un passage biblique enregistré',
    'removed a saved Bible passage': 'a retiré un passage biblique enregistré',
    'made a Bibles list': 'a créé une liste de Bibles',
    'renamed a Bibles list': 'a renommé une liste de Bibles',
    'moved a Bibles list to the trash':
        'a mis une liste de Bibles à la corbeille',
    'added a Bible note': 'a ajouté une note biblique',
    'removed a Bible note': 'a retiré une note biblique',
    'made a notes file': 'a créé un fichier de notes',
    'renamed a notes file': 'a renommé un fichier de notes',
    'moved a notes file to the trash':
        'a mis un fichier de notes à la corbeille',
    // --- Bible Properties, redesigned (2026-10-11): a stage, the looks as
    // pictures, and one row per value. `Aa` is the two letters a look is shown
    // on, in the script this window is read in.
    'For God so loved the world, that he gave his only begotten Son':
        "Car Dieu a tant aimé le monde qu'il a donné son Fils unique",
    'Light words for a dark background': 'Texte clair pour un fond sombre',
    'Dark words for a light background': 'Texte sombre pour un fond clair',
    Aa: 'Aa',
    'Thin Outline': 'Contour fin',
    'Heavy Outline': 'Contour épais',
    'Soft Shadow': 'Ombre douce',
    'Deep Shadow': 'Ombre profonde',
    'Hard Shadow': 'Ombre nette',
    Lifted: 'En relief',
    Haze: 'Brume',
    Halo: 'Auréole',
    'Blue Edge': 'Bord bleu',
    Bold: 'Gras',
    Justify: 'Justifier',
    'Outline Color': 'Couleur du contour',
    'Glow Color': 'Couleur du halo',
    'A CSS text-shadow of your own': 'Votre propre text-shadow CSS',
    'Plain words again; the size stays':
        'Retour au texte simple ; la taille reste',
    // A look somebody made can be kept as a tile of its own.
    Preset: 'Préréglage',
    'Save as Preset': 'Enregistrer comme préréglage',
    'Rename Preset': 'Renommer le préréglage',
    'Replace with Current Look': "Remplacer par l'apparence actuelle",
    'Remove Preset': 'Supprimer le préréglage',
    'Remove a preset to save a new one':
        'Supprimez un préréglage pour en enregistrer un nouveau',
    // The walkthrough card's own words (`listGuideCardTranKeys` in
    // tools/owa-devtools-mcp/guide.mjs): it sits in the app window, so it
    // speaks the app's language. `Step` is a slider's step elsewhere.
    Done: 'Terminé',
    'Do it': 'Le faire pour moi',
    Skip: 'Passer',
    'Step by step': 'Étape par étape',
    'Walkthrough step': 'Étape',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    '{title} — the last read failed: {error}':
        '{title} — la dernière lecture a échoué : {error}',
    '{title} — {count} shared': '{title} — {count} partagés',
    '{title} — {count} shared, read at {time}':
        '{title} — {count} partagés, lus à {time}',
    'my screen': 'mon écran',
    'app screen': 'écran de l’application',
    'my {window} window': 'ma fenêtre {window}',
    'Fetching the list…': 'Chargement de la liste…',
    'The full list is not available right now — the four above still work, and so does anything you type.':
        'La liste complète n’est pas disponible pour le moment — les quatre ci-dessus fonctionnent toujours, tout comme ce que vous tapez.',
    '{count} questions it is ready for here. Type a few words in the box to narrow them down.':
        '{count} questions auxquelles il peut répondre ici. Tapez quelques mots dans la zone pour affiner la liste.',
    'No AI model or account needed. Press one, then use {button} in the Reader for one safe step at a time.':
        'Aucun modèle d’IA ni compte nécessaire. Appuyez sur l’une d’elles, puis utilisez {button} dans le Lecteur, une étape sûre à la fois.',
    'Try a guided demo': 'Essayer une démonstration guidée',
    'Opens {address} in your browser': 'Ouvre {address} dans votre navigateur',
    'Spending limit per hour': 'Limite de dépense par heure',
    'Lift the pause and start the hour again: the whole limit is available once more from now.':
        'Lever la pause et recommencer l’heure : toute la limite est de nouveau disponible à partir de maintenant.',
    'Which part of the app': 'Quelle partie de l’application',
    'Which window of the app you are asking about. It starts on the window you launch it from; your choice stays until the next launch.':
        'La fenêtre de l’application sur laquelle porte votre question. Elle commence sur la fenêtre d’où vous l’ouvrez ; votre choix reste jusqu’à la prochaine ouverture.',
    'Working in': 'Travaille dans',
    'Which window': 'Quelle fenêtre',
    'Which of the open windows of the app the help looks at and works in: it reads that window, outlines buttons in it, and the 📷 and ◎ beside the box work there. The main window unless you choose another.':
        'La fenêtre ouverte de l’application que l’aide regarde et dans laquelle elle travaille : elle lit cette fenêtre, y entoure les boutons, et le 📷 et le ◎ à côté de la zone y fonctionnent. La fenêtre principale, sauf si vous en choisissez une autre.',
    '— no key needed, shared public service':
        '— aucune clé nécessaire, service public partagé',
    '{name} — needs an API key': '{name} — nécessite une clé API',
    '{names} and {last}': '{names} et {last}',
    'Which assistant answers': 'Quel assistant répond',
    '{names} need an API key of your own — add one in Settings → AI Providers':
        "{names} nécessitent votre propre clé API — ajoutez-en une dans Paramètres → Fournisseurs d'IA",
    '{name} answers your questions here': '{name} répond à vos questions ici',
    'No AI key': 'Aucune clé d’IA',
    '{name} answered the last question.':
        '{name} a répondu à la dernière question.',
    'Read the whole notice': 'Lire tout l’avis',
    'Fold this notice': 'Replier cet avis',
    Fold: 'Replier',
    'Who answers:': 'Qui répond :',
    'Open {address}': 'Ouvrir {address}',
    'Which model answers': 'Quel modèle répond',
    'Loading…': 'Chargement…',
    'More models…': 'Plus de modèles…',
    '(main window, {window})': '(fenêtre principale, {window})',
    '({window} window)': '(fenêtre {window})',
    '{name} — not attached any more': '{name} — n’est plus joint',
    '{name} — press to ring it in the app':
        '{name} — appuyez pour l’entourer dans l’application',
    '{name} — press to see it bigger': '{name} — appuyez pour l’agrandir',
    '{name} — press to open it': '{name} — appuyez pour l’ouvrir',
    'Remove {name}': 'Retirer {name}',
    'This window cannot show this kind of file. Download it or open its folder to look at it.':
        'Cette fenêtre ne peut pas afficher ce type de fichier. Téléchargez-le ou ouvrez son dossier pour le voir.',
    'Copy this answer': 'Copier cette réponse',
    'Could not copy': 'Copie impossible',
    'Copy {name} to the clipboard': 'Copier {name} dans le presse-papiers',
    'Could not copy the picture': 'Impossible de copier l’image',
    'Copy the picture to the clipboard':
        'Copier l’image dans le presse-papiers',
    'The song text, as it will be saved':
        'Le texte du chant, tel qu’il sera enregistré',
    'The song text that would be saved':
        'Le texte du chant qui serait enregistré',
    You: 'Vous',
    'Put this question back in the box': 'Remettre cette question dans la zone',
    'Ask again': 'Redemander',
    'This answer helped': 'Cette réponse m’a aidé',
    'Good answer': 'Bonne réponse',
    'This answer was wrong or did not help':
        'Cette réponse était fausse ou ne m’a pas aidé',
    'Bad answer': 'Mauvaise réponse',
    'Looking it up… press Stop to give up on it.':
        'Recherche en cours… appuyez sur Arrêter pour abandonner.',
    '{count} earlier step': '{count} étape précédente',
    '{count} earlier steps': '{count} étapes précédentes',
    'press Stop to give up on it.': 'appuyez sur Arrêter pour abandonner.',
    'Show me another thing this window can do':
        'Montrez-moi autre chose que cette fenêtre sait faire',
    'Tip: {tip} Press for another tip.':
        'Astuce : {tip} Appuyez pour une autre astuce.',
    'The tip before this one': 'L’astuce précédente',
    'Previous tip': 'Astuce précédente',
    'The next tip': 'L’astuce suivante',
    'Hide tips for 30 days': 'Masquer les astuces pendant 30 jours',
    '{name} could not answer — {reason}.':
        '{name} n’a pas pu répondre — {reason}.',
    'I wrote the song out myself instead.':
        'J’ai écrit le chant moi-même à la place.',
    "Here is what the app's own guide says.":
        'Voici ce que dit le guide de l’application.',
    'Putting your words into English with {model}':
        'Traduction de vos mots en anglais avec {model}',
    'The other models could not be listed — {reason}':
        'Impossible d’afficher la liste des autres modèles — {reason}',
    'I cannot read {names} — try a picture of it instead.':
        'Je ne peux pas lire {names} — essayez plutôt avec une image.',
    '{names} is too large to attach — {size} MB at most.':
        '{names} est trop volumineux pour être joint — {size} Mo au maximum.',
    '{name} is not there any more.': '{name} n’est plus là.',
    'Ask the Assistant About This File':
        'Demander à l’assistant à propos de ce fichier',
    '{name} is attached below. Ask me anything about what is in it, or press a question.':
        '{name} est joint ci-dessous. Posez-moi n’importe quelle question sur son contenu, ou appuyez sur une question.',
    'This is Bible chapter study material with verse text, cross-references, and explanations arranged by verse.':
        'Il s’agit d’un document d’étude d’un chapitre biblique, avec le texte des versets, des références croisées et des explications classées par verset.',
    'What is this file about?': 'De quoi parle ce fichier ?',
    'Sum up the main points': 'Résumer les points principaux',
    'Explain it in simple words': 'L’expliquer avec des mots simples',
    Read: 'Lire',
    'Full chapter': 'Chapitre entier',
    'Which verses in this chapter do you want to focus on? For example, type 1–3, or choose below.':
        'Sur quels versets de ce chapitre voulez-vous vous concentrer ? Par exemple, saisissez 1–3 ou choisissez ci-dessous.',
    'Which verse in this chapter do you want to focus on? For example, type 1, or choose below.':
        'Sur quel verset de ce chapitre voulez-vous vous concentrer ? Par exemple, saisissez 1 ou choisissez ci-dessous.',
    'This file belongs to the whole book, not to one chapter — like an introduction to it.':
        'Ce fichier concerne le livre entier, pas un seul chapitre — comme une introduction à ce livre.',
    'You are reading {passage} in the Bible Reader.':
        'Vous lisez {passage} dans le Lecteur biblique.',
    'You are reading {passage} in the Bible Reader. Press {range} to read what this file says about it.':
        'Vous lisez {passage} dans le Lecteur biblique. Appuyez sur {range} pour lire ce que ce fichier en dit.',
    'What does it say about {passage}?': 'Que dit ce fichier sur {passage} ?',
    'Which verse in this chapter do you want to focus on? You are reading {range} — press it, or choose another below.':
        'Sur quel verset de ce chapitre voulez-vous vous concentrer ? Vous lisez {range} — appuyez dessus ou choisissez-en un autre ci-dessous.',
    'AI analysis can make mistakes. Please read the passage, cross-references, and explanation yourself in the original Bible and PDF.':
        'L’analyse par IA peut contenir des erreurs. Lisez vous-même le passage, les références croisées et l’explication dans la Bible et le PDF d’origine.',
    'I could not read the PDF explanation reliably, so I did not show it. Please check the original PDF yourself or try a model that can read pictures better.':
        'Je n’ai pas pu lire l’explication du PDF de façon fiable, donc je ne l’ai pas affichée. Vérifiez vous-même le PDF original ou essayez un modèle qui lit mieux les images.',
    'This file goes with every question in this tab. Press × when you are done with it.':
        'Ce fichier accompagne chaque question dans cet onglet. Appuyez sur × quand vous avez terminé.',
    'Still asking about': 'Toujours à propos de',
    'Ask the Assistant About This Person':
        'Demander à l’assistant à propos de cette personne',
    'Ask the Assistant About This Place':
        'Demander à l’assistant à propos de ce lieu',
    'Ask the Assistant About This Passage':
        'Demander à l’assistant à propos de ce passage',
    'Ask the Assistant About This Verse':
        'Demander à l’assistant à propos de ce verset',
    'Open in Chatbot': "Ouvrir dans l'assistant conversationnel",
    'More things to do': 'Autres choses à faire',
    'Previous chapter': 'Chapitre précédent',
    'Next chapter': 'Chapitre suivant',
    'Previous verse': 'Verset précédent',
    'Next verse': 'Verset suivant',
    'Read it in another Bible': 'Le lire dans une autre Bible',
    'Who and where is in it': 'Qui et quels lieux y figurent',
    'Family and places': 'Famille et lieux',
    'Related places': 'Lieux liés',
    'Its verses': 'Ses versets',
    'Family line to Jesus': 'Lignée jusqu’à Jésus',
    'Open another passage': 'Ouvrir un autre passage',
    'Save to my Bibles list': 'Enregistrer dans ma liste de Bibles',
    'Copy the passage': 'Copier le passage',
    'Show it on a map': 'Le montrer sur une carte',
    'Related verses': 'Versets liés',
    'Study files for this chapter': 'Fichiers d’étude pour ce chapitre',
    'Study the words': 'Étudier les mots',
    'All words': 'Tous les mots',
    'Another verse': 'Un autre verset',
    'Choose a word': 'Choisir un mot',
    'More words': 'Plus de mots',
    'I could not read the words of {name} just now.':
        'Je n’ai pas pu lire les mots de {name} pour le moment.',
    'Which verse of {name} do you want to study? Press one, and I will list its words.':
        'Quel verset de {name} voulez-vous étudier ? Appuyez sur l’un d’eux, et j’en listerai les mots.',
    'Press a word to learn it, or {all} to learn every word of the verse.':
        'Appuyez sur un mot pour l’apprendre, ou sur {all} pour apprendre chaque mot du verset.',
    'Next word: {word}': 'Mot suivant : {word}',
    'Search Google for {word}': 'Rechercher {word} sur Google',
    'Teach me every word of {verse}': 'Apprendre chaque mot de {verse}',
    'Teach me the word {word}': 'Apprendre le mot {word}',
    'Teaching a word needs an assistant, and none could answer just now. You can search Google for it, or pick an assistant in the row above and ask again.':
        'Enseigner un mot demande un assistant, et aucun n’a pu répondre pour le moment. Vous pouvez le rechercher sur Google, ou choisir un assistant dans la ligne du haut et redemander.',
    'Opened a Google search for {word} in your browser.':
        'Recherche Google de {word} ouverte dans votre navigateur.',
    'Which other verses are related to this passage?':
        'Quels autres versets sont liés à ce passage ?',
    "The app's cross references lead from it to {count} other verses.":
        'Les références croisées de l’application mènent de ce passage à {count} autres versets.',
    'Resources has {count} study files for its chapter.':
        'Les Ressources ont {count} fichiers d’étude pour son chapitre.',
    'You have notes or marks of your own on {count} of its verses.':
        'Vous avez vos propres notes ou marques sur {count} de ses versets.',
    'What did I note on these verses?': 'Qu’ai-je noté sur ces versets ?',
    "The app's cross references have nothing for {name}.":
        'Les références croisées de l’application n’ont rien pour {name}.',
    "The app's cross references lead from {name} to {count} other verses. Press one to read it with me.":
        'Les références croisées de l’application mènent de {name} à {count} autres versets. Appuyez sur l’un d’eux pour le lire avec moi.',
    '{count} of its verses': '{count} de ses versets',
    'verses {list}': 'versets {list}',
    'What most of its verses point to':
        'Ce vers quoi la plupart de ses versets renvoient',
    'In the Old Testament': 'Dans l’Ancien Testament',
    'In the New Testament': 'Dans le Nouveau Testament',
    'In the New Testament, about the chapters around it':
        'Dans le Nouveau Testament, sur les chapitres qui l’entourent',
    'In the Old Testament, about the chapters around it':
        'Dans l’Ancien Testament, sur les chapitres qui l’entourent',
    'Themes, verse by verse': 'Thèmes, verset par verset',
    'Verse {verse}: {themes}': 'Verset {verse} : {themes}',
    'Resources has no study files for the chapter of {name}.':
        'Les Ressources n’ont aucun fichier d’étude pour le chapitre de {name}.',
    'The study files in Resources for the chapter of {name}. Press one to ask about it.':
        'Les fichiers d’étude des Ressources pour le chapitre de {name}. Appuyez sur l’un d’eux pour poser une question à son sujet.',
    'The names lookup has no point on a map for {name}.':
        'La recherche des noms n’a pas de point sur une carte pour {name}.',
    'Opened {name} on a map in your browser.':
        '{name} est ouvert sur une carte dans votre navigateur.',
    'Press {button} to open {name} on a map in your browser.':
        'Appuyez sur {button} pour ouvrir {name} sur une carte dans votre navigateur.',
    'Press {name} under the passage above.':
        'Appuyez sur {name} sous le passage ci-dessus.',
    'Here is {name} from the Bible it was opened in.':
        'Voici {name} d’après la Bible dans laquelle il a été ouvert.',
    'Here is the family line in {passage}, in the order it gives it:':
        'Voici la lignée dans {passage}, dans l’ordre qu’elle donne :',
    'Here is the family line in {passage}, from the Bible {bible}, in the order it gives it:':
        'Voici la lignée dans {passage}, d’après la Bible {bible}, dans l’ordre qu’elle donne :',
    'Neither family line the Bible gives — Matthew 1 and Luke 3 — names {name}.':
        'Aucune des deux lignées que donne la Bible — Matthieu 1 et Luc 3 — ne nomme {name}.',
    'The record names no children of {name}.':
        'La fiche ne nomme aucun enfant de {name}.',
    'The record names no husband or wife of {name}.':
        'La fiche ne nomme aucun conjoint de {name}.',
    'The record names no brothers or sisters of {name}.':
        'La fiche ne nomme aucun frère ni sœur de {name}.',
    'The record names no parents of {name}.':
        'La fiche ne nomme aucun parent de {name}.',
    'The record names {count} children of {name}: {names}.':
        'La fiche nomme {count} enfants de {name} : {names}.',
    'The record names {count} husbands or wives of {name}: {names}.':
        'La fiche nomme {count} conjoints de {name} : {names}.',
    'The record names {count} brothers and sisters of {name}: {names}.':
        'La fiche nomme {count} frères et sœurs de {name} : {names}.',
    'The record names {count} parents of {name}: {names}.':
        'La fiche nomme {count} parents de {name} : {names}.',
    'The names lookup lists no family or places for {name}.':
        'Lieu-Nom n’indique ni famille ni lieux pour {name}.',
    'The family and places of {name}. Press one to ask about it.':
        'La famille et les lieux de {name}. Appuyez sur l’un d’eux pour poser une question.',
    'Places related to {name}. Press one to ask about it.':
        'Les lieux liés à {name}. Appuyez sur l’un d’eux pour poser une question.',
    'The names lookup lists no verses for {name}.':
        'Lieu-Nom n’indique aucun verset pour {name}.',
    'Verses about {name}. Press one to read it with me.':
        'Les versets sur {name}. Appuyez sur l’un d’eux pour le lire avec moi.',
    'The names lookup lists {count} verses; these are the first {shown}.':
        'Lieu-Nom indique {count} versets ; voici les {shown} premiers.',
    'The names lookup has nobody and no place in {name}.':
        'Lieu-Nom n’a ni personne ni lieu dans {name}.',
    'People and places in {name}. Press one to ask about it.':
        'Les personnes et les lieux dans {name}. Appuyez sur l’un d’eux pour poser une question.',
    'This is the only Bible on this computer.':
        'C’est la seule Bible sur cet ordinateur.',
    'Which Bible should I read {name} in?':
        'Dans quelle Bible dois-je lire {name} ?',
    'What would you like to do with {name}?':
        'Que voulez-vous faire avec {name} ?',
    'I opened {name} in the Bible Lookup.':
        'J’ai ouvert {name} dans la recherche biblique.',
    'I could not open {name} in the Bible Lookup just now.':
        'Je n’ai pas pu ouvrir {name} dans la recherche biblique pour l’instant.',
    'There is no passage after {name} in this Bible.':
        'Il n’y a pas de passage après {name} dans cette Bible.',
    'There is no passage before {name} in this Bible.':
        'Il n’y a pas de passage avant {name} dans cette Bible.',
    'Type the passage you want, like John 3:16 or Psalm 23.':
        'Tapez le passage voulu, comme Jean 3:16 ou Psaume 23.',
    'I could not read “{words}”. Type it like John 3:16 or Psalm 23.':
        'Je n’ai pas pu lire « {words} ». Tapez-le comme Jean 3:16 ou Psaume 23.',
    'Saved {name} to your Bibles list.':
        '{name} est enregistré dans votre liste de Bibles.',
    'I could not save {name} just now.':
        'Je n’ai pas pu enregistrer {name} pour l’instant.',
    'Copied {name}.': '{name} copié.',
    'I could not copy it just now.': 'Je n’ai pas pu le copier pour l’instant.',
    'I could not do that just now.': 'Je n’ai pas pu le faire pour l’instant.',
    'Reading {name} from the app': 'Lecture de {name} dans l’application',
    'I could not read {name} from the app just now. Ask me about it anyway and I will try again.':
        'Je n’ai pas pu lire {name} dans l’application pour l’instant. Posez-moi quand même votre question et je réessaierai.',
    'I have read {name}. Ask me anything about this passage, or press a question.':
        'J’ai lu {name}. Posez-moi n’importe quelle question sur ce passage, ou appuyez sur une question.',
    'I have read {name} in the Bible {bible}. Ask me anything about this passage, or press a question.':
        'J’ai lu {name} dans la Bible {bible}. Posez-moi n’importe quelle question sur ce passage, ou appuyez sur une question.',
    'I have read what the names lookup holds on {name} (drawn from the King James Version). Ask me anything about this person, or press a question.':
        'J’ai lu ce que Lieu-Nom contient sur {name} (tiré de la version King James). Posez-moi n’importe quelle question sur cette personne, ou appuyez sur une question.',
    'I have read what the names lookup holds on {name} (drawn from the King James Version). Ask me anything about this place, or press a question.':
        'J’ai lu ce que Lieu-Nom contient sur {name} (tiré de la version King James). Posez-moi n’importe quelle question sur ce lieu, ou appuyez sur une question.',
    'Explain this passage in simple words':
        'Expliquer ce passage avec des mots simples',
    'What is happening around this passage?':
        'Que se passe-t-il autour de ce passage ?',
    'How can I apply this passage today?':
        'Comment puis-je appliquer ce passage aujourd’hui ?',
    'Who was {name}?': 'Qui était {name} ?',
    'What does the Bible say about {name}?': 'Que dit la Bible sur {name} ?',
    'Tell me about the family of {name}': 'Parlez-moi de la famille de {name}',
    'Where is {name}?': 'Où se trouve {name} ?',
    'What happened at {name} in the Bible?':
        'Que s’est-il passé à {name} dans la Bible ?',
    'Which verses mention {name}?': 'Quels versets mentionnent {name} ?',
    'No assistant could answer just now, so here is what the app holds on {name}.':
        'Aucun assistant n’a pu répondre pour l’instant, voici donc ce que l’application contient sur {name}.',
    'A question about this needs an assistant, and none could answer just now. Pick one in the row above, or add a key in Settings → AI Providers, and ask again.':
        "Une question à ce sujet nécessite un assistant, et aucun n’a pu répondre pour l’instant. Choisissez-en un dans la ligne ci-dessus, ou ajoutez une clé dans Paramètres → Fournisseurs d'IA, puis redemandez.",
    'What the app holds on this goes with every question in this tab. Press × when you are done with it.':
        'Ce que l’application contient à ce sujet accompagne chaque question dans cet onglet. Appuyez sur × quand vous avez terminé.',
    'Reading what the names lookup has on “{words}”':
        'Lecture de ce que Lieu-Nom contient sur « {words} »',
    'Reading the names lookup': 'Lecture de Lieu-Nom',
    'Reading “{words}” from Resources':
        'Lecture de « {words} » dans les Ressources',
    'Looking through Resources': 'Recherche dans les Ressources',
    'I could not take a picture of the app.':
        'Je n’ai pas pu prendre une image de l’application.',
    'I could not take a picture: {reason}':
        'Je n’ai pas pu prendre une image : {reason}',
    'Point at the control you mean in the app window…':
        'Désignez la commande voulue dans la fenêtre de l’application…',
    'Point at the control you mean in the {window} window…':
        'Désignez la commande voulue dans la fenêtre {window}…',
    'Nothing was picked in the app window.':
        'Rien n’a été désigné dans la fenêtre de l’application.',
    'I could not point at that one any more.':
        'Je ne peux plus montrer celui-ci.',
    'I could not find "{name}" on screen.':
        'Je n’ai pas trouvé « {name} » à l’écran.',
    'I could not find "{name}" on screen any more.':
        'Je ne trouve plus « {name} » à l’écran.',
    'That picture is not attached any more — send a new one.':
        'Cette image n’est plus jointe — envoyez-en une nouvelle.',
    'Copied.': 'Copié.',
    'I could not copy it: {reason}': 'Je n’ai pas pu le copier : {reason}',
    'I could not download it: {reason}':
        'Je n’ai pas pu le télécharger : {reason}',
    'The assistant is not running in this copy of the app. Restart the app, then open this window again.':
        'L’assistant ne fonctionne pas dans cette copie de l’application. Redémarrez l’application, puis rouvrez cette fenêtre.',
    'Stopped. I did not finish writing the report, and nothing was sent — press Report when you want it written.':
        'Arrêté. Je n’ai pas fini de rédiger le rapport, et rien n’a été envoyé — appuyez sur Signaler quand vous voulez qu’il soit rédigé.',
    'Stopped. I did not finish looking that up — press the question above to ask it again.':
        'Arrêté. Je n’ai pas fini de chercher — appuyez sur la question ci-dessus pour la reposer.',
    'This chat is locked, so it keeps its messages. Unlock it from ⋮ on its tab first, then type `/clear` again.':
        'Cette conversation est verrouillée, elle garde donc ses messages. Déverrouillez-la d’abord avec ⋮ sur son onglet, puis tapez à nouveau `/clear`.',
    'Searching {bible} for your words': 'Recherche de vos mots dans {bible}',
    'Reading the newest copy of that guide page':
        'Lecture de la version la plus récente de cette page du guide',
    'A general question needs an assistant, and none could answer just now. Pick one in the row above, or add a key in Settings → AI Providers, and ask again.':
        "Une question générale nécessite un assistant, et aucun n’a pu répondre pour l’instant. Choisissez-en un dans la ligne ci-dessus, ou ajoutez une clé dans Paramètres → Fournisseurs d'IA, puis redemandez.",
    'I cannot look at pictures while I am offline. Tell me in a few words what you can see and what you were trying to do, and I will look it up in the guide.':
        'Je ne peux pas regarder d’images hors ligne. Dites-moi en quelques mots ce que vous voyez et ce que vous essayiez de faire, et je chercherai dans le guide.',
    'Auto is checking which assistants can answer':
        'Auto vérifie quels assistants peuvent répondre',
    'Auto picked {name}': 'Auto a choisi {name}',
    '{failed} could not answer — {reason}. {provider} answered instead and this chat now uses it; pick {failed} in the row above to switch back.':
        '{failed} n’a pas pu répondre — {reason}. {provider} a répondu à la place et cette conversation l’utilise désormais ; choisissez {failed} dans la ligne ci-dessus pour revenir.',
    'Something went wrong inside the app while answering that. Ask it again, or press Report to tell the people who make the app.':
        "Un problème est survenu dans l'application en répondant. Posez la question à nouveau, ou appuyez sur Signaler pour prévenir ceux qui font l'application.",
    'I could not understand that choice. Choose an option below, or say it another way.':
        'Je n’ai pas compris ce choix. Choisissez une option ci-dessous ou dites-le autrement.',
    'I could not answer that: {reason}':
        'Je n’ai pas pu répondre à cela : {reason}',
    'You added that after I had finished looking, so there was no round left to fold it into — I asked it on its own.':
        'Vous avez ajouté cela après la fin de ma recherche, il ne restait donc aucun tour pour l’intégrer — je l’ai posé séparément.',
    'Added while it was working.': 'Ajouté pendant qu’il travaillait.',
    'Asked by the walkthrough card, not by you.':
        'Posée par la carte du guide pas à pas, pas par vous.',
    'No assistant is set up here, so this is what the window could see for itself.':
        'Aucun assistant n’est configuré ici, voici donc ce que la fenêtre a pu voir par elle-même.',
    'I could not look into it — {reason}. The report still carries what the window could see for itself.':
        'Je n’ai pas pu l’examiner — {reason}. Le rapport contient tout de même ce que la fenêtre a pu voir par elle-même.',
    'I could not put a report together: {reason}':
        'Je n’ai pas pu préparer de rapport : {reason}',
    'Tell me what went wrong first — one line in your own words in the box, then press Report. I will look at the app myself and write the rest of it.':
        'Dites-moi d’abord ce qui ne va pas — une ligne avec vos propres mots dans la zone, puis appuyez sur Signaler. J’examinerai l’application moi-même et j’écrirai le reste.',
    'That report is not prepared any more — this window has been reopened since. Say what is still wrong and press Report, and I will write it up again.':
        'Ce rapport n’est plus prêt — cette fenêtre a été rouverte depuis. Dites ce qui ne va toujours pas et appuyez sur Signaler, et je le rédigerai à nouveau.',
    'That report is not prepared any more — this window has been reopened since. Press Report again and I will put a new one together.':
        'Ce rapport n’est plus prêt — cette fenêtre a été rouverte depuis. Appuyez de nouveau sur Signaler et j’en préparerai un nouveau.',
    'Sending the report': 'Envoi du rapport',
    'Stopped. The report was not sent — press Send report when you want it to go.':
        'Arrêté. Le rapport n’a pas été envoyé — appuyez sur Envoyer le rapport quand vous voulez qu’il parte.',
    'A copy is in your Downloads folder.':
        'Une copie se trouve dans votre dossier Téléchargements.',
    'It had already gone when you pressed Stop.':
        'Il était déjà parti quand vous avez appuyé sur Arrêter.',
    'This build carries no contact address — pass the saved report on to whoever maintains the app for you.':
        'Cette version ne contient aucune adresse de contact — transmettez le rapport enregistré à la personne qui s’occupe de l’application pour vous.',
    'Copied `{email}`{source}. Paste it into the To line of your email.':
        '`{email}`{source} copié. Collez-le dans la ligne À de votre e-mail.',
    'I could not reach the clipboard. The address is `{email}` — you can select and copy it from here.':
        'Je n’ai pas pu accéder au presse-papiers. L’adresse est `{email}` — vous pouvez la sélectionner et la copier ici.',
    'I no longer have that picture — it is not in this window and not in your Downloads folder. Press Report again and I will take a new one.':
        'Je n’ai plus cette image — elle n’est ni dans cette fenêtre ni dans votre dossier Téléchargements. Appuyez de nouveau sur Signaler et j’en prendrai une nouvelle.',
    'I could not put the picture on the clipboard. Press its chip above to open the folder and attach the file from there.':
        'Je n’ai pas pu mettre l’image dans le presse-papiers. Appuyez sur son étiquette ci-dessus pour ouvrir le dossier et joindre le fichier depuis là.',
    'Copied the picture. Paste it into the email — most mail apps take a pasted picture as an attachment.':
        'Image copiée. Collez-la dans l’e-mail — la plupart des logiciels de messagerie prennent une image collée comme pièce jointe.',
    'Copied the picture. Paste it into the email to `{email}` — most mail apps take a pasted picture as an attachment.':
        'Image copiée. Collez-la dans l’e-mail à `{email}` — la plupart des logiciels de messagerie prennent une image collée comme pièce jointe.',
    'I no longer have that report — it is not in this window and not in your Downloads folder. Press Report again and I will put a new one together.':
        'Je n’ai plus ce rapport — il n’est ni dans cette fenêtre ni dans votre dossier Téléchargements. Appuyez de nouveau sur Signaler et j’en préparerai un nouveau.',
    'Copied the subject line `{subject}`. Paste it into the Subject line of your email.':
        'Objet `{subject}` copié. Collez-le dans la ligne Objet de votre e-mail.',
    'I could not reach the clipboard. The subject line is `{subject}` — you can select and copy it from here.':
        'Je n’ai pas pu accéder au presse-papiers. L’objet est `{subject}` — vous pouvez le sélectionner et le copier ici.',
    'Copied the whole report. Paste it into your message, and attach `{file}` from your Downloads folder.':
        'Rapport complet copié. Collez-le dans votre message, et joignez `{file}` depuis votre dossier Téléchargements.',
    'Copied the whole report. Paste it into your message.':
        'Rapport complet copié. Collez-le dans votre message.',
    'Copied the whole report. Paste it into an email to `{email}`, and attach `{file}` from your Downloads folder.':
        'Rapport complet copié. Collez-le dans un e-mail à `{email}`, et joignez `{file}` depuis votre dossier Téléchargements.',
    'Copied the whole report. Paste it into an email to `{email}`.':
        'Rapport complet copié. Collez-le dans un e-mail à `{email}`.',
    'I could not reach the clipboard. Open the report file from the chip above — it is a plain text document you can select and copy from.':
        'Je n’ai pas pu accéder au presse-papiers. Ouvrez le fichier du rapport depuis l’étiquette ci-dessus — c’est un simple document texte que vous pouvez sélectionner et copier.',
    'The report is on your clipboard — paste it into the message, and attach `{file}` from your Downloads folder.':
        'Le rapport est dans votre presse-papiers — collez-le dans le message, et joignez `{file}` depuis votre dossier Téléchargements.',
    'The report is on your clipboard — paste it into the message.':
        'Le rapport est dans votre presse-papiers — collez-le dans le message.',
    'I could not reach the clipboard, so press **Copy report** and paste it into the message, and attach `{file}` from your Downloads folder.':
        'Je n’ai pas pu accéder au presse-papiers : appuyez donc sur **Copier le rapport** et collez-le dans le message, et joignez `{file}` depuis votre dossier Téléchargements.',
    'I could not reach the clipboard, so press **Copy report** and paste it into the message.':
        'Je n’ai pas pu accéder au presse-papiers : appuyez donc sur **Copier le rapport** et collez-le dans le message.',
    'Opening your email app with `{email}` and the subject filled in.':
        'Ouverture de votre messagerie avec `{email}` et l’objet déjà remplis.',
    'If nothing opened, this machine has no email app set up — use the two Copy buttons instead.':
        'Si rien ne s’est ouvert, cet ordinateur n’a pas de messagerie configurée — utilisez plutôt les deux boutons Copier.',
    'I could not reach the clipboard. The song is in my answer above — you can select and copy it from there.':
        'Je n’ai pas pu accéder au presse-papiers. Le chant est dans ma réponse ci-dessus — vous pouvez le sélectionner et le copier depuis là.',
    'Copied. Paste it into the Lyric Editor and it will open as a song.':
        'Copié. Collez-le dans l’Éditeur de paroles et il s’ouvrira comme un chant.',
    'That song could not be saved. Check there is room in your documents folder, then press the button again.':
        'Ce chant n’a pas pu être enregistré. Vérifiez qu’il reste de la place dans votre dossier de documents, puis appuyez de nouveau sur le bouton.',
    'Saved as "{name}". It is in your documents list now, ready to put on the screen — open it in the Lyric Editor to change the words or mark the chords.':
        'Enregistré sous « {name} ». Il est maintenant dans votre liste de documents, prêt à être affiché à l’écran — ouvrez-le dans l’Éditeur de paroles pour modifier les paroles ou noter les accords.',
    'Opening a search for it in your browser. When you find the reference, type it here and I will read it from your Bible.':
        'Ouverture d’une recherche dans votre navigateur. Quand vous trouvez la référence, tapez-la ici et je la lirai dans votre Bible.',
    'This chat is not asking that assistant any more. Pick the model you want in the MODEL list at the top of this window, then ask again.':
        'Cette conversation ne s’adresse plus à cet assistant. Choisissez le modèle voulu dans la liste MODÈLE en haut de cette fenêtre, puis redemandez.',
    'Asked again with {model}, and this chat now uses it — pick another in the MODEL list at the top of this window to switch back.':
        'Redemandé avec {model}, que cette conversation utilise désormais — choisissez-en un autre dans la liste MODÈLE en haut de cette fenêtre pour revenir.',
    'Asking your question again.': 'Je repose votre question.',
    'Opening {address} in your browser.':
        'Ouverture de {address} dans votre navigateur.',
    'Show the choices again: which window, which assistant, which model and the limit per hour':
        'Afficher de nouveau les choix : quelle fenêtre, quel assistant, quel modèle et la limite par heure',
    'Fold these choices to one line': 'Replier ces choix sur une ligne',
    'Reload shared assistants': 'Recharger les assistants partagés',
    'Answers from': 'Réponses de',
    '{names} need an API key of your own — open AI settings':
        '{names} nécessitent votre propre clé API — ouvrez les paramètres d’IA',
    'Auto pick': 'Choix auto',
    Model: 'Modèle',
    'Try asking': 'Essayez de demander',
    'Press to put this in the box, then change the example to yours':
        'Appuyez pour le mettre dans la zone, puis remplacez l’exemple par le vôtre',
    'Guided demo: {demo}': 'Démonstration guidée : {demo}',
    'Back to the four suggestions': 'Revenir aux quatre suggestions',
    'Show everything it is ready to be asked here':
        'Afficher tout ce qu’on peut lui demander ici',
    Fewer: 'Moins',
    'More… — everything it can answer':
        'Plus… — tout ce à quoi il peut répondre',
    "Answers come from the app's own guide and from what the app is doing right now.":
        'Les réponses viennent du guide de l’application et de ce que fait l’application en ce moment.',
    'Be careful with AI answers.': 'Soyez prudent avec les réponses de l’IA.',
    'This assistant can be confidently wrong — it can misread the app, describe a button that is not there, or quote a verse inaccurately — and what it offers to do can reach a live projector. Check anything that matters before a service, and read a step yourself before you press it. It is here to help you use the app, not to replace knowing it.':
        'Cet assistant peut se tromper avec assurance — il peut mal interpréter l’application, décrire un bouton qui n’existe pas ou citer un verset de façon inexacte — et ce qu’il propose de faire peut atteindre un projecteur en direct. Vérifiez tout ce qui compte avant un culte, et lisez vous-même chaque étape avant d’appuyer. Il est là pour vous aider à utiliser l’application, pas pour remplacer votre connaissance de celle-ci.',
    'Put this caution away for 30 days; it comes back after that':
        'Masquer cet avertissement pendant 30 jours ; il revient ensuite',
    '{names} answer here only with an API key of your own.':
        '{names} ne répondent ici qu’avec votre propre clé API.',
    'Go to the newest message': 'Aller au message le plus récent',
    'Use {model}': 'Utiliser {model}',
    'Report “{quote}”? I will look into it in the app and write it up. The report carries {collects} — nothing is sent until you say so.':
        'Signaler « {quote} » ? Je vais l’examiner dans l’application et rédiger le rapport. Le rapport contient {collects} — rien n’est envoyé tant que vous ne l’avez pas décidé.',
    'Report it': 'Le signaler',
    'Attach a file': 'Joindre un fichier',
    'Attach a picture or a file': 'Joindre une image ou un fichier',
    'Attach a picture of the app': 'Joindre une image de l’application',
    'Attach a picture of the app as it looks now':
        'Joindre une image de l’application telle qu’elle est maintenant',
    'Point at a control in the app': 'Désigner une commande dans l’application',
    'Point at a control in the app window':
        'Désigner une commande dans la fenêtre de l’application',
    'Add anything else while it works…':
        'Ajoutez autre chose pendant qu’il travaille…',
    'Ask how to do something, or type / for a command…':
        'Demandez comment faire quelque chose, ou tapez / pour une commande…',
    'Ask how to do something in the app':
        'Demander comment faire quelque chose dans l’application',
    'Ctrl+Enter sends · Enter starts a new line · Alt+↑ and Alt+↓ bring back an earlier question · / lists the commands that need no assistant · ↑ and ↓ walk a list of suggestions, Tab takes one':
        'Ctrl+Enter pour envoyer · Enter pour une nouvelle ligne · Alt+↑ et Alt+↓ rappellent une question précédente · / liste les commandes sans assistant · ↑ et ↓ parcourent les suggestions, Tab en prend une',
    'Add this to the answer being written — Ctrl+Enter':
        'Ajouter ceci à la réponse en cours — Ctrl+Enter',
    'Add more': 'Ajouter',
    'Stop looking it up': 'Arrêter la recherche',
    'Send — Ctrl+Enter': 'Envoyer — Ctrl+Enter',
    Send: 'Envoyer',
    'Ask — Ctrl+Enter': 'Demander — Ctrl+Enter',
    Ask: 'Demander',
    'Report a problem with the app': 'Signaler un problème avec l’application',
    'Report a problem: I will look into it, collect what is on this machine and write it up for you':
        'Signaler un problème : je l’examine, je rassemble ce qui se trouve sur cet ordinateur et je rédige le rapport pour vous',
    'Preview of {name}': 'Aperçu de {name}',
    'Download {name} into your Downloads folder':
        'Télécharger {name} dans votre dossier Téléchargements',
    'Press anywhere to close': 'Appuyez n’importe où pour fermer',
    'Reload the assistants shared on openworship.app':
        'Recharger les assistants partagés sur openworship.app',
    'Auto picks the best assistant that costs nothing, again for every question — one of your own servers that is on and not busy, the bigger model first, or the free service':
        'Auto choisit le meilleur assistant gratuit, à nouveau pour chaque question — l’un de vos propres serveurs allumé et libre, le plus grand modèle d’abord, ou le service gratuit',
    'chosen at each question': 'choisi à chaque question',
    'app guide · offline': 'guide de l’application · hors ligne',
    'This assistant cannot look at pictures. Pick one that can, or take the picture off and describe it instead.':
        'Cet assistant ne peut pas regarder d’images. Choisissez-en un qui le peut, ou retirez l’image et décrivez-la à la place.',
    'This model is not marked as able to look at pictures. If it can, tick Sees pictures for it in Settings → AI Providers → Custom servers; or take the picture off and describe it instead.':
        "Ce modèle n’est pas marqué comme capable de regarder des images. S’il le peut, cochez Voit les images pour lui dans Paramètres → Fournisseurs d'IA → Serveurs personnalisés ; ou retirez l’image et décrivez-la à la place.",
    '{name} (the one in Find)': '{name} (celle de la recherche)',
    'Open {verse} in Bible Lookup': 'Ouvrir {verse} dans la Recherche biblique',
    'Send a picture of my screen': 'Envoyer une image de mon écran',
    'Point at the control': 'Désigner la commande',
    'Reporting a problem.': 'Signalement d’un problème.',
    'Solved without a report.': 'Résolu sans rapport.',
    'I searched the Bible for your words myself instead.':
        'J’ai cherché vos mots dans la Bible moi-même à la place.',
    'main window': 'fenêtre principale',
    'own window': 'fenêtre séparée',
    'Claude Haiku 5.5 (best recommended)':
        'Claude Haiku 5.5 (le plus recommandé)',
    'Highlight again': 'Mettre de nouveau en évidence',
    'Search another Bible': 'Chercher dans une autre Bible',
    'Search Google for it': 'Le chercher sur Google',
    'Clear {count} chat?': 'Effacer {count} conversation ?',
    'Close {count} chat?': 'Fermer {count} conversation ?',
    'Clear {count} chats?': 'Effacer {count} conversations ?',
    'Close {count} chats?': 'Fermer {count} conversations ?',
    'The locked one stays.': 'Celle qui est verrouillée reste.',
    'The locked ones stay.': 'Celles qui sont verrouillées restent.',
    'This cannot be undone.': 'Cette action est irréversible.',
    Chats: 'Conversations',
    'More for {title}': "Plus d'options pour {title}",
    More: 'Plus',
    'Name this chat': 'Nommer cette conversation',
    '{title} — double-click to rename':
        '{title} — double-cliquez pour renommer',
    '{title} is working on an answer': '{title} prépare une réponse',
    '{title} is locked': '{title} est verrouillée',
    'Locked — unlock it from this tab’s menu to close it':
        'Verrouillée — déverrouillez-la depuis le menu de cet onglet pour la fermer',
    'Close {title}': 'Fermer {title}',
    'Close this chat': 'Fermer cette conversation',
    'New chat': 'Nouvelle conversation',
    'Close one of these before starting another':
        "Fermez-en une avant d'en commencer une autre",
    'No room for another chat': 'Plus de place pour une autre conversation',
    'This window holds {count} chats at most. Close one to start a new chat.':
        'Cette fenêtre contient au plus {count} conversations. Fermez-en une pour commencer une nouvelle conversation.',
    'This window holds {count} chats at most, and all of them are locked. Unlock one from its ⋮ menu and close it to start a new chat.':
        'Cette fenêtre contient au plus {count} conversations, et toutes sont verrouillées. Déverrouillez-en une depuis son menu ⋮ et fermez-la pour commencer une nouvelle conversation.',
    'New window': 'Nouvelle fenêtre',
    'Clear all chats': 'Effacer toutes les conversations',
    'Close other chats': 'Fermer les autres conversations',
    'Keep them': 'Les garder',
    'Close them': 'Les fermer',
    'Rename this chat': 'Renommer cette conversation',
    'Unlock this chat': 'Déverrouiller cette conversation',
    'Lock this chat': 'Verrouiller cette conversation',
    'Open in new window': 'Ouvrir dans une nouvelle fenêtre',
    'Close other chats…': 'Fermer les autres conversations…',
    'Clear all chats…': 'Effacer toutes les conversations…',
    'Looking through your songs': 'Parcours de vos chants',
    'Reading one of your song': "Lecture d'un de vos chants",
    'Reading one of your song: “{name}”':
        "Lecture d'un de vos chants : « {name} »",
    'Creating a new song': "Création d'un nouveau chant",
    'Creating a new song: “{name}”': "Création d'un nouveau chant : « {name} »",
    'Editing a song': "Modification d'un chant",
    'Editing a song: “{name}”': "Modification d'un chant : « {name} »",
    'Renaming a song': "Renommage d'un chant",
    'Renaming a song: “{name}”': "Renommage d'un chant : « {name} »",
    'Moving a song to the trash': "Mise à la corbeille d'un chant",
    'Moving your song “{name}” to the trash':
        'Mise à la corbeille de votre chant « {name} »',
    'Working on your songs': 'Travail sur vos chants',
    'Looking through your slide documents':
        'Parcours de vos documents de diapositives',
    'Reading one of your slide document':
        "Lecture d'un de vos documents de diapositives",
    'Reading one of your slide document: “{name}”':
        "Lecture d'un de vos documents de diapositives : « {name} »",
    'Creating a new slide document':
        "Création d'un nouveau document de diapositives",
    'Creating a new slide document: “{name}”':
        "Création d'un nouveau document de diapositives : « {name} »",
    'Editing a slide document': "Modification d'un document de diapositives",
    'Editing a slide document: “{name}”':
        "Modification d'un document de diapositives : « {name} »",
    'Renaming a slide document': "Renommage d'un document de diapositives",
    'Renaming a slide document: “{name}”':
        "Renommage d'un document de diapositives : « {name} »",
    'Moving a slide document to the trash':
        "Mise à la corbeille d'un document de diapositives",
    'Moving your slide document “{name}” to the trash':
        'Mise à la corbeille de votre document de diapositives « {name} »',
    'Working on your slide documents':
        'Travail sur vos documents de diapositives',
    'Reading the slides': 'Lecture des diapositives',
    'Reading the slides of “{name}”': 'Lecture des diapositives de « {name} »',
    'Adding a slide': "Ajout d'une diapositive",
    'Adding a slide to “{name}”': "Ajout d'une diapositive à « {name} »",
    'Changing a slide': "Modification d'une diapositive",
    'Changing slide {slide}': 'Modification de la diapositive {slide}',
    'Changing a slide of “{name}”':
        "Modification d'une diapositive de « {name} »",
    'Changing slide {slide} of “{name}”':
        'Modification de la diapositive {slide} de « {name} »',
    'Removing a slide': "Suppression d'une diapositive",
    'Removing slide {slide}': 'Suppression de la diapositive {slide}',
    'Removing a slide from “{name}”':
        "Suppression d'une diapositive de « {name} »",
    'Removing slide {slide} from “{name}”':
        'Suppression de la diapositive {slide} de « {name} »',
    'Moving a slide': "Déplacement d'une diapositive",
    'Moving slide {slide}': 'Déplacement de la diapositive {slide}',
    'Moving a slide of “{name}”': "Déplacement d'une diapositive de « {name} »",
    'Moving slide {slide} of “{name}”':
        'Déplacement de la diapositive {slide} de « {name} »',
    'Copying a slide': "Copie d'une diapositive",
    'Copying slide {slide}': 'Copie de la diapositive {slide}',
    'Copying a slide of “{name}”': "Copie d'une diapositive de « {name} »",
    'Copying slide {slide} of “{name}”':
        'Copie de la diapositive {slide} de « {name} »',
    'Looking through your saved Bible passages':
        'Parcours de vos passages bibliques enregistrés',
    'Changing a saved Bible passage':
        "Modification d'un passage biblique enregistré",
    'Removing a saved Bible passage':
        "Suppression d'un passage biblique enregistré",
    'Making a Bibles list': "Création d'une liste de Bibles",
    'Renaming a Bibles list': "Renommage d'une liste de Bibles",
    'Moving a Bibles list to the trash':
        "Mise à la corbeille d'une liste de Bibles",
    'Looking through your Bible notes': 'Parcours de vos notes bibliques',
    'Reading a Bible note': "Lecture d'une note biblique",
    'Writing a Bible note': "Rédaction d'une note biblique",
    'Changing a Bible note': "Modification d'une note biblique",
    'Removing a Bible note': "Suppression d'une note biblique",
    'Making a notes file': "Création d'un fichier de notes",
    'Renaming a notes file': "Renommage d'un fichier de notes",
    'Moving a notes file to the trash':
        "Mise à la corbeille d'un fichier de notes",
    'Looking through the recent changes': 'Parcours des modifications récentes',
    'Putting back an earlier change':
        "Annulation d'une modification précédente",
    'Looking through your run sheets': 'Parcours de vos déroulés',
    'Reading a run sheet': "Lecture d'un déroulé",
    'Making a run sheet': "Création d'un déroulé",
    'Renaming a run sheet': "Renommage d'un déroulé",
    'Moving a run sheet to the trash': "Mise à la corbeille d'un déroulé",
    'Adding a line to a run sheet': "Ajout d'une ligne à un déroulé",
    'Taking a line off a run sheet': "Retrait d'une ligne d'un déroulé",
    'Moving a line of a run sheet': "Déplacement d'une ligne d'un déroulé",
    'Copying a line of a run sheet': "Copie d'une ligne d'un déroulé",
    'Parking a line of a run sheet': "Mise en attente d'une ligne d'un déroulé",
    'Putting a parked line back in the run':
        "Remise d'une ligne en attente dans le déroulé",
    'Working on your saved Bible passages':
        'Travail sur vos passages bibliques enregistrés',
    'Working on your Bible notes': 'Travail sur vos notes bibliques',
    'Working on a run sheet': 'Travail sur un déroulé',
    'Saving to your Bibles list: “{words}”':
        'Enregistrement dans votre liste de Bibles : « {words} »',
    'Saving a passage to your Bibles list':
        "Enregistrement d'un passage dans votre liste de Bibles",
    'Looking something up': 'Recherche en cours',
    'Downloading the Bible file and reading it':
        'Téléchargement et lecture du fichier de la Bible',
    'Finding Bible book names for your language':
        'Recherche des noms des livres bibliques pour votre langue',
    'Installing the Bible': 'Installation de la Bible',
    'Changing the Bible': 'Modification de la Bible',
    'Moving the Bible to the trash': 'Mise à la corbeille de la Bible',
    'Looking at your Bibles': 'Consultation de vos Bibles',
    'Taking the countdown off the screen':
        "Retrait du compte à rebours de l'écran",
    'Taking the stopwatch off the screen': "Retrait du chronomètre de l'écran",
    'Taking the clock off the screen': "Retrait de l'horloge de l'écran",
    'Taking the scrolling message off the screen':
        "Retrait du bandeau défilant de l'écran",
    'Taking the line of text off the screen':
        "Retrait de la ligne de texte de l'écran",
    'Taking the extras off the screen':
        "Retrait des éléments de premier plan de l'écran",
    'Taking an extra off the screen':
        "Retrait d'un élément de premier plan de l'écran",
    'Checking the extras on the screen':
        "Vérification des éléments de premier plan à l'écran",
    'Starting a {minutes} minute countdown on the screen':
        "Lancement d'un compte à rebours de {minutes} minutes à l'écran",
    'Starting a countdown to “{words}”':
        "Lancement d'un compte à rebours jusqu'à « {words} »",
    'Starting a countdown on the screen':
        "Lancement d'un compte à rebours à l'écran",
    'Starting a stopwatch on the screen':
        "Lancement d'un chronomètre à l'écran",
    'Putting a clock on the screen': "Affichage d'une horloge à l'écran",
    'Putting a scrolling message on the screen':
        "Affichage d'un bandeau défilant à l'écran",
    'Putting a line of text on the screen':
        "Affichage d'une ligne de texte à l'écran",
    'Putting an extra on the screen':
        "Affichage d'un élément de premier plan à l'écran",
    'Searching the guide for “{words}”':
        'Recherche de « {words} » dans le guide',
    'Searching the guide': 'Recherche dans le guide',
    'Reading the guide': 'Lecture du guide',
    'Looking through what it can answer':
        'Parcours des questions auxquelles il sait répondre',
    'Checking what the app is showing':
        "Vérification de ce que l'application affiche",
    'Looking over the buttons on screen': "Examen des boutons à l'écran",
    'Looking for “{words}”': 'Recherche de « {words} »',
    'Looking for a button': "Recherche d'un bouton",
    'Pressing “{words}”': 'Appui sur « {words} »',
    'Pressing a button': 'Appui sur un bouton',
    'Typing into “{words}”': 'Saisie dans « {words} »',
    'Typing something': 'Saisie de texte',
    'Switching the app window over':
        "Changement de page de la fenêtre de l'application",
    'Checking the projector screens': 'Vérification des écrans de projection',
    'Clearing the projector screens': 'Effacement des écrans de projection',
    'Reading the passage “{words}”': 'Lecture du passage « {words} »',
    'Reading a Bible passage': "Lecture d'un passage biblique",
    'Putting a Bible passage on the screen: “{words}”':
        "Affichage d'un passage biblique à l'écran : « {words} »",
    'Putting a Bible passage on the screen':
        "Affichage d'un passage biblique à l'écran",
    'Opening in the Bible Lookup: “{words}”':
        'Ouverture dans la Recherche biblique : « {words} »',
    'Opening a verse in the Bible Lookup':
        "Ouverture d'un verset dans la Recherche biblique",
    'Reading “{words}”': 'Lecture de « {words} »',
    'Reading Bible verses': 'Lecture de versets bibliques',
    'Searching the Bible for “{words}”':
        'Recherche de « {words} » dans la Bible',
    'Looking at the Bibles installed': 'Consultation des Bibles installées',
    'Checking what that button is called here':
        'Vérification du nom de ce bouton ici',
    'Reading a web page': "Lecture d'une page web",
    'Reading {site}': 'Lecture de {site}',
    'Reading {site} and writing the song out':
        'Lecture de {site} et rédaction du chant',
    'Looking up the song “{words}”': 'Recherche du chant « {words} »',
    'Looking up the song': 'Recherche du chant',
    'Writing the song out': 'Rédaction du chant',
    'Checking the song over': 'Vérification du chant',
    'Setting up a walkthrough': "Préparation d'un guide pas à pas",
    'Moving the walkthrough on':
        "Passage à l'étape suivante du guide pas à pas",
    'Checking on the walkthrough': 'Vérification du guide pas à pas',
    'Looking over the window': 'Examen de la fenêtre',
    'Checking which windows are open': 'Vérification des fenêtres ouvertes',
    'Switching to another window': 'Passage à une autre fenêtre',
    'Pressing a key': 'Appui sur une touche',
    'Waiting for the app to catch up': "Attente que l'application suive",
    "Reading the app's own log": "Lecture du journal de l'application",
    'Checking what the app has downloaded':
        "Vérification de ce que l'application a téléchargé",
    'Answering a message the app put up':
        "Réponse à un message affiché par l'application",
    'under $0.001': 'moins de $0.001',
    'price not known': 'prix inconnu',
    '≈ {dollars} + some at an unknown price':
        '≈ {dollars} + une partie à un prix inconnu',
    'free + some at an unknown price': 'gratuit + une partie à un prix inconnu',
    free: 'gratuit',
    '{count} tokens': '{count} jetons',
    'Model: {assistant} · {model}': 'Modèle : {assistant} · {model}',
    '{count} model round': '{count} tour de modèle',
    '{count} model rounds': '{count} tours de modèle',
    '{count} token in at the full rate':
        '{count} jeton en entrée au plein tarif',
    '{count} tokens in at the full rate':
        '{count} jetons en entrée au plein tarif',
    '{count} read from the cache': '{count} lus depuis le cache',
    '{count} written to it': '{count} écrits dans le cache',
    '{count} token out': '{count} jeton en sortie',
    '{count} tokens out': '{count} jetons en sortie',
    'About {dollars} at the list price. An estimate: the bill from your provider is the real figure.':
        "Environ {dollars} au prix catalogue. C'est une estimation : la facture de votre fournisseur est le vrai chiffre.",
    'About {dollars} at the list price, not counting {count} round on a model this app has no price for. An estimate: the bill from your provider is the real figure.':
        "Environ {dollars} au prix catalogue, sans compter {count} tour sur un modèle dont cette application ne connaît pas le prix. C'est une estimation : la facture de votre fournisseur est le vrai chiffre.",
    'About {dollars} at the list price, not counting {count} rounds on a model this app has no price for. An estimate: the bill from your provider is the real figure.':
        "Environ {dollars} au prix catalogue, sans compter {count} tours sur un modèle dont cette application ne connaît pas le prix. C'est une estimation : la facture de votre fournisseur est le vrai chiffre.",
    'This app has no list price for the model that answered, so it cannot put a figure on the cost.':
        'Cette application ne connaît pas le prix catalogue du modèle qui a répondu ; elle ne peut donc pas chiffrer le coût.',
    'Answered by a free service, so nothing was charged.':
        "Réponse d'un service gratuit : rien n'a été facturé.",
    'No limit': 'Sans limite',
    'paused · limit reached': 'en pause · limite atteinte',
    'paused · ≈ {dollars} this hour': 'en pause · ≈ {dollars} cette heure-ci',
    'paused · {count} call this hour':
        'en pause · {count} appel cette heure-ci',
    'paused · {count} calls this hour':
        'en pause · {count} appels cette heure-ci',
    '≈ {dollars} this hour': '≈ {dollars} cette heure-ci',
    '{count} call this hour': '{count} appel cette heure-ci',
    '{count} calls this hour': '{count} appels cette heure-ci',
    '≈ {dollars} of {limit} this hour':
        '≈ {dollars} sur {limit} cette heure-ci',
    '{count} call of {limit} this hour':
        '{count} appel (limite {limit}) cette heure-ci',
    '{count} calls of {limit} this hour':
        '{count} appels (limite {limit}) cette heure-ci',
    '{limit} an hour': '{limit} par heure',
    'Nothing has been spent in the last hour.':
        "Rien n'a été dépensé au cours de la dernière heure.",
    'In the last hour: about {dollars} over {count} model call, across every tab of this window. An estimate at list price.':
        'Au cours de la dernière heure : environ {dollars} pour {count} appel au modèle, sur tous les onglets de cette fenêtre. Estimation au prix catalogue.',
    'In the last hour: about {dollars} over {count} model calls, across every tab of this window. An estimate at list price.':
        'Au cours de la dernière heure : environ {dollars} pour {count} appels au modèle, sur tous les onglets de cette fenêtre. Estimation au prix catalogue.',
    'In the last hour: about {dollars} over {count} model call, {unpriced} of them on a model with no list price here, across every tab of this window. An estimate at list price.':
        'Au cours de la dernière heure : environ {dollars} pour {count} appel au modèle, dont {unpriced} sur un modèle sans prix catalogue ici, sur tous les onglets de cette fenêtre. Estimation au prix catalogue.',
    'In the last hour: about {dollars} over {count} model calls, {unpriced} of them on a model with no list price here, across every tab of this window. An estimate at list price.':
        'Au cours de la dernière heure : environ {dollars} pour {count} appels au modèle, dont {unpriced} sur un modèle sans prix catalogue ici, sur tous les onglets de cette fenêtre. Estimation au prix catalogue.',
    'The money cap is off. The assistant still pauses after {count} model calls in one hour, which is more than a person asks for.':
        "Le plafond de dépense est désactivé. L'assistant se met quand même en pause après {count} appels au modèle en une heure, soit plus qu'une personne n'en demande.",
    'When the assistant has spent about {limit} in one hour (or made {count} model calls), it pauses and asks before spending more, so a fault cannot run up the bill.':
        "Quand l'assistant a dépensé environ {limit} en une heure (ou fait {count} appels au modèle), il se met en pause et demande avant de dépenser davantage : une panne ne peut donc pas faire grimper la facture.",
    'The assistant is PAUSED now: press Allow more to carry on.':
        "L'assistant est EN PAUSE : appuyez sur Autoriser plus pour continuer.",
    'Press Allow more to carry on for another hour. Until then the built-in guide answers for free.':
        "Appuyez sur Autoriser plus pour continuer une heure de plus. D'ici là, le guide intégré répond gratuitement.",
    'Press Allow more to carry on for another hour, or raise the limit under Limit per hour at the top. Until then the built-in guide answers for free.':
        "Appuyez sur Autoriser plus pour continuer une heure de plus, ou relevez la limite dans Limite par heure en haut. D'ici là, le guide intégré répond gratuitement.",
    'I have paused the assistant: it has made {count} model calls in the last hour, which is more than a person would ask for, so something may be running away with your credit.':
        "J'ai mis l'assistant en pause : il a fait {count} appels au modèle au cours de la dernière heure, soit plus qu'une personne n'en demanderait ; quelque chose est peut-être en train d'épuiser votre crédit.",
    'I have paused the assistant: it made {count} model calls within one hour, which is more than a person would ask for, so something may be running away with your credit.':
        "J'ai mis l'assistant en pause : il a fait {count} appels au modèle en une heure, soit plus qu'une personne n'en demanderait ; quelque chose est peut-être en train d'épuiser votre crédit.",
    'I have paused the assistant to protect your credit: it has spent about {dollars} in the last hour, which reaches the {limit} limit set for this window.':
        "J'ai mis l'assistant en pause pour protéger votre crédit : il a dépensé environ {dollars} au cours de la dernière heure, ce qui atteint la limite de {limit} fixée pour cette fenêtre.",
    'I have paused the assistant to protect your credit: within one hour it reached the {limit} limit set for this window.':
        "J'ai mis l'assistant en pause pour protéger votre crédit : en une heure, il a atteint la limite de {limit} fixée pour cette fenêtre.",
    'Heads-up: about {dollars} of the {limit} hourly limit is used ({percent}%). At the limit I pause and ask before spending more; the guide keeps answering for free.':
        'Attention : environ {dollars} de la limite horaire de {limit} sont utilisés ({percent} %). À la limite, je me mets en pause et je demande avant de dépenser davantage ; le guide continue de répondre gratuitement.',
    'Heads-up: {count} of the {max} model calls an hour are used. At the limit I pause and ask before spending more; the guide keeps answering for free.':
        'Attention : {count} des {max} appels au modèle par heure sont utilisés. À la limite, je me mets en pause et je demande avant de dépenser davantage ; le guide continue de répondre gratuitement.',
    'No assistant is answering in this tab — that came from the guide alone. An assistant usually answers better: pick one in the ASSISTANT list at the top of this window.':
        'Aucun assistant ne répond dans cet onglet — cette réponse vient du guide seul. Un assistant répond généralement mieux : choisissez-en un dans la liste ASSISTANT en haut de cette fenêtre.',
    'A smarter model often gets right what this one did not. This tab is on Auto: pick an assistant by name in the ASSISTANT list at the top of this window, and the best model it has in the MODEL list beside it.':
        'Un modèle plus intelligent réussit souvent là où celui-ci a échoué. Cet onglet est sur Auto : choisissez un assistant par son nom dans la liste ASSISTANT en haut de cette fenêtre, puis son meilleur modèle dans la liste MODÈLE juste à côté.',
    'This tab is already asking the best model {assistant} has ({model}), so a larger one is not the way out; another assistant in the ASSISTANT list at the top of this window may read it differently.':
        "Cet onglet interroge déjà le meilleur modèle de {assistant} ({model}) : un modèle plus grand n'est donc pas la solution, mais un autre assistant de la liste ASSISTANT en haut de cette fenêtre pourrait le comprendre autrement.",
    'A smarter model often gets right what this one did not. This tab is asking {asking}: try a larger model in the MODEL list at the top of this window, or another assistant in the ASSISTANT list beside it.':
        'Un modèle plus intelligent réussit souvent là où celui-ci a échoué. Cet onglet interroge {asking} : essayez un modèle plus grand dans la liste MODÈLE en haut de cette fenêtre, ou un autre assistant dans la liste ASSISTANT juste à côté.',
    'A smarter model often gets right what this one did not. This tab is asking {asking}; {smarter} is the next one up.':
        'Un modèle plus intelligent réussit souvent là où celui-ci a échoué. Cet onglet interroge {asking} ; {smarter} est le modèle juste au-dessus.',
    'Ask again with {model}': 'Redemander avec {model}',
    'Ask it as a general question': 'Le demander comme question générale',
    'You are welcome. When you want to find another verse, just tell me what you remember of it.':
        'Avec plaisir. Pour trouver un autre verset, dites-moi simplement ce dont vous vous souvenez.',
    'Sorry — that did not help. Tell me in your own words what you were trying to do, or what went wrong, and I will look into it.':
        "Désolé — cela n'a pas aidé. Dites-moi avec vos propres mots ce que vous essayiez de faire, ou ce qui n'a pas marché, et je vais regarder.",
    'Sorry — that answer did not help. Tell me what was wrong and I will look again: press one of these, or say it in your own words.':
        "Désolé — cette réponse n'a pas aidé. Dites-moi ce qui n'allait pas et je regarderai à nouveau : appuyez sur l'un de ces choix, ou dites-le avec vos propres mots.",
    'Sorry — that answer did not help. Tell me what was wrong and I will look again.':
        "Désolé — cette réponse n'a pas aidé. Dites-moi ce qui n'allait pas et je regarderai à nouveau.",
    'Sorry — the answer to “{question}” did not help. Ask it again in other words, or tell me what was wrong, and I will look again.':
        "Désolé — la réponse à « {question} » n'a pas aidé. Reposez la question autrement, ou dites-moi ce qui n'allait pas, et je regarderai à nouveau.",
    'Only want to read the Bible? The Bible Reader page is made for that. Press Go to the Bible Reader below and the main window changes to it — whatever is on the projector is left as it is.':
        'Vous voulez seulement lire la Bible ? La page Lecteur biblique est faite pour cela. Appuyez sur Aller au Lecteur biblique ci-dessous et la fenêtre principale y passe — ce qui est au projecteur reste tel quel.',
    '{name} · main window': '{name} · fenêtre principale',
    '{name} · own window': '{name} · fenêtre à part',
    'the picture could not be read': "l'image n'a pas pu être lue",
    'the picture could not be redrawn': "l'image n'a pas pu être redessinée",
    'I could not do that just now. Try again in a moment.':
        "Je n'ai pas pu le faire pour l'instant. Réessayez dans un moment.",
    '{count} bytes': '{count} octets',
    'This file is not on this machine any more. It may have been moved, renamed or deleted.':
        "Ce fichier n'est plus sur cet ordinateur. Il a peut-être été déplacé, renommé ou supprimé.",
    'This picture is {size}, too big to show here. Download it or open its folder to look at it.':
        'Cette image fait {size}, trop grande pour être affichée ici. Téléchargez-la ou ouvrez son dossier pour la voir.',
    'I could not read that picture from the disk.':
        "Je n'ai pas pu lire cette image sur le disque.",
    'This file is {size}, too big to show here. Download it or open its folder to read it.':
        'Ce fichier fait {size}, trop gros pour être affiché ici. Téléchargez-le ou ouvrez son dossier pour le lire.',
    'I could not re-read the file, so this is the copy attached to your question.':
        "Je n'ai pas pu relire le fichier ; voici donc la copie jointe à votre question.",
    'I could not open that one: {reason}': "Je n'ai pas pu l'ouvrir : {reason}",
    'That picture is not attached any more — pictures are kept only while this window is open.':
        "Cette image n'est plus jointe — les images ne sont gardées que tant que cette fenêtre est ouverte.",
    'There is nothing left to show for that one.':
        'Il ne reste rien à montrer pour celui-ci.',
    'That file is not on this machine any more, so there is nothing to download.':
        "Ce fichier n'est plus sur cet ordinateur : il n'y a donc rien à télécharger.",
    '“{name}” is already in your Downloads folder — I opened it for you.':
        "« {name} » est déjà dans votre dossier Téléchargements — je l'ai ouvert pour vous.",
    'I could not save a copy into your Downloads folder.':
        "Je n'ai pas pu enregistrer de copie dans votre dossier Téléchargements.",
    'Saved “{name}” into your Downloads folder.':
        '« {name} » a été enregistré dans votre dossier Téléchargements.',
    'I could not save that picture.': "Je n'ai pas pu enregistrer cette image.",
    'Saved the picture into your Downloads folder.':
        "L'image a été enregistrée dans votre dossier Téléchargements.",
    'There is nothing left of that one to download.':
        'Il ne reste rien de celui-ci à télécharger.',
    '[... the rest is in the file ...]':
        '[... la suite est dans le fichier ...]',
    'Report: new': 'Signalement : nouveau',
    'Report: {words}': 'Signalement : {words}',
    'Alt+↑ brings back a question you asked before; Alt+↓ comes back to what you were typing.':
        'Alt+↑ rappelle une question déjà posée ; Alt+↓ revient à ce que vous étiez en train de taper.',
    'Ctrl+Enter sends. Plain Enter starts a new line, so a long question can run across several.':
        'Ctrl+Enter envoie le message. Enter seul passe à la ligne, pour écrire une longue question sur plusieurs lignes.',
    'While an answer is on its way, Send becomes Stop — and it really does call the question off.':
        "Pendant qu'une réponse arrive, Envoyer devient Arrêter — et la question est vraiment annulée.",
    'You can keep typing while an answer is coming. Press Add and it joins the question being worked on.':
        "Vous pouvez continuer à taper pendant qu'une réponse arrive. Appuyez sur Ajouter et cela rejoint la question en cours.",
    'The + above opens a second conversation. Each keeps its own assistant, model and answers.':
        'Le + en haut ouvre une deuxième conversation. Chacune garde son assistant, son modèle et ses réponses.',
    'Type / for commands that need no assistant: /screen-show turns the projector on, /screen-hide turns it off.':
        "Tapez / pour les commandes qui se passent d'assistant : /screen-show allume le projecteur, /screen-hide l'éteint.",
    'Not about the app? Put /btw in front — /btw what is the Bible? — and that tab’s next question stays general.':
        "Pas au sujet de l'application ? Mettez /btw devant — /btw qu'est-ce que la Bible ? — et la question suivante de cet onglet reste générale.",
    '/clear empties this chat. The projector’s clears are /screen-clear-all, /screen-clear-slide and friends.':
        '/clear vide cette conversation. Pour effacer le projecteur : /screen-clear-all, /screen-clear-slide et les autres du même genre.',
    'Right-click a tab to rename it, or lock it so clearing the chats leaves that one alone.':
        "Clic droit sur un onglet pour le renommer, ou pour le verrouiller afin qu'il échappe à l'effacement des conversations.",
    'The camera button attaches a picture of the app as it looks now — often quicker than describing it.':
        "Le bouton appareil photo joint une image de l'application telle qu'elle est maintenant — souvent plus rapide que de la décrire.",
    'The ◎ button points at a button in the app and asks what it does. Pointing at it does not press it.':
        "Le bouton ◎ désigne un bouton de l'application et demande à quoi il sert. Le désigner ne l'actionne pas.",
    'You can paste or drop a picture or a file straight into this window and ask about it.':
        'Vous pouvez coller ou déposer une image ou un fichier directement dans cette fenêtre et poser une question dessus.',
    'When an answer names a button, press that name and the app will outline the real one for you.':
        "Quand une réponse nomme un bouton, appuyez sur ce nom et l'application entourera le vrai bouton pour vous.",
    'Ask to be shown step by step and the steps are drawn on a card in the app window itself.':
        "Demandez à être guidé pas à pas, et les étapes s'affichent sur une carte dans la fenêtre de l'application elle-même.",
    'If the app itself is wrong, press Report — it looks into it and writes the report up for you.':
        "Si l'application elle-même se trompe, appuyez sur Signaler — il examine le problème et rédige le rapport pour vous.",
    'The “Asking about” picker at the top says which window the answers should be about.':
        'Le sélecteur « Question sur » en haut indique de quelle fenêtre les réponses doivent parler.',
    'Type a few words and a list of questions it can already answer drops up; ↑ and ↓ walk it, Tab takes one.':
        'Tapez quelques mots et une liste de questions auxquelles il sait déjà répondre apparaît ; ↑ et ↓ la parcourent, Tab en prend une.',
    'Every answer says what it cost; “Credit used” under the pickers totals this chat. Hover either for the sums.':
        "Chaque réponse indique son coût ; « Crédit utilisé » sous les sélecteurs fait le total de cette conversation. Survolez l'un ou l'autre pour le détail.",
    'It cannot run up the bill: “Limit per hour” at the top pauses it at $1 an hour until you press Allow more.':
        "Il ne peut pas faire grimper la facture : « Limite par heure » en haut le met en pause à $1 par heure jusqu'à ce que vous appuyiez sur Autoriser plus.",
    'Short of room? The arrow at the top left folds the pickers to one line; press the line to open them.':
        'Manque de place ? La flèche en haut à gauche replie les sélecteurs sur une ligne ; appuyez sur la ligne pour les rouvrir.',
    'A button it names is not there': "Un bouton qu'il nomme n'est pas là",
    'The steps did not work': "Les étapes n'ont pas fonctionné",
    'That is wrong for the window I am in':
        "Ce n'est pas juste pour la fenêtre où je suis",
    'Allow more': 'Autoriser plus',
    'Go to the Bible Reader': 'Aller au Lecteur biblique',
    'You do not need to type the English book name.':
        'Vous n’avez pas besoin de taper le nom du livre en anglais.',
    "1. Press **{clear}** to show the Bible's own book buttons.":
        '1. Appuyez sur **{clear}** pour afficher les boutons des livres de votre Bible.',
    "2. Press the book button for **{book}** in your Bible's own language, then press **Chapter {chapter}**.":
        '2. Appuyez sur le bouton du livre **{book}** dans la langue de votre Bible, puis sur **Chapitre {chapter}**.',
    '3. Press **Verse {verse}** to open the passage.':
        '3. Appuyez sur **Verset {verse}** pour ouvrir le passage.',
    'If the names use unfamiliar letters, press **{button}** below. It will handle one visible button at a time.':
        'Si les noms utilisent des lettres inconnues, appuyez sur **{button}** ci-dessous. Il s’occupera d’un bouton visible à la fois.',
    'Do it for me': 'Faites-le pour moi',
    'in this window': 'dans cette fenêtre',
    'This is done in the Presenter — the {page} page has none of these panels. First {route}, then:':
        'Cela se fait dans le Présentateur — la page {page} n’a aucun de ces panneaux. D’abord, {route}, puis :',
    'click the 🖥️ **Go Back to Presenter** button at the top right':
        'cliquez sur le bouton 🖥️ **Retour au Présentateur** en haut à droite',
    'click the **Presenter** tab at the top of the window':
        'cliquez sur l’onglet **Présentateur** en haut de la fenêtre',
    '**{window} is not open**, so I cannot point at "{target}" in it. To get there: {how} — I have outlined it in red. Then ask me again.':
        '**{window} n’est pas ouvert**, je ne peux donc pas y montrer "{target}". Pour y aller : {how} — je l’ai entouré en rouge. Puis redemandez-moi.',
    '**{window} is not open**, so I cannot point at "{target}" in it. To get there: {how}. Then ask me again.':
        '**{window} n’est pas ouvert**, je ne peux donc pas y montrer "{target}". Pour y aller : {how}. Puis redemandez-moi.',
    'I could not find "{target}", but there is **{closest}** on screen — is that the one? Ask again with those words and I will point it out.':
        'Je n’ai pas trouvé "{target}", mais il y a **{closest}** à l’écran — est-ce celui-là ? Redemandez avec ces mots et je vous le montrerai.',
    'Highlight "{name}"': 'Entourer "{name}"',
    'I found "{target}" in the {window}, but it is not visible right now. Try opening the panel or tab it belongs to first.':
        'J’ai trouvé "{target}" dans {window}, mais il n’est pas visible pour le moment. Ouvrez d’abord le panneau ou l’onglet où il se trouve.',
    '**{control}** is on screen now — I have outlined it in red for a few seconds, {where}.':
        '**{control}** est à l’écran — je l’ai entouré en rouge pendant quelques secondes, {where}.',
    'There are {count} things matching "{target}"; I outlined them all.':
        'Il y a {count} éléments qui correspondent à "{target}" ; je les ai tous entourés.',
    '({count} in all — ask with more of the words on the control to narrow it down.)':
        '({count} au total — redemandez avec plus de mots du bouton pour préciser.)',
    'Screen {id} is off but already holds {held}, so turning it on shows that.':
        'L’écran {id} est éteint mais contient déjà {held} ; l’allumer l’affichera.',
    'No presentation screen is showing right now. This machine has {count} display(s) available to present on.':
        'Aucun écran de présentation n’est affiché pour le moment. Cet ordinateur a {count} moniteur(s) disponible(s) pour présenter.',
    'Screen {ids} is showing right now, on a machine with {count} display(s){held}.':
        'L’écran {ids} est affiché en ce moment, sur un ordinateur avec {count} moniteur(s){held}.',
    'Screen {ids} are showing right now, on a machine with {count} display(s){held}.':
        'Les écrans {ids} sont affichés en ce moment, sur un ordinateur avec {count} moniteur(s){held}.',
    '**{reference} ({version})** reads -- "{words}".':
        '**{reference} ({version})** dit -- "{words}".',
    '**{reference} ({version})** reads.':
        '**{reference} ({version})** a été trouvé.',
    'I can put it on the screen for you.':
        'Je peux l’afficher à l’écran pour vous.',
    'I can put it on the screen for you -- the screen is off just now, so it will be loaded and ready for when it is turned on.':
        'Je peux l’afficher à l’écran pour vous -- l’écran est éteint pour l’instant, il sera donc chargé et prêt dès qu’il sera allumé.',
    'Put {what} on the screen': 'Afficher {what} à l’écran',
    'a {minutes} minute countdown': 'un compte à rebours de {minutes} minutes',
    'a countdown to {time}': 'un compte à rebours jusqu’à {time}',
    '**I can start {what} on the screen for you**.':
        '**Je peux lancer {what} à l’écran pour vous**.',
    '**I can start {what} on the screen for you** -- the screen is off just now, so it will be loaded and ready for when it is turned on.':
        '**Je peux lancer {what} à l’écran pour vous** -- l’écran est éteint pour l’instant, il sera donc chargé et prêt dès qu’il sera allumé.',
    'Start {what}': 'Lancer {what}',
    'The selected song lives in the Presenter, and the main window is not on it right now.':
        'Le chant sélectionné se trouve dans le Présentateur, et la fenêtre principale n’y est pas en ce moment.',
    'The run sheet lives in the Presenter, and the main window is not on it right now.':
        'Le déroulé se trouve dans le Présentateur, et la fenêtre principale n’y est pas en ce moment.',
    'I wrote those words out as a song for the Lyric Editor.':
        'J’ai mis ces paroles en forme de chant pour l’Éditeur de paroles.',
    'that page': 'cette page',
    'I could not read {site} just now. Check the address, or copy the words off the page and paste them here and I will write them out.':
        'Je n’ai pas pu lire {site} pour l’instant. Vérifiez l’adresse, ou copiez les paroles de la page et collez-les ici : je les mettrai en forme.',
    'I read {site} and wrote the song on it out for the Lyric Editor.':
        'J’ai lu {site} et mis en forme le chant qui s’y trouve pour l’Éditeur de paroles.',
    '{site} answered with a "checking your browser" page instead of the song. Open the page in your own browser once and try again, or copy the words off it and paste them here.':
        '{site} a répondu par une page "vérification de votre navigateur" au lieu du chant. Ouvrez une fois la page dans votre propre navigateur et réessayez, ou copiez-en les paroles et collez-les ici.',
    'I read {site} but could not find a song on it. If the words are in front of you, paste them here and I will write them out.':
        'J’ai lu {site} mais je n’y ai trouvé aucun chant. Si vous avez les paroles sous les yeux, collez-les ici et je les mettrai en forme.',
    'I could not look up "{title}" just now. Paste its words here, or send me the address of a page with the song on it, and I will write it out.':
        'Je n’ai pas pu chercher "{title}" pour l’instant. Collez ses paroles ici, ou envoyez-moi l’adresse d’une page où se trouve le chant, et je le mettrai en forme.',
    'You already have {names} in your Documents list.':
        'Vous avez déjà {names} dans votre liste des documents.',
    'I found "{title}" in the app\'s collection of public-domain hymns and wrote it out for the Lyric Editor, with a link back to where the words came from.':
        'J’ai trouvé "{title}" dans la collection de cantiques du domaine public de l’application et je l’ai mis en forme pour l’Éditeur de paroles, avec un lien vers la source des paroles.',
    'I could not find "{title}" in your songs or in the app\'s collection of public-domain hymns.':
        'Je n’ai pas trouvé "{title}" dans vos chants ni dans la collection de cantiques du domaine public de l’application.',
    'Did you mean {names}? Ask again with that name.':
        'Vouliez-vous dire {names} ? Redemandez avec ce nom.',
    'For any other song, paste its words here, or send me the address of a page with the song on it, and I will write it out. I do not write songs out from memory -- a remembered song is often wrong.':
        'Pour tout autre chant, collez ses paroles ici, ou envoyez-moi l’adresse d’une page où il se trouve, et je le mettrai en forme. Je n’écris pas de chants de mémoire -- un chant retenu de mémoire est souvent faux.',
    'The words did not say everything, so I guessed:':
        'Les paroles ne disaient pas tout, alors j’ai deviné :',
    'Press Create "{name}" to add it to your songs, or Copy song text to paste it into the Lyric Editor yourself.':
        'Appuyez sur Créer "{name}" pour l’ajouter à vos chants, ou sur Copier le texte du chant pour le coller vous-même dans l’Éditeur de paroles.',
    'I could not find that in the app guide. Try naming the button or the thing you want to put on the screen — for example "how do I show a song?" or "where is the clear button?".':
        'Je n’ai pas trouvé cela dans le guide de l’application. Essayez de nommer le bouton ou ce que vous voulez afficher à l’écran — par exemple "comment afficher un chant ?" ou "où est le bouton Effacer ?".',
    'Ask me how to do something in the app.':
        'Demandez-moi comment faire quelque chose dans l’application.',
    'Alright. Ask me again whenever you need something.':
        'D’accord. Redemandez-moi quand vous aurez besoin de quelque chose.',
    'Tell me in a few words what you would like to do and I will look it up — for example "how do I show a screen".':
        'Dites-moi en quelques mots ce que vous voulez faire et je chercherai — par exemple "comment afficher un écran".',
    'Going back to "{question}" —': 'Je reviens à "{question}" —',
    '**Opening {window} for you.**': '**J’ouvre {window} pour vous.**',
    '**Open {window} first.** It is {how}. When it is showing, come back here and press **{start}**.':
        '**Ouvrez d’abord {window}.** C’est {how}. Quand c’est affiché, revenez ici et appuyez sur **{start}**.',
    '**Open {window} first.** It is {how} — I have outlined it in red. When it is showing, come back here and press **{start}**.':
        '**Ouvrez d’abord {window}.** C’est {how} — je l’ai entouré en rouge. Quand c’est affiché, revenez ici et appuyez sur **{start}**.',
    'Done.': 'C’est fait.',
    'I could not start the walkthrough for that one. The written steps above still work.':
        'Je n’ai pas pu lancer le pas-à-pas pour cela. Les étapes écrites ci-dessus restent valables.',
    '**Look at the app window.** I am pointing to the right place now. Give me a moment to prepare the safe **{act}** step for the controls on your screen.':
        '**Regardez la fenêtre de l’application.** Je vous montre le bon endroit. Un instant : je prépare l’étape **{act}** sûre pour les commandes de votre écran.',
    '**Look at the app window.** A card is up. Some of its steps are not buttons I can point at, so give me a moment and I will work out the real ones.':
        '**Regardez la fenêtre de l’application.** Une fiche est affichée. Certaines de ses étapes ne sont pas des boutons que je peux montrer : un instant, je vais trouver les vraies.',
    '**Look at the app window.** I cannot press this one for you — its steps are things to do in the page itself, not buttons. A card is showing step 1 of {count}; press **{next}** on it as you go.':
        '**Regardez la fenêtre de l’application.** Je ne peux pas faire celle-ci pour vous — ses étapes se font dans la page elle-même, ce ne sont pas des boutons. Une fiche affiche l’étape 1 sur {count} ; appuyez sur **{next}** au fur et à mesure.',
    '**Look at the app window.** A card is showing step 1 of {count}. Press **{act}** and I will do that step for you, one step per press — or **{skip}** to do it yourself. **✕** stops.':
        '**Regardez la fenêtre de l’application.** Une fiche affiche l’étape 1 sur {count}. Appuyez sur **{act}** et je ferai cette étape pour vous, une étape par appui — ou sur **{skip}** pour la faire vous-même. **✕** arrête.',
    '**Look at the app window.** A card is showing step 1 of {count}, and the button that step is about is circled in red. Press **{next}** on the card when you have done it — or just do it, and the card moves on by itself.':
        '**Regardez la fenêtre de l’application.** Une fiche affiche l’étape 1 sur {count}, et le bouton concerné est entouré en rouge. Appuyez sur **{next}** sur la fiche quand c’est fait — ou faites-le simplement, et la fiche avance toute seule.',
    'I could not find "{text}" on screen just now. Open the panel or tab it belongs to, then ask again.':
        'Je ne trouve pas "{text}" à l’écran pour l’instant. Ouvrez le panneau ou l’onglet où il se trouve, puis redemandez.',
    'I have outlined **{control}** again, {where}.':
        'J’ai de nouveau entouré **{control}**, {where}.',
    'I could not do that just now. Ask me again, or tell me what you are trying to do and I will find another way.':
        'Je n’ai pas pu le faire pour l’instant. Redemandez-moi, ou dites-moi ce que vous essayez de faire et je trouverai un autre moyen.',
    '(From the app guide, which is written in English.)':
        '(Extrait du guide de l’application, rédigé en anglais.)',
    "I'm there — start it": 'J’y suis — commencez',
    everything: 'tout',
    'the background': 'l’arrière-plan',
    'the slide': 'la diapositive',
    'the Bible passage or long text': 'le passage biblique ou le texte long',
    'the foreground (countdown, marquee, clock)':
        'le premier plan (compte à rebours, bandeau, horloge)',
    'Screen {id} already holds {held}, so turning it on shows that.':
        'L’écran {id} contient déjà {held} ; l’allumer l’affichera.',
    '**Nothing is showing on the projector.** The screen is off.':
        '**Rien ne s’affiche au projecteur.** L’écran est éteint.',
    '**Nothing is showing on the projector.** The screen is off, and this computer has {count} display to put it on.':
        '**Rien ne s’affiche au projecteur.** L’écran est éteint, et cet ordinateur a {count} moniteur pour l’afficher.',
    '**Nothing is showing on the projector.** The screen is off, and this computer has {count} displays to put it on.':
        '**Rien ne s’affiche au projecteur.** L’écran est éteint, et cet ordinateur a {count} moniteurs pour l’afficher.',
    'Screen {id} shows {held}.': 'L’écran {id} affiche {held}.',
    '**Screen {ids} is showing right now** -- the projector has the app on it.':
        '**L’écran {ids} est affiché en ce moment** -- le projecteur montre l’application.',
    '**Screen {ids} are showing right now** -- the projector has the app on it.':
        '**Les écrans {ids} sont affichés en ce moment** -- le projecteur montre l’application.',
    'Turning the screen on': 'Allumage de l’écran',
    '**The screen is already on** -- screen {ids} is showing.':
        '**L’écran est déjà allumé** -- l’écran {ids} est affiché.',
    'I could not find the screen button in this window. It is the leftmost icon on the screen preview card in the **Presenter** (or press **F5** there).':
        'Je ne trouve pas le bouton de l’écran dans cette fenêtre. C’est l’icône la plus à gauche sur la carte d’aperçu de l’écran, dans le **Présentateur** (ou appuyez sur **F5** là-bas).',
    '**The screen is on now** -- screen {ids} is showing.':
        '**L’écran est maintenant allumé** -- l’écran {ids} est affiché.',
    'I pressed the screen button, but the app still reports nothing showing. Look at the screen preview card in the Presenter: its leftmost icon turns the output on, and the **Display** button under it says which display it goes to.':
        'J’ai appuyé sur le bouton de l’écran, mais l’application indique toujours que rien n’est affiché. Regardez la carte d’aperçu de l’écran dans le Présentateur : son icône la plus à gauche allume la sortie, et le bouton **Moniteur** en dessous indique vers quel moniteur elle va.',
    'Turning every screen off': 'Extinction de tous les écrans',
    '**The screen is already off** -- nothing is showing.':
        '**L’écran est déjà éteint** -- rien n’est affiché.',
    '**Every screen is off now.** The projector shows nothing from the app.':
        '**Tous les écrans sont maintenant éteints.** Le projecteur n’affiche plus rien de l’application.',
    'I asked the app to hide its screens, but one still reports showing. The leftmost icon on its preview card in the Presenter turns it off (or **F5**).':
        'J’ai demandé à l’application de masquer ses écrans, mais l’un d’eux indique toujours qu’il est affiché. L’icône la plus à gauche sur sa carte d’aperçu, dans le Présentateur, l’éteint (ou **F5**).',
    'Clearing {what}': 'Effacement : {what}',
    '**The screen is off**, so there is nothing to clear -- the projector shows nothing from the app.':
        '**L’écran est éteint**, il n’y a donc rien à effacer -- le projecteur n’affiche rien de l’application.',
    'The screen is off, so this only emptied what it was holding.':
        'L’écran est éteint : cela a seulement vidé ce qu’il contenait.',
    'I could not find the **{label}** button in this window. It is on the screen preview card in the **Presenter**, or press **{key}** there.':
        'Je ne trouve pas le bouton **{label}** dans cette fenêtre. Il est sur la carte d’aperçu de l’écran, dans le **Présentateur**, ou appuyez sur **{key}** là-bas.',
    'I pressed **{label}**, and the button looks the same afterwards -- it is only lit while there is {what} to clear, so there may have been nothing on that layer. Next time, **{key}** does the same.':
        'J’ai appuyé sur **{label}**, et le bouton n’a pas changé -- il ne s’allume que s’il y a {what} à effacer, il n’y avait donc peut-être rien sur cette couche. La prochaine fois, **{key}** fait la même chose.',
    '**Cleared {what}.**': '**Effacé : {what}.**',
    'Tell me the words written on the control -- for example `/find Clear Long Text` -- and I will outline it in the app window.':
        'Dites-moi les mots écrits sur la commande -- par exemple `/find Effacer le texte long` -- et je l’entourerai dans la fenêtre de l’application.',
    'I could not find anything on screen reading "{words}". Try the exact words written on the button, or open the panel it belongs to first.':
        'Je ne trouve rien à l’écran qui dise "{words}". Essayez les mots exacts écrits sur le bouton, ou ouvrez d’abord le panneau où il se trouve.',
    'I could not look for "{words}" just now -- the app window may be busy. Try again in a moment.':
        'Je n’ai pas pu chercher "{words}" pour l’instant -- la fenêtre de l’application est peut-être occupée. Réessayez dans un instant.',
    'Say which page: `/goto presenter`, `/goto reader` or `/goto editor`.':
        'Dites quelle page : `/goto presenter`, `/goto reader` ou `/goto editor`.',
    'Switching to the {page}': 'Passage à {page}',
    '**You are already in the {page}.**': '**Vous êtes déjà dans {page}.**',
    '**The main window is showing the {page} now.** The projector is untouched.':
        '**La fenêtre principale affiche maintenant {page}.** Le projecteur n’a pas changé.',
    'I could not switch to the {page}. Click its tab in the header of the main window instead.':
        'Je n’ai pas pu passer à {page}. Cliquez plutôt sur son onglet en haut de la fenêtre principale.',
    'Checking which window is in front':
        'Vérification de la fenêtre au premier plan',
    '**This tab works with the {window}, a window of its own** in {language}.':
        '**Cette conversation travaille avec {window}, une fenêtre à part** (langue : {language}).',
    '**This tab works with the {window}, a window of its own**.':
        '**Cette conversation travaille avec {window}, une fenêtre à part**.',
    'The main window is on the {window}.':
        'La fenêtre principale est sur {window}.',
    '**The main window is on the {window}** in {language}.':
        '**La fenêtre principale est sur {window}** (langue : {language}).',
    '**The main window is on the {window}**.':
        '**La fenêtre principale est sur {window}**.',
    'Also open: {windows}.': 'Aussi ouvert : {windows}.',
    'App version {version}.': 'Version de l’application {version}.',
    French: 'Français',
    'I could not search the guide just now. Ask the question in full and I will look it up.':
        'Je n’ai pas pu chercher dans le guide pour l’instant. Posez la question en entier et je chercherai.',
    'Checking what is selected': 'Vérification de la sélection',
    '**The main window is not on the Presenter**, and the selected song lives there.':
        '**La fenêtre principale n’est pas sur le Présentateur**, et c’est là que se trouve le chant sélectionné.',
    'Reading the run sheet': 'Lecture du déroulé',
    '**The main window is not on the Presenter**, and the run sheet lives there.':
        '**La fenêtre principale n’est pas sur le Présentateur**, et c’est là que se trouve le déroulé.',
    'Putting the next slide on the screen':
        'Affichage de la diapositive suivante',
    'Putting the previous slide on the screen':
        'Affichage de la diapositive précédente',
    '**The main window is not on the Presenter**, so there is no slide list to step through.':
        '**La fenêtre principale n’est pas sur le Présentateur**, il n’y a donc pas de liste de diapositives à parcourir.',
    '**Nothing is selected in the Documents list.** Click a song there first.':
        '**Rien n’est sélectionné dans la liste des documents.** Cliquez d’abord sur un chant.',
    '**There is no next slide** -- "{name}" has nothing after this one.':
        '**Il n’y a pas de diapositive suivante** -- "{name}" n’a rien après celle-ci.',
    '**There is no previous slide** -- none of "{name}" is on a screen yet, so there is nothing to go back from.':
        '**Il n’y a pas de diapositive précédente** -- aucune de "{name}" n’est encore à l’écran, il n’y a donc rien avant.',
    'I could not find slide {n} of "{name}" on the screen to press. Click it in the slide list instead.':
        'Je ne trouve pas la diapositive {n} de "{name}" à l’écran pour appuyer dessus. Cliquez-la plutôt dans la liste des diapositives.',
    'I pressed slide {n} of "{name}" but the app does not show it on a screen yet -- please look at the Mini Screen panel.':
        'J’ai appuyé sur la diapositive {n} de "{name}", mais l’application ne l’affiche pas encore à l’écran -- regardez le panneau Mini-écran.',
    '**{slide} of "{name}" is on the screen now**':
        '**{slide} de "{name}" est maintenant à l’écran**',
    'The screen itself is off, so the projector is not showing it yet.':
        'L’écran lui-même est éteint : le projecteur ne l’affiche pas encore.',
    'Slide {n} "{name}"': 'Diapositive {n} "{name}"',
    'Slide {n}': 'Diapositive {n}',
    'Its slides: {slides}.': 'Ses diapositives : {slides}.',
    'Putting the slide on the screen': 'Affichage de la diapositive',
    'Say which slide of "{name}": `/slide 2` or `/slide verse 1`.':
        'Dites quelle diapositive de "{name}" : `/slide 2` ou `/slide verse 1`.',
    '**"{name}" has no slide called "{words}".**':
        '**"{name}" n’a pas de diapositive appelée "{words}".**',
    '**{slide} of "{name}"** -- press the button and it goes on the screen':
        '**{slide} de "{name}"** -- appuyez sur le bouton et elle s’affiche à l’écran',
    'The screen is off, so it holds the slide until you turn it on.':
        'L’écran est éteint : il garde la diapositive jusqu’à ce que vous l’allumiez.',
    'Put slide {n} on the screen': 'Afficher la diapositive {n} à l’écran',
    '**"{name}" has no slide to go on to.**':
        '**"{name}" n’a pas de diapositive suivante.**',
    '**No slide of "{name}" is on a screen yet**, so there is none before it.':
        '**Aucune diapositive de "{name}" n’est encore à l’écran**, il n’y en a donc pas avant.',
    '**Nothing to turn off.**': '**Rien à éteindre.**',
    'Press the button to turn it off.':
        'Appuyez sur le bouton pour l’éteindre.',
    '**The screen is already on.**': '**L’écran est déjà allumé.**',
    'Press the button to turn it on.': 'Appuyez sur le bouton pour l’allumer.',
    '**Say which passage** -- for example `/verse John 3:16` or `/verse Psalm 23:1-6`.':
        '**Dites quel passage** -- par exemple `/verse John 3:16` ou `/verse Psalm 23:1-6`.',
    'Putting {reference} on the screen': 'Affichage de {reference} à l’écran',
    '**I could not put "{reference}" on the screen just now.** Write it as book, chapter and verse -- `/verse John 3:16` -- from the Presenter page.':
        '**Je n’ai pas pu afficher "{reference}" à l’écran pour l’instant.** Écrivez-le sous la forme livre, chapitre et verset -- `/verse John 3:16` -- depuis la page Présentateur.',
    '**Say how long** -- `/countdown 5` for five minutes, `/countdown 10:30` to count down to a time, or `/countdown stop` to take it off.':
        '**Dites combien de temps** -- `/countdown 5` pour cinq minutes, `/countdown 10:30` pour compter jusqu’à une heure donnée, ou `/countdown stop` pour le retirer.',
    'I could not take the countdown off just now. Press F10 (Clear Foreground) on the Presenter page.':
        'Je n’ai pas pu retirer le compte à rebours pour l’instant. Appuyez sur F10 (Effacer le premier plan) sur la page Présentateur.',
    'Starting a {minutes} minute countdown':
        'Lancement d’un compte à rebours de {minutes} minutes',
    'Starting a countdown to {time}':
        'Lancement d’un compte à rebours jusqu’à {time}',
    'I could not start the countdown just now. Try again from the Presenter page -- `/countdown 5`.':
        'Je n’ai pas pu lancer le compte à rebours pour l’instant. Réessayez depuis la page Présentateur -- `/countdown 5`.',
    '**Say the words to scroll** -- `/{command} Please silence your phones`; `/{command} stop` takes it off.':
        '**Dites les mots à faire défiler** -- `/{command} Mettez vos téléphones en silencieux` ; `/{command} stop` le retire.',
    'I could not take the message off just now. Press F10 (Clear Foreground) on the Presenter page.':
        'Je n’ai pas pu retirer le message pour l’instant. Appuyez sur F10 (Effacer le premier plan) sur la page Présentateur.',
    'Putting a scrolling message along the top of the screen':
        'Ajout d’un message défilant en haut de l’écran',
    'Putting a scrolling message along the bottom of the screen':
        'Ajout d’un message défilant en bas de l’écran',
    'I could not put the message on the screen just now. Try again from the Presenter page -- `/{command} <words>`.':
        'Je n’ai pas pu afficher le message à l’écran pour l’instant. Réessayez depuis la page Présentateur -- `/{command} <mots>`.',
    '**Give me the song** -- its title (`/lyric Amazing Grace`), the address of the page it is on (`/lyric https://…`), or paste its words after the command. I will write it out for the Lyric Editor and offer a button that saves it; nothing is saved until you press it.':
        '**Donnez-moi le chant** -- son titre (`/lyric Amazing Grace`), l’adresse de la page où il se trouve (`/lyric https://…`), ou collez ses paroles après la commande. Je le mettrai en forme pour l’Éditeur de paroles et proposerai un bouton pour l’enregistrer ; rien n’est enregistré avant que vous appuyiez dessus.',
    'the page': 'la page',
    'Looking up “{title}”': 'Recherche de “{title}”',
    'That did not read as the words of a song. Give me the address of the page it is on (`/lyric https://…`), or paste the words themselves, a line each, with a label like *Verse 1* or *Chorus* over each part.':
        'Cela ne ressemble pas aux paroles d’un chant. Donnez-moi l’adresse de la page où il se trouve (`/lyric https://…`), ou collez les paroles elles-mêmes, une par ligne, avec une étiquette comme *Verse 1* ou *Chorus* au-dessus de chaque partie.',
    'I could not write that song out just now. Try again in a moment, or paste the words as plain lines.':
        'Je n’ai pas pu mettre ce chant en forme pour l’instant. Réessayez dans un instant, ou collez les paroles en lignes simples.',
    '`/{command}` works on the Presenter page, and this chat is asking about the {window}. Switch the main window to the Presenter, choose **{presenter}** under {askingAbout} at the top, and type it again.':
        '`/{command}` fonctionne sur la page Présentateur, et cette conversation porte sur {window}. Passez la fenêtre principale au Présentateur, choisissez **{presenter}** sous {askingAbout} en haut, puis retapez la commande.',
    'Type `/clear` in the chat window to clear the chat in front of you.':
        'Tapez `/clear` dans la fenêtre de discussion pour effacer la conversation affichée.',
    '**Say the question after /btw** -- `/btw What is the Bible?` -- and the assistant answers it from its own knowledge instead of looking in this app’s guide. It takes an assistant (a key in Settings → AI Providers, or a server of your own): the built-in guide cannot answer a general question.':
        "**Écrivez la question après /btw** -- `/btw Qu’est-ce que la Bible ?` -- et l’assistant y répond avec ses propres connaissances au lieu de chercher dans le guide de cette application. Il faut un assistant (une clé dans Paramètres → Fournisseurs d'IA, ou votre propre serveur) : le guide intégré ne peut pas répondre à une question générale.",
    '**On the Presenter page** (switch there first): {commands}.':
        '**Sur la page Présentateur** (allez-y d’abord) : {commands}.',
    '**Commands you can type** -- each one runs on the spot, with no assistant and no internet (except `/btw`, which puts a general question to the assistant):':
        '**Commandes que vous pouvez taper** -- chacune s’exécute tout de suite, sans assistant et sans internet (sauf `/btw`, qui pose une question générale à l’assistant) :',
    'Type `/` and the list appears as you type.':
        'Tapez `/` et la liste apparaît pendant que vous tapez.',
    'Nothing has been spent in this chat yet: no question here has been put to an assistant. The figure appears under each answer, and **{credit}** under the pickers at the top keeps the total.':
        'Rien n’a encore été dépensé dans cette conversation : aucune question n’a été posée à un assistant. Le montant s’affiche sous chaque réponse, et **{credit}** sous les sélecteurs en haut garde le total.',
    '**This chat so far: {cost} · {tokens} tokens.**':
        '**Cette conversation jusqu’ici : {cost} · {tokens} jetons.**',
    'Each tab keeps its own total; the same figure sits under **{credit}** at the top, and every answer carries its own.':
        'Chaque onglet garde son propre total ; le même montant figure sous **{credit}** en haut, et chaque réponse porte le sien.',
    'Type `/limit` to change the limit.':
        'Tapez `/limit` pour changer la limite.',
    'Carrying on: the hour starts again from now.':
        'On continue : l’heure recommence à partir de maintenant.',
    'Carrying on: the hour starts again from now, with {limit} available before I pause again.':
        'On continue : l’heure recommence à partir de maintenant, avec {limit} disponibles avant une nouvelle pause.',
    'I do not read "{words}" as a limit. Say a number of dollars an hour (`/limit 2`, `/limit 0.50`), `/limit off` to keep only the pace cap, or `/limit more` to carry on after a pause.':
        'Je ne comprends pas "{words}" comme une limite. Indiquez un nombre de dollars par heure (`/limit 2`, `/limit 0.50`), `/limit off` pour ne garder que la limite de rythme, ou `/limit more` pour continuer après une pause.',
    '**The money cap is off.** The assistant will still pause after {count} model calls in one hour, which is more than a person asks for.':
        '**Le plafond d’argent est désactivé.** L’assistant fera quand même une pause après {count} appels au modèle en une heure, ce qui est plus que ce qu’une personne demande.',
    '**The limit is now {limit} an hour.** At that point the assistant pauses and asks before spending more.':
        '**La limite est maintenant de {limit} par heure.** Une fois atteinte, l’assistant fait une pause et demande avant de dépenser plus.',
    '**Limit: {limit} an hour.**': '**Limite : {limit} par heure.**',
    'Change it with `/limit <dollars>` or the **{picker}** picker at the top ({choices}), or `/limit off` to keep only the pace cap.':
        'Changez-la avec `/limit <dollars>` ou le sélecteur **{picker}** en haut ({choices}), ou `/limit off` pour ne garder que la limite de rythme.',
    'I do not know a command called `/{name}`.':
        'Je ne connais pas de commande appelée `/{name}`.',
    'I could not do `/{name}` just now. Try again in a moment, or ask me in words and I will find another way.':
        'Je n’ai pas pu exécuter `/{name}` pour l’instant. Réessayez dans un instant, ou demandez-moi avec des mots et je trouverai un autre moyen.',
    'I could not reach the app window just now. Try again in a moment.':
        'Je n’ai pas pu joindre la fenêtre de l’application pour l’instant. Réessayez dans un instant.',
    'Next time, **{key}** in the Presenter does the same.':
        'La prochaine fois, **{key}** dans le Présentateur fait la même chose.',
    '**The main window is not on the Presenter**, so there is no slide list to choose from.':
        '**La fenêtre principale n’est pas sur le Présentateur**, il n’y a donc pas de liste de diapositives où choisir.',
    '**Nothing is selected in the Documents list.** Click the song there first, then ask again.':
        '**Rien n’est sélectionné dans la liste des documents.** Cliquez d’abord sur le chant, puis redemandez.',
    'The guide covers using the app and holds none of the Bible’s words — but the Bibles in this app do, and **Bible Find** searches them. Search for “{words}”. If nothing comes back, try fewer words: it looks for them as they are typed.':
        'Le guide parle de l’utilisation de l’application et ne contient aucun mot de la Bible — mais les Bibles de cette application, oui, et la **recherche biblique** les parcourt. Cherchez “{words}”. Si rien ne vient, essayez moins de mots : elle cherche les mots tels qu’ils sont tapés.',
    'That is a question about the Bible itself, and the guide only knows how to use this app. An assistant can answer it: ask with /btw in front — /btw {question} — and if none answers, pick one in the row above, or add a key in Settings → AI Providers.':
        "C’est une question sur la Bible elle-même, et le guide ne sait qu’expliquer cette application. Un assistant peut y répondre : posez-la avec /btw devant — /btw {question} — et si aucun ne répond, choisissez-en un dans la rangée au-dessus, ou ajoutez une clé dans Paramètres → Fournisseurs d'IA.",
    'The Bibles in this app can be searched too: **Bible Find** lists the verses that have the words you type — try “{words}”, and fewer words if nothing comes back. Press {button} below for where it is.':
        'Les Bibles de cette application peuvent aussi être cherchées : la **recherche biblique** liste les versets qui contiennent les mots tapés — essayez “{words}”, et moins de mots si rien ne vient. Appuyez sur {button} ci-dessous pour voir où elle se trouve.',
    'Show me Bible Find': 'Montrez-moi la recherche biblique',
    'Open {provider} billing': 'Ouvrir la facturation {provider}',
    'Open {provider} usage limits':
        'Ouvrir les limites d’utilisation {provider}',
    'Open {provider} API keys': 'Ouvrir les clés API {provider}',
    'Open {provider} workspaces': 'Ouvrir les espaces de travail {provider}',
    '{provider} status page': 'Page d’état {provider}',
    '{assistant} could not answer — {reason}.':
        '{assistant} n’a pas pu répondre — {reason}.',
    '{assistant} could not answer.': '{assistant} n’a pas pu répondre.',
    'nothing answered at its address — it is shared by openworship.app and may be switched off right now; try again later or pick another assistant':
        'rien n’a répondu à son adresse — il est partagé par openworship.app et peut être éteint en ce moment ; réessayez plus tard ou choisissez un autre assistant',
    'its server is not answering — check that it is running on this computer':
        'son serveur ne répond pas — vérifiez qu’il tourne sur cet ordinateur',
    'its server is not answering — check that the computer it runs on is on and awake, and that the server is running':
        'son serveur ne répond pas — vérifiez que l’ordinateur où il tourne est allumé et réveillé, et que le serveur tourne',
    'it went quiet in the middle of the question — it is shared by openworship.app and may be switched off right now; try again later or pick another assistant':
        'il s’est tu au milieu de la question — il est partagé par openworship.app et peut être éteint en ce moment ; réessayez plus tard ou choisissez un autre assistant',
    'it went quiet in the middle of the question — check that its server is running':
        'il s’est tu au milieu de la question — vérifiez que son serveur tourne',
    'it went quiet in the middle of the question — check that the computer it runs on is on and awake, and that its server is running':
        'il s’est tu au milieu de la question — vérifiez que l’ordinateur où il tourne est allumé et réveillé, et que son serveur tourne',
    'the server took too long to answer':
        'le serveur a mis trop de temps à répondre',
    '{tried} {assistant} answered instead.':
        '{tried} {assistant} a répondu à la place.',
    '{failed} could not answer — looking for another assistant that costs nothing':
        "{failed} n'a pas pu répondre — je cherche un autre assistant gratuit",
    'Use Auto for this chat': 'Utiliser Auto pour cette conversation',
    'Use {assistant} for this chat':
        'Utiliser {assistant} pour cette conversation',
    'That assistant is not in the list any more. Pick one in the ASSISTANT list at the top of this window.':
        'Cet assistant n’est plus dans la liste. Choisissez-en un dans la liste ASSISTANT en haut de cette fenêtre.',
    'This chat now uses Auto: at each question it picks the best assistant that costs nothing and can answer.':
        'Cette conversation utilise désormais Auto : à chaque question, il choisit le meilleur assistant gratuit qui peut répondre.',
    'This chat now uses {assistant}. Pick another in the ASSISTANT list at the top of this window to change it again.':
        'Cette conversation utilise désormais {assistant}. Choisissez-en un autre dans la liste ASSISTANT en haut de cette fenêtre pour changer encore.',
    'Asking {name} instead': 'Je demande à {name} à la place',
    '{tried} Auto asked {assistant} instead.':
        '{tried} Auto a demandé à {assistant} à la place.',
    'Auto asked {assistant} this time.':
        'Cette fois, Auto a demandé à {assistant}.',
    'the control I mean': 'la commande dont je parle',
    'Show me step by step': 'Montrez-moi étape par étape',
    'Read the whole thing': 'Tout lire',
    'Turn the screen on': 'Allumer l’écran',
    'Hide every screen': 'Masquer tous les écrans',
    'Turn every screen off': 'Éteindre tous les écrans',
    'Clear everything on it': 'Tout effacer dessus',
    'Go to the Presenter': 'Aller au Présentateur',
    'Show the next slide': 'Afficher la diapositive suivante',
    'Back one slide': 'Revenir d’une diapositive',
    'Back one': 'Revenir d’une',
    'Show its first slide': 'Afficher sa première diapositive',
    'Is the screen on?': 'L’écran est-il allumé ?',
    'Take it off again': 'Le retirer',
    'Check the screen': 'Vérifier l’écran',
    'Copy song text': 'Copier le texte du chant',
    'Create "{name}"': 'Créer "{name}"',
    'Open AI settings': 'Ouvrir les paramètres d’IA',
    'Document Editor': 'Éditeur de documents',
    'No thanks': 'Non merci',
    'Asking about': 'Question sur',
    'Credit used': 'Crédit utilisé',
    'Limit per hour': 'Limite par heure',
    'from the Bible Reader it is the 🖥️ button at the top right; from the Document Editor it is the Presenter tab at the top':
        'depuis le Lecteur biblique, le bouton 🖥️ en haut à droite ; depuis l’Éditeur de documents, l’onglet Présentateur en haut',
    'the 📖 Bible Reader tab at the top of the window':
        'l’onglet 📖 Lecteur biblique en haut de la fenêtre',
    'the ✏️ Editor tab at the top of the window':
        'l’onglet ✏️ Éditeur en haut de la fenêtre',
    'double-click a note in the Bible Notes panel':
        'double-cliquez sur une note dans le panneau Notes bibliques',
    'the ⚙️ button at the top right of the window':
        'le bouton ⚙️ en haut à droite de la fenêtre',
    'in the Background panel, open Web and double-click a web page':
        'dans le panneau Arrière-plan, ouvrez Web et double-cliquez sur une page web',
    'open a song from the Documents panel and press Edit':
        'ouvrez un chant depuis le panneau Documents et appuyez sur Modifier',
    'the Tools menu → Local Web Share': 'le menu Outils → Partage web local',
    'in the middle of the window': 'au milieu de la fenêtre',
    'at the top left of the window': 'en haut à gauche de la fenêtre',
    'at the top center of the window': 'en haut au centre de la fenêtre',
    'at the top right of the window': 'en haut à droite de la fenêtre',
    'at the middle left of the window': 'au milieu à gauche de la fenêtre',
    'at the middle right of the window': 'au milieu à droite de la fenêtre',
    'at the bottom left of the window': 'en bas à gauche de la fenêtre',
    'at the bottom center of the window': 'en bas au centre de la fenêtre',
    'at the bottom right of the window': 'en bas à droite de la fenêtre',
    'Is anything showing on the projector?':
        'Quelque chose s’affiche-t-il au projecteur ?',
    'Turn the presentation screen on': 'Allumer l’écran de présentation',
    'Turn every presentation screen off':
        'Éteindre tous les écrans de présentation',
    'Clear everything off the screen (F6)': 'Tout effacer de l’écran (F6)',
    'Clear the background (F7)': 'Effacer l’arrière-plan (F7)',
    'Clear the slide (F8)': 'Effacer la diapositive (F8)',
    'Clear the Bible passage or long text (F9)':
        'Effacer le passage biblique ou le texte long (F9)',
    'Clear the countdown, marquee and clock (F10)':
        'Effacer le compte à rebours, le bandeau et l’horloge (F10)',
    'Clear this chat — every message in this tab':
        'Effacer cette conversation — tous les messages de cet onglet',
    'Outline a control in the app: /find Clear Long Text':
        'Entourer une commande dans l’application : /find Effacer le texte long',
    'Switch the main window: /goto presenter, reader or editor':
        'Changer la fenêtre principale : /goto presenter, reader ou editor',
    'Which window is in front, and the app version':
        'Quelle fenêtre est au premier plan, et la version de l’application',
    'Which song is selected, which slide is up, and what is next':
        'Quel chant est sélectionné, quelle diapositive est affichée, et la suite',
    'Which run sheet is open, where the run is, and what is next':
        'Quel déroulé est ouvert, où il en est, et la suite',
    'Put the next slide of the selected song on the screen':
        'Afficher à l’écran la diapositive suivante du chant sélectionné',
    'Go back one slide': 'Revenir d’une diapositive en arrière',
    'Put one slide of the selected song up: /slide 3, /slide verse 1':
        'Afficher une diapositive du chant sélectionné : /slide 3, /slide verse 1',
    'Put a Bible passage on the screen: /verse John 3:16':
        'Afficher un passage biblique à l’écran : /verse John 3:16',
    'Start a countdown on the screen: /countdown 5, or /countdown 10:30':
        'Lancer un compte à rebours à l’écran : /countdown 5, ou /countdown 10:30',
    'Scroll a message along the bottom: /marquee Silence your phones':
        'Faire défiler un message en bas : /marquee Mettez vos téléphones en silencieux',
    'Scroll a message along the top of the screen: /marquee-top Welcome':
        'Faire défiler un message en haut de l’écran : /marquee-top Bienvenue',
    'Search the built-in guide without an assistant: /help clear bible':
        'Chercher dans le guide intégré sans assistant : /help clear bible',
    'What this chat has cost so far':
        'Ce que cette conversation a coûté jusqu’ici',
    'See or set the hourly spending limit: /limit 2, /limit off':
        'Voir ou régler la limite de dépense par heure : /limit 2, /limit off',
    'Write a song out from its title, a web page, or pasted words':
        'Écrire un chant à partir de son titre, d’une page web ou de paroles collées',
    'Ask the assistant a general question, not about this app':
        'Poser à l’assistant une question générale, hors de cette application',
    'List every command': 'Lister toutes les commandes',
    "The app's own help service did not respond. Try again in a moment; if it keeps happening, restart the app with View → Relaunch in the main window.":
        "Le service d'aide de l'application n'a pas répondu. Réessayez dans un instant ; si cela continue, redémarrez l'application avec Affichage → Relancer dans la fenêtre principale.",
    'That song is not held any more — this window has been reopened since. Send me the words again and I will write it out afresh.':
        "Ce chant n'est plus gardé — cette fenêtre a été rouverte depuis. Envoyez-moi de nouveau les paroles et je le réécrirai.",
    'per 1M tokens (in/out)': 'par 1M de jetons (entrée/sortie)',
    'best answers': 'meilleures réponses',
    'good answers': 'bonnes réponses',
    'simple answers': 'réponses simples',
    'good answers at the lowest cost, with the prompt cached':
        "bonnes réponses au plus bas coût, avec l'invite mise en cache",
    'good answers, the everyday pick':
        'bonnes réponses, le choix de tous les jours',
    'simple answers at a tenth of the price':
        'réponses simples pour un dixième du prix',
    'good answers, strong with tools':
        "bonnes réponses, à l'aise avec les outils",
    'better answers, us-west-2 only':
        'réponses meilleures, us-west-2 uniquement',
    'open model, lowest cost': 'modèle ouvert, coût le plus bas',
    'best answers, about five times the price of Terra':
        'meilleures réponses, environ cinq fois le prix de Terra',
    'older; Terra answers better for less':
        'plus ancien ; Terra répond mieux pour moins cher',
    'open model, lighter': 'modèle ouvert, plus léger',
    'tiny, simple answers only': 'minuscule, réponses simples uniquement',
    'good answers, can see pictures': 'bonnes réponses, voit les images',
    'often busy': 'souvent occupé',
    slower: 'plus lent',
    quick: 'rapide',
    quickest: 'le plus rapide',
    'slow when busy': 'lent quand il est occupé',
    'Answers are coming from a free public AI service ({service}), which needs no API key. Your questions and anything you attach leave this computer and may be kept by that service, so do not send anything private. Answers are also weaker, and can be slow or busy. Your own key in Settings gives better and more private answers.':
        "Les réponses viennent d'un service d'IA public et gratuit ({service}), qui ne demande pas de clé API. Vos questions et tout ce que vous joignez quittent cet ordinateur et peuvent être conservés par ce service : n'envoyez donc rien de privé. Les réponses sont aussi moins bonnes, et peuvent être lentes ou indisponibles. Votre propre clé dans les Paramètres donne des réponses meilleures et plus privées.",
    'Auto picks an assistant that costs nothing for each question: one of your own servers when it is up to it, otherwise a free public AI service ({service}). When that service answers, your questions and anything you attach leave this computer and may be kept by it, so do not send anything private. A server of your own picked in the row above is asked first; when it cannot answer, the question goes on to your other servers and then to this service.':
        "Auto choisit pour chaque question un assistant qui ne coûte rien : un de vos propres serveurs quand il en est capable, sinon un service d'IA public et gratuit ({service}). Quand ce service répond, vos questions et tout ce que vous joignez quittent cet ordinateur et peuvent être conservés par lui : n'envoyez donc rien de privé. Un de vos propres serveurs choisi dans la ligne ci-dessus est interrogé en premier ; quand il ne peut pas répondre, la question passe à vos autres serveurs, puis à ce service.",
    '{name}, shared by openworship.app': '{name}, partagé par openworship.app',
    '{name}, on this computer': '{name}, sur cet ordinateur',
    '{name}, on your network': '{name}, sur votre réseau',
    'can see pictures': 'voit les images',
    'it wrote no answer this time — a smaller question, or a larger model, usually helps':
        "il n'a écrit aucune réponse cette fois — une question plus courte, ou un modèle plus grand, aide généralement",
    'this API key needs a workspace id — add it in Settings → AI Providers':
        "cette clé API demande un identifiant d'espace de travail (workspace id) — ajoutez-le dans Paramètres → Fournisseurs d'IA",
    'the API key was refused — check it in Settings → AI Providers':
        "la clé API a été refusée — vérifiez-la dans Paramètres → Fournisseurs d'IA",
    'the AI account is out of credit': "le compte d'IA n'a plus de crédit",
    'the AI account is being rate-limited (asked too often) — wait a minute and try again':
        "le compte d'IA est limité (trop de demandes) — attendez une minute et réessayez",
    'the AI account is out of credit or being rate-limited':
        "le compte d'IA n'a plus de crédit ou est limité",
    'the AI service is overloaded right now':
        "le service d'IA est surchargé en ce moment",
    'the AI service is having trouble right now':
        "le service d'IA rencontre des difficultés en ce moment",
    'this model is not available to the account — pick another one in the row above':
        "ce modèle n'est pas disponible pour ce compte — choisissez-en un autre dans la ligne ci-dessus",
    'the server could not load this model — the computer it runs on may not have enough memory free. Pick a smaller model in the row above, or close another model there':
        "le serveur n'a pas pu charger ce modèle — l'ordinateur qui le fait tourner n'a peut-être pas assez de mémoire libre. Choisissez un modèle plus petit dans la ligne ci-dessus, ou fermez-y un autre modèle",
    'it could not be reached — the internet may be down':
        'il est injoignable — internet est peut-être coupé',
    'the AI service refused the request (error {status})':
        "le service d'IA a refusé la demande (erreur {status})",
    'To see what is on the projector or what is selected, the main window needs to be on the Presenter page — switch to it and ask again.':
        'Pour voir ce qui est sur le projecteur ou ce qui est sélectionné, la fenêtre principale doit être sur la page Présentateur — passez-y et redemandez.',
    'Thinking about it': 'Réflexion en cours',
    'Thinking it over ({count})': 'Nouvelle réflexion ({count})',
    'I ran out of room working that out before I could answer. Try asking about one step at a time.':
        "J'ai manqué de place pour réfléchir avant de pouvoir répondre. Essayez de demander une étape à la fois.",
    'I could not find an answer for that.':
        "Je n'ai pas trouvé de réponse à cela.",
    'I looked several things up but could not settle on an answer. Try asking about one step at a time.':
        "J'ai vérifié plusieurs choses, mais je ne suis pas arrivé à une réponse. Essayez de demander une étape à la fois.",
    'This assistant’s server cannot use the app’s tools, so this comes from the guide text alone and nothing was checked in the window — for presses and live answers, use LM Studio, Ollama or llama.cpp.':
        "Le serveur de cet assistant ne peut pas utiliser les outils de l'application : cette réponse vient donc du seul texte du guide et rien n'a été vérifié dans la fenêtre — pour des actions et des réponses en direct, utilisez LM Studio, Ollama ou llama.cpp.",
    '{first} or {last}': '{first} ou {last}',
    '{model} is not offered in {region} — choose {choices} under Settings → AI Providers → AWS Region':
        "{model} n'est pas proposé en {region} — choisissez {choices} dans Paramètres → Fournisseurs d'IA → Région AWS",
    'this model is no longer in Settings — pick another one in the row above':
        "ce modèle n'est plus dans les Paramètres — choisissez-en un autre dans la ligne ci-dessus",
    'Waiting for {server} to load {model} — the first answer takes longer':
        'En attente que {server} charge {model} — la première réponse prend plus de temps',
    '{server} is reading the instructions first — the first answer takes longer on a local model':
        "{server} lit d'abord les instructions — la première réponse prend plus de temps sur un modèle local",
    'The walkthrough got stuck on step {number} of "{title}" — "{step}" — and asked for help.':
        'Le guide pas à pas "{title}" s\'est bloqué à l\'étape {number} — "{step}" — et a demandé de l\'aide.',
    'The walkthrough got stuck on step {number} — "{step}" — and asked for help.':
        "Le guide pas à pas s'est bloqué à l'étape {number} — \"{step}\" — et a demandé de l'aide.",
    'The walkthrough got stuck of "{title}" — "{step}" — and asked for help.':
        'Le guide pas à pas "{title}" s\'est bloqué — "{step}" — et a demandé de l\'aide.',
    'The walkthrough got stuck — "{step}" — and asked for help.':
        'Le guide pas à pas s\'est bloqué — "{step}" — et a demandé de l\'aide.',
    'No AI provider key is set': "Aucune clé de fournisseur d'IA n'est définie",
    'There was no question to ask': "Il n'y avait aucune question à poser",
    'Connecting to the app': "Connexion à l'application",
    '{failed} could not answer — asking {other} instead':
        "{failed} n'a pas pu répondre — je demande à {other} à la place",
    'Show it in the list': 'Le montrer dans la liste',
    'here {names}': 'ici {names}',
    'attachment {number}': 'pièce jointe {number}',
    'I have written this up as "{title}". It carries {collected}. Copy report puts every word of it on your clipboard if you want to read it first. Press Send report when you want it filed — nothing goes anywhere until you do.':
        "Je l'ai rédigé sous le titre \"{title}\". Il contient {collected}. Copier le rapport met chaque mot sur votre presse-papiers si vous voulez le lire d'abord. Appuyez sur Envoyer le rapport quand vous voulez le transmettre — rien ne part tant que vous ne l'avez pas fait.",
    'Send report': 'Envoyer le rapport',
    'Copy report': 'Copier le rapport',
    'Try this first:': "Essayez d'abord ceci :",
    'Did that solve it? If it did, nothing needs to be sent. If it did not, I have the report written up and ready.':
        "Est-ce que cela a réglé le problème ? Si oui, rien n'a besoin d'être envoyé. Sinon, j'ai le rapport rédigé et prêt.",
    'That fixed it': "C'est réglé",
    'Still a problem — report it': 'Toujours un problème — le signaler',
    'Good. Nothing was sent, and this report is closed. If it comes back, press Report again and I will pick it up from here.':
        "Bien. Rien n'a été envoyé, et ce rapport est clos. Si le problème revient, appuyez de nouveau sur Signaler et je reprendrai à partir d'ici.",
    "the app's version and build, this computer's system information (operating system, language, time zone, display scale), the window you are in and what is selected, what each screen holds, the app's console log (its recent errors and warnings), the end of this conversation, a picture of the app and any file you attach":
        "la version et la build de l'application, les informations système de cet ordinateur (système d'exploitation, langue, fuseau horaire, échelle d'affichage), la fenêtre où vous êtes et ce qui est sélectionné, ce que contient chaque écran, le journal de la console de l'application (ses erreurs et avertissements récents), la fin de cette conversation, une image de l'application et tout fichier que vous joignez",
    'I will look at the app myself and write it up for the people who maintain the app. The report carries {collected}. Nothing is sent until you then press Send report.':
        "Je vais examiner l'application moi-même et rédiger le rapport pour les personnes qui la maintiennent. Le rapport contient {collected}. Rien n'est envoyé tant que vous n'appuyez pas ensuite sur Envoyer le rapport.",
    'Tell me what went wrong — or what you wish the app did better — in the box below, in your own words, and attach a picture or a file (a PDF, a text file) if it helps. Then press Send or Report — either starts it: {promise}':
        "Dites-moi ce qui n'a pas marché — ou ce que vous aimeriez que l'application fasse mieux — dans la case ci-dessous, avec vos propres mots, et joignez une image ou un fichier (un PDF, un fichier texte) si cela aide. Puis appuyez sur Envoyer ou Signaler — l'un ou l'autre lance la démarche : {promise}",
    Report: 'Signaler',
    'The app ran into a problem:': "L'application a rencontré un problème :",
    'Press Report to let me look into it: {promise} If you remember what you were doing when it happened, type that in the box instead and press Send — it goes into the report, and so does a picture or a file you attach.':
        "Appuyez sur Signaler pour que je l'examine : {promise} Si vous vous souvenez de ce que vous faisiez quand c'est arrivé, tapez-le plutôt dans la case et appuyez sur Envoyer — cela va dans le rapport, tout comme une image ou un fichier que vous joignez.",
    "from the app's help page": "depuis la page d'aide de l'application",
    'the address built into the app; its help page could not be checked':
        "l'adresse intégrée à l'application ; sa page d'aide n'a pas pu être vérifiée",
    'give it this subject line (**Copy subject** copies it):':
        "donnez-lui cet objet (**Copier l'objet** le copie) :",
    'Pass the saved file on to whoever maintains the app for you, and {subject}':
        "Transmettez le fichier enregistré à la personne qui maintient l'application pour vous, et {subject}",
    'Pass the saved file and its picture on to whoever maintains the app for you, and {subject}':
        "Transmettez le fichier enregistré et son image à la personne qui maintient l'application pour vous, et {subject}",
    'To send it, email the report to {email}{source} — press **Copy report** and paste it into the message, and {subject}':
        "Pour l'envoyer, envoyez le rapport par e-mail à {email}{source} — appuyez sur **Copier le rapport** et collez-le dans le message, et {subject}",
    'To send it, email the report to {email}{source} — press **Copy report** and paste it into the message, attach {image} from your Downloads folder, and {subject}':
        "Pour l'envoyer, envoyez le rapport par e-mail à {email}{source} — appuyez sur **Copier le rapport** et collez-le dans le message, joignez {image} depuis votre dossier Téléchargements, et {subject}",
    '**Email it** opens your mail app with the address and subject filled in and the report on your clipboard.':
        "**Envoyer par e-mail** ouvre votre messagerie avec l'adresse et l'objet déjà remplis, et le rapport dans votre presse-papiers.",
    'Copy subject': "Copier l'objet",
    'Copy picture': "Copier l'image",
    'Copy email address': "Copier l'adresse e-mail",
    'Email it': 'Envoyer par e-mail',
    'I could not save the report: {reason}':
        "Je n'ai pas pu enregistrer le rapport : {reason}",
    'The report is called {reference}.': "Le rapport s'appelle {reference}.",
    'Sent. Report {reference} went to the report server openworship.app shares and I kept a copy in your Downloads folder too.':
        "Envoyé. Le rapport {reference} est parti vers le serveur de rapports que partage openworship.app, et j'en ai aussi gardé une copie dans votre dossier Téléchargements.",
    'Sent. Report {reference} went to the report server openworship.app shares, with {count} file — {names} — and I kept a copy in your Downloads folder too.':
        "Envoyé. Le rapport {reference} est parti vers le serveur de rapports que partage openworship.app, avec {count} fichier — {names} — et j'en ai aussi gardé une copie dans votre dossier Téléchargements.",
    'Sent. Report {reference} went to the report server openworship.app shares, with {count} files — {names} — and I kept a copy in your Downloads folder too.':
        "Envoyé. Le rapport {reference} est parti vers le serveur de rapports que partage openworship.app, avec {count} fichiers — {names} — et j'en ai aussi gardé une copie dans votre dossier Téléchargements.",
    'Not sent with it: {files}.': 'Non envoyés avec lui : {files}.',
    'The picture is still in Downloads, and the buttons below email it if somebody asks to see it.':
        "L'image est toujours dans Téléchargements, et les boutons ci-dessous l'envoient par e-mail si quelqu'un demande à la voir.",
    'Report {reference} is ready, but the report server is not answering right now ({why}). I kept it, and the app will send it by itself as soon as that server is back — it tries every half hour while the app is open, for up to a week — so there is nothing more you need to do. A copy is in your Downloads folder too, and if it is urgent the buttons below email it.':
        "Le rapport {reference} est prêt, mais le serveur de rapports ne répond pas pour le moment ({why}). Je l'ai gardé, et l'application l'enverra d'elle-même dès que ce serveur sera de retour — elle réessaie toutes les demi-heures tant que l'application est ouverte, pendant une semaine au plus — vous n'avez donc plus rien à faire. Une copie se trouve aussi dans votre dossier Téléchargements, et si c'est urgent, les boutons ci-dessous l'envoient par e-mail.",
    'it is away': 'il est absent',
    'Report {reference} is ready. No report server is shared with this app right now, so nothing was sent — I saved the whole thing into your Downloads folder.':
        "Le rapport {reference} est prêt. Aucun serveur de rapports n'est partagé avec cette application pour le moment, donc rien n'a été envoyé — je l'ai enregistré en entier dans votre dossier Téléchargements.",
    'Report {reference} is ready, but I could not send it: {why}. Nothing was sent — I saved the whole thing into your Downloads folder.':
        "Le rapport {reference} est prêt, mais je n'ai pas pu l'envoyer : {why}. Rien n'a été envoyé — je l'ai enregistré en entier dans votre dossier Téléchargements.",
    'larger than a report may carry, {size} MB':
        "plus gros que ce qu'un rapport peut transporter, {size} Mo",
    'this window no longer holds the picture': "cette fenêtre n'a plus l'image",
    'the file is not where it was on their computer any more':
        "le fichier n'est plus à son emplacement sur votre ordinateur",
    'not a kind of file a report carries':
        "pas un type de fichier qu'un rapport transporte",
    'the report already carries as much as it may':
        'le rapport transporte déjà le maximum autorisé',
    'it could not be read': "il n'a pas pu être lu",
    'the report server found the files too large':
        'le serveur de rapports a trouvé les fichiers trop gros',
    'the app took too long to send it':
        "l'application a mis trop de temps à l'envoyer",
    'the app could not hand it over': "l'application n'a pas pu le transmettre",
    'the report server has no usable address':
        "le serveur de rapports n'a pas d'adresse utilisable",
    'the report server did not keep it':
        "le serveur de rapports ne l'a pas gardé",
    'the report server sent it on to another address':
        "le serveur de rapports l'a renvoyé vers une autre adresse",
    'the report server said it is too large':
        "le serveur de rapports a dit qu'il est trop gros",
    'the report server took too long to answer':
        'le serveur de rapports a mis trop de temps à répondre',
    'the report server did not answer':
        "le serveur de rapports n'a pas répondu",
    'AI features are turned off in Settings':
        "Les fonctionnalités d'IA sont désactivées dans les Paramètres",
    'that is not a report this app wrote':
        "ce n'est pas un rapport écrit par cette application",
    'several reports were sent in the last few minutes; wait a little before sending another':
        "plusieurs rapports ont été envoyés ces dernières minutes ; attendez un peu avant d'en envoyer un autre",
    'the list of report servers could not be read':
        "la liste des serveurs de rapports n'a pas pu être lue",
    'I agree': "J'accepte",
    'Open the website': 'Ouvrir le site web',
    'Install it': 'Installer',
    'Start over': 'Recommencer',
    'Find more lists online': "Chercher d'autres listes en ligne",
    'Look for a Bible by language': 'Chercher une Bible par langue',
    'Do it in Settings instead': 'Le faire plutôt dans les Paramètres',
    'A file on this computer': 'Un fichier sur cet ordinateur',
    'Import a Bible for me': 'Importer une Bible pour moi',
    'List {number}': 'Liste {number}',
    '{choice} (suggested)': '{choice} (suggéré)',
    'A short name is 2 to 24 letters or numbers, like KJV.':
        'Un nom court compte de 2 à 24 lettres ou chiffres, comme KJV.',
    '"{key}" has a space in it. Use letters and numbers only, like KSV.':
        '"{key}" contient une espace. Utilisez uniquement des lettres et des chiffres, comme KSV.',
    '"{key}" has a sign in it that cannot be in a file name. Use letters and numbers only.':
        '"{key}" contient un signe interdit dans un nom de fichier. Utilisez uniquement des lettres et des chiffres.',
    'You already have a Bible called "{key}". Choose another name.':
        'Vous avez déjà une Bible nommée "{key}". Choisissez un autre nom.',
    '**Step 1 of {total} — a short name.** This is the name on the Bible button, like KJV.':
        "**Étape 1 sur {total} — un nom court.** C'est le nom affiché sur le bouton de la Bible, comme KJV.",
    'Press one, or type your own (letters and numbers, no spaces).':
        "Appuyez sur l'un d'eux, ou tapez le vôtre (lettres et chiffres, sans espaces).",
    'Type one (letters and numbers, no spaces).':
        'Tapez-en un (lettres et chiffres, sans espaces).',
    '**Step 2 of {total} — the language.** I could not tell which language this Bible is in. Type its name, for example Khmer, Thai or French.':
        "**Étape 2 sur {total} — la langue.** Je n'ai pas pu savoir dans quelle langue est cette Bible. Tapez son nom en anglais, par exemple Khmer, Thai ou French.",
    '**Step 2 of {total} — the language.** It looks like **{language}**: {why}. If it is a different language, type its name.':
        "**Étape 2 sur {total} — la langue.** On dirait du **{language}** : {why}. Si c'est une autre langue, tapez son nom.",
    '**Step 2 of {total} — the language.** It looks like **{language}**. If it is a different language, type its name.':
        "**Étape 2 sur {total} — la langue.** On dirait du **{language}**. Si c'est une autre langue, tapez son nom.",
    '**Step 3 of 4 — numbers.** Should chapter and verse numbers show in {language} digits, or as 0 to 9?':
        "**Étape 3 sur 4 — les chiffres.** Les numéros de chapitre et de verset doivent-ils s'afficher avec les chiffres de la langue ({language}), ou de 0 à 9 ?",
    'its own': 'sa langue',
    'Only this list says: {names}.': 'Seule cette liste dit : {names}.',
    '({count} of its names are in this Bible)':
        '({count} de ses noms sont dans cette Bible)',
    '**Step {total} of {total} — book names.** These are the names shown for Genesis, Exodus and the rest. Pick the list that matches your printed Bible — list 1 matches the words of this Bible best.':
        "**Étape {total} sur {total} — les noms des livres.** Ce sont les noms affichés pour la Genèse, l'Exode et les autres. Choisissez la liste qui correspond à votre Bible imprimée — la liste 1 correspond le mieux aux mots de cette Bible.",
    '**Step {total} of {total} — book names.** These are the names shown for Genesis, Exodus and the rest. Pick the list that matches your printed Bible.':
        "**Étape {total} sur {total} — les noms des livres.** Ce sont les noms affichés pour la Genèse, l'Exode et les autres. Choisissez la liste qui correspond à votre Bible imprimée.",
    '**Ready to install.**': '**Prête à installer.**',
    '- Name: **{key}**': '- Nom : **{key}**',
    '- Language: {language}': '- Langue : {language}',
    '- Numbers: {digits}': '- Chiffres : {digits}',
    '- Book names: {names}': '- Noms des livres : {names}',
    'from the file': 'depuis le fichier',
    'Press **Install it**. You can undo it afterwards.':
        "Appuyez sur **Installer**. Vous pourrez l'annuler ensuite.",
    'That link does not lead to a file — the website answered "not found". The address may be mistyped, or the file has moved.':
        'Ce lien ne mène pas à un fichier — le site a répondu "introuvable". L\'adresse est peut-être mal tapée, ou le fichier a été déplacé.',
    'That website would not give the file out. It may need a sign-in.':
        "Ce site web n'a pas voulu fournir le fichier. Il faut peut-être se connecter.",
    'That website is busy right now. Try again in a few minutes.':
        'Ce site web est occupé pour le moment. Réessayez dans quelques minutes.',
    'That website had a problem sending the file. Try again later.':
        'Ce site web a eu un problème pour envoyer le fichier. Réessayez plus tard.',
    'I can only download from a public web address that starts with https://.':
        'Je ne peux télécharger que depuis une adresse web publique qui commence par https://.',
    'I could not reach that website. Check the internet connection and the address.':
        "Je n'ai pas pu joindre ce site web. Vérifiez la connexion internet et l'adresse.",
    'The download took too long and I stopped it. The website or the internet may be slow — try again.':
        "Le téléchargement a pris trop de temps et je l'ai arrêté. Le site ou internet est peut-être lent — réessayez.",
    'That file is far too large to be a Bible.':
        'Ce fichier est bien trop gros pour être une Bible.',
    'That link gave back an empty file.': 'Ce lien a renvoyé un fichier vide.',
    'That link leads to a file, but not a Bible file this app can install. A Bible file ends in .xml.':
        'Ce lien mène à un fichier, mais pas à un fichier de Bible que cette application peut installer. Un fichier de Bible se termine par .xml.',
    'I downloaded the file, but there is no Bible in it that this app can read — it may be a different Bible format.':
        "J'ai téléchargé le fichier, mais il ne contient aucune Bible que cette application peut lire — c'est peut-être un autre format de Bible.",
    'That link opens a web page, and there is no Bible file on it.':
        "Ce lien ouvre une page web, et il n'y a aucun fichier de Bible dessus.",
    'That download is not here any more — downloads are kept for two hours.':
        "Ce téléchargement n'est plus là — les téléchargements sont conservés deux heures.",
    'That link did not lead to a Bible.': 'Ce lien ne mène pas à une Bible.',
    'To get the right link: open the page in your web browser, find the Bible file (its name ends in .xml), and copy the address of THAT file — on GitHub, open the file and press **Raw**, then copy the address bar. Paste it here.':
        "Pour obtenir le bon lien : ouvrez la page dans votre navigateur, trouvez le fichier de la Bible (son nom se termine par .xml), et copiez l'adresse de CE fichier — sur GitHub, ouvrez le fichier et appuyez sur **Raw**, puis copiez la barre d'adresse. Collez-la ici.",
    '**{matched}** has “{words}” in the name':
        '**{matched}** a “{words}” dans son nom',
    '**{matched}** have “{words}” in the name':
        '**{matched}** ont “{words}” dans leur nom',
    'Of its **{total}** Bibles, {matchedText}.':
        'Sur ses **{total}** Bibles, {matchedText}.',
    'It has **{total}** Bibles.': 'Elle contient **{total}** Bibles.',
    'It has **{total}** Bible files; {matchedText}.':
        'Elle contient **{total}** fichiers de Bible ; {matchedText}.',
    'It has **{total}** Bible files.':
        'Elle contient **{total}** fichiers de Bible.',
    'I looked in the free Bible collection on GitHub (Beblia).':
        "J'ai cherché dans la collection gratuite de Bibles sur GitHub (Beblia).",
    'That link is a web page, not the Bible file itself.':
        'Ce lien est une page web, pas le fichier de la Bible lui-même.',
    'None of them has “{words}” in its name.':
        "Aucune n'a “{words}” dans son nom.",
    'Did you mean one of these? Press it, or type the language again.':
        "Vouliez-vous dire l'une de celles-ci ? Appuyez dessus, ou tapez à nouveau la langue.",
    'Type the language in English or in its own words — for example Khmer, ខ្មែរ or Thai. If you have a link to a Bible file, you can paste it here instead.':
        'Tapez la langue en anglais ou dans la langue elle-même — par exemple Khmer, ខ្មែរ ou Thai. Si vous avez un lien vers un fichier de Bible, vous pouvez le coller ici à la place.',
    '**you already have this one** ({key})': "**vous l'avez déjà** ({key})",
    'Press the one you want, or type a word from its name — a year, for example — to see others.':
        "Appuyez sur celle que vous voulez, ou tapez un mot de son nom — une année, par exemple — pour en voir d'autres.",
    'Press the one you want, or type its number. Nothing is installed until you have chosen its name and language.':
        "Appuyez sur celle que vous voulez, ou tapez son numéro. Rien n'est installé tant que vous n'avez pas choisi son nom et sa langue.",
    'I downloaded **{title}** — {summary}.':
        "J'ai téléchargé **{title}** — {summary}.",
    '**You already have this Bible** — it is installed as **{key}**. There is no need to install it again: press **Cancel**.':
        "**Vous avez déjà cette Bible** — elle est installée sous **{key}**. Inutile de l'installer à nouveau : appuyez sur **Annuler**.",
    'Nothing is installed yet.': "Rien n'est encore installé.",
    'It has the New Testament only.':
        'Elle ne contient que le Nouveau Testament.',
    'It has the Old Testament only.':
        "Elle ne contient que l'Ancien Testament.",
    'It is missing {count} of the 66 books.':
        'Il lui manque {count} des 66 livres.',
    '{books} books, {chapters} chapters, {verses} verses':
        '{books} livres, {chapters} chapitres, {verses} versets',
    'the internet, at the address below.': "internet, à l'adresse ci-dessous.",
    'I found it on the internet, in a free collection of Bible files that someone shared on GitHub (Beblia): {page}':
        "Je l'ai trouvée sur internet, dans une collection gratuite de fichiers de Bible que quelqu'un a partagée sur GitHub (Beblia) : {page}",
    'I found it on the internet, on this web page: {page}':
        "Je l'ai trouvée sur internet, sur cette page web : {page}",
    '**Before you install it, please read this:**':
        "**Avant de l'installer, veuillez lire ceci :**",
    '**Where it is from:** {where}': "**D'où elle vient :** {where}",
    '**The file:** {file}': '**Le fichier :** {file}',
    '**It is not from Open Worship.** Open Worship did not make, choose or check this Bible, and cannot promise that it is complete, correct or free to use.':
        "**Elle ne vient pas d'Open Worship.** Open Worship n'a ni créé, ni choisi, ni vérifié cette Bible, et ne peut pas garantir qu'elle est complète, exacte ou libre d'utilisation.",
    '**You are responsible to its publisher.** Every Bible translation belongs to the publisher or Bible society that made it, and many are under copyright. Before you use it — on a screen in church, in print or online — make sure its publisher allows that.':
        "**Vous êtes responsable envers son éditeur.** Chaque traduction de la Bible appartient à l'éditeur ou à la société biblique qui l'a réalisée, et beaucoup sont protégées par le droit d'auteur. Avant de l'utiliser — sur un écran à l'église, en version imprimée ou en ligne — assurez-vous que son éditeur le permet.",
    'Do you agree? Press **I agree** to go on, or **Cancel** and nothing is installed.':
        "Êtes-vous d'accord ? Appuyez sur **J'accepte** pour continuer, ou sur **Annuler** et rien ne sera installé.",
    'You already have this Bible as **{key}**. To keep a second copy anyway, choose a different short name below.':
        'Vous avez déjà cette Bible sous **{key}**. Pour garder quand même une deuxième copie, choisissez un autre nom court ci-dessous.',
    'Thank you. A few quick choices, then I install it.':
        "Merci. Quelques choix rapides, puis je l'installe.",
    'The app is looking for a Bible called **{key}**. Keep that short name below and the app will find this Bible by itself.':
        "L'application cherche une Bible nommée **{key}**. Gardez ce nom court ci-dessous et l'application trouvera cette Bible d'elle-même.",
    'There is no web page to open for this Bible.':
        "Il n'y a pas de page web à ouvrir pour cette Bible.",
    'I opened {page} in your web browser. When you have looked, come back here.':
        "J'ai ouvert {page} dans votre navigateur web. Quand vous aurez regardé, revenez ici.",
    'I do not know the language “{language}”. Try its English name or its code, like km-KH.':
        'Je ne connais pas la langue “{language}”. Essayez son nom en anglais ou son code, comme km-KH.',
    'I read “{from}” as **{to}**.': 'J’ai lu « {from} » comme **{to}**.',
    'The book names on this page do not match your selected language. Try another link or tell me which language to use.':
        'Les noms des livres sur cette page ne correspondent pas à la langue choisie. Essayez un autre lien ou indiquez-moi la langue à utiliser.',
    'I could not read a complete book-name list from that link. Your previous choices are still available.':
        'Je n’ai pas pu lire une liste complète des noms des livres depuis ce lien. Vos choix précédents restent disponibles.',
    'I looked online and found no other complete list.':
        "J'ai cherché en ligne et n'ai trouvé aucune autre liste complète.",
    'I found {count} more online.': "J'en ai trouvé {count} de plus en ligne.",
    'I could not use the name **{key}**: you already have a Bible by that name. Choose another.':
        "Je n'ai pas pu utiliser le nom **{key}** : vous avez déjà une Bible de ce nom. Choisissez-en un autre.",
    'Something went wrong while installing it. Nothing was changed.':
        "Un problème est survenu pendant l'installation. Rien n'a été modifié.",
    '**Done — {key} is installed.** Choose it from the Bible version button in the Bible Lookup or the Reader.':
        '**Terminé — {key} est installée.** Choisissez-la avec le bouton de version de la Bible dans la Recherche biblique ou le Lecteur biblique.',
    'If it is not right, press **Undo** and it goes to the trash.':
        "Si ce n'est pas la bonne, appuyez sur **Annuler** et elle ira à la corbeille.",
    'Undone: **{key}** is gone again (it is in the trash). Nothing else was changed.':
        "Annulé : **{key}** a de nouveau disparu (elle est dans la corbeille). Rien d'autre n'a été modifié.",
    'That was already undone.': "C'était déjà annulé.",
    'Stopped. Nothing was installed.': "Arrêté. Rien n'a été installé.",
    'Create the provided KJV': 'Créer la KJV fournie',
    // The Reader's "Bible key KJV is not available!" card asks before it
    // builds the KJV out of the copy the app carries.
    'Create the KJV Bible?': 'Créer la Bible KJV ?',
    'The KJV Bible is not available. Open Worship provides it, and creating it needs no internet and no separate download: the app already holds the whole KJV.':
        "La Bible KJV n'est pas disponible. Open Worship la fournit, et sa création ne nécessite ni Internet ni téléchargement séparé : l'application contient déjà toute la KJV.",
    'Failed to create the KJV Bible. Please try again.':
        'Échec de la création de la Bible KJV. Veuillez réessayer.',
    'Use the internet copy anyway': 'Utiliser quand même la copie d’Internet',
    'Import another Bible anyway': 'Importer quand même une autre Bible',
    'Add another Bible': 'Ajouter une autre Bible',
    'Creating the provided KJV Bible': 'Création de la Bible KJV fournie',
    'I could not create the KJV Open Worship provides. Nothing was installed. In **Settings → Bible**, press **{button}**, or try again here.':
        "Je n'ai pas pu créer la KJV fournie par Open Worship. Rien n'a été installé. Dans **Paramètres → Bible**, appuyez sur **{button}**, ou réessayez ici.",
    '**You already have the KJV Open Worship provides**, installed as **KJV**. There is no need to import this file. To use the file anyway, press a choice below.':
        "**Vous avez déjà la KJV fournie par Open Worship**, installée sous **KJV**. Il n'est pas nécessaire d'importer ce fichier. Pour utiliser quand même le fichier, choisissez ci-dessous.",
    '**You already have the KJV Open Worship provides**, installed as **KJV**. There is no need to import this file. To keep a second copy anyway, choose a short name below.':
        "**Vous avez déjà la KJV fournie par Open Worship**, installée sous **KJV**. Il n'est pas nécessaire d'importer ce fichier. Pour garder quand même une deuxième copie, choisissez un nom court ci-dessous.",
    '**Open Worship provides the KJV Bible** — the recommended King James Version, and it is not installed yet. Create it from the app itself and you will have the one this app recommends. To use this file instead, press a choice below.':
        "**Open Worship fournit la Bible KJV** — la version King James recommandée, et elle n'est pas encore installée. Créez-la depuis l'application elle-même et vous aurez celle que cette application recommande. Pour utiliser plutôt ce fichier, choisissez ci-dessous.",
    '**Before another Bible: Open Worship provides the KJV Bible** — the recommended King James Version, and it is not installed yet. Create it first, and then I will start your import again. To go on without it, press a choice below.':
        "**Avant une autre Bible : Open Worship fournit la Bible KJV** — la version King James recommandée, et elle n'est pas encore installée. Créez-la d'abord, puis je recommencerai votre import. Pour continuer sans elle, choisissez ci-dessous.",
    'Creating it needs no internet and no separate download: the app already holds the whole KJV.':
        "Sa création ne nécessite ni Internet ni téléchargement séparé : l'application contient déjà toute la KJV.",
    '**Done — the KJV Open Worship provides is installed.** Choose **KJV** from the Bible version button. A Bible Reader card saying the KJV is not available goes away by itself.':
        "**Terminé — la KJV fournie par Open Worship est installée.** Choisissez **KJV** dans le bouton de version de la Bible. La carte du Lecteur de Bible disant que la KJV n'est pas disponible disparaît d'elle-même.",
    'I opened **Settings → Bible** with your link in the Import box. Press **Import** there, then choose the name, language, numbers and book names on the form.':
        "J'ai ouvert **Paramètres → Bible** avec votre lien dans la case Importer. Appuyez sur **Importer**, puis choisissez le nom, la langue, les chiffres et les noms des livres dans le formulaire.",
    'That step is not one I know.': 'Je ne connais pas cette étape.',
    'Something went wrong on my side. The app may still be starting — try again in a moment. Nothing was installed.':
        "Un problème est survenu de mon côté. L'application est peut-être encore en train de démarrer — réessayez dans un instant. Rien n'a été installé.",
    '**Which language do you want the Bible in?** Press one, or type its name — in English or in its own words, for example Thai, ខ្មែរ or Español. I will look in a free collection of about a thousand Bibles and show you every one in that language. If you have a link to a Bible file, you can paste it here instead.':
        "**Dans quelle langue voulez-vous la Bible ?** Appuyez sur l'une d'elles, ou tapez son nom — en anglais ou dans la langue elle-même, par exemple Thai, ខ្មែរ ou Español. Je chercherai dans une collection gratuite d'environ mille Bibles et vous montrerai toutes celles dans cette langue. Si vous avez un lien vers un fichier de Bible, vous pouvez le coller ici à la place.",
    'I opened **Settings → Bible**. Press **Choose File**, pick the Bible file (its name ends in .xml), then press **Import** below it.':
        "J'ai ouvert **Paramètres → Bible**. Appuyez sur **Choisir un fichier**, choisissez le fichier de la Bible (son nom se termine par .xml), puis appuyez sur **Importer** en dessous.",
    'Looking online for Bible book names — this can take a minute':
        'Recherche en ligne des noms des livres de la Bible — cela peut prendre une minute',
    'Putting it back': 'Remise en place',
    'this server needs tool calling switched on — start llama-server (or llamafile) again with the --jinja flag, then ask again':
        "ce serveur doit avoir l'appel d'outils activé — redémarrez llama-server (ou llamafile) avec l'option --jinja, puis reposez la question",
    'this server needs tool calling switched on — start it again with --enable-auto-tool-choice and --tool-call-parser (vLLM, SGLang), then ask again':
        "ce serveur doit avoir l'appel d'outils activé — redémarrez-le avec --enable-auto-tool-choice et --tool-call-parser (vLLM, SGLang), puis reposez la question",
    'this model cannot use tools, which the assistant needs to look things up — pick a model that supports tools':
        "ce modèle ne peut pas utiliser d'outils, dont l'assistant a besoin pour chercher — choisissez un modèle qui prend en charge les outils",
    'this server’s API does not take tools at all (GPT4All’s does not), so the assistant can only answer from the guide text — for presses and live answers use LM Studio, Ollama or llama.cpp':
        "l'API de ce serveur n'accepte aucun outil (celle de GPT4All non plus), l'assistant ne peut donc répondre qu'à partir du guide — pour les actions et les réponses en direct, utilisez LM Studio, Ollama ou llama.cpp",
    "the conversation does not fit this model's context — {fix}, then ask again":
        'la conversation ne tient pas dans le contexte de ce modèle — {fix}, puis reposez la question',
    'the conversation does not fit the {size} context this model is loaded with — {fix}, then ask again':
        'la conversation ne tient pas dans le contexte de {size} avec lequel ce modèle est chargé — {fix}, puis reposez la question',
    'it loaded this model with only {size} of context and answered from part of the question, so that answer is not shown — {fix}, then ask again':
        "il a chargé ce modèle avec seulement {size} de contexte et a répondu à une partie de la question, cette réponse n'est donc pas affichée — {fix}, puis reposez la question",
    'load it again in LM Studio with a Context Length of {size} or more (the model’s load settings)':
        "rechargez-le dans LM Studio avec une Context Length d'au moins {size} (réglages de chargement du modèle)",
    'in the Ollama app, set Settings → Context length to {size} or more (or start Ollama with OLLAMA_CONTEXT_LENGTH={tokens})':
        "dans l'application Ollama, réglez Settings → Context length sur au moins {size} (ou démarrez Ollama avec OLLAMA_CONTEXT_LENGTH={tokens})",
    'start llama-server (or llamafile) again with a context size of {size} or more (-c {tokens})':
        "redémarrez llama-server (ou llamafile) avec une taille de contexte d'au moins {size} (-c {tokens})",
    'load it with a context length of {size} or more where the model is served':
        "chargez-le avec une longueur de contexte d'au moins {size} là où le modèle est servi",
    'this server has no model called “{model}” — check the model id in Settings → AI Providers → Custom servers, press Load models from server there, or pull it (ollama pull {model})':
        "ce serveur n'a pas de modèle appelé « {model} » — vérifiez l'identifiant du modèle dans Paramètres → Fournisseurs d'IA → Custom servers, appuyez sur Load models from server, ou téléchargez-le (ollama pull {model})",
    'this server has no model called “{model}” — check the model id in Settings → AI Providers → Custom servers, press Load models from server there':
        "ce serveur n'a pas de modèle appelé « {model} » — vérifiez l'identifiant du modèle dans Paramètres → Fournisseurs d'IA → Custom servers, puis appuyez sur Load models from server",
    'this shared server did not answer the way the app expects — its address is openworship.app’s to correct; press ↻ beside the list of assistants to read the shared servers again, or pick another assistant':
        "ce serveur partagé n'a pas répondu comme l'application l'attend — c'est à openworship.app de corriger son adresse ; appuyez sur ↻ à côté de la liste des assistants pour relire les serveurs partagés, ou choisissez un autre assistant",
    'this server did not answer the way the app expects — in Settings → AI Providers → Custom servers, check its address and press Test':
        "ce serveur n'a pas répondu comme l'application l'attend — dans Paramètres → Fournisseurs d'IA → Custom servers, vérifiez son adresse et appuyez sur Test",
    'the server took longer than {minutes} minutes over the question and the window gave up — a local model reads the assistant’s whole instruction set first, and this computer is too slow for that; a general question typed after /btw is small enough to answer here, and questions about the app need a faster computer or a model running on a GPU':
        "le serveur a mis plus de {minutes} minutes sur la question et la fenêtre a abandonné — un modèle local lit d'abord toutes les instructions de l'assistant, et cet ordinateur est trop lent pour cela ; une question générale tapée après /btw est assez courte pour une réponse ici, et les questions sur l'application demandent un ordinateur plus rapide ou un modèle sur un GPU",
    'the server took longer than {minutes} minutes over the question and the window gave up — a local model reads the assistant’s whole instruction set first, and the computer it runs on is too slow for that; a general question typed after /btw is small enough to answer here, and questions about the app need a faster computer or a model running on a GPU':
        "le serveur a mis plus de {minutes} minutes sur la question et la fenêtre a abandonné — un modèle local lit d'abord toutes les instructions de l'assistant, et l'ordinateur où il tourne est trop lent pour cela ; une question générale tapée après /btw est assez courte pour une réponse ici, et les questions sur l'application demandent un ordinateur plus rapide ou un modèle sur un GPU",
    '(Ollama marks them “tools” in its library)':
        '(Ollama les marque « tools » dans sa bibliothèque)',
    'Nothing to press for this one — it is something to notice in the window behind me. Press {next} when you have.':
        "Rien à appuyer pour celle-ci — c'est quelque chose à remarquer dans la fenêtre derrière moi. Appuyez sur {next} quand c'est fait.",
    '{key} does something that cannot be undone, so I will not press it for you. Press it yourself if you want it — I will notice when you do.':
        "{key} fait quelque chose qui ne peut pas être annulé, je ne l'appuierai donc pas pour vous. Appuyez vous-même si vous le voulez — je le remarquerai.",
    'Press {act} and I will press {key} for you.':
        "Appuyez sur {act} et j'appuierai sur {key} pour vous.",
    'Press {key} — I will notice when you do.':
        'Appuyez sur {key} — je le remarquerai.',
    'Press {act} and I will right-click the list for you, then press it again to choose "{name}".':
        'Appuyez sur {act} et je ferai un clic droit sur la liste pour vous, puis appuyez de nouveau pour choisir « {name} ».',
    'Press {act} and I will right-click the list for you, then press it again to choose.':
        'Appuyez sur {act} et je ferai un clic droit sur la liste pour vous, puis appuyez de nouveau pour choisir.',
    'Look for "{name}" in the window behind me.':
        'Cherchez « {name} » dans la fenêtre derrière moi.',
    'Do this step in the window behind me.':
        'Faites cette étape dans la fenêtre derrière moi.',
    'Look for "{name}" in the window behind me. The closest thing I can see is "{seen}", which may not be it.':
        "Cherchez « {name} » dans la fenêtre derrière moi. Le plus proche que je vois est « {seen} », mais ce n'est peut-être pas cela.",
    'Press {act} and I will open the hidden controls first. Then press it again and I will change "{name}".':
        "Appuyez sur {act} et j'ouvrirai d'abord les commandes masquées. Puis appuyez de nouveau et je modifierai « {name} ».",
    'Press {act} and I will open the hidden controls first. Then press it again and I will use "{name}".':
        "Appuyez sur {act} et j'ouvrirai d'abord les commandes masquées. Puis appuyez de nouveau et j'utiliserai « {name} ».",
    'First press the ringed three dots to open the hidden controls. I will keep this step here for you.':
        "Appuyez d'abord sur les trois points entourés pour ouvrir les commandes masquées. Je garde cette étape ici pour vous.",
    '"{name}" is not on screen right now — open the panel or tab it belongs to first.':
        "« {name} » n'est pas à l'écran pour l'instant — ouvrez d'abord le panneau ou l'onglet où il se trouve.",
    '"{name}" is behind {layer} — answer that first, and I will carry on.':
        "« {name} » est derrière {layer} — répondez-y d'abord, et je continuerai.",
    '"{name}" is behind {layer}.': '« {name} » est derrière {layer}.',
    'Press {act} and I will close the menu first, then press it again for this step.':
        "Appuyez sur {act} et je fermerai d'abord le menu, puis appuyez de nouveau pour cette étape.",
    'Press Escape (or click anywhere outside the menu) and I will carry on.':
        "Appuyez sur Échap (ou cliquez n'importe où hors du menu) et je continuerai.",
    'Press {act} and I will close {short} first, then press it again for this step.':
        "Appuyez sur {act} et je fermerai d'abord {short}, puis appuyez de nouveau pour cette étape.",
    'Close it with the ringed ✕ and I will carry on.':
        'Fermez-le avec le ✕ entouré et je continuerai.',
    'Press {act} and I will change it for you.':
        'Appuyez sur {act} et je le modifierai pour vous.',
    'Press {act} and I will right-click it for you.':
        'Appuyez sur {act} et je ferai un clic droit dessus pour vous.',
    'Press {act} and I will move the pointer over it for you.':
        'Appuyez sur {act} et je placerai le pointeur dessus pour vous.',
    'Press {act} and I will click it for you.':
        'Appuyez sur {act} et je cliquerai dessus pour vous.',
    'This is the app asking you a question, so I will not answer it for you.':
        "C'est l'application qui vous pose une question, je n'y répondrai donc pas pour vous.",
    'This one cannot be undone, so I will not press it for you — press it yourself if you want it.':
        "Cela ne peut pas être annulé, je ne l'appuierai donc pas pour vous — appuyez vous-même si vous le voulez.",
    'Move the pointer over the ringed area.':
        'Placez le pointeur sur la zone entourée.',
    'This one only shows while the mouse is over it, so I am holding it up for you.':
        "Celui-ci n'apparaît que lorsque la souris est dessus, je le maintiens donc visible pour vous.",
    'The ringed control is at the {where} of this window.':
        'La commande entourée se trouve {where} de cette fenêtre.',
    'The ringed control is in the {panel} panel, at the {where} of this window.':
        'La commande entourée se trouve dans le panneau {panel}, {where} de cette fenêtre.',
    'Something is in front of it right now — close that first.':
        "Quelque chose est devant pour l'instant — fermez-le d'abord.",
    '{count} controls are called "{name}" (in {panels}), so the ring may be on the wrong one — the step says which.':
        "{count} commandes s'appellent « {name} » (dans {panels}), l'anneau est donc peut-être sur la mauvaise — l'étape dit laquelle.",
    '{count} controls are called "{name}", so the ring may be on the wrong one — the step says which.':
        "{count} commandes s'appellent « {name} », l'anneau est donc peut-être sur la mauvaise — l'étape dit laquelle.",
    'I cannot press these steps for you — they are things to do in the page itself, not buttons. I will walk you through them instead.':
        'Je ne peux pas appuyer sur ces étapes pour vous — ce sont des choses à faire dans la page elle-même, pas des boutons. Je vais plutôt vous guider.',
    'I opened the hidden controls. "{more}" is visible now. Press {act} again and I will finish this step.':
        "J'ai ouvert les commandes masquées. « {more} » est visible maintenant. Appuyez de nouveau sur {act} et je terminerai cette étape.",
    'Done - and it brought up "{more}". Press {act} again to finish this step.':
        "C'est fait - et « {more} » est apparu. Appuyez de nouveau sur {act} pour terminer cette étape.",
    'I closed {closed}, which was in the way. Press {act} again and I will do this step.':
        "J'ai fermé {closed}, qui gênait. Appuyez de nouveau sur {act} et je ferai cette étape.",
    'That did not work — I am asking the assistant to look at your window…':
        "Cela n'a pas marché — je demande à l'assistant de regarder votre fenêtre…",
    'I could not do that one for you ({reason}) - do it yourself, then press {skip}.':
        "Je n'ai pas pu faire celle-ci pour vous ({reason}) - faites-la vous-même, puis appuyez sur {skip}.",
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Choose an AI chat': 'Choisir un chat IA',
    'Choose an AI chat to use in this window':
        'Choisissez un chat IA à utiliser dans cette fenêtre',
    'Switch anytime from the list above the page. You sign in on the site itself, with your own account, and your conversations stay there.':
        'Changez à tout moment depuis la liste au-dessus de la page. Vous vous connectez sur le site lui-même, avec votre propre compte, et vos conversations y restent.',
    'Recently closed': 'Fermés récemment',
    'These are other companies’ websites. What you type there leaves this computer under their terms; this app keeps nothing of it but the tab.':
        'Ce sont les sites web d’autres entreprises. Ce que vous y tapez quitte cet ordinateur selon leurs conditions ; cette application n’en garde rien d’autre que l’onglet.',
    'You stay signed in on this computer until you say otherwise. {button} when several people use it.':
        'Vous restez connecté sur cet ordinateur jusqu’à ce que vous en décidiez autrement. {button} lorsque plusieurs personnes l’utilisent.',
    'Sign out of every site': 'Se déconnecter de tous les sites',
    'Loading {site}': 'Chargement de {site}',
    '{site} could not be loaded — {reason}. Check the internet connection.':
        'Impossible de charger {site} — {reason}. Vérifiez la connexion Internet.',
    'Chat with': 'Discuter avec',
    'Which AI chat': 'Quel chat IA',
    'Open in your browser': 'Ouvrir dans votre navigateur',
    'Recently closed tabs (Ctrl+Shift+T opens the last)':
        'Onglets fermés récemment (Ctrl+Maj+T rouvre le dernier)',
    'Recently closed tabs': 'Onglets fermés récemment',
    'Signing out did not finish, so nothing was changed. Try again.':
        'La déconnexion n’a pas abouti, rien n’a donc été modifié. Réessayez.',
    'Sign out of every site, in every AI Chat window? The tabs stay, but the pages they were on and the recently closed list are forgotten, and every site will ask you to sign in again. This cannot be undone.':
        'Se déconnecter de tous les sites, dans toutes les fenêtres Chat IA ? Les onglets restent, mais les pages qu’ils affichaient et la liste des onglets fermés récemment sont oubliées, et chaque site vous demandera de vous reconnecter. Cette action est irréversible.',
    'Keep me signed in': 'Rester connecté',
    'Signing out…': 'Déconnexion…',
    Microphone: 'Microphone',
    '{site} wants to use your microphone. Allow it until the app closes? Only this site hears it, and the camera stays off. Sign out of every site takes it back.':
        '{site} veut utiliser votre microphone. L’autoriser jusqu’à la fermeture de l’application ? Seul ce site l’entend, et la caméra reste éteinte. « Se déconnecter de tous les sites » le retire.',
    'Don’t allow': 'Ne pas autoriser',
    Allow: 'Autoriser',
    Chat: 'Discussion',
    'just now': 'à l’instant',
    '{count} min ago': 'il y a {count} min',
    '{count} h ago': 'il y a {count} h',
    yesterday: 'hier',
    '{count} days ago': 'il y a {count} jours',
    'Tabs you close show up here, so you can open them again.':
        'Les onglets que vous fermez apparaissent ici, pour que vous puissiez les rouvrir.',
    'Open “{title}” again': 'Rouvrir « {title} »',
    'Close a tab before opening another':
        'Fermez un onglet avant d’en ouvrir un autre',
    'Clear this list': 'Vider cette liste',
    'Page not opened': 'Page non ouverte',
    'This site tried to open {site} in your browser without a press, so it was not opened. Press the link again if you meant it.':
        'Ce site a tenté d’ouvrir {site} dans votre navigateur sans que vous ayez appuyé, il n’a donc pas été ouvert. Appuyez à nouveau sur le lien si c’était voulu.',
    'I will search **{bible}**.': 'Je vais chercher dans **{bible}**.',
    '**What do you remember about the verse?** Type it in the box below, the way it comes to you:':
        '**De quoi vous souvenez-vous à propos de ce verset ?** Tapez-le dans la zone ci-dessous, comme il vous vient :',
    'a few of its words, in any order — _love, enemies, pray_':
        'quelques-uns de ses mots, dans n’importe quel ordre — _aimer, ennemis, prier_',
    'or what it is about — _a verse about not worrying about tomorrow_':
        'ou ce dont il parle — _un verset sur le fait de ne pas s’inquiéter du lendemain_',
    'If you remember the book, or roughly where it is, say that too.':
        'Si vous vous souvenez du livre, ou à peu près de l’endroit, dites-le aussi.',
    'There is no Bible on this computer to search yet. Install one first — I can do that with you, one question at a time.':
        'Il n’y a pas encore de Bible à chercher sur cet ordinateur. Installez-en une d’abord — je peux le faire avec vous, une question à la fois.',
    'I could not read the Bibles in the app just now. Make sure the main window is open, then press the 🤖 in **{find}** again.':
        'Je n’ai pas pu lire les Bibles de l’application pour l’instant. Vérifiez que la fenêtre principale est ouverte, puis appuyez de nouveau sur le 🤖 dans **{find}**.',
    'There is one Bible on this computer, so that is the one.':
        'Il y a une seule Bible sur cet ordinateur, ce sera donc celle-ci.',
    '**Which Bible should I search?** Pick one below.':
        '**Dans quelle Bible dois-je chercher ?** Choisissez-en une ci-dessous.',
    'Or type the short name of another one: {names}.':
        'Ou tapez le nom court d’une autre : {names}.',
    '(searched in {other}, quoted from {bible})':
        '(recherché dans {other}, cité depuis {bible})',
    'In {bible}, for your words': 'Dans {bible}, pour vos mots',
    'In {bible}, for your words in English: “{english}”':
        'Dans {bible}, pour vos mots en anglais : « {english} »',
    'If none of these is the one, say more of what you remember.':
        'Si aucun n’est le bon, dites-en davantage sur ce dont vous vous souvenez.',
    'If it is still not here, search Google for it:':
        'S’il n’est toujours pas là, cherchez-le sur Google :',
    'Those words are not written in the language of {bible}, so there is nothing in it to match them. Type them the way that Bible writes them, or press **{another}** below to search one in your language for them.':
        'Ces mots ne sont pas écrits dans la langue de {bible}, il n’y a donc rien à leur faire correspondre. Tapez-les comme cette Bible les écrit, ou appuyez sur **{another}** ci-dessous pour les chercher dans une Bible de votre langue.',
    'Show in another Bible': 'Afficher dans une autre Bible',
    'These words gather in {passages}.':
        'Ces mots se trouvent surtout dans {passages}.',
    'By book: {books}.': 'Par livre : {books}.',
    'Every verse with these words': 'Tous les versets avec ces mots',
    'More verses': 'Plus de versets',
    'No more verses in {bible} have those words.':
        'Aucun autre verset de {bible} ne contient ces mots.',
    'That is as far as a search goes. Add a word you remember to narrow it down.':
        'Une recherche ne va pas plus loin. Ajoutez un mot dont vous vous souvenez pour la préciser.',
    'That is every verse in {bible} with those words.':
        'Ce sont tous les versets de {bible} qui contiennent ces mots.',
    'Verses {first} to {last} of {total} in {bible} that have your words:':
        'Versets {first} à {last} sur {total} dans {bible} qui contiennent vos mots :',
    '{bible} is the only Bible on this computer. To read or search in another language, install a Bible in it first — I can do that with you, one question at a time.':
        '{bible} est la seule Bible sur cet ordinateur. Pour lire ou chercher dans une autre langue, installez d’abord une Bible dans cette langue — je peux le faire avec vous, une question à la fois.',
    'I could not read those verses in {bible}.':
        'Je n’ai pas pu lire ces versets dans {bible}.',
    'From **{bible}**:': 'Dans **{bible}** :',
    '{bible} does not have {refs}.': '{bible} n’a pas {refs}.',
    'If it is not here, say more of what you remember, and I will search {bible}.':
        'Si ce n’est pas celui-là, dites-en davantage sur ce dont vous vous souvenez, et je chercherai dans {bible}.',
    '**Which Bible should I show the verse in?** Pick one below.':
        '**Dans quelle Bible dois-je afficher ce verset ?** Choisissez-en une ci-dessous.',
    '**Which Bible should I show the verses in?** Pick one below.':
        '**Dans quelle Bible dois-je afficher ces versets ?** Choisissez-en une ci-dessous.',
    'An assistant can also take words in your language and find the verse: pick one in the row above, or add a key in Settings → AI Providers.':
        "Un assistant peut aussi prendre des mots dans votre langue et trouver le verset : choisissez-en un dans la rangée ci-dessus, ou ajoutez une clé dans Paramètres → Fournisseurs d'IA.",
    'I could not search the Bible just now. Make sure the main window is open, then type the words again.':
        'Je n’ai pas pu chercher dans la Bible pour l’instant. Vérifiez que la fenêtre principale est ouverte, puis tapez de nouveau les mots.',
    'If you remember what it is ABOUT rather than its words, an assistant can search by meaning: pick one in the row above, or add a key in Settings → AI Providers.':
        "Si vous vous souvenez de ce dont il PARLE plutôt que de ses mots, un assistant peut chercher par le sens : choisissez-en un dans la rangée ci-dessus, ou ajoutez une clé dans Paramètres → Fournisseurs d'IA.",
    'No verse in {bible} has those words together.':
        'Aucun verset de {bible} ne contient ces mots ensemble.',
    'These are not in it at all: {words}.':
        'Ceux-ci n’y figurent pas du tout : {words}.',
    'Try fewer words, or other forms of them (forgive / forgave).':
        'Essayez moins de mots, ou d’autres formes de ces mots (pardonner / pardonna).',
    '{hits} of {of} words': '{hits} mots sur {of}',
    'These verses in {bible} have the most of your words:':
        'Ces versets de {bible} contiennent le plus de vos mots :',
    '{total} verses have some of them; add a word you remember to narrow it down.':
        '{total} versets en contiennent certains ; ajoutez un mot dont vous vous souvenez pour affiner.',
    'I could not open that verse just now.':
        'Je n’ai pas pu ouvrir ce verset pour l’instant.',
    '**Look at the app window.** {verse} is open in the Bible Lookup. Nothing went on a screen.':
        '**Regardez la fenêtre de l’application.** {verse} est ouvert dans la Recherche biblique. Rien n’est passé à l’écran.',
    'Help me find a Bible verse': 'Aidez-moi à trouver un verset biblique',
    'Help me find a Bible verse in "{bible}"':
        'Aidez-moi à trouver un verset biblique dans « {bible} »',
    'Import the Bible called "{name}"': 'Importer la Bible appelée « {name} »',
    'Import a Bible from {link}': 'Importer une Bible depuis {link}',
    'Import a Bible': 'Importer une Bible',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Click the control you mean {name} · Esc to cancel':
        'Cliquez sur la commande dont vous parlez {name} · Échap pour annuler',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Putting your question into English with {model}':
        'Traduction de votre question en anglais avec {model}',
    'Putting the answer into your language with {model}':
        'Traduction de la réponse dans votre langue avec {model}',
    'I could not put this answer into {language}, so it is in English.':
        'Je n’ai pas pu traduire cette réponse en {language}, elle est donc en anglais.',
    'The tips are back, on the line above the box.':
        'Les astuces sont de retour, sur la ligne au-dessus de la zone de saisie.',
    'The tips are on the line above the box.':
        'Les astuces sont sur la ligne au-dessus de la zone de saisie.',
    'Press a tip for another one, or the arrows beside it to go through them all. Here is one:':
        'Appuyez sur une astuce pour en voir une autre, ou sur les flèches à côté pour les parcourir toutes. En voici une :',
    'Show the tips above the box again, and one of them now':
        'Réafficher les astuces au-dessus de la zone de saisie, et l’une d’elles tout de suite',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    Reader: 'Lecteur',
};
function sanitizeTranKey(key: string) {
    return key.trim().toLowerCase();
}
const duplicateKeys = Object.entries(dictionary)
    .filter(([key], index, self) => {
        const sanitizedKey = sanitizeTranKey(key);
        return (
            self.findIndex(([k]) => sanitizeTranKey(k) === sanitizedKey) !==
            index
        );
    })
    .map(([key]) => key);
if (duplicateKeys.length > 0) {
    throw new Error(
        'Duplicate translation keys found after sanitization: ' +
            duplicateKeys.join(', '),
    );
}

const sanitizedDictionary = Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [
        sanitizeTranKey(key),
        value,
    ]),
);
// Everything French writes a word with once it is lower-cased. Bible Find shows
// the finding text in its results, so accents are KEPT rather than folded away.
const NOT_FINDING_CHAR_PATTERN = /[^a-z0-9àâäæçéèêëîïôöœùûüÿ ]/g;
const lang: LanguageDataType = {
    packageDir: '',
    version: '0.0.1',
    locale: 'fr-FR',
    langCode: 'fr',
    bibleBooks,
    getBibleKeyNameMap: () => {
        return bibleKeyMap;
    },
    // French is Latin script, which no test here can tell apart from English;
    // claiming it would move English text in a bible note off the default
    // language. There is no French font to apply either.
    checkIsThisLang: () => {
        return false;
    },
    genCss: () => {
        return '';
    },
    numList,
    dictionary: sanitizedDictionary,
    name: 'French',
    nativeName: 'Français',
    flagSVG: `<svg xmlns="http://www.w3.org/2000/svg" id="flag-icons-fr" viewBox="0 0 640 480">
    <path fill="#fff" d="M0 0h640v480H0z"/>
    <path fill="#000091" d="M0 0h213.3v480H0z"/>
    <path fill="#e1000f" d="M426.7 0H640v480H426.7z"/>
  </svg>`,
    sanitizeText: (text: string) => {
        return text;
    },
    sanitizePreviewText: (text: string) => {
        return text;
    },
    sanitizeFindingText: (text: string) => {
        return text
            .normalize('NFC')
            .toLowerCase()
            .replaceAll(NOT_FINDING_CHAR_PATTERN, ' ')
            .replaceAll(/\s+/g, ' ')
            .trim();
    },
    bookMarkerWords: ['dans', 'livre'],
    findFrameWords: [
        'trouver',
        'trouve',
        'chercher',
        'cherche',
        'montre',
        'montrez',
        'moi',
        'aide',
        'verset',
        'versets',
        'bible',
        'histoire',
        'récit',
        'où',
        'quel',
        'quelle',
        'parle',
        'sur',
    ],
    stopWords: [
        'le',
        'la',
        'les',
        'de',
        'des',
        'du',
        'un',
        'une',
        'et',
        'à',
        'au',
        'aux',
        'en',
        'est',
        'que',
        'qui',
        'dans',
        'pour',
        'par',
        'sur',
        'il',
        'elle',
        'ils',
        'ce',
        'se',
        'ne',
        'pas',
        'avec',
        'mais',
        'ou',
    ],
    trimText: (text: string) => {
        return text.trim();
    },
    endWord: (text: string) => {
        return text + ' ';
    },
    extraBibleContextMenuItems: (_bibleItem, _appProvider) => {
        return [];
    },
    bibleAudioAvailable: false,
    sanitizeTranKey,
    transformBibleBookName: (bookName: string) => {
        return [bookName];
    },
    getBibleCrossRefBundleFilePath(resolveGzBundleFilePath) {
        return resolveGzBundleFilePath(bbCR);
    },
    async getLookupDataVersion({ readJsonFileVersion }) {
        const [namesMap, locationsMap] = await Promise.all([
            readJsonFileVersion(namesMapUrl),
            readJsonFileVersion(locationsMapUrl),
        ]);
        if (namesMap === null || locationsMap === null) {
            return null;
        }
        return { namesMap, locationsMap };
    },
    async getLookupData({ readJsonFile }) {
        try {
            const namesMap = await readJsonFile(namesMapUrl);
            const locationsMap = await readJsonFile(locationsMapUrl);
            return { namesMap, locationsMap };
        } catch (error) {
            console.error(error);
            return null;
        }
    },
};

export default lang;
