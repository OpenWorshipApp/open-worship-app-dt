---
id: W-05
title: "Présenter les paroles d'un chant"
section: "Présenter du contenu"
lang: fr
translatedFrom: 74d6bff11d380b45
---
# W-05 — Présenter les paroles d'un chant

**Objectif :** mettre les paroles d'un chant à l'écran.

1. Dans la colonne de gauche, cliquez sur un chant dans la liste **[en:tran:Documents]** — les chants portent une
   icône de note de musique. L'onglet **[en:tran:Documents]** du milieu passe à la vue du chant : l'**[en:tran:Previewer]**
   des paroles en haut, et les couplets de l'**[en:tran:Stage Previewer]** en dessous. Un seul fichier de la
   liste est mis en surbrillance à la fois, donc choisir un chant libère ce qui était sélectionné avant.
   Ces deux vues montrent à quoi ressemblera le chant à l'écran ; rien n'arrive à l'écran
   tant que vous ne cliquez pas sur un couplet. 📸
2. **Cliquez** sur un couplet pour l'envoyer à l'écran.
3. Appuyez sur **F8** / le bouton d'effacement pour le retirer.
4. Pour joindre des liens à un chant — des adresses web, ou des fichiers de cet ordinateur écrits
   `file:///C:/…` — ouvrez-le dans l'**Éditeur de paroles** (clic droit sur le chant →
   **[en:tran:Edit]**) et ajoutez un champ **`- Attachments:`** à son bloc `ol:Config`, un lien
   par ligne. Chaque lien devient aussi **sa propre diapositive à la fin** de l'Aperçu des scènes,
   nommée d'après le lien. Un lien YouTube devient une vidéo que l'on peut lire, un lien d'image / de
   vidéo / d'audio devient ce média, et toute autre adresse web devient la page elle-même ;
   chacun remplit toute la diapositive. Présentez-en un de la même façon qu'un couplet. Un lien vers
   un fichier de cet ordinateur fonctionne aussi (écrit `file:///C:/…`), et c'est ainsi qu'une grille
   d'accords ou un accompagnement enregistré voyage avec le chant. 📸
5. Les liens que l'application ne peut pas afficher — un PDF, ou une ligne qui n'est pas une adresse
   web — reçoivent quand même leur diapositive nommée, simplement vide.
6. **Un même chant peut être prévisualisé sur plusieurs scènes à la fois.** **[en:tran:Add Stage]** dans
    l'en-tête de l'Aperçu des scènes ouvre le même menu que le badge **St:** du mini-écran :
    **[en:tran:Stage] 0** à **[en:tran:Stage] 5** — une scène déjà à l'écran est listée mais grisée — et
    **[en:tran:Increment] · [en:tran:Stage] N** en bas, qui ajoute une scène au-delà de la plus haute que vous ayez.
    Augmenter est le moyen de dépasser la Scène 5, et c'est ce qui correspond à un écran dont le
    numéro **St:** a déjà été poussé jusque-là. Chaque scène arrive comme sa propre pastille et son
    propre volet, dans sa propre couleur ; le **×** d'une pastille (**[en:tran:Hide Stage] N**) masque
    de nouveau le volet de cette scène — son apparence sous **⚙** est gardée pour quand vous la rajoutez — et
    la **[en:tran:Stage] 0**, munie d'un cadenas, reste. 📸
7. Pour changer l'**apparence** des diapositives d'une scène, cliquez sur le **⚙** de la pastille de cette
   scène (`Stage 0`, `Stage 3`, …) dans l'en-tête de l'Aperçu des scènes. Une petite fenêtre **[en:tran:Stage Style]**
   s'ouvre — faites-la glisser où vous voulez, elle retient où vous l'avez laissée. Elle règle **[en:tran:Slide Padding (%)]**,
   **[en:tran:Background Opacity (%)]**, **[en:tran:Extra Font Size]**, un thème **[en:tran:Light]/[en:tran:Dark]**, et une
   zone **[en:tran:Custom CSS]** pour tout le reste. 📸
