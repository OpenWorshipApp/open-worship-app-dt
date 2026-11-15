---
id: W-08
title: "Définir l'arrière-plan (couleur / image / vidéo / web)"
section: "Présenter du contenu"
lang: fr
translatedFrom: 11a9e9b10fc20174
---
# W-08 — Définir l'arrière-plan (couleur / image / vidéo / web)

**Objectif :** placer quelque chose derrière votre contenu.

1. Repérez le panneau **[en:tran:Background]** en bas de la colonne du milieu,
   ouvert avec ses onglets visibles. S'il a été replié en une fine barre, cliquez sur la
   barre et le panneau s'ouvre de nouveau. 📸
2. Choisissez un onglet : **[en:tran:Fills] / [en:tran:Animations] / [en:tran:Images] / [en:tran:Videos] / [en:tran:Cameras] / [en:tran:Webs]**.
   - **[en:tran:Fills] :** une couleur unie, un dégradé ou un motif. Cliquez sur une pastille de couleur, ou sur une tuile
     sous **[en:tran:Gradients]** ou **[en:tran:Patterns]**. **[en:tran:Dark]** /
     **[en:tran:Light]**, en haut, fait passer les rangées du dessous de teintes profondes à des teintes pâles. Une tuile
     marquée d'un petit signe de vent bouge à l'écran ; la tuile elle-même et le Mini-écran restent immobiles. Si une
     couleur risque de gêner la lecture du texte biblique, l'application change la couleur du texte pour qu'il reste visible
     et le signale dans un message avec son propre bouton **[en:tran:Undo]** — elle ne demande rien. 📸
   - Dès qu'un écran affiche un remplissage, l'onglet a une section pour chacun de ces écrans. La flèche à
     gauche de sa ligne, dans la couleur de cet écran, replie la section sur cette ligne, qui montre alors
     le numéro de l'écran et ce qu'il affiche ; appuyez de nouveau sur la flèche pour l'ouvrir.
   - **[en:tran:Customize]**, à côté des tuiles quand un écran affiche un dégradé ou un motif,
     change ses couleurs, **[en:tran:Type]**, **[en:tran:Angle]**, **[en:tran:Size]** et
     **[en:tran:Speed]** ; l'écran suit une demi-seconde après votre dernier changement. Chaque couleur a son propre
     curseur **[en:tran:Opacity]** à côté d'elle (0 laisse voir ce qu'il y a derrière l'écran, 255
     la rend opaque), et sa pastille est dessinée aussi pâle sur un damier. Le bouton des curseurs, au bout
     de la ligne **[en:tran:Gradients]**, l'ouvre et le ferme.
   - **[en:tran:Save as Preset]**, sous les motifs, garde ce qui est affiché comme un bouton à part
     sous **[en:tran:Presets]**.
   - Clic droit sur une tuile de dégradé ou de motif, ou sur un bouton enregistré, → **[en:tran:Copy CSS]** pour
     emporter son CSS ailleurs, à la taille d'un écran. Une tuile immobile se copie en lignes de CSS ; une
     tuile animée en une courte feuille de style qui la fait bouger comme à l'écran — mettez la classe
     `owa-fill` sur ce qu'elle doit remplir.
   - **[en:tran:Animations] :** un arrière-plan animé fait pour le culte — neige, rayons de lumière,
     lever de soleil, flammes, croix dans la gloire — de deux sortes : **[en:tran:CSS Animations]**, assez légères
     pour n'importe quel ordinateur, et **[en:tran:GLSL Shaders]**, dessinés par la carte graphique.
     Chaque tuile est immobile ; posez le pointeur dessus pour la voir bouger, et cliquez dessus pour la mettre à
     l'écran. Seul l'écran bouge : le Mini-écran et chaque aperçu montrent une seule image
     fixe. 📸
   - **[en:tran:Customize]**, à côté des tuiles quand un écran affiche une animation, change son
     **[en:tran:Effect]**, ses couleurs (la première est la **[en:tran:Background Color]**, chacune
     avec sa propre **[en:tran:Opacity]**), **[en:tran:Speed]**, **[en:tran:Density]** (CSS)
     ou **[en:tran:Quality]** (un shader : plus bas, il pèse moins sur un vieil ordinateur), l'**[en:tran:Opacity]** de toute
     l'animation et son **[en:tran:Blend Mode]** avec ce qu'il y a derrière
     l'écran ; l'écran suit une demi-seconde après votre dernier changement. **[en:tran:Save as Preset]**
     la garde comme un bouton sous **[en:tran:Presets]**.
   - Le bouton **[en:tran:Edit Code]** d'un shader ouvre **[en:tran:Shader Code]** : son code à côté d'un
     aperçu animé. Une erreur s'affiche sous l'aperçu avec sa ligne, et
     **[en:tran:Apply]** attend qu'il n'y en ait plus ; **[en:tran:Reset]** remet le code
     tel qu'il était. De courts shaders écrits pour Shadertoy (un `mainImage`, sans textures) peuvent y être
     collés.
   - Clic droit sur une tuile → **[en:tran:Copy Code]** pour emporter l'animation ailleurs : une
     animation CSS comme une page web complète (collez-la dans un fichier de page à vous dans l'Éditeur de page web,
     W-15, et l'onglet **[en:tran:Webs]** l'affiche), un shader comme son code.
   - **[en:tran:Images] / [en:tran:Videos] :** **cliquez** sur un élément pour en faire l'arrière-plan en direct ;
     cliquez de nouveau sur le même élément pour le retirer. 📸
   - **[en:tran:Cameras] :** choisissez une caméra branchée.
   - **[en:tran:Webs] :** cliquez sur une page enregistrée, ou utilisez le **⋮** à côté du chemin du dossier (ou
     faites un clic droit sur la liste vide) → **[en:tran:Add URL]** pour en ajouter une (une petite case demande
     l'adresse web ; l'Éditeur de page web, W-15, sert pour un fichier de page qui vous appartient).
     **Une adresse enregistrée ne peut pas être modifiée.** Pour la changer, faites un clic droit sur sa tuile →
     **[en:tran:Remove URL]** (une confirmation est demandée, et ce choix n'est pas proposé tant que cette page est sur un
     écran), puis **[en:tran:Add URL]** avec la nouvelle adresse — avec le **⋮** de l'onglet, à
     droite du chemin du dossier, ou par un clic droit sur une partie vide de la liste.
