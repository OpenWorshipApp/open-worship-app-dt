---
id: W-33
title: "Partager vos traductions de la Bible (XML) avec une autre machine"
section: "Raccourcis clavier (annexe du tutoriel)"
lang: fr
translatedFrom: 758f7fbc875f8b0f
---
# W-33 — Partager vos traductions de la Bible (XML) avec une autre machine

Partager une **liste biblique** ne transporte que les versets que vous avez alignés. Ceci partage les
**traductions elles-mêmes** : les Bibles XML que vous avez ajoutées ou modifiées sous
**Paramètres → [en:tran:Bible]**, qui jusqu'ici ne pouvaient être déplacées qu'en allant chercher les
fichiers à la main.

1. Ouvrez **[en:tran:Bible]**. Sous la case **[en:tran:Import XML File]** à gauche se trouve une carte intitulée **[en:tran:Bible Data]**. 📸
2. Cliquez sur **[en:tran:Export Bible Data]**. Un panneau s'ouvre et liste chaque
   traduction que vous avez, une ligne pour chacune, avec sa **clé** courte (`KJV`, `GKHB`, `ពគប`…)
   et son titre complet. Tout est coché au départ. Décochez celles que vous ne voulez pas, ou utilisez
   **[en:tran:Deselect All]** puis choisissez-en seulement quelques-unes. 📸
3. Sous la liste, la même paire **[en:tran:Password]** / **[en:tran:Confirm Password]** que pour toutes
   les autres exportations : laissez les deux vides pour le paquet ordinaire, ou tapez le même mot de passe
   dans les deux pour le verrouiller. Si vous les tapez différemment, l'application vous indique
   **[en:tran:Passwords do not match]** dans le panneau lui-même et le rouvre aussitôt — avec toujours les
   Bibles que vous aviez cochées et le mot de passe que vous aviez tapé — si bien qu'un mot de passe mal
   tapé ne peut jamais produire en silence un fichier non protégé, et que vous n'avez jamais à choisir vos
   traductions une deuxième fois.
4. Cliquez sur **[en:tran:Ok]**. Vous obtenez un seul fichier `Bible Data.owabdata.tar.gz` dans votre
   dossier **Téléchargements** (ou `Bible Data.owabdata.enc` si vous avez mis un mot de passe), et le
   dossier s'ouvre dessus. Le fichier est compressé, donc deux ou trois traductions ne font que quelques
   Mo (une Bible entière y prend environ 1–2 Mo).
5. Sur l'autre machine, ouvrez **Paramètres → [en:tran:Bible]** et **faites glisser le fichier n'importe
   où sur cette page** — toute la zone des paramètres de la Bible l'accepte, pas seulement la petite carte.
   Ou cliquez sur **[en:tran:Import Bible Data]** et sélectionnez-le. Un paquet
   protégé demande d'abord son mot de passe, et affiche **[en:tran:Wrong password, try again]** au lieu
   d'échouer tout de suite. 📸
6. Un panneau liste ce qu'il contient. Tout ce qui peut être importé est coché. Ce qui **ne peut pas**
   l'être apparaît comme une **ligne rouge** que vous ne pouvez pas cocher, avec la raison à droite :
   - **[en:tran:Bible key already exists]** — vous avez déjà une
     traduction avec cette clé. Les majuscules et les minuscules comptent comme la même clé, donc un `kjv`
     dans le paquet est refusé face à un `KJV` que vous avez déjà.
   - **[en:tran:Duplicate bible key in this archive]**
     — deux entrées du même paquet revendiquent la même clé ; la première est proposée.
   - **[en:tran:Unable to read this bible file]** — l'application
     n'a pas pu lire de clé de Bible dans ce fichier, elle ne peut donc pas le vérifier et n'y touchera
     pas. 📸
7. Cliquez sur **[en:tran:Ok]**. Les traductions cochées sont ajoutées et la liste de droite se met à jour
   pour les afficher. Un message vous dit combien ont été importées et combien ont été ignorées.

> Remarques : une importation ne **remplace jamais** une traduction que vous avez déjà, et ne vous laisse
> jamais avec deux copies de la même. C'est tout l'intérêt des lignes rouges — là où les documents et les
> arrière-plans ajoutent une deuxième copie sous le nom `a (1).mp4`, une Bible est identifiée par sa clé,
> et deux Bibles avec la même clé seraient ambiguës partout ailleurs dans l'application. Si vous voulez
> vraiment la version qui arrive, supprimez d'abord la vôtre (le 🗑 à côté) et importez à nouveau.
>
> Seules les traductions **XML** sont dans le paquet — celles listées sous **[en:tran:Bibles XML]**.
> Les versions de la Bible que vous avez téléchargées dans l'application n'y sont pas : elles font des
> centaines de Mo et peuvent simplement être téléchargées à nouveau sur l'autre machine.
>
> La vérification se fait sur le **fichier contenu dans le paquet**, pas sur ce que le paquet prétend
> — ainsi, un paquet modifié à la main ne peut pas pousser l'application à écraser une Bible.
