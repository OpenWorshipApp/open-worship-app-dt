---
id: W-10
title: "Contrôler ce que voit l'assemblée (mini-écran + effacements)"
section: "Présenter du contenu"
lang: fr
translatedFrom: d56869c7785b1683
---
# W-10 — Contrôler ce que voit l'assemblée (mini-écran + effacements)

**Objectif :** gérer la sortie en direct depuis la carte d'aperçu de l'écran.

- Le **mini-écran** (colonne de droite, en bas) reproduit ce que voit l'assemblée ; le
  curseur de zoom en dessous ne change que la taille de votre aperçu, pas la sortie. 📸
- Derrière tout ce que la carte dessine se trouve **le fond d'écran du bureau de ce moniteur**.
  L'écran de l'assemblée est une fenêtre transparente, donc partout où vous n'avez rien
  affiché, c'est vraiment ce que la salle verrait. Un clic droit sur une partie vide du
  panneau du mini-écran (ou sur le **⋮** en bas à droite) → **[en:tran:Show Monitor Wallpaper]**
  le désactive et remet le simple motif en damier — il n'en faut pas plus.
  **[en:tran:Refresh Preview]** dans le même menu sert à autre chose : il relit le
  fond d'écran après que vous avez changé le fond de votre bureau. Une machine
  qui ne dit pas quel est son fond d'écran garde le motif.
- Chaque écran a sa propre carte d'aperçu avec un **en-tête** et un **pied** de commandes :
- **Afficher / masquer l'écran** (en-tête, tout à gauche — ou appuyez sur **F5**) : allume ou éteint
  la sortie sur le moniteur physique. Le bouton agit sur son propre écran ; **F5** agit sur les écrans
  **sélectionnés** (tous les écrans quand aucun n'est sélectionné) et les met tous dans le
  même état : allumés seulement s'ils sont tous éteints, sinon tous éteints.
  Un écran non sélectionné reste tel quel lorsqu'un autre écran est sélectionné. L'icône se remplit et s'éclaire pendant l'affichage. C'est
  la commande nommée **[en:tran:Toggle showing screen]** — dites ces mots quand
  vous indiquez à quelqu'un sur quoi appuyer, car plusieurs autres choses dans cette fenêtre
  s'appellent aussi « Afficher ». 📸
- **Masquer tous les écrans.** Dans le panneau des mini-écrans du Présentateur (en bas à droite), vérifiez
  chaque carte, y compris celles qui ne sont pas sélectionnées. Sur chaque carte dont le bouton
  **[en:tran:Toggle showing screen]**, tout à gauche de l'en-tête, est rempli et lumineux, cliquez une fois
  pour masquer cet écran ; laissez un bouton éteint tel quel. Quand tous ces boutons sont éteints,
  tous les écrans sont masqués et leur contenu est conservé. **F5** bascule les écrans
  sélectionnés, utilisez donc ces boutons individuels pour masquer tous les écrans sans risque.
- **Boutons d'effacement** (en-tête — chacun a aussi une touche de fonction) :
  **Tout effacer `F6` / BG `F7` / SL `F8` / LT `F9` / FG `F10`**
  ([en:tran:Clear All] / [en:tran:Clear Background] / [en:tran:Clear Slide] / [en:tran:Clear Long Text] / [en:tran:Clear Foreground]).
  Un bouton n'est allumé que lorsque sa couche a quelque chose à effacer. **LT** est la
  couche de texte long : un passage biblique, ou le texte d'un
  **[en:tran:Long Text Show]**.
- **Arrêter de dessiner l'aperçu** (en-tête, l'œil juste après **FG** —
  **[en:tran:Stop rendering preview]**) : pour un ordinateur lent. Cliquez dessus et cette carte
  arrête de dessiner : son contenu devient un motif rayé qui affiche
  **[en:tran:No rendering]**, tandis que l'écran de l'assemblée continue de tout montrer.
  Tous les autres boutons de la carte fonctionnent toujours, les boutons d'effacement s'allument toujours, et
  tout ce que vous présentez depuis les listes va toujours à l'écran — seule l'image
  ici disparaît, et avec elle le travail de tout dessiner deux fois. La vidéo ou
  l'audio d'une diapositive joue toujours son son comme avant, mais son bouton de lecture fait partie de l'image :
  cliquez sur l'œil barré (**[en:tran:Resume rendering preview]**) pour faire revenir
  l'image et en lancer un à la main — la carte reprend exactement ce qui est à
  l'écran, et un clip en cours de lecture continue. La carte se souvient de ce choix pour
  cet écran, même après un redémarrage. 📸
- **[en:tran:Lock]** (en-tête, le cadenas) : quand il est verrouillé (rouge), l'écran refuse les changements de diapositive —
  pratique pendant un moment en direct ; cliquez de nouveau (vert) pour déverrouiller. Un changement refusé affiche
  _[en:tran:Screen Manager is locked]_ dans un message avec son propre bouton **[en:tran:Unlock]** : appuyer dessus
  déverrouille les écrans et ferme le message.
- **Moniteur** (pied, par ex. `(0):2678…`) : cliquez pour choisir **sur quel moniteur physique** cet
  écran projette — le menu liste chaque moniteur avec sa résolution, et marque
  l'actuel d'un `*` et le principal de `(principal)`.
- **Rien sur le projecteur ?** Vérifiez sa carte de haut en bas : il est affiché (**[en:tran:Toggle showing screen]**, ou **F5**) ; le **Moniteur** de son pied nomme le projecteur, pas l'écran de cet ordinateur — choisissez-le là ; et quelque chose y est présenté — un bouton d'effacement allumé dit quelle couche contient quelque chose.
- **Transitions** (pied, `Tr:`) : les boutons **[en:tran:Slide]:**, **[en:tran:Background]:** et
  **[en:tran:Foreground]:** choisissent l'animation de changement pour cet écran —
  **aucune / fondu / déplacement / zoom**. Ils servent de valeur par défaut : un document, une diapositive, un
  onglet d'Arrière-plan, un arrière-plan, un panneau de premier plan ou l'une de ses sessions peut
  avoir sa propre transition à la place (W-48). 📸
- **Audio d'arrière-plan** (pied, l'icône d'onde sonore — apparaît quand un arrière-plan vidéo
  est en direct) : ouvre un petit lecteur par vidéo pour lire/mettre en pause son audio en synchronisation ; l'icône
  de répétition le met en boucle. L'application refuse de fermer le lecteur pendant que l'audio joue.
- **Numéro de scène** (pied, `St:`) : cliquez pour attribuer à cet écran un numéro de scène
  (0–5, ou augmenter/diminuer) pour les configurations avec vue de scène. Passer un écran à une scène
  au-dessus de 0 règle aussi sa transition **[en:tran:Slide]:** sur **aucune**, et une note dans le coin le signale ; vous pouvez en choisir une autre
  ensuite, et revenir à la scène 0 laisse la transition telle quelle. La transition propre d'un document
  ou d'une diapositive (W-48) l'emporte toujours sur elle.
