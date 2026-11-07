---
id: W-50
title: "Présenter sur un autre ordinateur avec Screen Mirror"
section: "Screen Mirror"
lang: fr
translatedFrom: e0b52827da025229
---
# W-50 — Présenter sur un autre ordinateur avec Screen Mirror

Utilisez une application comme hôte et une autre comme invité. Les deux ordinateurs ont
besoin de la même version de l'application et d'une connexion réseau qui les relie — le
même réseau, ou Internet une fois que l'hôte s'y ouvre (étape 7).

1. Dans le Présentateur de l'hôte, cliquez sur **[en:tran:Mini Screen Options]** — le ⋮
   en bas à droite de la liste du mini-écran — puis, dans le menu qui s'ouvre,
   cliquez sur **[en:tran:Virtual Screens Manager]**, puis choisissez l'onglet
   **[en:tran:Screen Mirror Connection]** du panneau flottant. Le panneau retient
   quel onglet était ouvert, et s'il était ouvert ou non. L'hébergement reste désactivé
   tant que vous n'activez pas **[en:tran:Let other computers connect]** en haut de
   l'onglet — d'ici là, aucun autre ordinateur ne peut trouver celui-ci ni s'y joindre.
   Une fois activé, le panneau affiche **[en:tran:Host addresses]** et
   **[en:tran:Port]** : l'application sert HTTP et WebSocket sur un port libre
   de la plage 39240–39259, et l'interrupteur reste activé au prochain lancement. Sous
   **[en:tran:This network]**, chaque adresse de cet ordinateur est écrite sous la forme
   `address:port` (par exemple `192.168.1.3:39240`) avec deux boutons :
   **[en:tran:Copy address]** met ce texte dans le presse-papiers, et
   **[en:tran:QR code]** l'affiche sous forme de code QR sous la ligne. Le code contient
   le même texte brut, pas un lien : un téléphone qui le scanne propose donc les mots
   à copier. **[en:tran:Copy image]** sous le code le copie comme une image,
   avec l'adresse écrite en dessous, pour l'envoyer à la personne qui prépare l'invité.
2. Sur l'invité, ouvrez la page **[en:tran:Screen Mirror]**. Elle n'a pas d'en-tête
   d'application, seulement une barre en haut : **[en:tran:Presenter]** à sa gauche permet
   de revenir, et la tasse à sa droite est **[en:tran:Stay Awake]** — activée sauf si vous
   l'éteignez, elle empêche cet ordinateur de se mettre en veille tant que la page est
   ouverte, ce dont a besoin un ordinateur qui tient lieu de projecteur. La page
   cherche des hôtes dès qu'elle s'ouvre et les liste sous
   **[en:tran:Hosts on this network]** ; **[en:tran:Rescan]** cherche de nouveau.
   La recherche interroge chaque réseau auquel cet ordinateur est relié, sur chaque port
   de 39240 à 39259 ; un hôte qui répond sur plusieurs réseaux n'est listé qu'une fois,
   sur sa meilleure adresse (un vrai réseau local avant un adaptateur virtuel ou la boucle
   locale), et le premier hôte est inscrit dans **[en:tran:Host address]** et
   **[en:tran:Port]** sous **[en:tran:Connect by address]** — jamais par-dessus
   une adresse que vous avez tapée ni un hôte que vous avez choisi. Choisissez un autre
   hôte ou tapez une adresse si besoin, puis cliquez sur **[en:tran:Connect]**. Une
   adresse qu'on vous a envoyée n'a pas besoin d'être retapée : **[en:tran:Paste address]**
   remplit **[en:tran:Host address]** et **[en:tran:Port]** à partir de ce qui a été
   copié — `address:port`, un lien `http://` entier, une adresse IPv6 entre
   crochets, ou une image du code QR de l'hôte — et
   **[en:tran:Read QR code]** fait de même à partir d'un fichier image que vous choisissez.
   Coller `address:port` directement dans **[en:tran:Host address]** le découpe
   aussi, et une image collée n'importe où dans le formulaire est lue comme un code QR.
   Un presse-papiers sans adresse affiche
   **[en:tran:No host address found in the clipboard.]** et laisse le formulaire
   tel quel. En mode approbation, l'invité affiche
   **[en:tran:Waiting for host approval]** pendant que l'hôte clique sur
   **[en:tran:Allow connection]** dans le panneau flottant.
3. L'invité affiche **[en:tran:Connected]**, et sous
   **[en:tran:This computer]** ses moniteurs portent le préfixe sous lequel l'hôte le
   connaît, par exemple a1 — le nom à choisir dans le sélecteur de moniteur de l'hôte.
   L'hôte le liste sous
   **[en:tran:Connected guests]** au-dessus des aperçus du mini-écran et en haut du
   menu de leur liste. Chaque invité a un préfixe stable, comme a1 ou a2 ;
   cliquez sur son bouton d'en-tête pour ouvrir le panneau flottant, sur l'onglet où il
   était resté (la ligne de l'invité dans le menu de la liste l'ouvre sur
   **[en:tran:Screen Mirror Connection]**). Dans le panneau, chaque
   invité et chaque demande indique d'où il vient :
   **[en:tran:This network]** pour un ordinateur situé sur l'un des réseaux de l'hôte, ou
   **[en:tran:Internet]** — un globe et une bordure ambre — pour
   un ordinateur venu de l'extérieur. Le bouton d'en-tête d'un invité venu d'Internet est
   ambre lui aussi, avec un globe.