3. L'onglet de l'arrière-plan en direct porte le point « à l'écran » devant son nom (par ex. `● Videos`).
4. Appuyez sur **F7** ([en:tran:Clear Background]) pour le retirer.

**Vue en miniatures ou vue en liste (Images / Vidéos / Sites web).** Par défaut, chaque onglet affiche
des aperçus en images. Si vous avez beaucoup de fichiers — ou si l'application semble lente sur une
machine ancienne — passez à une simple liste de noms : cliquez sur le petit bouton **⋯** en bas à gauche du panneau Arrière-plan
(**[en:tran:Reveal Hidden Controls]**) pour faire apparaître la barre du bas, puis
cliquez sur l'icône **liste** (`☰`, **[en:tran:List View]**) tout à droite de celle-ci ; l'icône **grille**
à côté (**[en:tran:Thumbnail View]**) permet de revenir. 📸 La liste affiche le nom complet de chaque fichier (avec son extension), les écrans sur lesquels il est
affiché et son point de couleur — cliquer sur une ligne le met toujours à l'écran, exactement comme une
miniature. Chaque onglet retient son propre choix, même après un redémarrage de l'application. Le
curseur de taille des miniatures n'apparaît qu'en vue en miniatures.

**Sessions de dossiers (Images / Vidéos / Sites web / Audios).** Au-dessus de chacune de ces listes se trouve une
rangée de petits boutons : **[en:tran:Default]**, puis ceux que vous ajoutez avec **＋**. Chacun est un dossier
à part — avec son propre mode d'affichage, son tri et son diaporama — pour passer des
images de ce dimanche sur une clé USB à votre série habituelle d'arrière-plans sans jamais
changer le dossier avec lequel l'application a été configurée. **[en:tran:Default]** EST ce dossier : c'est
celui que nomment les Paramètres des chemins, et ajouter des sessions n'y touche jamais. Une nouvelle session commence
sans dossier et propose d'utiliser celui par défaut. Pour qu'une session lise un dossier à vous, appuyez sur la ligne du dossier au-dessus de la liste (le chemin qu'elle lit) : une case s'ouvre dessous — tapez le chemin du dossier et appuyez sur Entrée, ou appuyez sur **[en:tran:Choose a folder]** (l'icône de dossier) et choisissez-le. Le **⋮** de la session sur laquelle vous êtes (ou un
clic droit sur n'importe laquelle) la renomme ou la supprime — la session **[en:tran:Default]** peut être renommée,
jamais supprimée. Supprimer oublie le dossier et le diaporama
de cette session — jamais les fichiers eux-mêmes. **[en:tran:Documents]**, **[en:tran:Presenting Flows]**, **[en:tran:Bibles]**
et **[en:tran:Bible Notes]** ont la même rangée sous leur titre (W-58). Dans les onglets Images, Vidéos et Sites web,
le diaporama se trouve sur la même rangée, et un ▶ bleu sur un bouton signifie que le diaporama de cette session
continue pendant que vous en regardez une autre.
