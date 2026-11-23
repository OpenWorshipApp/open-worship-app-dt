---
id: W-08
title: "Définir l'arrière-plan (couleur / image / vidéo / web)"
section: "Présenter du contenu"
lang: fr
translatedFrom: e377209f7e258134
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
   - **[en:tran:Category]**, au-dessus des tuiles, choisit l'occasion pour laquelle elles sont faites : un
     culte du dimanche, **[en:tran:Christmas]**, **[en:tran:Thanksgiving]**, un mariage, une
     saison, un thème — 57 en tout, en six groupes. Une catégorie montre chaque effet des deux
     sortes dans ses couleurs, d'abord ceux qui la caractérisent, certains en plusieurs versions :
     **[en:tran:Christmas]** s'ouvre sur quatre chutes de neige de chaque sorte (**[en:tran:Snowfall]**,
     _Chute de neige 2_ … _Chute de neige 4_), puis des nuits étoilées et des bougies. Un jour solennel
     laisse de côté **[en:tran:Fireworks]**, **[en:tran:Confetti]** et **[en:tran:Hearts]** ; un jour
     d'été laisse de côté la neige. En plus de la neige, des étoiles, des rayons de lumière, des nuages,
     des vagues, d'une croix et du reste, les deux sortes dessinent **[en:tran:Falling Leaves]**,
     **[en:tran:Fireworks]**, **[en:tran:Petals]**, **[en:tran:Candlelight]**, **[en:tran:Confetti]**
     et **[en:tran:Hearts]**. La liste garde la catégorie que vous avez choisie ; tant que vous n'en avez
     choisi aucune, elle s'ouvre sur la catégorie de l'animation que l'écran affiche.
   - **[en:tran:Dark]** / **[en:tran:Light]** en haut, comme dans **[en:tran:Fills]**, fait passer
     les tuiles de chaque catégorie de fonds profonds, sur lesquels se lisent des mots blancs, à des
     fonds pâles, sur lesquels se lisent des mots noirs — les mêmes effets dans le même ordre, dans les
     couleurs claires de l'occasion. Le nom d'une tuile claire se termine par _(Clair)_ :
     _Noël - Chute de neige (Clair)_. Le sélecteur s'ouvre du côté de l'animation que l'écran affiche,
     et ne change de lui-même que lorsqu'une tuile de l'autre côté est mise à l'écran.
   - Épinglez une tuile pour la garder sous la main, quels que soient la catégorie ou le côté : l'épingle dans son coin
     supérieur (elle apparaît sous le pointeur), ou **[en:tran:Pin]** dans son menu du clic droit. Elle rejoint
     **[en:tran:Pinned]** au-dessus de **[en:tran:Category]**, dans l'ordre où vous les avez épinglées, dans
     le panneau **[en:tran:Background]** comme dans **[en:tran:Animation Show]**, tuiles sombres et claires
     ensemble quel que soit le côté affiché ; appuyer sur une tuile épinglée ne change pas la catégorie. **[en:tran:Unpin]** la retire. On peut en épingler trente ;
     ensuite l'épingle indique **[en:tran:Unpin one to pin another]**.
   - **[en:tran:Customize]**, à côté des tuiles quand un écran affiche une animation, change son
     **[en:tran:Effect]**, ses couleurs (la première est la **[en:tran:Background Color]**, chacune
     avec sa propre **[en:tran:Opacity]**), **[en:tran:Speed]**, **[en:tran:Density]** (CSS)
     ou **[en:tran:Quality]** (un shader : plus bas, il pèse moins sur un vieil ordinateur), l'**[en:tran:Opacity]** de toute
     l'animation et son **[en:tran:Blend Mode]** avec ce qu'il y a derrière
     l'écran ; l'écran suit une demi-seconde après votre dernier changement. **[en:tran:Save as Preset]**
     la garde comme un bouton sous **[en:tran:Presets]**.
   - **[en:tran:Edit Code]** ouvre le code de l'animation choisie à côté d'un aperçu animé :
     **[en:tran:Shader Code]** pour un shader, **[en:tran:CSS Code]** pour une animation CSS
     — une animation intégrée aussi. Tant qu'il est ouvert, il suit l'animation : cliquez
     sur une autre tuile de sa sorte, ou choisissez un autre **[en:tran:Effect]**, et son code
     arrive (une tuile de l'autre sorte le ferme) ; une couleur, la vitesse ou la densité n'y change rien. Une erreur s'affiche sous
     l'aperçu, et **[en:tran:Apply]** attend qu'il n'y en ait plus ; **[en:tran:Reset]**
     remet le code de l'animation choisie. De courts shaders écrits pour Shadertoy (un
     `mainImage`, sans textures) peuvent y être collés.
   - **[en:tran:CSS Code]** s'ouvre sur l'effet CSS choisi, écrit en CSS (Rayons de lumière
     avec ses nappes de rayons, Nuages avec ses nuages), ou sur le code propre d'une
     animation **[en:tran:Custom CSS]**. Une fois appliqué, l'animation devient
     **[en:tran:Custom CSS]** : laissé tel quel, il rend l'effet comme avant ; modifié, il
     est à vous. Le CSS met en forme des boîtes que l'application dessine : `.scene` (toute
     l'image), six `.layer` à l'intérieur et des points (`.dot`) dans chaque couche, autant
     que l'indique **[en:tran:Density]** (`--density` vaut 0, 1 ou 2) ; utilisez
     `var(--color-1)` à `var(--color-4)`, ou `var(--accent)` — une couleur après la
     première, la suivante pour chaque couche et chaque point à tour de rôle — et les
     pastilles de couleur le changent toujours. Pour rester léger sur un vieil ordinateur et sûr à
     l'écran, il ne peut rien charger (ni `url()` ni `@import`) et ses `@keyframes` peuvent
     seulement déplacer, tourner, agrandir ou estomper (`transform`, `opacity`) — la ligne
     d'erreur dit quoi changer.
   - Le 🤖 (**[en:tran:Open in Chatbot]**) au bout de la ligne **[en:tran:Customize]**,
     et dans la barre de titre du panneau de code, ouvre la fenêtre d'aide sur cette
     animation : elle dit ce que l'assistant peut changer et propose trois choses à
     demander, comme **[en:tran:Make it slower]**, **[en:tran:Explain the shader code]** ou,
     pour une animation CSS, **[en:tran:Explain the CSS code]**. Demandez avec vos propres
     mots : l'assistant change ce que **[en:tran:Customize]** change, et écrit ou corrige le
     code dans son panneau, en ne le mettant à l'écran qu'une fois qu'il fonctionne.
   - Clic droit sur une tuile → **[en:tran:Copy Code]** pour emporter l'animation ailleurs : une
     animation CSS comme une page web complète (collez-la dans un fichier de page à vous dans l'Éditeur de page web,
     W-15, et l'onglet **[en:tran:Webs]** l'affiche), un shader comme son code.
   - **[en:tran:Save as image] (PNG)** et **[en:tran:Save as video] (MP4)**, les deux
     boutons à droite de l'aperçu de **[en:tran:Customize]**, gardent l'animation dans un fichier.
     Chacun demande sa **[en:tran:Resolution]** (les tailles courantes, celles de vos écrans, ou
     **[en:tran:Custom]**) ; une vidéo demande aussi sa **[en:tran:Duration]** en secondes
     et sa **[en:tran:Frame Rate]** (24, 30 ou 60). Le fichier va dans le dossier de la
     session en cours de **[en:tran:Images]** ou de **[en:tran:Videos]** — depuis
     **[en:tran:Animation Show]**, de **[en:tran:Image Show]** ou de **[en:tran:Video Show]** —,
     nommé d'après l'animation et sa taille, prêt à être affiché ; sans dossier défini là, il le
     dit et n'enregistre rien. Une image garde ses parties transparentes. Une vidéo est dessinée
     image par image, sa notification comptant **[en:tran:Exporting]** jusqu'à 100 % avec un
     **[en:tran:Stop]** qui ne laisse aucun fichier derrière lui. 📸
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

