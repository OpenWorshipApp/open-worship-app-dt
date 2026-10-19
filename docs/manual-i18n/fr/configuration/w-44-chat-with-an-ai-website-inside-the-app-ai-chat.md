---
id: W-44
title: "Discuter avec un site d'IA dans l'application (Chat IA)"
section: "Configuration"
lang: fr
translatedFrom: f267389fd5f04342
---
# W-44 — Discuter avec un site d'IA dans l'application (Chat IA)

**Objectif :** utiliser ChatGPT, Claude, Gemini, DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen ou
Copilot — le site web de l'entreprise elle-même, avec votre propre compte — dans une fenêtre à côté de l'application,
comme le fait la barre latérale d'IA d'un navigateur, sans quitter l'application.

**Le ✨ n'est pas le 🤖.** Le **✨** ouvre le site de chat d'IA de l'entreprise elle-même — ChatGPT,
Claude, Gemini et d'autres — dans un cadre, connecté avec votre propre compte sur ce site. Le **🤖**
est l'assistant de l'application : il répond à partir de ce
manuel et peut vous montrer des choses dans l'application. Ceci n'est pas l'assistant de l'application (W-42) : rien ici ne lit ce manuel ni n'appuie sur
quoi que ce soit dans l'application, et aucune clé d'API n'est nécessaire. C'est le site lui-même, dans un cadre.

1. Cliquez sur le bouton **✨** ([en:tran:AI Chat]) dans le coin supérieur droit de la fenêtre, à droite
   du **🤖** et à gauche du **?**, ou ouvrez **Help** → **AI Chat** dans la barre de menus. Depuis
   une fenêtre sans barre supérieure, utilisez **Tools** → **[en:tran:AI Chat]**. Une fenêtre étroite s'ouvre à côté de
   l'application, de la même taille et à la même place que la fenêtre d'aide. 📸 Elle fonctionne que les **fonctionnalités
   d'IA** soient activées ou non dans Paramètres → Autres : cette fenêtre ne contient aucune clé et n'ouvre aucune
   porte de l'application.
2. La fenêtre s'ouvre sur une carte, **Choisissez un chat IA à utiliser dans cette fenêtre**, qui liste les
   sites. Cliquez sur l'un d'eux. Le site se charge dans la fenêtre, et sa propre page de connexion apparaît si vous n'êtes
   pas connecté ; connectez-vous là exactement comme dans un navigateur. Vous restez connecté au
   prochain démarrage de l'application. 📸
3. La rangée au-dessus du site indique **DISCUTER AVEC** et le nom du site. Changez-le là pour faire passer
   le même onglet sur un autre site. À côté : **←** revient d'une page, **↻** recharge,
   **↗** (**Ouvrir dans votre navigateur**) ouvre la même page dans votre navigateur habituel — pour la seule
   chose qu'un site dans un cadre ne peut pas faire, comme une connexion qui tient à ouvrir une fenêtre surgissante —
   et **↤** (**Se déconnecter de tous les sites**), qui est l'étape 7.
