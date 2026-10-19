---
id: W-22h
title: "Lire automatiquement la vidéo ou le chant d'une diapositive (contrôle média)"
section: "Configuration"
lang: fr
translatedFrom: a2c8b65996090485
---
# W-22h — Lire automatiquement la vidéo ou le chant d'une diapositive (contrôle média)

**Objectif :** le déroulé appuie pour vous sur lecture pour la vidéo ou l'audio propre à une diapositive — à partir de l'endroit que vous indiquez, pendant la durée que vous indiquez.

1. **Contrôle média — lire automatiquement la vidéo ou le chant d'une diapositive.** Une diapositive peut contenir sa propre vidéo ou son propre extrait audio, et normalement vous appuyez sur lecture à la main sur le mini-écran. Clic droit sur la diapositive (ou sur la ligne du document, ou sur la ligne d'une diapositive dans un document) → **[en:tran:Add Media Control]**, et le déroulé le fait pour vous. Un panneau de réglages s'ouvre d'abord — rien n'est ajouté tant que vous n'appuyez pas sur **[en:tran:Ok]** :

   - **[en:tran:Action]** — **[en:tran:Play]**, **[en:tran:Pause]** ou **[en:tran:Stop]**. Lire lance le média ; Pause le laisse où il en est ; Arrêter le met en pause et le ramène au point de départ, pour que la même ligne puisse resservir. Mettez une Pause ou un Arrêter sur une ligne suivante pour couper un extrait avant la fin.
   - **[en:tran:Delay Before]** — attendre ce nombre de secondes après l'affichage de la diapositive avant de faire quoi que ce soit. Laissez 0 pour agir tout de suite.
   - **[en:tran:Media Start At]** — où commencer dans l'extrait, en secondes.
   - **[en:tran:Then Pause]** — **[en:tran:Never]**, **[en:tran:After]** un certain nombre de secondes de lecture, ou **[en:tran:At Media Time]** pour s'arrêter à un point de l'extrait lui-même (ainsi « lire de 0:10 à 1:10 » tient en deux nombres, sans chronomètre).
   - **[en:tran:Volume]** et **[en:tran:Speed]** — chacun derrière une case à cocher, car en laisser une décochée veut dire « n'y touchez pas » : le niveau que vous avez réglé à la main sur le mini-écran reste tel quel.
   - **[en:tran:Set Specific Screen]** — laissez toutes les cases vides et cela agit sur tous les écrans où la diapositive est allée. Cochez-en une et cela n'agit **que** là où la diapositive est aussi arrivée. Cela contrôle le média que la diapositive a mis sur un écran, donc un écran que la diapositive n'a jamais atteint n'a rien à contrôler.
2. La nouvelle ligne apparaît comme élément CC sous la diapositive, en indiquant ce qu'elle fera — `Slide: Media Control (Play +3s 10s→70s 70% 2x)` — avec un petit **engrenage cyan** à sa droite. Cliquez sur l'engrenage (ou clic droit → **[en:tran:Media Control Settings]**) pour le modifier plus tard ; il s'ouvre sur ce que vous avez réglé la dernière fois. Une simple ligne `Slide: Media Control` est aussi ajoutée à la fin de la liste : le CC pointe vers cette ligne, alors laissez-la là — la retirer retire le contrôle avec elle. 📸

   Toutes les vidéos et tous les extraits audio de cette diapositive sont pilotés ensemble. Le son sort de l'ordinateur du présentateur, exactement comme quand vous appuyez sur lecture à la main, donc le **[en:tran:Volume]** est le niveau que vous entendez à la régie ; l'écran projeté reste muet et suit simplement le rythme, à la même vitesse.
3. **Quitter la diapositive l'arrête.** Quand vous mettez une autre diapositive sur cet écran — ou que vous effacez l'écran — tout ce que le contrôle média a lancé est arrêté et tout ce qui attend encore (un « arrêt à 1:10 », un départ différé) est abandonné, pour que rien ne se reporte sur ce que vous affichez ensuite. C'est ce qui permet au déroulé de continuer : un extrait que vous avez lancé **à la main** sur le mini-écran bloque la diapositive suivante jusqu'à ce que vous le mettiez en pause (l'application affiche **[en:tran:Media is Playing]**), car là l'application ne peut pas savoir que vous vouliez le laisser tourner — mais un extrait lancé par le déroulé, c'est au déroulé de l'arrêter. 📸

   Celui-ci ne s'attache jamais qu'à une diapositive : vous ne le trouverez pas sous **[en:tran:Add Action]** sur le déroulé lui-même, car « lancer cette vidéo à dix secondes » est une phrase qui concerne une diapositive précise.