**Sessions et diaporama sur Remplissages et Animations.** Les onglets **[en:tran:Fills]** et
**[en:tran:Animations]** ont la même rangée de boutons de session au-dessus de leurs vignettes :
**[en:tran:Default]**, puis celles que vous ajoutez avec **＋**. Une session y garde ses propres remplissages ou
animations enregistrés sous **[en:tran:Presets]**, si bien que l'une peut tenir les couleurs de cette saison et une
autre celles du culte des jeunes ; ceux de la session par défaut sont aussi ceux que proposent **[en:tran:Fill Show]**
et **[en:tran:Animation Show]** (W-09). Supprimer une session oublie ses enregistrés et son diaporama. Dès qu'un
écran affiche le genre de l'onglet, la rangée porte aussi le diaporama : appuyez sur **[en:tran:Start Slide Show]** (▶)
et, toutes les tant de secondes — le nombre à côté —, chaque écran qui en affiche un passe à la vignette suivante
de la rangée où se trouve celle affichée : l'enregistré suivant de la session quand celui affiché en fait
partie, sinon le suivant des **[en:tran:Pinned]** quand il est épinglé, sinon le shader ou l'animation CSS
suivant de sa catégorie de son côté, dans l'ordre où les vignettes sont dessinées, ou le dégradé ou le motif suivant du
côté **[en:tran:Dark]** / **[en:tran:Light]** où il se trouve. La façon dont l'écran l'avait ajusté et stylé l'accompagne. Une couleur
de la palette, ou une vignette modifiée dans **[en:tran:Customize]**, n'appartient à aucune rangée et reste en
place. Un écran n'a qu'un arrière-plan, donc un onglet ne fait tourner qu'un diaporama : le lancer dans une autre
session arrête le premier, et le ▶ bleu passe sur le bouton de cette session. **[en:tran:Clear Background]**
(**F7**) arrête le diaporama, et afficher une vignette ensuite ne le relance pas.
