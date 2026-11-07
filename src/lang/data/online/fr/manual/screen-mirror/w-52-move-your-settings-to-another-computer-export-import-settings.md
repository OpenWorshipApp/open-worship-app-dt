---
id: W-52
title: "Transférer vos réglages vers un autre ordinateur (Exporter / Importer les paramètres)"
section: "Screen Mirror"
lang: fr
translatedFrom: 264a658f464a357b
---
# W-52 — Transférer vos réglages vers un autre ordinateur (Exporter / Importer les paramètres)

**File → [en:tran:Export Data]** transfère vos fichiers — chants, diapositives, médias. Ceci transfère la
façon dont l'application est RÉGLÉE : la langue et le thème, l'apparence d'une Bible à l'écran, le
texte défilant et les minuteurs, la taille des panneaux, et tout le reste de ce que vous avez choisi
au fil du temps.

1. Ouvrez **[en:tran:Setting]**. En bas de la barre latérale gauche, sous
   **[en:tran:Apply Settings]**, se trouvent **[en:tran:Export Settings]** et
   **[en:tran:Import Settings]** — les mêmes sur chaque onglet. 📸
2. Cliquez sur **[en:tran:Export Settings]**. Un panneau liste les réglages par sections :
   **[en:tran:General]**, **[en:tran:Bible]**, **[en:tran:Screens]**,
   **[en:tran:Foreground]**, **[en:tran:Background]**,
   **[en:tran:Documents & Lyrics]**, **[en:tran:Layout]**,
   **[en:tran:AI & Assistant]**, **[en:tran:Connections]**,
   **[en:tran:API Keys & Sign-ins]** et **[en:tran:Other Settings]**. Chacune indique
   combien de réglages elle contient, ou **[en:tran:All default]** quand rien n'y a
   jamais été changé. Tout est coché au départ, sauf les clés d'API. 📸
3. La flèche à gauche d'une section l'ouvre, et chaque partie peut être cochée
   séparément — **[en:tran:General]** contient **[en:tran:Language]**,
   **[en:tran:Theme]**, **[en:tran:Font]**, **[en:tran:Tips of the Day]**,
   **[en:tran:Folders]** et **[en:tran:File Color Notes]**. Une section dont seules
   certaines parties sont cochées affiche un tiret dans sa case ; cocher la section les
   coche toutes. **[en:tran:Deselect All]** / **[en:tran:Select All]** agit sur toutes
   les sections à la fois.
4. Sous la liste se trouve la même paire **[en:tran:Password]** /
   **[en:tran:Confirm Password]** que pour toute autre exportation.
   **Les clés d'API et les connexions ne vont dans un fichier qu'avec un mot de passe** : leurs
   lignes restent rouges, avec **[en:tran:Type a password below to include these]**, tant
   qu'aucun mot de passe n'est tapé, et reviennent décochées s'il est effacé. Tapés
   différemment, les deux champs indiquent **[en:tran:Passwords do not match]** et le
   panneau revient en gardant ce qui était coché.
5. Cliquez sur **[en:tran:Ok]**. `Settings.owasetting.tar.gz` est écrit dans le dossier **Téléchargements**
   (`Settings.owasetting.enc` avec un mot de passe), et le dossier s'ouvre sur
   ce fichier.
6. Sur l'autre ordinateur, ouvrez **[en:tran:Setting]**, cliquez sur
   **[en:tran:Import Settings]** et choisissez le fichier. Un fichier protégé demande
   d'abord son mot de passe.
7. Un panneau liste les sections que contient le fichier, sous l'avertissement
   **[en:tran:Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default]**.
   **[en:tran:Folders]**, **[en:tran:Screen Mirror & Virtual Displays]** et les
   clés d'API sont décochés au départ — ils vont au-delà de l'apparence de l'application. 📸
8. Cliquez sur **[en:tran:Ok]**. Un message indique combien de réglages ont été écrits et combien sont
   revenus à leur valeur par défaut. L'application propose ensuite de recharger ses fenêtres
   (**[en:tran:Apply Settings]**), ou de redémarrer quand une section cochée n'est lue
   qu'au démarrage (**[en:tran:Screens & Monitors]**,
   **[en:tran:Screen Mirror & Virtual Displays]**).

> Remarques : une importation REMPLACE chaque section cochée au lieu de s'y ajouter — un
> réglage du texte défilant modifié ici mais absent du fichier revient à sa valeur par défaut, et
> une section laissée décochée n'est pas touchée du tout. Jamais transféré, quoi que vous
> cochiez : le dossier de données qu'utilise l'application, l'identité de cet ordinateur sur le
> réseau et les appareils auxquels il fait confiance, l'activation ou non des fonctionnalités d'IA,
> les conversations avec l'assistant, et ce qui est à l'écran en ce moment. Une
> fenêtre de projecteur ouverte garde son ancienne apparence jusqu'à ce qu'elle soit rouverte. Une
> connexion SongSelect copiée de cette façon peut déconnecter l'un des deux ordinateurs la
> prochaine fois que l'un ou l'autre la renouvelle.

Les étapes 1–2 et les libellés en khmer ont été observés en direct le 9 octobre 2026 ; les étapes 3–8
appuient sur des boutons de la propre boîte de dialogue de l'application, que le pare-feu MCP laisse à une
personne, et sont vérifiées par des tests unitaires jusqu'à ce qu'un essai fait par une personne les valide.
