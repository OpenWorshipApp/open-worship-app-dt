---
id: W-16
title: "Paramètres : langue, thème, polices, dossiers"
section: "Configuration"
lang: fr
translatedFrom: 95ea9b97949a681a
---
# W-16 — Paramètres : langue, thème, polices, dossiers

**Objectif :** configurer l'application.

1. Cliquez sur l'**engrenage** ([en:tran:Setting]) dans l'en-tête — les Paramètres s'ouvrent dans leur propre fenêtre, sur **[en:tran:Path Settings]**. **[en:tran:App Assistant]** au-dessus de **[en:tran:Apply Settings]** en bas à gauche ouvre la fenêtre d'aide, pour poser une question sur n'importe quel réglage. 📸
2. **[en:tran:General]** (onglet) :
   - **[en:tran:Language] :** cliquez sur **English**, **ខ្មែរ** ou **Français**. Chaque langue est affichée sous son PROPRE nom, quelle que soit la langue dans laquelle vous êtes — ainsi, si un mauvais clic vous laisse dans une écriture que vous ne savez pas lire, le chemin du retour reste lisible. (Survolez un bouton et son `title` donne le nom anglais.) Certains libellés changent tout de suite, mais le changement n'est complet qu'une fois que vous avez cliqué sur **[en:tran:Apply Settings]** en bas à gauche — cela recharge toutes les fenêtres ouvertes. Les modifications non enregistrées dans l'Éditeur de diapositives sont conservées. La langue appartient à cet ordinateur, pas au dossier de données : passez à un autre dossier de données et l'application reste dans la langue que vous avez choisie.
   - **[en:tran:Theme] :** système / clair / sombre.
   - **[en:tran:Font Family] :** la police dans laquelle sont dessinées les fenêtres de l'application elle-même — pas le texte de l'écran de l'assemblée. Une police marquée `(Missing)` est configurée mais n'est pas installée sur cet ordinateur. Quand la police choisie existe en plusieurs graisses, une deuxième liste à côté permet d'en choisir une (`400 Regular`, `700 Bold`…) ; **[en:tran:Default]** garde la graisse propre à la police.
   - **Bouton de réinitialisation** (`Clear All Settings`) :
     **ce bouton efface la configuration ; à utiliser avec prudence.** Il demande d'abord une confirmation.
   - **[en:tran:Show Tips of the Day automatically] :** indique si le Présentateur et le Lecteur biblique affichent une astuce automatique après le prochain lancement de l'application.
   - Les tailles des panneaux ne se réinitialisent plus ici — voir **W-31**.
