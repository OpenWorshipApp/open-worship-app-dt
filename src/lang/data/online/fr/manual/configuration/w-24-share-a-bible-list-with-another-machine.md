---
id: W-24
title: "Partager une liste biblique avec une autre machine"
section: "Configuration"
lang: fr
translatedFrom: f1fe663ce5d183f7
---
# W-24 — Partager une liste biblique avec une autre machine

Une liste biblique (les versets que vous avez préparés pour un culte) voyage de la même façon.

1. Dans le panneau **[en:tran:Bibles]**, faites un clic droit sur la liste voulue et choisissez **[en:tran:Export]**. Un petit panneau affiche deux cases, **[en:tran:Password]** et
   **[en:tran:Confirm Password]** — laissez les deux vides pour le paquet ordinaire, ou tapez
   le même mot de passe dans les deux pour le verrouiller (W-22j, étape 1a). Vous obtenez un seul
   fichier `<name>.owbible.tar.gz` dans votre dossier **Téléchargements** (Downloads), ou `<name>.owbible.enc`
   si vous avez mis un mot de passe. 📸
2. Le paquet est petit : une liste biblique enregistre des _références_ de versets, pas le texte de la Bible ;
   seuls la liste et l'arrière-plan que vous y avez joint (ou à l'un de ses versets) sont donc
   dedans.
3. Sur l'autre machine, faites un clic droit sur une partie vide du panneau **[en:tran:Bibles]** → **[en:tran:Import]** et choisissez le fichier — ou **faites glisser le `.owbible.tar.gz` (ou le `.owbible.enc`) sur
   le panneau Bibles** ; un paquet protégé demande d'abord son mot de passe. **[en:tran:Import From URL]** fonctionne aussi ici. 📸
4. La liste apparaît dans le dossier des bibles de cette machine avec ses versets, leurs couleurs et
   son arrière-plan, prête à être présentée. Si une liste du même nom s'y trouve déjà, les
   versets qu'elle n'a pas encore sont ajoutés à cette liste, au lieu qu'une deuxième liste apparaisse.

> Remarques : les **versions** de la Bible que citent les versets ne font pas partie du paquet — ce sont
> de gros fichiers téléchargés séparément. Si l'autre machine n'a pas encore une de ces versions,
> téléchargez-la sur cette machine (Paramètres → Bible) et les versets s'affichent. La page **[en:tran:Bible Reader]**
> a son propre dossier de bibles : importer depuis cette page ajoute donc la liste au dossier du Lecteur biblique,
> pas à celui du Présentateur.
>
> Un paquet ne peut être importé que par la liste d'où il vient : choisir un paquet de document dans
> le panneau Bibles (ou un paquet biblique dans la liste Documents) est refusé avec un message
> qui indique ce que le fichier contient réellement, et rien n'est écrit.
