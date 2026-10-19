---
id: W-09
title: "Lire de l'audio, et les extras de premier plan (compte à rebours, horloge, bandeau défilant en bas…)"
section: "Présenter du contenu"
lang: fr
translatedFrom: e43f59758ed2997e
---
# W-09 — Lire de l'audio, et les extras de premier plan (compte à rebours, horloge, bandeau défilant en bas…)

**Objectif :** gérer les extras du culte.

**Audio :** dans le panneau Arrière-plan, ouvrez l'onglet **[en:tran:Audios]**, cliquez sur une piste
pour ouvrir son lecteur et appuyez sur lecture — l'onglet est marqué pendant la lecture ; mettez-la en pause pour l'arrêter. 📸

**Widgets de premier plan** — appuyez sur l'onglet du milieu **[en:tran:Foreground]** et un menu
s'ouvre **à l'endroit du curseur**, avec la liste de tous les composants. Choisissez-en un et il s'ouvre dans **son propre
panneau flottant**, qui garde sa taille et sa place après un redémarrage ; le menu se ferme
tout seul. Ouvrez-en autant que vous voulez côte à côte — les panneaux sont indépendants. Le menu
sert aussi de tableau d'état : une case cochée marque un panneau déjà ouvert, un composant qui a
quelque chose sur un écran est marqué comme l'onglet **et porte le numéro de chaque
écran où il se trouve**, et un ▶ bleu marque un composant dont le diaporama est en cours — c'est
ainsi que vous retrouvez un diaporama qui avance encore derrière un panneau que personne n'a ouvert. Le panneau
lui-même n'a pas de seconde barre de titre à replier : son propre en-tête porte le nom, la
marque « à l'écran » et le bouton de fermeture. Chaque panneau a ses propres commandes et un bouton
Afficher/Démarrer :

- **[en:tran:Marquee Top] :** tapez le texte défilant, cliquez sur
  **[en:tran:Show Marquee Top]** — il défile le long du bord supérieur.
- **[en:tran:Marquee Bottom] :** tapez le texte défilant, cliquez sur
  **[en:tran:Show Marquee Bottom]** — il défile le long du bord inférieur. Le haut et le bas peuvent être affichés en même temps.
- Les deux bandeaux défilants proposent une **vitesse de défilement** (%) sous _Propriétés_ : `100%` est
  l'allure par défaut, plus haut va plus vite, plus bas va plus lentement. La modifier pendant qu'un bandeau est
  affiché change son allure sans avoir à recliquer sur Afficher.
- **[en:tran:Quick Text] :** tapez un court message, cliquez sur **[en:tran:Show Quick Text]**.
- **[en:tran:Countdown] :** deux modes. _Jusqu'à une date/heure_ : réglez la date et l'heure et appuyez sur
  **[en:tran:Start Countdown to DateTime]** — il démarre aussitôt et compte toujours jusqu'à cette
  heure. _Pour une durée_ : remplissez les cases **h**, **m** et **s** (plus de 24
  heures, c'est possible : 25 h s'affiche `25:00:00`) et appuyez sur
  **[en:tran:Show Countdown]** — il s'affiche ARRÊTÉ sur sa durée complète (`00:05:00`), pour qu'on
  puisse l'afficher à l'avance et le lancer au bon moment. Tant qu'il est sur un écran,
  **[en:tran:Start]**, **[en:tran:Pause]** / **[en:tran:Resume]** et **[en:tran:Reset]**
  (retour à la durée complète, arrêté) se trouvent sous le bouton, avec un mot qui indique s'il
  est _[en:tran:Not started]_, _[en:tran:Running]_ ou _[en:tran:Paused]_. Activez
  **[en:tran:Auto-start]** et le bouton devient **[en:tran:Start Countdown]**, et il compte
  dès qu'il est affiché. Quand il atteint zéro, les chiffres clignotent en rouge cinq fois (environ dix
  secondes) puis restent rouges ; ils restent sur `00:00:00` pendant une
  seconde, puis comptent le temps DÉPASSÉ derrière un **+** (`+00:01:23`) jusqu'à ce que vous
  le masquiez. L'assemblée ne voit que les chiffres — un compte à rebours en pause s'arrête simplement. Masquez-le
  avec son bouton Masquer. 📸