8. Ces réglages appartiennent à la **scène**, pas au chant — chaque chant que vous ouvrez les utilise,
   c'est pourquoi le panneau indique _[en:tran:Applies to every song]_. **Chaque numéro de scène garde
   ses propres réglages**, si bien que vous pouvez laisser sobre la scène projetée, agrandir la scène des accords,
   et donner un thème sombre à une troisième scène pour la personne à la table de mixage. La Scène 0
   est l'apparence sobre, paroles seules, et la scène 4 aussi ; chaque autre scène part de l'apparence
   avec accords et notes, et une scène au-delà de 5 ne diffère de la scène 1 que par ce que vous réglez
   ici. Le CSS personnalisé est **ajouté à** l'apparence intégrée de la scène au lieu de la remplacer,
   si bien que la scène 0 continue de masquer ses accords.
   **Les scènes 2 à 5 montrent ce qui vient ensuite** autour du couplet chanté : la 2 montre le couplet
   suivant en dessous, la 3 les deux suivants, la 4 fait comme la 2 dans l'apparence sobre, et la 5 montre
   le précédent en haut à gauche et le suivant en bas à droite. Le couplet à venir est en **pleine luminosité**, pas
   estompé, et sur les scènes 2 à 4 le couplet est collé au coin supérieur gauche de l'écran, avec le
   suivant collé à gauche
   juste en dessous, le touchant — sans marge autour ni espace entre eux, quoi qu'indique **[en:tran:Slide Padding (%)]** (la marge
   reste à l'intérieur de la boîte de chaque couplet). Un écran passé à une scène au-dessus de 0 voit sa
   transition **[en:tran:Slide]:** réglée sur **none** (W-10).
9. Dans cette fenêtre **[en:tran:Stage Style]** — le **⚙** de la pastille de la scène, dans l'Aperçu des scènes du Présentateur — **[en:tran:Reset]** remet cette scène aux valeurs par défaut.
10. Un écran qui affiche déjà une diapositive la garde — présentez de nouveau la diapositive pour lui
    envoyer la nouvelle apparence.
11. **Modifiez les paroles pendant que le chant est ouvert, et les couplets suivent d'eux-mêmes ; un couplet
    déjà à l'écran change quand vous cliquez de nouveau dessus.** Modifiez
    le chant dans l'**Éditeur de paroles** (clic droit sur le chant → **[en:tran:Edit]**) — ou dans n'importe
    quelle autre fenêtre — et en une seconde ou deux, le chant affiché **et chaque volet de l'Aperçu des scènes**
    montrent les nouvelles paroles, une fois que l'éditeur les a enregistrées (**Ctrl+S**) : les couplets
    affichent ce que contient le fichier du chant. Vous n'avez pas à choisir de nouveau le chant. Un couplet
    déjà à l'écran garde ses anciennes paroles jusqu'à ce que vous cliquiez de nouveau dessus. 📸
12. Si jamais vous devez le forcer — pour un chant modifié par quelque chose en dehors de l'application,
    par exemple — le **⋮** à l'extrémité droite de l'en-tête de l'Aperçu des scènes contient **[en:tran:Reload]**,
    qui refait l'affichage de toutes les scènes à la fois. Le même **[en:tran:Reload]** se trouve dans le menu du
    clic droit d'un volet de scène, et dans celui du chant affiché au-dessus.
    **Comment un chant est écrit : ses parties, et l'ordre dans lequel on les chante.** Dans l'Éditeur
    de paroles, un chant est du texte brut en blocs. Chaque partie est un bloc à part : une ligne de trois
    accents graves suivie de `ol:` et du nom de la partie — `ol:Verse 1`, `ol:Verse 2`,
    `ol:Chorus`, `ol:Bridge` — puis ses paroles, puis une ligne de trois accents graves pour le fermer.
    Un accord se met entre crochets juste avant la syllabe sur laquelle il tombe, comme `[G]`.
    **L'ordre dans lequel on le chante est sa ligne Structure, en codes courts comme V1CV2C, soit couplet 1, refrain, couplet 2, refrain.** La ligne Structure, dans le premier
    bloc (`ol:Config`, à côté du titre du chant, **Title**), est l'ordre dans lequel le chant est chanté
    et affiché, donc pour changer l'ordre, changez cette ligne — les parties elles-mêmes restent où
    elles sont. Écrivez-la en codes courts collés SANS espaces : `- Structure: V1CV2C`
    signifie couplet 1, refrain, couplet 2, refrain, et `x2` après un code le répète (`Cx2`). Les
    codes : Verse (couplet) `V`, Chorus (refrain) `C`, Pre-Chorus
    (pré-refrain) `P`, Bridge (pont) `B`, Intro `I`, Outro `O`, Tag `T`, Interlude `L`, Instrumental `IS` ;
    une partie numérotée prend son numéro (`V2`), Intro et Outro n'en prennent pas.
    **L'éditeur marque une erreur en rouge à l'endroit où elle se trouve.** Il marque une ligne
    Structure vide, contenant des espaces ou nommant une partie qui n'a pas de bloc (`V3` sans
    `Verse 3`), deux parties portant le même nom, et un accord qu'il ne connaît pas — il connaît
    `[Cm7]`, pas `[Cm7b5]`, alors écrivez à sa place un accord qu'il connaît. Corrigez la ligne
    marquée et le rouge disparaît.