4. Choisissez le moniteur préfixé de l'invité dans le sélecteur de moniteur de la carte
   d'écran. Présentez une diapositive et une image d'arrière-plan, puis utilisez la
   commande d'affichage de la carte (F5). L'invité ouvre la sortie de présentation sur ce
   moniteur, devant sa propre fenêtre d'application. Les images et
   les autres fichiers de l'hôte se chargent par le service HTTP de l'hôte ; l'invité n'a
   pas besoin d'en avoir sa propre copie. Ils se chargent depuis l'adresse que l'invité a
   composée : un invité qui a joint l'hôte à travers un routeur les reçoit donc aussi à
   travers ce routeur.
5. Fermez le panneau flottant avec son **✕**, ou rebasculez
   **[en:tran:Virtual Screens Manager]**. La connexion et son entrée d'en-tête
   restent actives. Pour mettre fin à la connexion, utilisez
   **[en:tran:Disconnect]**. La sortie de l'invité se ferme et son entrée quitte
   l'en-tête des invités connectés de l'hôte.
6. Dans **[en:tran:Background]** → **[en:tran:Cameras]**, l'hôte liste aussi les
   caméras des invités connectés, avec leurs préfixes. Choisir une caméra la diffuse
   vers l'aperçu de l'hôte et vers la sortie de l'invité choisie. Choisir plutôt une
   image libère le flux de la caméra. L'accès à la caméra doit être disponible
   sur l'ordinateur qui la fournit, et un invité ne propose ses caméras qu'une fois
   **[en:tran:Share my cameras]** activé — le bouton caméra dans le panneau de cet hôte,
   sur la page **[en:tran:Screen Mirror]** de l'invité, désactivé pour chaque nouveau
   lien.
7. Pour laisser un invité se connecter depuis l'extérieur de ce réseau, activez
   **[en:tran:Open to the internet]** sous
   **[en:tran:Let other computers connect]**. C'est désactivé tant que vous ne
   l'activez pas, et c'est retenu. Un avertissement dit que toute personne ayant
   l'adresse peut demander à se connecter et que la connexion n'est pas chiffrée (replié
   sur une ligne ; son chevron, ou un clic dessus, l'affiche en entier — les notes sur le
   routeur et le tunnel se replient de la même façon, et chacune reste comme vous l'avez
   laissée) : choisissez **[en:tran:Require connection code]** sous
   **[en:tran:Guest access]**, et désactivez l'option quand vous avez terminé. L'hôte
   demande au routeur de rediriger son port (UPnP) ; une fois **[en:tran:The router opened the port.]**,
   une liste **[en:tran:Internet]** montre
   l'adresse publique du routeur marquée **[en:tran:Router]**, et toute adresse IPv6
   globale de cet ordinateur marquée IPv6 — ce qui ne fonctionne que si le routeur laisse
   passer les connexions entrantes.
   Quand aucun routeur ne répond, ou qu'il refuse, le panneau le dit et affiche le
   port et l'adresse de cet ordinateur à rediriger à la main sur le routeur ;
   **[en:tran:Ask the router again]** essaie une fois de plus. Une adresse publique ou un
   nom DDNS tapé dans **[en:tran:Public address (optional)]** et enregistré
   avec **[en:tran:Save address]** est listé aussi. Chaque adresse Internet a
   les mêmes boutons de copie et de code QR. Un routeur placé derrière un autre réseau
   (NAT de l'opérateur) ne peut pas du tout être joint depuis Internet ; le panneau le
   dit et propose plutôt un VPN comme Tailscale. Désactiver l'option
   supprime la redirection de port du routeur et met fin à chaque invité venu
   d'Internet — ceux de ce réseau restent. Tant qu'elle est désactivée, un ordinateur
   situé hors des propres réseaux de cet ordinateur est refusé. Cinq codes de connexion
   erronés venant d'un même expéditeur le bloquent pendant dix minutes.
8. Un invité peut être relié à plusieurs hôtes à la fois. Une fois l'un d'eux connecté,
   **[en:tran:Hosts on this network]** et **[en:tran:Connect by address]**
   restent sous son panneau : choisissez ou tapez un autre hôte et cliquez de nouveau sur
   **[en:tran:Connect]**. Chaque hôte reçoit son propre panneau — son propre
   état, le préfixe que cet hôte a donné à cet ordinateur, et un
   **[en:tran:Disconnect]** qui ne met fin qu'à ce lien. Un hôte déjà relié
   affiche **[en:tran:Connected]** dans la liste et ne peut pas être choisi de nouveau ;
   s'y connecter une seconde fois par adresse est refusé avec
   **[en:tran:Incompatible or duplicate connection]**. Un lien qui a échoué —
   un mauvais code, par exemple — garde son panneau avec la raison, et son hôte peut être
   choisi de nouveau pour réessayer. Deux hôtes peuvent chacun afficher un écran sur cet
   ordinateur en même temps.
