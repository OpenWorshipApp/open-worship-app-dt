---
id: W-22d
title: "Faire attendre un déroulé, puis le faire avancer tout seul (Next: Timeout)"
section: "Configuration"
lang: fr
translatedFrom: be9f12dce6ab0d27
---
# W-22d — Faire attendre un déroulé, puis le faire avancer tout seul (Next: Timeout)

**Objectif :** une diapositive qui s'attarde puis continue sans vous, ou un tableau d'annonces qui
se termine exactement quand le culte commence.

1. **Laissez le déroulé avancer tout seul.** Dans la liste **[en:tran:Presenting Flows]** (pas
   dans le panneau d'aperçu), faites un clic droit sur **le déroulé lui-même** — la
   rangée qui porte son nom, pas la partie vide de la liste ni l'une de ses lignes — et
   choisissez **[en:tran:Add Action]** → **[en:tran:Next: Timeout]**. Cela ajoute une NOUVELLE ligne
   au déroulé ; on ne l'ajoute jamais par un clic droit sur une ligne déjà présente.
   Elle arrive à la FIN du déroulé : faites-la glisser juste après la ligne qu'elle doit suivre.
   Il demande combien de **[en:tran:Seconds]**, et la réponse fait partie de la nouvelle
   ligne — `⏱ Next: Timeout (5)` — si bien qu'un coup d'œil au déroulé vous dit combien de temps il attend. Vous vous êtes
   trompé ? Faites un clic droit sur cette ligne `Next: Timeout` → **[en:tran:Change Timing]** ; la fenêtre s'ouvre
   sur la valeur que la ligne contient maintenant. 📸
2. **[en:tran:Next: Timeout]** attend une fois. Quand le déroulé l'atteint, il fait un compte à rebours puis fait avancer
   le déroulé tout seul — une diapositive qui doit rester dix secondes puis continuer sans
   vous. **Aller ailleurs vous-même l'annule** : cliquez sur une autre ligne, ou appuyez sur la touche
   pour avancer, et l'attente est terminée et c'est de nouveau vous qui pilotez. Un clic qui ne mène nulle part ne
   l'annule PAS : cliquer sur un arrière-plan ou sur un bouton de premier plan, ou un clic perdu sur
   le panneau, le laisse compter, pour qu'un clic mal visé ne puisse pas vous faire perdre l'attente sans que vous le voyiez.
3. **Ou attendez jusqu'à une heure précise.** Un délai n'a pas à être compté en
   secondes. La petite fenêtre qui demande les secondes — elle s'ouvre quand vous ajoutez la ligne
   (étape 1, puis faites glisser la nouvelle ligne juste après la ligne qu'elle doit suivre), et de nouveau par clic droit → **[en:tran:Change Timing]** sur cette ligne — a un
   sélecteur à sa gauche : passez-le de **[en:tran:Seconds]** à **[en:tran:At Time]** et tapez
   l'heure à laquelle le déroulé doit avancer — `7:05 AM`, `8:30 PM`. La ligne affiche alors `⏱ Next: Timeout (7:05 AM)`, et
   la pastille compte à rebours en minutes et en heures (`4:58`, `1:12:30`) au lieu d'un long nombre
   de secondes. Utilisez-le pour le tableau d'annonces avant un culte : placez-le sur la dernière
   annonce et le déroulé la quitte exactement quand le culte commence, que vous l'ayez armé
   une heure ou cinq minutes avant. Son entrée de menu est **[en:tran:Change Timing]** plutôt que **[en:tran:Change Seconds]**, et elle s'ouvre sur celle des deux moitiés
   avec laquelle vous l'avez armé — les deux sont des alternatives, donc en choisir une efface l'autre. Si
   l'heure choisie est **déjà passée**, l'application le dit (**[en:tran:The set time is already due]**)
   et ne lance rien : elle n'attendra pas discrètement jusqu'à demain. Choisissez une nouvelle heure, ou armez-le
   en secondes. 📸
4. **Il ne compte que dans le panneau d'aperçu.** Une ligne `Next:` n'a de sens que lorsque le
   **panneau d'aperçu** de ce déroulé est ouvert (W-22b) — c'est ce panneau qui fait avancer le
   déroulé : cliquer sur la ligne à cet endroit lance son compte à rebours, et une petite pastille en haut à droite du
   panneau montre les secondes restantes, avec ⊗ pour l'arrêter et ⏸ pour le suspendre. Cliquez sur la
   ligne avec le panneau fermé et l'application le dit
   (**[en:tran:Open the presenting flow preview to use this action]**) au lieu de faire comme
   si elle avait fait quelque chose. Il ne va jamais sur un écran, donc il n'a ni **[en:tran:Apply on Screens]**
   ni **[en:tran:Set Specific Screen]**, et on ne peut rien lui attacher.
5. **Un délai peut aussi accompagner une autre ligne.** Attachez-le à une ligne — une
   diapositive, un chant, un verset — comme **élément CC** (W-22g), et cette ligne veut dire « affiche ceci,
   et continue tout seul N secondes plus tard ». Ajoutez le **[en:tran:Next: Timeout]** une fois, faites un clic droit sur la
   ligne où vous le voulez → **[en:tran:Add CC Elements]** et choisissez-le. Gardez quand même la
   ligne `Next: Timeout` elle-même dans la liste : un CC pointe vers cette ligne au lieu de la copier, donc supprimer la ligne supprime aussi toutes les lignes qui en dépendent (mettez-la de côté avec **[en:tran:Disable]** si le déroulé ne doit pas s'y arrêter — celles qui en dépendent se déclenchent quand même). Attaché à
   un CHANT entier, il accompagne chacune de ses diapositives, et c'est ainsi qu'un chant avance tout seul. 📸
6. **Chaque ligne peut attendre sa propre durée.** Créez d'abord un délai s'il n'y en a pas :
   clic droit sur le nom du déroulé lui-même → **[en:tran:Add Action]** →
   **[en:tran:Next: Timeout]**, puis saisissez ses secondes. Faites un clic droit sur chaque ligne qui doit
   attendre → **[en:tran:Add CC Elements]**, puis choisissez ce délai. Il apparaît comme une
   ligne CC en retrait sous chaque ligne à laquelle il est attaché. Une ligne CC suit normalement la valeur réglée sur la
   ligne `Next: Timeout`, donc réarmer cette seule ligne réarme en même temps toutes les lignes qui en dépendent.
   Quand une ligne a besoin d'une attente différente, cliquez sur le petit **chronomètre** à
   droite de **cette ligne CC — la rangée en retrait sous la ligne, pas la ligne elle-même** (ou
   faites un clic droit sur cette ligne CC → **[en:tran:Change Timing]**) et
   répondez avec des secondes ou une heure, exactement comme sur une ligne à part. Cette réponse
   appartient à **ce seul attachement** : le même `Next: Timeout` peut garder la diapositive d'accueil 4 secondes
   et la diapositive d'annonce 30, avec un seul délai dans le déroulé au lieu
   d'un par durée. Une rangée qui a sa propre attente montre le chronomètre **plein** et affiche
   son propre nombre ; une rangée qui suit encore l'élément le montre creux. Pour rendre une rangée à l'élément,
   faites un clic droit dessus → **[en:tran:Use Element Timing]** — elle revient au nombre de
   l'élément et change de nouveau avec lui. 📸
7. **Si le déroulé a cessé d'avancer tout seul**, l'une de trois choses s'est produite. Vous êtes allé
   ailleurs vous-même — clic sur une autre ligne, ou appui sur la touche pour avancer — et cela annule un
   délai. Ou le panneau d'aperçu a été fermé : aucune ligne `Next:` ne compte sans lui. Ou le
   déroulé a atteint la fin de la liste. Pour le relancer, cliquez sur la ligne `Next:` (ou sur la
   ligne qu'elle accompagne) dans le panneau d'aperçu.
