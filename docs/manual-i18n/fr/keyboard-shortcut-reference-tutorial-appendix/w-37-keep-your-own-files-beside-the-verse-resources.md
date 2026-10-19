---
id: W-37
title: "Garder vos propres fichiers à côté du verset (Ressources)"
section: "Raccourcis clavier (annexe du tutoriel)"
lang: fr
translatedFrom: 0895194b7f6c68d7
---
# W-37 — Garder vos propres fichiers à côté du verset (Ressources)

Si vous gardez déjà sur le disque des documents d'étude nommés d'après le chapitre auquel ils se rapportent —
`PSA.1.pdf`, `GEN.49.pptx` — **[en:tran:Resources]** place ces fichiers
juste à côté de ce que vous lisez, depuis autant de dossiers que vous voulez — et suit
**chaque passage que vous avez ouvert**, et non un seul verset sur lequel vous avez cliqué : trois volets sur
Genèse 24, 27 et 29 listent les fichiers des trois chapitres.

Le nom doit suivre un modèle précis : **`<book key>.<chapter>.<anything>`**. La clé du livre est
celle de trois caractères qu'utilise l'application (Psaumes, c'est `PSA`, Genèse `GEN`, 1 Chroniques `1CH`) ; ainsi,
n'importe où dans le Psaume 1, l'application cherche `PSA.1.*` — `PSA.1.pdf`, `PSA.1.outline.docx`. N'importe quel type de fichier
convient. C'est le **chapitre** qui compte, pas le verset : chaque verset d'un chapitre vous montre
donc les mêmes fichiers.

**Les fichiers pour tout le livre** reçoivent le numéro de chapitre **0** : `PSA.0.pdf` est votre introduction aux
Psaumes, et il est listé pour _chaque_ chapitre des Psaumes, au-dessus des fichiers propres à ce
chapitre. Si vous avez plusieurs documents de ce genre, continuez vers le bas — `-1`, `-2` et ainsi de suite
comptent tous aussi au niveau du livre.

1. Dans la recherche biblique, cliquez sur **[en:tran:Advance Bible Lookup]** (les jumelles, en haut à droite) pour ouvrir
   le panneau latéral, puis choisissez **[en:tran:Resources]** dans la liste déroulante du panneau — la quatrième entrée,
   après **[en:tran:Find]**, **[en:tran:Cross Reference]** et **[en:tran:Location-Name (KJV)]**. 📸
2. La ligne du haut de la vue montre les modèles de noms de fichiers recherchés, un pour **chaque
   passage que vous avez ouvert**, dans l'ordre de vos volets, pour que vous voyiez toujours ce qui
   est cherché — en lisant Genèse 24 à côté de Genèse 27, un `GEN.24.*` plein et un `GEN.27.*`
   plein pour les fichiers propres aux chapitres, puis un `GEN.0.*` en pointillés pour ceux du livre.
   Au-dessus de chaque groupe de fichiers, le titre écrit aussi le livre et le chapitre en toutes lettres :
   `JHN.3.*, John chapter 3` ou `JHN.0.*, John Introduction`. Ces noms complets
   suivent la langue de l'interface et sont visibles sans survoler.
   Deux volets sur le même chapitre dans deux versions ne comptent qu'une fois. Le volet dans lequel vous tapez une
   référence suit ce qu'indique sa case, dès que la référence est complète ;
   passer à un autre verset du même chapitre ne change rien ici — c'est le chapitre
   qui compte. 📸
3. La première fois, le corps de la vue ne contient qu'un seul bouton **[en:tran:Add Folder]**. Cliquez dessus et
   choisissez le dossier où se trouvent vos fichiers. Vous pouvez en ajouter autant que vous voulez — le bouton
   **⋮ [en:tran:More Options]**, ou un clic droit n'importe où dans la vue, y compris dans l'espace vide sous
   les dossiers, propose de nouveau **[en:tran:Add Folder]**. Ajouter deux fois le même dossier ne fait rien. 📸
   **Les dossiers déjà présents dans votre dossier de données sont à un clic.** Tout ce que
   **[en:tran:Copy to Data Directory]** (étape 8) crée arrive dans un dossier `resources` à l'intérieur de
   votre dossier de données, tout comme ce que **[en:tran:Import Data]** (W-25) ramène. Tout
   dossier qui s'y trouve et qui n'est pas encore dans la liste apparaît en bas de la vue sous
   **[en:tran:In the data directory]** — la première fois, juste sous le bouton **[en:tran:Add Folder]**.
   Cliquez sur l'un d'eux et il devient aussitôt un groupe, avec ses fichiers correspondants déjà
   listés et sans sélecteur de dossier ; il quitte cette liste en rejoignant l'étagère, et
   **[en:tran:Remove Folder]** l'y remet. Un dossier que vous créez là-dedans pendant que la vue est
   ouverte apparaît après **[en:tran:Reload]**. Rien de ce que la vue montre déjà n'est proposé —
   y compris chaque dossier qui s'y trouve quand tout le dossier `resources` est lui-même dans la liste —
   et le titre n'est pas affiché du tout quand il n'y a rien à proposer. 📸
   **Ou faites glisser le dossier directement.** Prenez-le dans votre gestionnaire de fichiers — l'Explorateur de fichiers, le Finder —
   et déposez-le n'importe où sur la vue Ressources : tant que vous le tenez au-dessus, la vue s'entoure
   d'un contour et sa ligne du haut affiche **[en:tran:Drop folders here]** à la place des modèles,
   et quand vous le lâchez, le dossier est rangé sur l'étagère exactement comme avec le bouton, avec ses fichiers correspondants
   déjà listés en dessous. Plusieurs dossiers à la fois, c'est un seul dépôt. 📸
   Rien n'est copié ni déplacé — le dossier reste où il est, et Ressources retient seulement
   où chercher. Si vous déposez un **fichier** par erreur, rien n'est ajouté : la vue affiche
   **[en:tran:Drop a folder, not a file]**, car le dossier où se trouve un fichier égaré est aussi
   souvent tout votre dossier Téléchargements qu'une bibliothèque, et y diriger Ressources lui ferait
   parcourir tout ce que vous possédez. Un dossier qui est déjà dans la liste affiche
   **[en:tran:Folder is already added]** au lieu de ne rien changer en silence.
   Ce même menu contient **[en:tran:Reload]**, qui relit tout d'un coup : votre
   liste de dossiers, et les fichiers à l'intérieur de chaque dossier. Utilisez-le après avoir ajouté des fichiers sur le disque pendant que
   l'application est ouverte, ou après avoir modifié la liste depuis une autre fenêtre. 📸
4. Chaque dossier devient son propre groupe, nommé d'après le dossier, avec le dossier qui le contient
   affiché à côté du nom, et le chemin complet si vous le survolez. Sous le nom, suspendus à une
   seule ligne verticale, se trouvent les fichiers correspondants — **de ce dossier et des dossiers
   qu'il contient, sur deux niveaux** (`Library/Genesis/Sermons/GEN.24.pdf` est trouvé, un fichier un
   dossier plus bas ne l'est pas) — classés sous le modèle auquel chacun correspond (`GEN.24.*`, puis
   `GEN.27.*`, puis le `GEN.0.*` en pointillés), triés par type de fichier dans chaque modèle, chacun avec sa
   propre icône (PDF, Word, PowerPoint, vidéo, image, note biblique). L'extension est plus discrète
   que le reste du nom pour que la référence se lise en premier. Survolez un fichier pour voir où il se
   trouve réellement. 📸
   Un fichier au niveau du livre n'est listé **qu'une fois**, sous son modèle en pointillés, quel que soit le nombre de chapitres
   de ce livre que vous avez ouverts, et porte une étiquette **[en:tran:Introduction]** en pointillés pour qu'un
   `PSA.0.pdf` dise pourquoi il est là. Un groupe qui n'a rien pour ce que vous lisez affiche
   **[en:tran:No matching files]**.
