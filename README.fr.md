# FNIRSI 2C23T Studio ⚡🔬

> **Studio, compagnon et suite de contrôle pour Windows pour l'oscilloscope / multimètre / générateur de fonctions DDS portable 3-en-1 FNIRSI 2C23T.**

Documentation principale (anglais) : [README.md](README.md).

## 🌟 Fonctionnalités

* **⚡ Multimètre numérique 10 000 points et enregistreur de données (DMM Studio) :**
  * Grand afficheur de style OLED avec 12 plages commutables (DC V, AC V True-RMS, DC mV, DC A, AC A, mA/µA, résistance Ω, capacité F, continuité 🔔, test de diode ▶|, fréquence Hz, température °C).
  * Barre analogique dynamique avec échelle et dégradé de couleur.
  * Testeur de continuité sonore (buzzer piézo) directement depuis le PC.
  * Enregistreur de courbes continu en temps réel (tracé de tendance) avec mise à l'échelle automatique, Min/Max/Moy et fréquence d'échantillonnage réglable (100 ms à 2 s).
  * Export CSV de la série de mesures en un clic, pour Excel et les rapports.
* **🔬 Laboratoire oscilloscope double voie 60 FPS :**
  * Télémétrie matérielle réelle via USB-CDC (CH1 jaune en haut, CH2 cyan/bleu en bas) avec repères de masse matériels.
  * Échelle Time/Div (500 µs – 10 ms) et réglage Volts/Div.
  * Analyseur de spectre FFT en direct et effet de rémanence de phosphore.
  * Mesures automatiques (Vpp, Vrms, fréquence) synchronisées avec l'appareil physique.
* **⚡ Arbitrary Waveform Studio (concepteur ARBT pour OpenScope) :**
  * Éditeur de courbes interactif : dessin à main levée à la souris ou modèles mathématiques (sinus, carré, triangle, dent de scie, impulsion ECG, bruit).
  * Export en un clic au format `.CSV` directement sur le 2C23T pour le générateur de signaux DDS.
* **📸 Archive de captures d'écran en direct :**
  * Détection automatique de toutes les captures (`.BMP`) faites avec la touche `SAVE` du 2C23T.
  * Vue détaillée, zoom et export PNG en un clic.

## 🌍 Langues

L'interface existe en **allemand, français et anglais**. Le sélecteur de langue se trouve dans la barre du haut ; le choix est mémorisé (au premier démarrage : langue du système, anglais si elle n'est pas gérée).

## 🛠️ Développement

```bash
npm install
npm start      # lancer l'application
npm test       # tests i18n (clés et paramètres identiques dans toutes les langues)
npm run dist   # installateur Windows + version portable
```

## 🤝 Remerciements & Contributeurs

Un immense merci à **[@Renouveaux](https://github.com/Renouveaux)** pour ses contributions majeures qui ont transformé *FNIRSI 2C23T Studio* en un véritable laboratoire de mesure et d'analyse :
* **Calibration de précision :** Correction de l'échelle horizontale à 12 divisions, de la formule verticale du firmware (`754 / 20000`) et du tracé net sans flou (`shadowBlur`).
* **Outils d'oscilloscope :** Décodeurs de bus UART, I2C et SPI, curseurs de mesure, historique des captures avec superposition de référence & export CSV, mode XY et trace mathématique `CH1 ± CH2`.
* **Multilinguisme & qualité :** Architecture i18n complète (allemand, français, anglais) avec 60 tests unitaires automatisés, thème clair, raccourcis clavier et alarme sonore DMM.

Merci également à **[@rosenrot00](https://github.com/rosenrot00)** pour le développement du firmware open-source **[OpenScope-2C23T](https://github.com/rosenrot00/OpenScope-2C23T)**.

## 📜 Licence

Licence MIT — développé par **Daddelgreis74** (2026).