- **[en:tran:Stopwatch] :** les mêmes commandes. **[en:tran:Show Stopwatch]** l'affiche sur
  `00:00:00`, arrêté (il tourne aussitôt avec **[en:tran:Auto-start]**), puis
  **[en:tran:Start]** / **[en:tran:Pause]** / **[en:tran:Resume]** / **[en:tran:Reset]**
  (retour à zéro). **[en:tran:Reset]** ENREGISTRE d'abord le temps affiché dans une liste
  **[en:tran:History]** sous les boutons — le plus récent en haut, numéroté, avec l'heure
  à laquelle il a été remis à zéro (dans la langue de l'application ; en khmer en chiffres, comme ceci : `04/10 07:57`) — ainsi les 7:42 qu'a duré un témoignage ne se perdent pas avec le zéro. Chaque
  session garde sa propre liste (les 20 derniers ; une remise à zéro de moins d'une seconde n'est pas gardée), et
  **[en:tran:Clear]** à côté la vide après confirmation.
- **[en:tran:Time]** (l'horloge) : même principe — configurer, Afficher, Masquer.
  **[en:tran:Choose City]** met le nom de la ville en toutes lettres au-dessus de l'horloge
  (`Phnom Penh`) avec son heure ; **[en:tran:Use Current Timezone]** revient à
  l'heure de cet ordinateur et retire ce nom en même temps (un nom que vous avez tapé
  vous-même reste). AM/PM est écrit dans la langue de l'application. Un nom long passe à la ligne
  à l'intérieur du cadre au lieu d'être coupé. Avec plusieurs horloges, chaque bouton
  **[en:tran:Show Time]** est numéroté pour un lecteur d'écran, comme son
  bouton de suppression. Une horloge ajoutée avec **[en:tran:Add Time]** démarre à une place
  à elle — la première au milieu, la suivante en haut, puis en bas — si bien que deux horloges
  affichées ensemble ne se superposent jamais ; déplacez-en une dans **[en:tran:Properties]** pour la mettre ailleurs.
- **[en:tran:Camera Show]** : même principe — configurer, Afficher, Masquer. Une caméra
  qu'un autre programme utilise le signale dans sa vignette au lieu de charger sans fin.
- **[en:tran:Screen Show] :** ce qu'un écran contient, affiché sur un autre —
  la diapositive de l'écran 1 dans le coin de l'écran 0. Le panneau a une carte par
  écran, dans la couleur propre à cet écran et avec son numéro. Cliquez sur une carte pour
  mettre cet écran sur l'écran sélectionné, ou appuyez sur son **⋮**
  (**[en:tran:Show on Screens]**) pour choisir. Placez-le et réglez sa taille sous
  _Propriétés_ comme toute autre superposition. Il montre l'arrière-plan, la diapositive,
  le texte biblique et les superpositions de cet écran au fil de leurs changements, **même
  quand cet écran est masqué** — un écran qui n'est affiché nulle part ailleurs ne peut
  être montré qu'à l'intérieur d'un autre. Là où cet écran ne dessine rien,
  celui du dessous transparaît. Un écran ne se montre jamais lui-même, et deux
  écrans ne se montrent jamais l'un l'autre : l'application refuse alors avec
  **[en:tran:A screen cannot show itself]** ou
  **[en:tran:These screens would show each other]**. Il ne
  transmet jamais de son : c'est l'écran montré qui le joue. Retirez-le avec
  **[en:tran:Hide Screen Show]**. 📸
- **[en:tran:Video Show]**, **[en:tran:Image Show]** et **[en:tran:Web Show] :** un clip,
  une image ou une page web affichés _par-dessus_ la diapositive au lieu de derrière. Chacun liste un
  dossier de la même façon que les onglets d'Arrière-plan — seules les lignes visibles sont construites, si bien qu'un
  dossier de milliers de fichiers s'ouvre aussi vite qu'un dossier de dix. Cliquez sur une vignette pour l'afficher,
  cliquez de nouveau pour la retirer, faites un clic droit pour choisir un moniteur. Un clip est lu sans son
  et en boucle.
  **Le volume de ce qui est lu.** Une piste de l'onglet [en:tran:Audios] n'a pas de
  curseur de volume propre à l'application : elle est aussi forte que le volume de
  l'ordinateur, alors montez-le ou baissez-le. Un clip de [en:tran:Video Show] en a un.
  Ouvrez [en:tran:Video Show] depuis l'onglet [en:tran:Foreground], ouvrez
  _[en:tran:Properties]_ dans son panneau et cochez **[en:tran:Play With Sound]** : un
  curseur **[en:tran:Volume]** apparaît dessous, et ce curseur est le volume du clip.
- **Sessions — chaque composant de premier plan en a**, sauf [en:tran:Camera Show] et
  [en:tran:Screen Show], qui présentent plutôt une carte par caméra et par écran. Ce sont
  les boutons en rangée épinglés en haut du panneau, avec **＋** pour en ajouter une, et une session est une
  configuration enregistrée de ce panneau : ses **propres** mots ou chiffres **et** ses **propres**
  _Propriétés_ (taille, place, couleurs, effets). Ainsi **[en:tran:Messages]** contient le
  tableau d'annonces d'avant le culte dans une session et les alertes en cours de culte dans une autre ;
  **[en:tran:Countdown]** contient celui de cinq minutes qui lance le culte à côté
  de celui qui compte jusqu'à une date ; **[en:tran:Marquee Bottom]** contient le message d'accueil permanent
  à côté de l'annonce de parking de ce matin ; **[en:tran:Time]** contient un mur d'horloges
  du monde à côté de l'unique horloge du culte. Rien n'est à retaper par-dessus la configuration
  qui fonctionnait. Sur **[en:tran:Video Show]**, **[en:tran:Image Show]**
  et **[en:tran:Web Show]**, une session possède aussi son **propre
  dossier** et son **propre diaporama**, si bien que l'une peut faire défiler un diaporama de votre dossier
  d'arrière-plans pendant qu'une autre affiche un logo venu d'ailleurs, les deux à l'écran en même temps.
  Préparer une session ne met rien à l'écran : c'est son bouton d'affichage qui le fait, quand vous voulez celle-là.
- Faites un clic droit sur une session (ou appuyez sur son **⋮**) pour la renommer ou la supprimer. Une seule session
  est affichée à la fois, alors chaque bouton porte ses propres marques : le point « à l'écran » quand
  cette session a quelque chose d'affiché, et un ▶ bleu pendant que son diaporama avance —
  ce point est le seul signe de quelque chose en direct appartenant à une session que vous ne
  regardez pas. Supprimer une session **retire d'abord des écrans ce qu'elle y a mis**, pour que
  rien ne reste affiché sans bouton pour le masquer.
- Les _Propriétés_ d'une session et sa rangée Masquer agissent sur **la propre superposition de cette session, et
  rien d'autre**. Changer la taille, la couleur ou la place dans une session ne modifie jamais
  ce qu'une autre session a au mur, et une session qui n'a rien d'affiché ne montre aucun
  bouton Masquer. Pour retirer ce qu'une autre session a affiché, appuyez sur le bouton de session
  qui porte le point « à l'écran » et utilisez le bouton Masquer à cet endroit. Ce qui a été
  affiché sans session (une ligne du déroulé glissée, l'assistant) appartient au
  premier bouton de session, qui est **[en:tran:Default]** sauf s'il a été supprimé.
- **[en:tran:Messages]** et **[en:tran:Time]** contiennent plusieurs éléments par session
  (plusieurs éditeurs de message, plusieurs horloges), si bien que deux sessions peuvent chacune avoir quelque chose
  d'affiché en même temps, chacun listé sur la rangée Masquer de sa propre session. **[en:tran:Countdown]**,
  **[en:tran:Stopwatch]**, **[en:tran:Quick Text]** et les deux bandeaux défilants mettent **une seule**
  chose sur un écran, donc afficher depuis une autre session remplace ce qui s'y trouvait et le
  point « à l'écran » passe à la session qui le possède désormais. **[en:tran:Image Show]**,
  **[en:tran:Video Show]** et **[en:tran:Web Show]** gardent un fichier par session : cliquer une autre
  vignette le remplace. Deux images à la fois — un habillage et un logo — sont deux sessions :
  ajoutez-en une avec **＋** et affichez une image depuis chacune.
- Le panneau **[en:tran:Properties]** se trouve une seule fois à côté des boutons de session et règle
  chaque élément que cette session affiche — position, largeur, échelle, opacité, coin et fusion.
  Toute cette rangée — sessions, _Propriétés_, le diaporama et les boutons d'écran qui
  retirent l'élément — **reste en place pendant que la liste de fichiers défile**.
- **[en:tran:Always on Top]** (chaque composant de premier plan, pas seulement ceux-ci — sous
  _[en:tran:Properties]_ dans son propre panneau) garde un
  widget au-dessus des autres, quel que soit l'ordre dans lequel ils ont été affichés — un logo au-dessus de la neige
  qui tombe. Le nombre à côté départage deux éléments qui sont tous deux au-dessus : le plus élevé l'emporte.
- **[en:tran:Behind Slide]** (chaque composant de premier plan : sous _Propriétés_ dans son
  propre panneau, juste au-dessus de _Toujours au premier plan_) place l'élément de cette session **derrière** la diapositive et le texte biblique — par-dessus
  l'arrière-plan, sous les mots — pour qu'un logo, une horloge ou un clip de neige qui tombe ne couvre jamais
  les paroles. Cochez-le pendant que l'élément est affiché et il se déplace aussitôt ; décochez-le et il revient
  par-dessus la diapositive. Une diapositive qui remplit tout l'écran avec sa propre image le cache
  complètement, et c'est voulu. Tant qu'il est coché, _Toujours au premier plan_ est grisé :
  un élément derrière la diapositive y reste, quel que soit son nombre.
- Le diaporama se trouve dans la rangée des boutons de session, en haut du panneau, dès que la session a quelque chose sur un écran :
  **[en:tran:Start Slide Show]** et les secondes à côté. Il continue pendant que vous
  regardez une autre session, ou avec tout le panneau Premier plan fermé, et s'arrête
  tout seul quand l'élément de cette session est effacé. La liste de fichiers ne défile **pas** pour
  le suivre — la vignette affichée est marquée quand elle se trouve être visible, et la liste
  reste où vous l'avez laissée pour que vous puissiez continuer à chercher la prochaine image pendant que le diaporama
  tourne.
- **[en:tran:Blend Mode]** (sous _Propriétés_ sur Affichage vidéo, Affichage d'image, Affichage de la caméra,
  Affichage d’écran et Affichage Web) décide comment la superposition se mélange avec ce qui est dessous. C'est la
  solution pour un clip à fond noir : choisissez **[en:tran:Screen Blend]** et le
  noir disparaît, ne laissant que la neige qui tombe, les étincelles ou la lumière par-dessus la diapositive en direct.
  **[en:tran:Multiply]** fait l'inverse — le blanc disparaît. **[en:tran:Normal]** est
  la superposition simple qui couvre ce qui est dessous.
- **[en:tran:Effects]** est une section repliable sous _Propriétés_, sur **chaque** composant, et elle
  habille la superposition : une **[en:tran:Border]** (style, épaisseur, couleur), une
  **[en:tran:Shadow]** (Douce / Moyenne / Forte / Halo, avec sa propre couleur) et
  **[en:tran:Padding]** — l'espace entre ce qui est affiché et le bord de son propre cadre,
  mesuré en tailles de texte pour garder ses proportions quand vous changez la taille de police.
  Sur les composants qui mettent des MOTS à l'écran, il y a plus :
  **[en:tran:Text Align]**, **[en:tran:Line Height]**, **[en:tran:Letter Spacing]**,
  une **[en:tran:Text Shadow]** (Douce / Halo / Contour) — c'est ce qui rend une annonce
  lisible par-dessus une image chargée ou une vidéo en mouvement — et **[en:tran:Text Style]** :
  italique, souligné, MAJUSCULES. La section porte un point tant qu'un réglage y est
  actif, pour qu'un style introuvable ne soit jamais la raison pour laquelle un message a l'air faux. 📸
- La rangée de propriétés partagées (taille de police / couleur / position) modifie le style du widget en direct.
- Astuce de pro : **faites glisser** le bouton Afficher d'un widget et **déposez-le sur le mini-écran** pour
  le lancer là ; **faites un clic droit** sur le bouton pour choisir un moniteur précis.

Appuyez sur **F10** ([en:tran:Clear Foreground]) pour effacer tous les widgets de premier plan, ou sur **F6** pour tout
effacer d'un coup.

**Ou demandez-le.** Dans la fenêtre d'aide (🤖), _Lance un compte à rebours de 5 minutes à
l'écran_ ou _Mets l'heure à l'écran_ lance l'extra tout de suite et relit
l'écran — il est conservé même quand l'écran est éteint, et le bouton d'affichage de l'écran lui-même
est proposé, jamais pressé sans qu'on le demande. **/countdown 5**, **/countdown 10:30**
et **/marquee Merci de mettre vos téléphones en silencieux** font la même chose sans assistant,
et **/countdown stop** ou **/clear-foreground** le retire (W-42 étape 6).
