---
id: W-21
title: "Ajouter une vidéo ou un chant d'arrière-plan à partir d'un lien"
section: "Configuration"
lang: fr
translatedFrom: 189580081490b30e
---
# W-21 — Ajouter une vidéo ou un chant d'arrière-plan à partir d'un lien

**Objectif :** récupérer une vidéo (ou son audio en MP3) depuis un lien en ligne, directement dans votre
dossier Vidéos / Audios, sans quitter l'application. Les outils de téléchargement ne sont pas intégrés à
l'application : la première fois, une boîte **[en:tran:Media Tools Required]** propose d'ouvrir
**[en:tran:Setting]** → **[en:tran:Others]** → **[en:tran:Extra Binaries]**, où
**[en:tran:Download and Install]** les installe une fois pour toutes.

1. Ouvrez le panneau **[en:tran:Background]** (W-08 étape 1) et choisissez l'onglet **[en:tran:Videos]** — ou la partie **[en:tran:Audios]** si vous ne voulez que le son.
2. **Faites un clic droit sur une partie vide de la liste** (ou utilisez le bouton ⋮ [en:tran:More Options]
   à droite de la barre du chemin de dossier) et choisissez **[en:tran:Download From URL]**. 📸
3. Une petite boîte demande le lien — **[en:tran:Video URL:]** dans l'onglet Vidéos, **[en:tran:Audio URL:]**
   dans Audios. Si vous avez copié le lien avant, il est **déjà rempli** ; sinon, collez-le.
   La boîte n'est entourée de rouge — avec **[en:tran:Cannot be empty]** en dessous — qu'une fois que
   vous y avez tapé quelque chose puis l'avez vidée.
4. Cliquez sur **[en:tran:Ok]**. Le téléchargement se fait en arrière-plan — un chant ou une vidéo
   entière prend quelques minutes, et vous pouvez continuer à utiliser l'application pendant ce temps.
5. Quand il est terminé, le fichier **apparaît dans le dossier où vous étiez** : la vidéo apparaît comme
   une nouvelle vignette dans l'onglet Vidéos, l'audio comme une nouvelle ligne sous **[en:tran:Audios]**. 📸 À partir
   de là, il se comporte comme n'importe quel autre arrière-plan (W-08) ou piste (W-09).

> Remarques : l'audio est toujours converti en **MP3**, la vidéo garde la meilleure qualité du site
> (`.webm`/`.mp4`). Si un fichier de ce nom est déjà dans le dossier, le nouveau est
> enregistré sous `name (1)`. Coller quelque chose qui n'est pas un lien web affiche un message
> **[en:tran:Invalid URL]** et rien n'est téléchargé. Les téléchargements nécessitent une connexion
> Internet — et un site très sollicité peut couper un gros téléchargement en cours de route, et dans ce cas,
> réessayez simplement.

> **Un téléchargement qui échoue ne laisse rien dans vos dossiers.** L'application télécharge dans le
> dossier temporaire de l'ordinateur et retire ses morceaux inachevés quand le téléchargement
> échoue (on vous dit pourquoi sous **[en:tran:Download From URL]**). Ce n'est que si l'application a été
> fermée au milieu d'un téléchargement qu'un fichier nommé `temp-…` peut rester dans ce dossier
> temporaire : rien dans l'application ne l'utilise, et vous pouvez le supprimer sans risque quand aucun
> téléchargement n'est en cours.
