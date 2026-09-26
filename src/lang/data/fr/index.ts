import { type LanguageDataType } from '../../langHelpers';

import bibleBooks from './bibleBooks.json';
import bbCR from './bb-cr.gz.bundle';
import locationsMapUrl from './location-name-map-data/locationsMap.json?url';
import namesMapUrl from './location-name-map-data/namesMap.json?url';

const numList = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Same keys, same order and same sections as `../km/index.ts`, which
// `tranKeyCoverage.test.ts` holds this file to. Machine-translated
// (2026-09-21); a native speaker should review the phrasing.
const dictionary = {
    'Are you sure you want to clear all settings?':
        'Voulez-vous vraiment effacer tous les paramètres ?',
    'Reveal Original': "Afficher l'original",
    Sort: 'Trier',
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
    Results: 'Résultats',
    'Go to results': 'Aller aux résultats',
    'Load more results': 'Charger plus de résultats',
    'Show pages': 'Afficher les pages',
    'Book-level files are shown in every chapter':
        'Les fichiers au niveau du livre sont affichés dans chaque chapitre',
    Introduction: 'Introduction',
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
    'The document data is corrupted and cannot be loaded. We will reset the document data to a new state.':
        'Les données du document sont corrompues et ne peuvent pas être chargées. Nous allons les réinitialiser à un état neuf.',
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
    'Click here to set default data on "Desktop"':
        'Cliquez ici pour définir les données par défaut sur "Desktop"',
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
    'The current text color may not be visible with the new background color.':
        "La couleur actuelle du texte risque de ne pas être visible avec la nouvelle couleur d'arrière-plan.",
    'Do you want to change the text color as well?':
        'Voulez-vous aussi changer la couleur du texte ?',
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
    'Remove Stage': 'Retirer la scène',
    'Base Stage': 'Scène de base',
    'Base stage is always shown': 'La scène de base est toujours affichée',
    'Add another stage layout': 'Ajouter une autre disposition de scène',
    'All stage layouts are shown':
        'Toutes les dispositions de scène sont affichées',
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
    'The application is started first time':
        "L'application est lancée pour la première fois",
    Close: 'Fermer',
    'Toggle Widget Full View': 'Agrandir/réduire le panneau',
    'Split Vertical to': 'Diviser verticalement vers',
    'Split Horizontal to': 'Diviser horizontalement vers',
    'Loading Bible Data': 'Chargement des données bibliques',
    'Unable to preview right now': 'Aperçu impossible pour le moment',
    'Open bible lookup popup': 'Ouvrir la recherche biblique',
    Cancel: 'Annuler',
    Ok: 'OK',
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
    Loading: 'Chargement',
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
    'Change Bible Model Info': 'Modifier les infos du modèle de Bible',
    'Child Directories': 'Sous-dossiers',
    'Clear All Settings': 'Effacer tous les paramètres',
    'Clear All': 'Tout effacer',
    'Clear Background': "Effacer l'arrière-plan",
    'Clear Bible': 'Effacer la Bible',
    'Clear Cache': 'Vider le cache',
    'Clear Color Note': 'Effacer la note de couleur',
    'Clear Foreground': 'Effacer le premier plan',
    // --- Messages and Mask ---
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
    'Remove Time': 'Supprimer l’horloge',
    Rotate: 'Alterner',
    'Show each message in turn': 'Afficher chaque message à tour de rôle',
    'Seconds each message stays before the next':
        "Secondes d'affichage de chaque message avant le suivant",
    'Tick a screen first, then press the key again':
        "Cochez d'abord un écran, puis appuyez à nouveau sur la touche",
    Mask: 'Masque',
    'Cover from the top': 'Couvrir depuis le haut',
    'Cover from the bottom': 'Couvrir depuis le bas',
    'Cover from the left': 'Couvrir depuis la gauche',
    'Cover from the right': 'Couvrir depuis la droite',
    'Mask color': 'Couleur du masque',
    'Remove Mask': 'Retirer le masque',
    'Clear All does not remove the mask':
        'Tout effacer ne retire pas le masque',
    'Cover the edges the projector overshoots':
        'Couvrir les bords que le projecteur dépasse',
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
    'Go Back to Presenter': 'Retour au Présentateur',
    'Go to Bible Setting': 'Aller aux paramètres de la Bible',
    'Or add bible ': 'Ou ajouter une Bible ',
    'Go to Settings': 'Aller aux paramètres',
    'Hide Camera': 'Masquer la caméra',
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
    'Please stop the audio before leaving the page.':
        "Veuillez arrêter l'audio avant de quitter la page.",
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
    'Reset White': 'Réinitialiser le blanc',
    'Reset Black': 'Réinitialiser le noir',
    'Reset to default display dimension':
        "Réinitialiser à la dimension d'affichage par défaut",
    'Reset Widgets Size': 'Réinitialiser la taille des panneaux',
    'Are you sure to reset every widget size and reopen the widgets?':
        'Voulez-vous vraiment réinitialiser la taille de tous les panneaux et les rouvrir ?',
    Widgets: 'Panneaux',
    'Round (%)': 'Arrondi (%)',
    'Round Size %:': "Taille de l'arrondi % :",
    'Round Size Pixel:': "Taille de l'arrondi en pixels :",
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
    'There is no parent directory selected':
        "Aucun dossier parent n'est sélectionné",
    'This will change all Slides': 'Cela modifiera toutes les diapositives',
    'Time Second Delay:': 'Délai (secondes) :',
    'Time Second to Live:': "Durée d'affichage (secondes) :",
    Time: 'Heure',
    'Toggle Fading at End': 'Activer/désactiver le fondu à la fin',
    'Toggle is video should fade at the end':
        'Activer/désactiver le fondu de la vidéo à la fin',
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
    'Keep Open': 'Garder ouvert',
    'Should New Lines': 'Retours à la ligne',
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
    'Background transition': "Transition d'arrière-plan",
    'Clear input': 'Effacer la saisie',
    'Clear input chunk': 'Effacer une partie de la saisie',
    'Keep popup modal open when adding a bible item, useful in presenter mode':
        "Garder la fenêtre contextuelle ouverte lors de l'ajout d'un élément biblique, utile en mode Présentateur",
    'Canvas Items': 'Éléments du canevas',
    'Please change bible key here': 'Veuillez modifier la clé de la Bible ici',
    'Not available': 'Non disponible',
    'Moving File to Trash': 'Déplacement du fichier vers la corbeille',
    'Are you sure you want to move': 'Voulez-vous vraiment déplacer',
    'to trash?': 'vers la corbeille ?',
    Yes: 'Oui',
    No: 'Non',
    'will be converted to PDF into': 'sera converti en PDF dans',
    Align: 'Aligner',
    'All Files': 'Tous les fichiers',
    'AM/PM': 'AM/PM',
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
    // The two bodies every export/import toast is built from. The path or the
    // name goes on AFTER the translation, never into the key.
    'Exported to': 'Exporté vers',
    Imported: 'Importé',
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
    'You will be redirected to the General Settings page to select a parent directory.':
        'Vous allez être redirigé vers la page Paramètres généraux pour sélectionner un dossier parent.',
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
    'Books map': 'Correspondance des livres',
    'Box Alignment': 'Alignement de la zone',
    'Box Properties': 'Propriétés de la zone',
    'Cannot find Bible Item': 'Élément biblique introuvable',
    'Cannot find Note Item': 'Élément de note introuvable',
    'Cannot source Bible': 'Impossible de charger la Bible',
    'Cannot source Note': 'Impossible de charger la note',
    'Canvas item not found': 'Élément du canevas introuvable',
    'Canvas Scale': 'Échelle du canevas',
    'Chapter data not found.': 'Données du chapitre introuvables.',
    'Choose Bible Books': 'Choisir les livres de la Bible',
    'Choose Locale': 'Choisir la langue',
    'Clear url': "Effacer l'URL",
    'Click to edit this section': 'Cliquez pour modifier cette section',
    'Color Note': 'Note de couleur',
    'Converting to PDF': 'Conversion en PDF',
    'Copy Color': 'Copier la couleur',
    'Copy Error Json': "Copier le Json de l'erreur",
    'Create New Web File': 'Créer un nouveau fichier web',
    'Creating Presenting Flow': 'Création du déroulé',
    'Delete Bible': 'Supprimer la Bible',
    'Delete Bible XML': 'Supprimer le XML de la Bible',
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
    'Please open a folder first': "Veuillez d'abord ouvrir un dossier",
    'Please select an Open Worship slide first':
        "Veuillez d'abord sélectionner une diapositive Open Worship",
    'Position & Size': 'Position et taille',
    'PowerPoint Document': 'Document PowerPoint',
    'Preview Size Scale': "Échelle de l'aperçu",
    Previous: 'Précédent',
    'Reset Date and Time to Now':
        "Réinitialiser à la date et l'heure actuelles",
    'Rotate:': 'Rotation :',
    'Saving Bible Data': 'Enregistrement des données de la Bible',
    'Saving File': 'Enregistrement du fichier',
    'Scroll to the top': 'Revenir en haut',
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
    'Text has been copied to clip':
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
    // --- The caution asked before either AI window opens (2026-09-12).
    'Be careful with AI': "Soyez prudent avec l'IA",
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
    'The media tools used to download background video and audio. They are downloaded separately to keep the app small.':
        "Les outils multimédias servant à télécharger les vidéos et audios d'arrière-plan. Ils sont téléchargés séparément pour garder l'application légère.",
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
    'No connection found': 'Aucun lien trouvé',
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
    'Double click to put back, shift double click to put back split':
        'Double-cliquez pour remettre, Maj + double-clic pour remettre en vue partagée',
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
    'Data Folder Not Found': 'Dossier de données introuvable',
    'is not available. If it is on a USB flash drive, plug it in and press Retry. Until then the app is using a folder of its own; your data is not touched.':
        "n'est pas disponible. S'il se trouve sur une clé USB, branchez-la et appuyez sur Réessayer. En attendant, l'application utilise son propre dossier ; vos données ne sont pas modifiées.",
    Retry: 'Réessayer',
    'Choose Another Folder': 'Choisir un autre dossier',
    'Data Folder Found': 'Dossier de données trouvé',
    'Use the data folder found at':
        'Utiliser le dossier de données trouvé dans',
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
    "Don't show again": 'Ne plus afficher',
    'Show Tips of the Day automatically':
        'Afficher automatiquement les astuces du jour',
    'Applies to the Presenter and Bible Reader on the next app launch.':
        "S'applique au Présentateur et au Lecteur biblique au prochain démarrage de l'application.",
    'Starting walkthrough…': 'Démarrage du guide…',
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
    'Learn Copy Debug Info, Copy Full Debug Info, Local Web Share, Google Fonts, App Assistant, AI Chat, Khmer Tools, and Start Controlling.':
        "Découvrez la copie des informations de débogage, le partage web local, Google Fonts, l'assistant, AI Chat, les outils khmers et le contrôle de l'écran.",
    'Learn the Window menu': 'Découvrir le menu Fenêtre',
    'Learn Minimize, Maximize or Zoom, Close, Bring All to Front, window switching, and Reset Position and Size.':
        'Découvrez Réduire, Agrandir ou Zoomer, Fermer, Tout ramener au premier plan, changer de fenêtre et Réinitialiser la position et la taille.',
    'Learn the Help menu': 'Découvrir le menu Aide',
    'Learn Tips of the Day, All tips, App Help (Chatbot), AI Chat, Learn More, both update checks, and About.':
        "Découvrez les astuces du jour, toutes les astuces, l'aide par chatbot, AI Chat, En savoir plus, les deux recherches de mise à jour et À propos.",
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
    'Open the hidden footer and raise Font Size.':
        'Ouvrez le pied de page masqué et augmentez la taille de police.',
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
    'Make the words smaller': 'Réduire les mots',
    'Open the hidden footer and lower Font Size.':
        'Ouvrez le pied de page masqué et réduisez la taille de police.',
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
    "Show this Bible's book buttons and start a fresh lookup.":
        'Affichez les boutons des livres et commencez une nouvelle recherche.',
    'Change names and places language':
        'Changer la langue des noms et des lieux',
    'Open the language picker used by the people and places tools.':
        'Ouvrez le sélecteur de langue des outils de personnes et de lieux.',
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
    'Present a passage from the Reader':
        'Présenter un passage depuis le Lecteur',
    'Double-click a verse to send it to selected screens; use F9 to clear it.':
        "Double-cliquez un verset pour l'envoyer aux écrans choisis; utilisez F9 pour l'effacer.",
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
    'See other verses connected to the passage you are reading.':
        "Voyez d'autres versets liés au passage que vous lisez.",
    'See people and places in this passage':
        'Voir les personnes et les lieux de ce passage',
    'Open the names and locations found in what you are reading.':
        'Ouvrez les noms et lieux trouvés dans votre lecture.',
    'Open passage resources': 'Ouvrir les ressources du passage',
    'Show study resources for the passage beside the Bible.':
        "Affichez les ressources d'étude du passage à côté de la Bible.",
    'Search only selected Bible books':
        'Rechercher seulement dans certains livres bibliques',
    'Open the book filter used by Bible Find.':
        'Ouvrez le filtre de livres utilisé par la recherche biblique.',
    'Type a complete Bible reference': 'Saisir une référence biblique complète',
    'Enter a reference such as John 3:16 and open it directly.':
        'Saisissez une référence comme Jean 3:16 et ouvrez-la directement.',
    'Use the reference box shortcuts':
        'Utiliser les raccourcis du champ de référence',
    'Tab completes a choice, Escape removes one part, and Ctrl+Escape clears all.':
        'Tab complète un choix, Échap supprime une partie et Ctrl+Échap efface tout.',
    'Reuse and arrange passage history':
        "Réutiliser et organiser l'historique des passages",
    'Open, split, drag, save, or remove references from the history row.':
        "Ouvrez, partagez, faites glisser, enregistrez ou retirez les références de l'historique.",
    'Change version and read Bible information':
        'Changer de version et lire les informations bibliques',
    'Choose a translation, then open its publisher, language, and copyright details.':
        "Choisissez une traduction, puis consultez son éditeur, sa langue et ses droits d'auteur.",
    'Choose one verse or a verse range':
        'Choisir un verset ou une plage de versets',
    'Use verse numbers to select a start, an end, or all verses in the chapter.':
        'Utilisez les numéros pour choisir un début, une fin ou tout le chapitre.',
    'Use dictionary and Word export':
        "Utiliser le dictionnaire et l'export Word",
    'Look up selected words in Wiki Dictionary or export a passage to Microsoft Word.':
        'Recherchez les mots sélectionnés dans Wiki Dictionary ou exportez le passage vers Microsoft Word.',
    'Use Bible audio and AI reading controls':
        'Utiliser les commandes audio et de lecture IA',
    'Enable automatic AI audio, play verse audio, repeat it, or refresh the source.':
        "Activez l'audio IA automatique, lisez un verset, répétez-le ou actualisez la source.",
    'Edit and arrange reading panes':
        'Modifier et organiser les volets de lecture',
    'Rename, recolor, drag, split, replace, or close the passages in your workspace.':
        'Renommez, recolorez, faites glisser, partagez, remplacez ou fermez les passages.',
    'Master Bible Find results':
        'Maîtriser les résultats de recherche biblique',
    'Change version, use suggestions and book filters, page through hits, then open or save one.':
        'Changez de version, utilisez les suggestions et filtres, parcourez les résultats, puis ouvrez-en ou enregistrez-en un.',
    'Explore people and place details':
        'Explorer les détails des personnes et des lieux',
    'Filter records, follow references, open verses or maps, copy details, and change data language.':
        'Filtrez les fiches, suivez les références, ouvrez versets ou cartes, copiez les détails et changez la langue des données.',
    'Explore the connection graph': 'Explorer le graphe de relations',
    'Open a graph from a record, expand relations, filter, drag, pan, zoom, and find connections.':
        'Ouvrez un graphe depuis une fiche, développez et filtrez les relations, déplacez, zoomez et trouvez des liens.',
    'Organize and share a connection graph':
        'Organiser et partager un graphe de relations',
    'Re-layout, undo, set a centre or root, then copy, save, print, or open the drawn view.':
        'Réorganisez, annulez, définissez un centre ou une racine, puis copiez, enregistrez, imprimez ou ouvrez le dessin.',
    'Organize passage resources by filename':
        'Organiser les ressources par nom de fichier',
    'Name files by book and chapter so they appear beside the right passage.':
        "Nommez les fichiers par livre et chapitre afin qu'ils apparaissent près du bon passage.",
    'Build and use your Resources library':
        'Créer et utiliser votre bibliothèque de ressources',
    'Add or drop folders, search and reload them, open files, add files, or copy them into app data.':
        "Ajoutez ou déposez des dossiers, recherchez et actualisez-les, ouvrez ou ajoutez des fichiers, ou copiez-les dans les données de l'application.",
    'Highlight and comment on Bible text':
        'Surligner et commenter le texte biblique',
    'Select words in one verse to highlight, recolor, remove marks, or attach a comment.':
        'Sélectionnez des mots dans un verset pour les surligner, recolorer, effacer ou commenter.',
    'Work with marked verses in Bible Notes':
        'Utiliser les versets annotés dans Notes bibliques',
    'Open, recolor, edit, move, drag, add to Bibles, or delete a marked verse.':
        'Ouvrez, recolorez, modifiez, déplacez, faites glisser, ajoutez à Bibles ou supprimez un verset annoté.',
    'Use the Reader header tools': "Utiliser les outils d'en-tête du Lecteur",
    'Return to Presenter or open Settings, App Assistant, AI Chat, and Help.':
        "Revenez au Présentateur ou ouvrez Paramètres, Assistant, Chat IA et l'aide.",
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
