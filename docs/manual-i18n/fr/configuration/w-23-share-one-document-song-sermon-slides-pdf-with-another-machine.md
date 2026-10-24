---
id: W-23
title: "Partager un seul document (chant, diapositives de prédication, PDF) avec une autre machine"
section: "Configuration"
lang: fr
translatedFrom: 7a5c2885b43579cd
---
# W-23 — Partager un seul document (chant, diapositives de prédication, PDF) avec une autre machine

Parfois, vous ne voulez transmettre qu'**un seul** élément, pas tout un culte. Un document
voyage dans son propre paquet, avec tout ce qui lui est attaché.

1. Dans la liste **[en:tran:Documents]**, faites un clic droit sur l'élément voulu — un document de
   diapositives Open Worship, un chant, un PDF, un fichier PowerPoint ou Word, tout fonctionne — et
   choisissez **[en:tran:Export]**. 📸
2. Un petit panneau demande un **[en:tran:Password]** et un **[en:tran:Confirm Password]**. Laissez les deux vides et appuyez sur **[en:tran:Ok]** pour le paquet ordinaire, ou
   tapez le même mot de passe dans les deux pour le verrouiller — voir W-22 étape 10a ; cela fonctionne
   de la même façon ici, et il n'existe aucun moyen de récupérer un mot de passe oublié. 📸
3. Vous obtenez un seul fichier `<name>.owadoc.tar.gz` dans votre dossier **Téléchargements** (ou
   `<name>.owadoc.enc` si vous avez défini un mot de passe), et le dossier s'ouvre. Il contient le
   document lui-même, plus tout ce qui s'y rattache : l'arrière-plan que vous lui avez attaché
   (et le fichier image ou vidéo de cet arrière-plan), toute vidéo placée dans ses diapositives, et
   sa note de couleur.
4. Sur l'autre machine, faites un clic droit sur une partie vide de la liste **[en:tran:Documents]** →
   **[en:tran:Import]** et choisissez ce fichier — ou bien **faites simplement glisser le fichier
   `.owadoc.tar.gz` (ou `.owadoc.enc`) depuis votre gestionnaire de fichiers sur la liste
   Documents**, ce qui l'importe de la même façon. Un paquet protégé demande d'abord son mot de
   passe ; un paquet ordinaire ne le demande jamais. 📸
5. Le document apparaît dans le dossier de documents de cette machine sous son nom d'origine, avec
   son arrière-plan rattaché et sa note de couleur restaurée : il est donc prêt à être présenté
   tout de suite.
6. Si le paquet se trouve sur un serveur web ou sur une machine qui le partage sur le réseau local,
   utilisez plutôt **[en:tran:Import From URL]** et collez le lien. Le
   téléchargement va dans un dossier temporaire, est importé exactement comme ci-dessus, puis
   supprimé.

> Remarques : les mêmes règles que pour un paquet de déroulé s'appliquent. Un fichier déjà présent
> **avec le même contenu** est réutilisé au lieu d'être dupliqué, donc importer deux fois est sans
> risque ; un fichier du même NOM qui est en réalité un fichier différent n'est pas touché, et celui du
> paquet arrive à côté sous le nom `a (1).pdf`. Un document qui a déjà un arrière-plan attaché garde le
> sien — une importation ne l'écrase jamais, et elle n'écrase pas non plus la note de couleur de ce
> document. L'importation exige que les dossiers dans lesquels elle écrit soient **déjà choisis** (pour
> un document avec un arrière-plan vidéo, le dossier Vidéos aussi), et s'il en manque un,
> l'importation s'arrête avant de copier quoi que ce soit et vous dit lequel choisir.
>
> Si vous exportez deux fois le même document, le second fichier s'appelle
> `<name> (1).owadoc.tar.gz`. Ce nom se termine toujours par `.owadoc.tar.gz` : faire glisser
> _cette_ copie sur la liste l'importe donc comme la première (un `<name>.owadoc.tar (1).gz`
> écrit par une ancienne version de l'application est accepté de la même façon).


> Cela fonctionne aussi pour un **chant** — un chant est une ligne de la même liste Documents. Son
> paquet contient le chant plus chaque arrière-plan que vous avez attaché à ses diapositives : le chant
> arrive donc sur l'autre machine avec déjà l'apparence que vous lui avez donnée.
