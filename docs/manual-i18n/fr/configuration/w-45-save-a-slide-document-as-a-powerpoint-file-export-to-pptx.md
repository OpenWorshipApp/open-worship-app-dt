---
id: W-45
title: "Enregistrer un document de diapositives en fichier PowerPoint (Exporter en PPTX)"
section: "Configuration"
lang: fr
translatedFrom: 141db5a352120554
---
# W-45 — Enregistrer un document de diapositives en fichier PowerPoint (Exporter en PPTX)

Pour quand un document de diapositives doit être montré ou modifié là où cette application n'est pas — l'ordinateur portable d'un prédicateur invité, une église qui utilise PowerPoint, Google Slides ou Keynote. Contrairement à **[en:tran:Export]** (W-23), qui transporte le document vers une autre application Open Worship, ceci crée un fichier PowerPoint que tout le monde peut ouvrir.

1. Dans la liste **[en:tran:Documents]**, faites un clic droit sur un document de diapositives Open Worship (ou appuyez sur le **⋮** au bout de sa ligne) et choisissez **[en:tran:Export to PPTX]**. Il se trouve juste sous **[en:tran:Export]**. 📸
2. Pour un chant, sélectionnez sa ligne pour que l'**[en:tran:Stage Previewer]** s'ouvre. Ajoutez ou retirez des scènes jusqu'à ce que les mises en page voulues soient visibles, puis appuyez sur le **⋮** dans l'en-tête de l'aperçu des scènes et choisissez **[en:tran:Export to PPTX]**. L'application écrit une présentation par scène visible : `<song> - Stage 0.pptx`, `<song> - Stage 1.pptx`, et ainsi de suite. Chaque présentation utilise la mise en page et le style de paroles propres à cette scène. 📸
3. Un message **[en:tran:Export to PPTX]** apparaît, indiquant **[en:tran:Exported to]** et l'emplacement : un `<name>.pptx` dans votre dossier **Téléchargements**, qui s'ouvre avec le fichier dedans. L'export d'un chant n'ouvre le dossier Téléchargements qu'une seule fois ; exporter de nouveau ajoute des copies numérotées à côté des présentations précédentes. 📸
4. Ouvrez-le dans PowerPoint. Chaque diapositive ressemble à ce que montre l'écran :
   - les mots restent des mots que vous pouvez modifier, coupés en lignes exactement là où l'application les coupe, dans la même police — et, là où cette police n'a pas de lettre pour une partie du texte (l'anglais dans un titre khmer), dans la police que l'application a utilisée à la place ;
   - les zones de texte gardent leur couleur, leur remplissage transparent et leurs coins arrondis, et une zone qui floute ce qui est derrière elle porte ce flou sous forme d'image en dessous ;
   - les images gardent leur place et leur taille ; une vidéo devient sa première image et une zone de site web son image de la page ;
   - derrière chaque diapositive se trouve l'arrière-plan que l'écran montrerait : celui de la diapositive, sinon celui du document, sinon celui que la diapositive précédente a laissé affiché — ainsi les diapositives qui suivent un arrière-plan vidéo le gardent, comme quand vous les présentez dans l'ordre. 📸
5. Tout ce que vous avez écrit dans la **[en:tran:Slide Note]** d'une diapositive se trouve dans les **Notes** de cette diapositive dans PowerPoint, et une diapositive que vous avez désactivée devient une diapositive **masquée**, sautée pendant le diaporama.

> Remarques : un document de diapositives s'exporte depuis le menu de sa ligne ; un chant s'exporte depuis l'en-tête de
> l'aperçu des scènes, car chaque scène visible est une mise en page rendue séparément. Un fichier PDF,
> PowerPoint ou Word de la liste est déjà son propre fichier. Le
> fichier est une copie : le modifier ne change rien dans l'application. Une zone YouTube devient l'image de la
> vidéo quand l'ordinateur est en ligne ; une zone caméra, un arrière-plan caméra et une
> page web en direct utilisée comme arrière-plan ne peuvent pas être exportés, de même que l'impression les laisse de côté.
> PowerPoint sur un autre ordinateur utilise les polices de CET ordinateur-là ; pour le même rendu, installez-y
> les mêmes polices (les lignes se coupent aux mêmes endroits dans tous les cas).
