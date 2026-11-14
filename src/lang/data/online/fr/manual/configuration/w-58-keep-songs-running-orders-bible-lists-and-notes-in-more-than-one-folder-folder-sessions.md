---
id: W-58
title: "Garder les chants, les déroulés, les listes bibliques et les notes dans plusieurs dossiers (sessions de dossiers)"
section: "Configuration"
lang: fr
translatedFrom: 3534872882304df1
---
# W-58 — Garder les chants, les déroulés, les listes bibliques et les notes dans plusieurs dossiers (sessions de dossiers)

**Objectif :** garder les chants de ce dimanche, le programme de Pâques dernier ou les notes d'une série de prédications dans des dossiers à eux, et passer de l'un à l'autre depuis la liste elle-même — sans changer le dossier avec lequel l'application a été configurée.

1. Sous le titre de **[en:tran:Documents]**, **[en:tran:Presenting Flows]**, **[en:tran:Bibles]** et **[en:tran:Bible Notes]** se trouve une rangée de petits boutons : **[en:tran:Default]** et un **＋** (**[en:tran:Add Session]**). 📸 **[en:tran:Default]** est le dossier que la liste a toujours affiché — celui que nomme **[en:tran:Path Settings]** (W-16) — et rien sur cette rangée ne le change jamais.
2. Appuyez sur **＋**. Un bouton **Session 2** apparaît et c'est celui sur lequel vous êtes ; sa liste est vide et indique **[en:tran:No directory selected]**.
3. Donnez-lui un dossier : appuyez sur **[en:tran:Choose a folder]** et choisissez-en un, ou appuyez sur la ligne du dossier au-dessus de la liste, tapez le chemin du dossier et appuyez sur Enter. **[en:tran:Select Default]** la fait plutôt pointer vers le dossier habituel de la liste. La liste affiche alors les fichiers de ce dossier, avec son propre tri et son propre filtre. 📸
4. Appuyez sur **[en:tran:Default]** pour revenir en arrière et sur **Session 2** pour y retourner — l'application se souvient de celle sur laquelle vous étiez.
5. Le **⋮** de la session sur laquelle vous êtes (ou un clic droit sur n'importe laquelle d'entre elles) propose **[en:tran:Rename Session]** et, sur toutes les sessions sauf **[en:tran:Default]**, **[en:tran:Remove Session]**, qui demande d'abord confirmation. Supprimer une session l'oublie, avec son réglage de dossier — les fichiers de ce dossier ne sont jamais touchés. **[en:tran:Default]** peut être renommée, jamais supprimée.

Ce qui suit la session sur laquelle vous êtes :

- un chant ou un document de diapositives ouvert avec **[en:tran:Edit]**, et une note biblique ouverte depuis la liste, s'ouvrent depuis le dossier de cette session ;
- ce que vous créez depuis un autre endroit y arrive — un chant ou des diapositives faits à partir d'un passage biblique (W-06), un verset enregistré depuis **[en:tran:Bible Lookup]** dans la liste **Default** de **[en:tran:Bibles]**, un chant ou des diapositives que l'assistant écrit (W-42, W-56, W-57), et un fichier que vous importez (W-23, W-22j, W-24, W-41) ;
- le dossier d'une session situé en dehors du dossier de données est surveillé comme le dossier de données, si bien qu'un fichier copié dedans apparaît dans la liste.

Ce qui ne la suit PAS : vos surlignages et vos commentaires sur les versets de la Bible (W-40) sont toujours gardés dans les notes de la session **[en:tran:Default]**, si bien que changer de session dans **[en:tran:Bible Notes]** ne les cache jamais, et le Lecteur marque un verset qui a des notes, qu'elles viennent de la session **[en:tran:Default]** ou de celle sur laquelle vous êtes. Le Présentateur et le Lecteur biblique gardent leurs sessions **[en:tran:Bibles]** séparées, comme ils gardent leurs dossiers séparés.

Les étapes 1 à 5 ont été observées en direct le 2026-11-07 sur le Présentateur de l'application de développement : la rangée sous les quatre titres ; **＋** sur **[en:tran:Documents]** créant **Session 2** avec **[en:tran:Choose a folder]** dans sa liste vide ; un dossier tapé affichant son chant et son document de diapositives ; **[en:tran:Edit]** sur chacun les ouvrant depuis ce dossier (l'Éditeur de paroles et l'Éditeur de documents) ; **[en:tran:Default]** ramenant la liste habituelle ; et le menu de **[en:tran:Default]** ne proposant que **[en:tran:Rename Session]**. Vérifié par des tests unitaires, mais pas vu en direct : un verset enregistré depuis la recherche biblique dans la liste d'une session, un chant créé à partir d'un passage dans une session, les marques de versets qui restent dans les notes de la session **[en:tran:Default]**, et la rangée **[en:tran:Bibles]** de la fenêtre de recherche qui suit celle de la colonne de droite.
