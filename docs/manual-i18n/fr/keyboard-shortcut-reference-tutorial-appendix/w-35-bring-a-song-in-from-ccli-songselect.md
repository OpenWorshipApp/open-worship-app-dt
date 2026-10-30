---
id: W-35
title: "Importer un chant depuis CCLI SongSelect"
section: "Raccourcis clavier (annexe du tutoriel)"
lang: fr
translatedFrom: 77dc208713b72ba1
---
# W-35 — Importer un chant depuis CCLI SongSelect

Si votre église a accès à la **SongSelect Partner API** de CCLI, l'application peut chercher dans
SongSelect et transformer un chant directement en document de paroles — sans rien retaper. Il vous faut
les identifiants d'API que CCLI vous a délivrés (un **Client ID**, une **Subscription Key**, et la
**Redirect URI** que vous avez enregistrée ; certains clients ont aussi un **Client Secret**).

> CCLI a fermé les nouvelles inscriptions de partenaires, si bien que cela ne fonctionne qu'avec des
> identifiants que vous détenez déjà. Tout ce qui suit a été testé en direct avec un serveur SongSelect
> de remplacement ; le passage final de la connexion vers la vraie page de consentement de CCLI est vérifié
> dans le code, mais **pas observé** de bout en bout, faute de vrais identifiants.

1. Ouvrez **[en:tran:Settings]** → **[en:tran:Others]**. Au-dessus d'**[en:tran:Extra Binaries]**
   se trouve une carte intitulée **[en:tran:SongSelect Integration]**, avec un
   bouton **SongSelect ↗** qui ouvre songselect.ccli.com dans votre navigateur. Une carte
   qui n'affiche que son titre est repliée — cliquez sur le titre pour l'ouvrir. 📸
2. Remplissez **Client ID**, **Subscription Key** et **Redirect URI** (et **Client Secret**
   si vous en avez un). Chaque champ s'enregistre dès que vous cliquez ailleurs, et reçoit un
   ✓ vert. Tant que les trois ne sont pas remplis, **[en:tran:Sign In]** reste gris — le survoler
   nomme les trois champs dont il a besoin.
3. Cliquez sur **[en:tran:Sign In]**. Une fenêtre CCLI s'ouvre pour que vous vous connectiez et donniez
   votre accord. Si vous la fermez à la place, l'application affiche **Échec de la connexion — Connexion annulée** ([en:tran:Sign in was canceled]) et rien ne change. Une fois connecté, la carte affiche
   un **[en:tran:Signed in]** vert avec un bouton **[en:tran:Sign Out]**, et
   l'application garde la session active d'elle-même.
4. De retour dans le Présentateur, ouvrez **⋮ [en:tran:More Options]** de la liste **[en:tran:Documents]**. Une
   nouvelle entrée, **[en:tran:Import From SongSelect]**, se trouve maintenant sous
   **[en:tran:Import From Public Domain Songs]** — elle n'est là que tant que vous êtes connecté. 📸
5. Cliquez dessus. Un panneau flottant **[en:tran:Import From SongSelect]** s'ouvre (faites-le glisser où
   vous voulez ; l'application retient où vous l'avez mis). Tapez dans **[en:tran:Search songs]** — les
   résultats apparaissent dès que vous faites une pause, avec les auteurs, le numéro de chant CCLI, une
   ligne des paroles, et un badge **[en:tran:Public Domain]** quand c'est le cas. Parcourez les
   longues listes de résultats page par page avec les flèches ‹ › en bas. Un chant que votre compte
   n'a pas la licence de prendre a son bouton de téléchargement grisé. 📸
6. Cliquez sur le bouton de téléchargement ☁⬇ d'un chant. Un instant plus tard, l'application confirme
   **Document de chant créé avec succès** ([en:tran:Lyric document created successfully]) et le chant
   apparaît dans votre liste **[en:tran:Documents]** comme chant (♪), nommé d'après son titre. Le panneau
   reste ouvert, vous pouvez donc continuer à télécharger ; télécharger deux fois le même chant garde
   les deux — le second devient `<Title> (1)`. 📸
7. Cliquez sur la nouvelle ligne : elle s'affiche en aperçu diapositive par diapositive — une diapositive
   **Info** avec le titre, les auteurs et la ligne de copyright `CCLI Song #`, puis une diapositive par
   partie (**Verse 1**, **Chorus**, …). Présentez-le comme n'importe quel autre chant (W-04), ou
   peaufinez d'abord le texte dans l'éditeur de paroles. 📸

> **Si SongSelect ne se connecte pas, vérifiez ces points.** Un **[en:tran:Sign In]** gris signifie
> que l'un des trois champs — Client ID, Subscription Key, Redirect URI — est encore vide : survolez-le
> et il les nomme tous les trois ; parmi eux, celui qui n'a pas de ✓ vert est vide. Une recherche ou un téléchargement qui échoue en donne la raison, directement
> dans le panneau ou dans une notification : trop de requêtes d'affilée vous demandent d'attendre un
> moment ; une session expirée affiche
> **[en:tran:SongSelect sign-in expired, please sign in again in Settings]**, alors reconnectez-vous ;
> sans Internet, le message est **[en:tran:Could not reach SongSelect]**.