5. Parfois, vous voulez un fichier qui n'est _pas_ nommé d'après ce verset. Cliquez sur la **loupe**
   à l'extrémité droite de la ligne des modèles, et une case de recherche s'ouvre en dessous.
   Tapez n'importe quelle partie du nom d'un fichier — `abc`, `baptism`, `PSA.11` — et chaque fichier de vos
   dossiers dont le nom la contient est aussi listé, ajouté sous les fichiers du verset de ce dossier, sous
   un titre `*abc*`, pour que vous puissiez distinguer les deux. Vos fichiers du verset restent exactement là où ils
   étaient. 📸
   Les majuscules et minuscules ne comptent pas, et la recherche regarde n'importe où dans le nom, pas seulement au
   début — chercher `abc` trouve `abc.pdf` comme `01-abc-notes.docx`. Si vous avez l'habitude d'écrire
   `abc*`, cela fonctionne aussi ; le `*` est simplement ignoré.
   Cliquez de nouveau sur la loupe pour fermer la case et remettre les listes comme avant. Si un
   dossier a des centaines de correspondances, seules les 200 premières sont affichées, et la case indique
   **[en:tran:Too many matching files]** — tapez un peu plus pour affiner.
   **Pour voir tout le reste sans rien taper, cochez [en:tran:Others]**, la case juste à gauche de la
   loupe. Chaque dossier liste alors aussi chaque fichier dont le nom n'est _pas_ un livre et un
   chapitre — `family-tree.jpeg`, `church-map.pdf`, `README.txt` — sous un titre
   **[en:tran:Others]**, après ses fichiers du verset et ce que vous avez cherché. 📸
   Un fichier ne compte comme fichier de livre et de chapitre que s'il commence par une vraie clé de livre et un
   chapitre écrit simplement : `GEN.5.pdf` reste donc hors de cette liste, alors que `IMG.2.jpg` et un
   `GEN.01.pdf` mal numéroté y apparaissent — pratique pour repérer un fichier mal nommé. Un
   fichier trouvé par votre recherche est listé sous le titre de la recherche à la place, jamais deux fois. Jusqu'à 200
   fichiers sont affichés par dossier ; au-delà, le groupe indique **[en:tran:Too many other files]**, et diriger
   Ressources vers le dossier où se trouvent réellement vos documents garde la liste courte. Décochez
   **[en:tran:Others]** pour les masquer de nouveau — la case reste telle que vous l'avez laissée la fois suivante.
