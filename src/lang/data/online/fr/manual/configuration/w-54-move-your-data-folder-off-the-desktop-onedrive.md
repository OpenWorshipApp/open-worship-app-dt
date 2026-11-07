---
id: W-54
title: "Déplacer votre dossier de données hors du Bureau (OneDrive)"
section: "Configuration"
lang: fr
translatedFrom: 7ccdd3118e706bbc
---
# W-54 — Déplacer votre dossier de données hors du Bureau (OneDrive)

**Objectif :** garder vos chants, diapositives, Bibles et paramètres là où un programme de sauvegarde ne peut pas les emporter.

L'application créait autrefois son dossier de données sur le Bureau, `Desktop\open-worship-data`. Sous Windows, Microsoft OneDrive sauvegarde souvent le Bureau, et pendant la synchronisation il peut remplacer des fichiers par des copies disponibles uniquement en ligne ou les retirer de l'ordinateur — des chants, des diapositives et des paramètres ont disparu. Un nouveau dossier de données est désormais créé dans `.owa\open-worship-data`, dans votre dossier utilisateur (`~/.owa/open-worship-data` sur un Mac ou sous Linux), que rien ne synchronise.

1. Lancez l'application. Tant que votre dossier de données est encore `Desktop\open-worship-data`, chaque démarrage demande **[en:tran:Move Your Data Folder Off the Desktop]**. La question nomme votre dossier, dit pourquoi il est en danger sur cet ordinateur — OneDrive sous Windows, iCloud Drive sur un Mac — et où il ira. Tant qu'il n'est pas déplacé, chaque fenêtre affiche aussi une carte du même titre, qui dit que le Bureau n'est pas un endroit sûr pour votre dossier de données, avec **[en:tran:Move Now]** et **[en:tran:Hide for 30 days]**. 📸
2. Appuyez sur **[en:tran:Move Now]**. L'application se ferme et se rouvre, et déplace le dossier avant d'y ouvrir quoi que ce soit. Hors de OneDrive, le dossier est simplement déplacé. Dans OneDrive, ou quand un de ses fichiers est en cours d'utilisation, chaque fichier est copié et vérifié, et l'ancien dossier reste où il était.
3. **[en:tran:Data Folder Moved]** indique où se trouvent maintenant vos données — et, après une copie, où se trouve l'ancienne copie. Appuyez sur **[en:tran:Ok]**. Les images, vidéos et chants s'affichent toujours : les liens qui désignaient l'ancien emplacement suivent le dossier. 📸
4. Après une copie, chaque démarrage affiche **[en:tran:Old Copy of Your Data Folder]** avec le jour du déplacement. Vérifiez que vos chants et diapositives sont tous là, puis appuyez sur **[en:tran:Show Folder]** et mettez vous-même l'ancien dossier à la corbeille — l'application ne le supprime jamais. Une fois qu'il a disparu, le rappel s'arrête. 📸
5. Pas maintenant ? **[en:tran:Not Now]** repose la question au prochain démarrage. **[en:tran:Hide for 30 days]** écarte la question pendant 30 jours.

> Remarques : `migration-moved-from.txt` dans le nouveau dossier indique d'où il vient et quand ; `migration-moved-to.txt` dans une ancienne copie indique où il est allé.
> Un déplacement qui échoue ne change rien : **[en:tran:Data Folder Not Moved]** en donne la raison, l'application continue d'utiliser le dossier là où il est, et elle repose la question au prochain démarrage.
> Sur un Mac, un fichier qui n'est que dans iCloud Drive bloque le déplacement jusqu'à ce qu'il soit téléchargé (Finder → **Télécharger maintenant**).
> Le nom du nouveau dossier commence par un point, donc le Finder et les gestionnaires de fichiers Linux le masquent ; le sélecteur de dossier des Paramètres l'affiche.

Les étapes 1 à 5 ont été observées en direct le 2026-10-17 sur un profil de développement de test, avec un dossier jetable sur le Bureau, en anglais et en khmer : la question avec chacune de ses trois réponses, le déplacement au redémarrage de l'application (renommé ; puis copié, avec un fichier maintenu ouvert), le résultat, le rappel avec sa date en chiffres khmers, et le rappel disparu une fois l'ancienne copie partie. **[en:tran:Show Folder]** n'a pas été pressé — il ouvre la fenêtre de fichiers de l'ordinateur — et est couvert par les tests unitaires. Pas vu en direct : OneDrive lui-même (la copie a été forcée par un fichier maintenu ouvert) et un Mac.