4. La bande d'**onglets** en haut fonctionne comme celle de la fenêtre d'aide (W-42 étape 2) : **+**
   ouvre un autre onglet (il s'ouvre de nouveau sur la carte), **×** en ferme un, un **double-clic sur le
   nom d'un onglet** le renomme, et le **⋮** d'un onglet (ou un clic droit) ouvre **Renommer cette conversation**,
   **Verrouiller cette conversation**, **Fermer cette conversation**, **Fermer les autres conversations…** et **Effacer toutes les conversations…**. Tant que vous ne l'avez pas
   renommé, un onglet porte le nom de la page — le nom de la conversation elle-même, sur la plupart de ces
   sites. Les onglets sont gardés quand la fenêtre et l'application se ferment, jusqu'à huit, et chacun
   revient sur la conversation où il était. 📸 **Faites glisser un onglet** le long de la bande pour le placer
   ailleurs parmi les autres.
   **Fermé par erreur ?** Un onglet fermé n'est pas perdu : il va dans **Fermés récemment**,
   listé sur la carte où s'ouvre un nouvel onglet et derrière le **🕘** (**Onglets fermés récemment**) dans
   la rangée au-dessus de la page. Cliquez dessus et il se rouvre sur la conversation où il était ;
   **Ctrl+Shift+T** rouvre le dernier. La liste est partagée par toutes les fenêtres Chat IA,
   garde les vingt derniers, et **Vider cette liste** en dessous la vide. 📸

5. Seuls trois onglets gardent leur site chargé en même temps — celui de devant et les deux que vous avez utilisés
   le plus récemment. Les autres se déchargent pour économiser la mémoire et rechargent leur dernière page quand
   vous cliquez dessus, ce qui prend une seconde et ne perd rien : la conversation vit sur le
   site, sous votre compte.
   **Plus d'une fenêtre.** Chaque appui sur le **✨** ouvre une autre fenêtre Chat IA, tout comme
   le bouton **Nouvelle fenêtre** à droite du **+** dans la bande — jusqu'à trois à la fois ; un
   quatrième appui ramène plutôt les fenêtres ouvertes au premier plan, parce que chaque site ouvert prend de la
   mémoire. Chaque fenêtre garde ses propres onglets. Pour donner à un onglet sa propre fenêtre, **faites-le glisser hors**
   de la bande et lâchez-le n'importe où en dehors de la fenêtre, ou choisissez **Ouvrir dans une nouvelle fenêtre**
   dans son **⋮** : une nouvelle fenêtre s'ouvre avec cet onglet, sur la conversation où il était, et
   l'onglet quitte la première fenêtre. Vous restez connecté, parce que toutes les fenêtres partagent les
   mêmes connexions. 📸

6. Un lien que le site ouvre dans une nouvelle fenêtre (une citation, un « en savoir plus ») s'ouvre dans votre navigateur
   habituel, jamais dans l'application — et seulement si vous avez appuyé sur quelque chose dans le site juste avant.
   Une page qui essaie d'en ouvrir un d'elle-même est bloquée, et une ligne sous la rangée au-dessus de la
   page dit _Ce site a tenté d’ouvrir … dans votre navigateur sans que vous ayez appuyé, il n’a donc pas été
   ouvert_ ; appuyez de nouveau sur le lien si c'était voulu. 📸 Le site ne peut pas utiliser la caméra ni votre
   position depuis cette fenêtre, ne peut rien ouvrir sur cet ordinateur, et ne peut
   rien atteindre sur celui-ci ni sur le réseau du bâtiment — ni l'application elle-même, ni le routeur,
   ni une imprimante, ni un programme comme OBS qui attend des connexions. Seulement
   Internet, qui est tout ce qu'un site de chat demande.

   **Parler au lieu de taper.** Le microphone est la seule chose qu'un site peut demander. Appuyez
   sur son bouton de microphone (le **Dictate** de Claude, par exemple) et une ligne apparaît sous la rangée
   au-dessus de la page : _claude.ai veut utiliser votre microphone. L’autoriser jusqu’à la fermeture de
   l’application ?_ 📸 **Autoriser** laisse ce site vous entendre ; **Ne pas autoriser** — déjà sélectionné, donc
   Enter ou Escape le choisit — garde le microphone éteint, et le site affiche son propre
   message « bloqué » jusqu'à ce que vous appuyiez sur son bouton et répondiez de nouveau. Un oui vaut pour ce seul
   site, dure jusqu'à la fermeture de l'application, et ne compte que tant que son onglet est celui de devant ; un
   onglet à l'arrière n'est jamais autorisé. **Se déconnecter de tous les sites** (étape 7) le retire. La
   caméra reste éteinte quelle que soit votre réponse.

7. **Vous partagez cet ordinateur ?** Vous restez connecté à ces sites jusqu'à ce que vous en décidiez autrement,
   et fermer les onglets ne vous déconnecte pas — c'est bon à savoir dans une arrière-salle d'église
   où plusieurs personnes utilisent la même machine. Cliquez sur **↤** (**Se déconnecter de tous les
   sites**) dans la rangée au-dessus de la page, ou sur les mêmes mots sur la carte de l'étape 2, et répondez
   **Se déconnecter**. 📸 Une confirmation est demandée d'abord, et **Rester connecté** est la réponse déjà
   sélectionnée, donc un mauvais clic ne coûte rien. Cela vous déconnecte de tous les sites dans toutes les fenêtres
   Chat IA, puisqu'elles partagent toutes la même connexion. Vos onglets restent où ils sont ; les pages
   qu'ils affichaient, les noms que les sites leur ont donnés et la liste **Fermés récemment** sont
   oubliés, un nom que vous avez tapé vous-même sur un onglet est gardé, et chaque site vous demande de vous
   reconnecter. C'est irréversible.

**Ça ne charge pas ?** La fenêtre affiche _Impossible de charger …_ avec un bouton **Réessayer** quand
le site est injoignable — vérifiez d'abord la connexion Internet du bâtiment. Un site qui refuse de
vous connecter dans la fenêtre peut être ouvert dans votre navigateur avec **↗** et utilisé là.