6. Cliquez sur un fichier pour l'ouvrir dans l'application que votre ordinateur utilise d'habitude pour ce type de fichier — un
   PowerPoint dans PowerPoint, une image dans votre visionneuse d'images. Faites un clic droit dessus pour **[en:tran:Open]**,
   **[en:tran:Copy Path to Clipboard]**, ou **[en:tran:Reveal in Finder]** / **[en:tran:Reveal in File Explorer]**.
   Trois sortes de fichiers s'ouvrent plutôt **dans l'application** :
   - **Un PDF** (`.pdf`) s'ouvre dans la fenêtre de visionneuse PDF de l'application elle-même — la même que celle
     qu'ouvre **[en:tran:Preview PDF]** depuis un PDF de la liste Documents — avec ses pages sur
     le côté, le zoom et l'impression. Faites un clic droit sur la ligne pour **[en:tran:Preview PDF]**, ou **[en:tran:Open]**
     pour utiliser votre propre lecteur PDF à la place. Appuyer sur un PDF dont l'aperçu est déjà ouvert met
     cette fenêtre au premier plan. 📸
   - **Un fichier markdown** (`.md`, `.markdown`, affiché avec l'icône markdown) s'ouvre dans sa
     propre fenêtre **Markdown Preview**, comme le fait une note biblique : titres, listes, tableaux, citations,
     code, images gardées à côté du fichier, et les **diagrammes Mermaid** écrits dans un bloc ` ```mermaid `
     sont dessinés comme des diagrammes (un diagramme qui contient une erreur affiche l'erreur au-dessus de son
     code). La fenêtre suit le fichier — enregistrez-le dans votre éditeur et l'aperçu change.
     Un lien vers un titre fait défiler jusqu'à ce titre ; un lien vers un autre `.md` l'ouvre dans la même fenêtre,
     avec **[en:tran:Back]** (la flèche gauche) pour revenir ; un lien web s'ouvre dans votre navigateur ; un
     lien vers tout autre fichier le montre dans son dossier au lieu de l'exécuter. Le HTML écrit
     dans le fichier est dessiné comme GitHub affiche un README — une image centrée, un tableau, une
     section qui se replie — mais rien ne peut s'y exécuter : les scripts, boutons, formulaires et styles
     sont retirés. Si un fichier affiche `#` et `**` au lieu d'un titre et de texte en gras, c'est que le fichier lui-même
     a été enregistré avec ces signes échappés (`\#`, `\*\*`), ce que fait la vue mise en forme de certains éditeurs
     quand on y colle du texte ; l'aperçu montre ce qui est écrit. La ligne d'en-tête a aussi
     **[en:tran:Reload]**, **[en:tran:Open in Default App]** (pour le modifier) et
     **[en:tran:Reveal in File Explorer]**. Faites un clic droit sur la ligne pour **[en:tran:Preview]** ou **[en:tran:Open]**. Appuyer sur un
     fichier dont l'aperçu est déjà ouvert met cette fenêtre au premier plan. 📸
   - **Un fichier de notes bibliques** (`.own`) reçoit un chevron : cliquez dessus et tout ce qu'il contient est
     listé en dessous, comme le panneau **[en:tran:Bible Notes]** le liste — ses notes, et chaque verset
     marqué dedans (l'icône de surligneur) avec ses surlignages dans leur couleur et ses commentaires
     soulignés, ce qui a été écrit à côté. Cliquez sur une note pour l'ouvrir dans la fenêtre **Note biblique**
     en **lecture seule** — la barre de titre indique **([en:tran:Read-only])**, le cadenas en
     bas montre qu'elle est verrouillée, et rien de ce que vous y faites n'est enregistré dans le fichier. Cliquez sur un
     surlignage ou un commentaire pour ouvrir ce verset à côté de ce que vous lisez ; cliquez sur un verset pour
     le replier en un simple nombre. Rien dans le fichier ne peut être modifié d'ici. Un fichier qui
     n'est pas un fichier de notes bibliques affiche **[en:tran:Not a bible note file]**. 📸
7. **Un fichier `.json` peut contenir une liste de liens** — vidéos, articles, tout ce qui est sur le web pour
   ce chapitre — et le panneau les affiche au lieu d'ouvrir le fichier. Enregistrez ce fichier
   dans un dossier listé dans **[en:tran:Resources]** ; pour ajouter son dossier, cliquez sur
   **⋮** du panneau → **[en:tran:Add Folder]**, puis choisissez ce dossier. Écrivez-le comme une liste
   d'entrées, chacune avec un champ **title** à lire et un champ **url** à ouvrir — un lien s'écrit `[{"title": "Notes", "url": "https://www.example.com/notes"}]` — exactement comme dans cet exemple :

   ```json
   [
     {
       "title": "Overview: 1-2 Chronicles",
       "url": "https://www.example.com/watch?v=overview-chronicles"
     },
     {
       "title": "Notes on the genealogies",
       "url": "https://www.example.com/notes"
     }
   ]
   ```

   Enregistrez-le sous le nom de son chapitre, comme les fichiers à côté (`JHN.3.json` pour Jean 3, `1CH.0.json` pour tout 1 Chroniques), et sa ligne reçoit un chevron
   et une icône 🔗, avec une ligne par entrée suspendue en dessous. **Cliquez sur un
   titre pour l'ouvrir dans votre propre navigateur web** — Chrome, Edge, Safari, celui que vous
   utilisez d'habitude — et le site visé est affiché après le titre quand le panneau est assez
   large, avec le titre et l'adresse complète dans l'infobulle dans tous les cas. Faites un clic droit sur un
   lien (ou utilisez son **⋮**) pour **[en:tran:Open Link in Browser]** et **[en:tran:Copy URL to Clipboard]**. 📸
   Quelques détails bons à savoir :
   - Une adresse seule sur sa ligne — `"https://www.example.com/talk"` — est un lien qui
     se sert de titre à lui-même : une liste rapide n'a donc besoin d'aucun titre. Une entrée sans titre affiche
     son adresse comme titre.
   - Seules les adresses **`http`** et **`https`** sont proposées. Tout le reste est écarté, et
     le panneau indique combien d'entrées il n'a pas pu lire (**1 [en:tran:entry was not understood]**),
     pour qu'une faute de frappe se voie au lieu qu'une ligne disparaisse discrètement.
   - **Un `.json` qui n'est pas une liste de liens est un simple fichier.** S'il contient d'autres données, ou
     n'est pas du JSON valide du tout, la ligne garde l'icône de fichier ordinaire, sans chevron, et un
     clic l'ouvre dans votre éditeur de texte comme n'importe quel autre fichier — rien à fermer.
   - Le fichier est lu quand sa ligne apparaît : après l'avoir modifié sur le disque, repliez le groupe
     puis rouvrez-le pour voir votre modification. Les fichiers trouvés par la **recherche** de l'étape 5 sont
     lus au premier clic à la place, c'est pourquoi une liste de liens trouvée ainsi a besoin d'un
     appui pour afficher ses liens.
   - Faites un clic droit sur la ligne du `.json` elle-même (ou sur son **⋮**) pour **[en:tran:Open]** si vous voulez modifier
     le fichier plutôt que suivre un lien.

8. Cliquez sur l'en-tête d'un groupe pour le replier ; il se rouvre la prochaine fois que les Ressources s'affichent. Faites un clic droit sur un en-tête
   pour **[en:tran:Refresh]** (relit ce seul dossier — **[en:tran:Reload]**, à l'étape 3, les relit tous),
   **[en:tran:Add Folder]**, **[en:tran:Add Files]**, **[en:tran:Reveal in Finder]**/**[en:tran:Reveal in File Explorer]**,
   **[en:tran:Copy to Data Directory]** et **[en:tran:Remove Folder]**, qui demande confirmation puis
   le retire seulement de cette liste — rien n'est touché sur le disque. 📸
   **[en:tran:Add Files]** fait l'inverse : il met des fichiers que vous avez déjà DANS ce
   dossier. Choisissez-en un ou plusieurs dans le sélecteur et ils y sont **copiés** — les originaux restent
   exactement là où ils étaient — puis le groupe se relit, s'ouvre s'il était replié, et une
   note indique combien de fichiers ont été copiés. **Rien n'est jamais écrasé** : un nom que le dossier contient déjà
   reçoit un numéro à côté, ainsi un second `GEN.4.pdf` arrive sous le nom `GEN.4 (1).pdf`. Si vous choisissez un fichier
   qui est déjà dans ce dossier, il est laissé tel quel au lieu d'être copié à côté de lui-même. Si vous y copiez
   un fichier qui n'est nommé d'après aucun chapitre — `notes.docx` — il est sur l'étagère mais pas dans la liste ;
   la note le dit et vous indique de cocher **[en:tran:Others]** (étape 5) pour le voir. 📸
   **[en:tran:Copy to Data Directory]** fait entrer un dossier que vous gardez ailleurs avec le reste
   des données de l'application, pour qu'il vive et se déplace avec elles — **[en:tran:Export Data]** (W-25) l'emporte
   dans une sauvegarde, ce qui n'est pas le cas d'un dossier seulement listé ici. Il demande d'abord, en nommant le dossier et l'endroit où
   va la copie — un dossier `resources` à l'intérieur de votre dossier de données (celui que les Paramètres appellent le
   dossier parent). Appuyez sur **[en:tran:Yes]** et tout le contenu du dossier y est copié, sous-dossiers
   compris, pendant que la barre de progression avance ; puis le groupe passe à la copie, au même endroit
   et ouvert, et une note indique où elle est allée. **Votre dossier d'origine n'est pas
   touché** — il quitte seulement cette liste, supprimez-le donc vous-même quand la copie vous convient.
   Une seconde copie d'un dossier du même nom s'appelle `YouTube (1)` au lieu d'être mélangée à
   la première. Ce choix n'est pas proposé sur un dossier qui est déjà une copie, et un dossier qui
   contient votre dossier de données — tout votre Bureau, quand les données sont sur le Bureau — est refusé
   d'emblée avec **[en:tran:The data directory is inside this folder]**, car il serait
   copié dans lui-même. 📸

> **Attention à la numérotation.** Le numéro de chapitre doit être seul entre deux points. Pour
> le Psaume 1, cela signifie que `PSA.1.pdf` est trouvé alors que `PSA.10.pdf`, `PSA.100.pdf` et `PSA.149.pdf`
> sont laissés de côté — c'est exactement ce que vous voulez, puisqu'une série complète des Psaumes les a tous
> dans un seul dossier. Écrivez les numéros simplement : pas de zéro au début (`PSA.01.pdf` n'est pas
> trouvé), et `-0` n'est pas un numéro. Les majuscules et minuscules ne comptent pas.

> **Si un groupe affiche un avertissement** au lieu de fichiers : **[en:tran:Folder not found]** signifie que le dossier a été
> déplacé, renommé ou supprimé depuis que vous l'avez ajouté (retirez-le et ajoutez-le de nouveau) ;
> **[en:tran:Cannot read folder]** signifie que l'application n'a pas le droit de le lire. **[en:tran:Too many folders to search]**
> signifie que même ces deux niveaux contenaient plus de dossiers qu'elle ne pouvait en lire — dirigez
> Ressources vers le dossier où se trouvent réellement vos documents plutôt que vers un disque entier.
> Un fichier attendu qui n'est tout simplement **pas listé** se trouve en général plus de deux dossiers plus bas :
> ajoutez le dossier où il se trouve (ou celui juste au-dessus) comme un groupe à part entière.
