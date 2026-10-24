---
id: W-22c
title: "Effacer l'écran, ou l'afficher et le masquer, depuis un déroulé"
section: "Configuration"
lang: fr
translatedFrom: 8a56f898f39f0304
---
# W-22c — Effacer l'écran, ou l'afficher et le masquer, depuis un déroulé

**Objectif :** mettre dans le déroulé quelque chose à _faire_ — effacer un écran, l'allumer,
l'éteindre — plutôt que quelque chose à montrer.

1. **Ajouter une action d'écran.** Un déroulé peut aussi contenir quelque chose à _faire_ plutôt que
   quelque chose à montrer. Faites un clic droit sur **le déroulé lui-même** — sa propre ligne dans la
   liste, pas la partie vide de la liste ni l'une de ses lignes — et choisissez
   **[en:tran:Add Action]** : toutes les actions s'ajoutent depuis ce seul menu. Pour un effacement,
   choisissez-y **[en:tran:Clear Screen]** — une ligne qui n'ajoute rien et ouvre les effacements —
   puis **[en:tran:Clear All]**, **[en:tran:Clear Background]**, **[en:tran:Clear Slide]**, **[en:tran:Clear Long Text]** ou **[en:tran:Clear Foreground]** — les cinq mêmes effacements que les boutons de chaque écran miniature, et la ligne
   porte le même badge `ALL` / `BG` / `SL` / `LT` / `FG` pour que vous puissiez les distinguer d'un
   coup d'œil. Elle arrive en fin de liste ; faites-la glisser vers le haut jusqu'à sa place — par exemple entre
   le dernier chant et la prédication. 📸

   Sous ces cinq, **[en:tran:Other Clear FG Items]** propose un **effacement plus fin,
   pour un seul élément du premier plan à la fois**, pour retirer le compte à rebours et laisser
   tourner le texte défilant : **[en:tran:Clear FG Messages]** (`MS`), **[en:tran:Clear FG Marquee Top]** (`M↑`), **[en:tran:Clear FG Marquee Bottom]** (`M↓`), **[en:tran:Clear FG Quick Text]** (`QT`), **[en:tran:Clear FG Countdown]** (`CD`), **[en:tran:Clear FG Stopwatch]** (`SW`), **[en:tran:Clear FG Time]** (`TM`), **[en:tran:Clear FG Video Show]** (`VD`), **[en:tran:Clear FG Image Show]** (`IM`), **[en:tran:Clear FG Camera Show]** (`CM`), **[en:tran:Clear FG Screen Show]** (`SS`) et **[en:tran:Clear FG Web Show]** (`WB`). Chacun fait exactement ce que fait le bouton de masquage de cet élément dans le panneau **[en:tran:Foreground]** ; ceux de `Messages`, `Time`, `Video Show`, `Image Show`, `Camera Show`, `Screen Show` et `Web Show` effacent tous leurs éléments d'un coup.
2. **Une action d'écran s'exécute, elle ne s'affiche pas.** Cliquez dessus pour effacer, faites-la glisser sur un écran miniature
   pour n'effacer que celui-là, ou faites un clic droit → **[en:tran:Apply on Screens]** pour choisir. Elle ne
   s'allume jamais comme « en direct », car rien d'elle n'est à l'écran pour être en direct. Dans le
   panneau d'aperçu (W-22b), on s'y arrête et on la déclenche comme n'importe quelle autre ligne — ainsi un
   **[en:tran:Clear All]** entre le dernier chant et la prédication signifie qu'un appui de plus sur la même
   touche vide l'écran exactement à ce moment du déroulé.
3. **Afficher et masquer l'écran lui-même.** Deux autres actions ne concernent pas ce qui est _sur_ un
   écran, mais le fait qu'il y en ait un : **[en:tran:Screen: Show]** et
   **[en:tran:Screen: Hide]**, ce que le bouton des diapositives de chaque écran miniature
   fait à la main. Utilisez-les quand le déroulé doit fonctionner sans personne devant la machine —
   un **[en:tran:Screen: Show]** au début d'une boucle d'avant-culte, un **[en:tran:Screen: Hide]** à la fin de
   celle-ci, et l'écran s'éteint tout seul au lieu de garder la dernière annonce jusqu'à ce que
   quelqu'un s'en aperçoive.

   **Ces deux actions demandent quel écran** quand vous les ajoutez, et c'est tout l'intérêt : une
   liste à cocher des écrans ouverts apparaît (`Screen id: 0`, `Screen id: 1`, …,
   chacun dans la couleur de son écran), et la ligne retient votre réponse comme son épingle — la
   ligne affiche le badge d'épingle, et **[en:tran:Set Specific Screen]** permet de la rediriger plus tard. Contrairement à toutes
   les autres lignes, elle va vers ces écrans et _seulement_ ceux-là : elle ne se rabattra pas sur
   l'écran que vous aviez sélectionné à ce moment-là, et elle ne s'arrêtera jamais pour demander, car
   à 7 h 05, sur un déroulé sans surveillance, il n'y a personne pour répondre. Si vous ne cochez rien, l'application
   affiche **[en:tran:Please choose at least one screen]** au lieu d'ajouter une ligne qui ne ferait
   rien. Comme toute action, la ligne arrive en fin de liste : faites-la glisser vers le haut jusqu'à
   l'endroit où elle doit se déclencher. En déclencher une deux fois est sans danger — un **[en:tran:Screen: Show]** sur un écran déjà
   affiché ne fait rien du tout, c'est donc sûr dans une boucle. Rien ne peut non plus leur être
   joint, mais elles peuvent elles-mêmes être jointes à une autre ligne — « mettre cette dernière diapositive
   à l'écran **et** allumer l'écran » en un seul clic. 📸
   Cliquer sur l'une d'elles l'envoie aux écrans qu'elle nomme et nulle part ailleurs ; **[en:tran:Apply on Screens]**
   demande quand même, puisque ce choix revient à dire « envoie celle-ci ailleurs » — mais il
   ne change pas l'écran auquel la ligne est épinglée.
4. **Où se trouvent les actions dans le menu.** **[en:tran:Add Action]** commence par **[en:tran:Clear Screen]** —
   une ligne qui n'ajoute rien et ouvre les cinq effacements, avec **[en:tran:Other Clear FG Items]**
   en dessous pour les douze effacements par élément du premier plan — puis viennent **[en:tran:Screen: Show]** / **[en:tran:Screen: Hide]**, puis les cinq actions qui pilotent le déroulé.
