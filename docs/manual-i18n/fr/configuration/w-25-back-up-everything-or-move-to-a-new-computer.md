---
id: W-25
title: "Tout sauvegarder, ou passer à un nouvel ordinateur"
section: "Configuration"
lang: fr
translatedFrom: 03fd39dd73f25670
---
# W-25 — Tout sauvegarder, ou passer à un nouvel ordinateur

W-22 à W-24 transportent chacun une seule chose. Pour emporter **tout** votre matériel d'un coup — pour
une sauvegarde, ou pour préparer une deuxième machine — utilisez le menu **File** de l'application.

1. Ouvrez le menu **File** en haut de la fenêtre et choisissez **[en:tran:Export Data]**. 📸
2. Un panneau liste chaque dossier de données que vous avez configuré — Documents, Déroulés, Images,
   Vidéos, Audios et Sites web d'arrière-plan, Images et Vidéos de premier plan, Présentation biblique, Lecteur
   biblique, Notes bibliques, **[en:tran:Bibles XML]** et
   **[en:tran:Resources]** — avec le dossier vers lequel chacun pointe. **Ils sont tous cochés au départ.**
   Décochez ce que vous ne voulez pas (le dossier des vidéos est généralement le plus gros), ou utilisez
   **[en:tran:Select All]** / **[en:tran:Deselect All]**. 📸

   > **[en:tran:Bibles XML]** et **[en:tran:Resources]** sont les deux dossiers que vous n'avez jamais
   > choisis vous-même — c'est l'application qui les tient.
   >
   > **[en:tran:Bibles XML]** contient les fichiers XML de Bible que vous avez ajoutés à la main
   > (Paramètres → Bible → Bibles XML), et **seulement ceux-là** : les versions de la Bible que vous avez
   > téléchargées dans l'application sont laissées de côté, car il suffit de les télécharger à nouveau sur
   > l'autre machine. Si vous n'avez jamais ajouté de Bible XML, la ligne n'est pas proposée du tout.
   >
   > **[en:tran:Resources]** est le dossier `resources` à l'intérieur de votre dossier de données — là où
   > **[en:tran:Copy to Data Directory]** du panneau Ressources (W-37) place un dossier de PDF de
   > chapitres, de notes ou de liens. Tout son contenu est inclus, il peut donc être gros ; décochez-le
   > comme les vidéos si vous n'en avez pas besoin. Un dossier que vous avez laissé ailleurs sur
   > l'ordinateur et seulement listé dans le panneau n'est **pas** dans la sauvegarde — copiez-le d'abord
   > dans le dossier de données. Si vous n'en avez jamais copié là, la ligne n'est pas proposée.
   > 2a. Sous la liste des dossiers, le même panneau demande un **[en:tran:Password]** et un
   > **[en:tran:Confirm Password]**. Laissez les deux vides pour une sauvegarde ordinaire.
   > Tapez le même mot de passe dans les deux pour la verrouiller — une sauvegarde transportée sur une
   > clé USB contient tous vos documents, c'est donc celle qui mérite d'être protégée. 📸

   > **Il n'existe aucun moyen de retrouver un mot de passe oublié**, et ce fichier contient tout ce que
   > vous avez. Notez-le quelque part ailleurs que sur la même clé USB.

3. Appuyez sur **[en:tran:Ok]**. Vous obtenez un seul fichier `open-worship-data.owadata.tar` dans votre
   dossier **Téléchargements** — ou `open-worship-data.owadata.enc` si vous avez mis un mot de passe — et
   le dossier s'ouvre. Copiez-le sur une clé USB ou sur l'autre machine.
4. Sur l'autre machine, ouvrez **[en:tran:Settings]** → **[en:tran:Path Settings]**
   et choisissez d'abord les dossiers de destination. Ensuite, choisissez **File** → **[en:tran:Import Data]** et sélectionnez ce fichier. Une sauvegarde protégée demande d'abord son mot de passe. Un mot de passe mal tapé est
   redemandé sous _[en:tran:Wrong password, try again]_, trois fois au plus, puis l'importation
   s'arrête sans rien importer. Tapez-le exactement comme il a été défini, majuscules comprises, ou
   demandez-le à la personne qui a créé le fichier. Personne ne peut l'ouvrir sans lui. Le panneau liste ensuite seulement
   les dossiers que le fichier contient réellement — tous cochés, là encore — pour que vous puissiez ne
   restaurer que les chants, ou que les arrière-plans. 📸

   > Une sauvegarde protégée est déverrouillée d'un seul coup avant que cette liste puisse s'afficher,
   > donc une grosse sauvegarde met un peu plus de temps à s'ouvrir qu'une sauvegarde ordinaire. Une
   > sauvegarde ordinaire est lue aussi vite qu'avant.

5. Appuyez sur **[en:tran:Ok]**. À la fin, on vous indique combien de fichiers ont été importés et
   combien étaient déjà à jour. Chaque dossier ramené par la ligne **[en:tran:Resources]** est aussi
   ajouté à la liste du panneau Ressources, pour qu'il y apparaisse sans être ajouté à la main
   (appuyez sur **[en:tran:Reload]** dans le menu ⋮ du panneau si celui-ci était déjà ouvert).

> Remarques : il s'agit d'une **copie, pas d'un remplacement**. Un fichier déjà présent sur la machine
> avec le même contenu est laissé tel quel, donc importer deux fois la même sauvegarde ne change rien et
> peut être refait sans risque. Si un fichier porte le même NOM mais avec un contenu différent — vous
> avez modifié le chant sur cette machine — **votre version est conservée** et celle de la sauvegarde est
> ajoutée à côté sous le nom `song (1).ows`, pour que vous puissiez comparer et supprimer celle que vous
> ne voulez pas. Rien n'est jamais écrasé.
>
> L'importation écrit dans les dossiers configurés sur **cette** machine, alors choisissez-les d'abord
> (Paramètres → Paramètres des chemins). Si l'un d'eux n'a pas encore de dossier, l'importation s'arrête
> avant de copier quoi que ce soit et vous dit lequel définir.
>
> La sauvegarde laisse de côté les fichiers de travail que l'application peut reconstruire seule —
> l'historique d'annulation d'un document et les images de pages créées pour les aperçus
> PDF/PowerPoint/Word — elle reste donc bien plus petite que les dossiers eux-mêmes, et ces fichiers sont
> recréés sur l'autre machine la première fois que vous ouvrez le document.
