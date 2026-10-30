---
id: W-22j
title: "Partager un déroulé avec une autre machine"
section: "Configuration"
lang: fr
translatedFrom: 930d38b74e44ec58
---
# W-22j — Partager un déroulé avec une autre machine

**Objectif :** transmettre tout le culte — le déroulé et chaque fichier dont il a besoin — à une autre
machine en un seul fichier.

1. Faites un clic droit sur le déroulé → **[en:tran:Export]**. Un petit panneau demande un champ
    **[en:tran:Password]** et un champ **[en:tran:Confirm Password]**.
    **Laissez les deux vides et appuyez sur OK** pour le paquet ordinaire : un seul
    fichier `<name>.owapf.tar.gz` dans votre dossier **Téléchargements**, et le dossier s'ouvre. Il
    contient le déroulé _et chaque fichier dont il a besoin_ — les documents complets derrière vos
    diapositives, les images et les vidéos, et tout arrière-plan attaché à ces documents.
    (Voir l'étape 1a pour y mettre plutôt un mot de passe.)
    1a. **Pour le protéger par un mot de passe**, tapez le même mot de passe dans les deux champs et appuyez sur
    **[en:tran:Ok]**. **[en:tran:Show Password]** affiche ce que vous avez tapé si vous voulez le
    vérifier. Vous obtenez alors `<name>.owapf.enc` — le même paquet, verrouillé. Si les deux
    champs ne correspondent pas, le panneau affiche **[en:tran:Passwords do not match]** et redemande au lieu d'exporter, en gardant ce que vous
    avez déjà tapé pour que vous ne corrigiez que la moitié qui est fausse. Vider les deux champs est toujours
    permis — cela veut simplement dire « pas de mot de passe ».

    > **Il n'existe aucun moyen de récupérer un mot de passe oublié.** Personne — ni vous, ni l'application,
    > ni la personne à qui vous l'envoyez — ne peut ouvrir le paquet sans lui. Notez-le
    > dans un endroit sûr avant de remettre le fichier, et envoyez-le par un autre moyen que
    > le fichier lui-même.

2. **Importer sur la machine de destination.** Ouvrez d'abord **[en:tran:Settings]** → **[en:tran:Path Settings]** et choisissez les dossiers de destination pour les types de fichiers du paquet. Puis faites un clic droit sur une partie vide de la liste **[en:tran:Presenting Flows]** → **[en:tran:Import]** et choisissez ce fichier — ou **faites simplement glisser le fichier `.owapf.tar.gz` (ou `.owapf.enc`)
    depuis votre gestionnaire de fichiers sur la liste des déroulés**, ce qui l'importe de la même façon.
    Un paquet protégé demande d'abord son mot de passe, en affichant **Cette archive est protégée par mot de passe**
    ([en:tran:This archive is password protected]) ; si vous vous trompez, il affiche
    **[en:tran:Wrong password, try again]** et vous laisse
    le retaper, jusqu'à trois essais. Un paquet ordinaire ne demande jamais rien. Les chants, documents
    et médias sont recréés dans les dossiers propres à cette machine, les versets bibliques sont ajoutés à la
    liste **Par défaut**, et chaque lien dans le déroulé est redirigé vers les copies
    locales. 📸
3. Si le paquet se trouve sur un serveur web ou sur une machine qui le partage sur le réseau local,
    vous pouvez éviter de copier le fichier : faites un clic droit sur la liste **[en:tran:Presenting Flows]** →
    **[en:tran:Import From URL]**, collez le lien et appuyez sur **[en:tran:Ok]**. (Si le lien est
    déjà dans votre presse-papiers, il est rempli pour vous.) L'application télécharge le paquet dans un
    dossier temporaire, l'importe exactement comme ci-dessus puis supprime le téléchargement — vous
    obtenez le déroulé et rien d'autre ne reste. Une simple adresse `http://…` avec un
    port, comme celle servie par un autre ordinateur portable, fonctionne aussi bien que `https://`. 📸

> Remarques : une image, une vidéo ou un autre fichier média déjà présent **avec le même contenu**
> est réutilisé plutôt que dupliqué. Le déroulé lui-même, ses chants et ses documents arrivent
> toujours comme de nouveaux fichiers — à côté d'un fichier du même nom, même celui importé
> auparavant, sous le nom `name (1)` — donc importer deux fois le même paquet vous donne une
> deuxième copie de chacun. Si un fichier média du même NOM est
> déjà présent mais qu'il s'agit en fait d'un autre fichier — votre propre `a.mp4` n'est pas le `a.mp4`
> du paquet — le vôtre n'est pas touché et celui du paquet est ajouté à côté sous le nom
> `a (1).mp4`, avec le déroulé pointé vers cette copie. Les diapositives et les documents sont
> enregistrés comme _références_, donc si vous modifiez un chant plus tard, le déroulé projette les nouvelles
> paroles. Les couleurs et les caméras n'ont pas de fichier, il n'y a donc rien à empaqueter pour elles.
>
> Une vidéo placée **dans une diapositive** voyage aussi : le paquet transporte le fichier vidéo et
> la diapositive importée est redirigée vers la copie locale, pour qu'elle soit lue sur l'autre machine.
> (Les images placées dans une diapositive sont enregistrées dans la diapositive elle-même, donc elles ont toujours voyagé.)
>
> L'importation a besoin que les dossiers où elle va écrire soient **déjà choisis** — si, par exemple, aucun
> dossier Vidéos n'a encore été choisi et que le paquet contient une vidéo, l'importation s'arrête
> avant de copier quoi que ce soit et vous dit quel dossier choisir d'abord. Rien n'est
> à moitié importé. Et si une ligne d'un déroulé affiche un jour un triangle d'avertissement indiquant
> **[en:tran:Invalid item]**, cette seule entrée est endommagée (généralement un fichier modifié à la main) — le reste
> du déroulé fonctionne toujours ; supprimez cette ligne et rajoutez-la.