2a. **[en:tran:Path Settings]** (onglet, à côté de **[en:tran:General]**) : l'endroit où tout
    est stocké sur le disque.
   - **Dossiers :** l'endroit du disque où sont stockés les documents, les paroles et les Bibles. Un dossier de données est obligatoire : tout ce que vous créez et réglez — chants, diapositives, Bibles, notes et la plupart des réglages — y est conservé, pour pouvoir le sauvegarder, l'emporter sur une clé et le retrouver. Tant qu'aucun n'est choisi, chaque fenêtre sauf les Paramètres n'affiche que **[en:tran:No Parent Directory Selected]**, **[en:tran:Go to Settings]** et **[en:tran:App Assistant]**, et les Paramètres s'ouvrent d'eux-mêmes sur cet onglet, avec seulement **[en:tran:General]** (langue et thème) et **[en:tran:AI Providers]** à côté. Sous **[en:tran:Parent Directory:]**, **[en:tran:Suggested]** propose `.owa\open-worship-data` dans votre dossier utilisateur : **[en:tran:Use This Folder]** le crée s'il n'existe pas et l'utilise. **[en:tran:Found Data Folders]** liste les dossiers de données en haut des disques de cet ordinateur — un sur une clé USB — chacun avec **[en:tran:Switch]**. Rien n'est choisi à votre place. Un dossier choisi qui n'est pas là — une clé non branchée — compte comme aucun ; branchez-la et appuyez sur **[en:tran:Apply Settings]**. Un dossier de données sur le Bureau n'est jamais suggéré ; tant qu'il est utilisé, chaque fenêtre affiche la carte **[en:tran:Move Your Data Folder Off the Desktop]**, qui dit que le Bureau n'est pas un endroit sûr pour lui, avec **[en:tran:Move Now]** et **[en:tran:Hide for 30 days]** — voir **W-54**.
   - **[en:tran:Copy Data Folder]** (sous **[en:tran:Parent Directory:]**, quand un dossier est utilisé) : choisissez une clé USB, un autre disque ou un dossier, et une copie complète y est faite sous le nom `open-worship-data`, chaque fichier compté et vérifié. Les liens qu'elle contient pointent vers la copie elle-même : la copie ne lit ni ne modifie jamais les chants et images de l'original. Le dossier utilisé n'est pas modifié ; l'application propose ensuite de **[en:tran:Switch]** vers la copie.
   - **Pour tout garder ailleurs**, appuyez sur la ligne du dossier
     sous **[en:tran:Parent Directory:]** (le dossier en cours d'utilisation) et une case s'ouvre dessous : tapez
     le chemin complet du dossier (qui commence par le disque, comme `D:\`, ou par `/`) et appuyez sur Entrée, ou appuyez sur **[en:tran:Choose a folder]** et choisissez-le. Un dossier tapé qui n'existe pas encore est d'abord demandé (**[en:tran:Create Data Folder]**) et n'est créé qu'avec **[en:tran:Create]** ; vider la case ne change rien.
     L'application demande **[en:tran:Set according paths]** une seule fois, et **[en:tran:Yes]** crée dedans les
     dossiers standard (Documents, Videos, Images et les autres), les utilise et recharge. Ce que vous
     avez déjà n'est pas déplacé. Cela reste dans l'ancien dossier, où **[en:tran:Recent Folders]**
     ci-dessous vous ramène, ou bien une sauvegarde l'emporte avec elle (W-25).
   - **Pour revenir à un dossier de données utilisé auparavant.** Dans **[en:tran:Path Settings]**, sous **[en:tran:Parent Directory:]** → **[en:tran:Recent Folders]**, appuyez sur **[en:tran:Switch]** à côté du dossier, puis confirmez avec **[en:tran:Switch]** dans la boîte **[en:tran:Switch Data Folder]**. Toutes les fenêtres ouvertes se rechargent automatiquement sur ce dossier. La liste montre les dossiers précédemment utilisés par cet ordinateur, du plus récent au plus ancien, sauf celui en cours d'utilisation. Un dossier absent (une clé USB débranchée) indique **[en:tran:Missing]** et on ne peut pas y passer. **✕** retire un dossier de la liste ; le dossier lui-même n'est pas touché. La liste garde les 10 derniers et apparaît dès qu'un deuxième dossier a été utilisé. 📸
   - **[en:tran:Repair Links]** (à côté de **[en:tran:Reset All Child Directories]**) : après avoir apporté le dossier de données d'un autre ordinateur — une clé USB, un dossier copié — appuyez dessus une fois. Les images, vidéos et chants qui pointent encore vers l'endroit où se trouvait AUPARAVANT le dossier sont redirigés vers l'endroit où il est maintenant ; un lien vers quelque chose qui existe encore est laissé tel quel. Une fenêtre indique combien de liens ont été réparés, et l'application se recharge pour les afficher. 📸
   - **Bouton de réinitialisation** (`Reset All Child Directories`) :
     **ce bouton efface la configuration ; à utiliser avec prudence.** Il demande d'abord une confirmation.
3. **[en:tran:Bible]** (onglet) : importer une Bible XML depuis un fichier ou une URL, modifier les Bibles XML installées, ou exporter/importer une archive **[en:tran:Bible Data]**. L'ancienne liste des versions en ligne est réservée au développement et peut être indisponible. 📸
   **Une Bible installée n'a pas d'interrupteur marche/arrêt.** Toutes les Bibles de cette liste sont proposées partout où l'on choisit une version. Pour qu'une Bible ne soit plus proposée, retirez-la de l'ordinateur : l'icône de corbeille sur sa ligne, **[en:tran:Move to Trash]**, ouvre une confirmation intitulée **[en:tran:Delete Bible XML]**. Appuyez sur **[en:tran:Yes]** dans cette boîte pour envoyer son fichier dans la Corbeille, d'où elle peut être récupérée ou importée à nouveau.
4. **[en:tran:AI Providers]** (onglet) : le commutateur principal de l'IA, les clés des
   fournisseurs et les serveurs personnalisés — voir **W-42**.
5. Cliquez sur **[en:tran:Apply Settings]** (en bas à gauche) pour appliquer — les fenêtres de l'application se rechargent.
