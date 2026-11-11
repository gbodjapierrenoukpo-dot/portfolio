/* =====================================================================
   Portfolio géomatique — script.js
   1. Courbes de niveau animées   2. Carte Leaflet   3. Comparateur
   4. Galerie + visionneuse       5. Formulaire de contact
   ===================================================================== */
(() => {
  'use strict';

  const $ = (sel, racine = document) => racine.querySelector(sel);
  const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Outils communs pour les visuels SVG ---------- */

  // Générateur pseudo-aléatoire à graine : les dessins sont identiques à chaque chargement
  const alea = (graine) => () => {
    graine = (graine + 0x6D2B79F5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Interpolation dans une rampe de couleurs (v entre 0 et 1)
  const rampe = (couleurs, v) => {
    v = Math.min(1, Math.max(0, v));
    const n = couleurs.length - 1;
    const i = Math.min(n - 1, Math.floor(v * n));
    const f = v * n - i;
    const a = couleurs[i], b = couleurs[i + 1];
    return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * f)).join(',')})`;
  };

  const R_CHALEUR = [[95, 212, 164], [255, 224, 139], [255, 107, 53]];
  const R_HYPSO = [[38, 110, 84], [120, 170, 96], [226, 208, 140], [176, 124, 84], [245, 245, 240]];
  const R_NDVI = [[165, 0, 38], [244, 109, 67], [254, 224, 139], [166, 217, 106], [26, 152, 80], [0, 104, 55]];
  const R_MAGMA = [[28, 16, 68], [114, 31, 129], [205, 64, 113], [253, 150, 104], [252, 253, 191]];

  const svg = (contenu, boite = '0 0 400 300') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boite}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${contenu}</svg>`;

  // Contour fermé déformé (isoligne, frange, isochrone…)
  const anneau = (cx, cy, r, deforme, ex = 1, ey = 1) => {
    let d = '';
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const rr = r * deforme(a);
      d += `${k ? 'L' : 'M'}${(cx + rr * Math.cos(a) * ex).toFixed(1)} ${(cy + rr * Math.sin(a) * ey).toFixed(1)}`;
    }
    return d + 'Z';
  };

  /* =====================================================================
     1. EN-TÊTE — courbes de niveau animées
     ===================================================================== */
  function initContours() {
    const groupe = $('#contours-lignes');
    if (!groupe) return;
    const NS = 'http://www.w3.org/2000/svg';
    const sommets = [
      { x: 590, y: 240, n: 11, pas: 42, phase: 0 },
      { x: 130, y: 530, n: 6, pas: 40, phase: 2.1 },
    ];
    const lignes = [];
    sommets.forEach((s) => {
      for (let i = 1; i <= s.n; i++) {
        const p = document.createElementNS(NS, 'path');
        if (i % 5 === 0) p.setAttribute('class', 'maitresse'); // courbes maîtresses
        groupe.appendChild(p);
        lignes.push({ p, s, i });
      }
    });

    const dessiner = (t) => {
      for (const { p, s, i } of lignes) {
        p.setAttribute('d', anneau(s.x, s.y, i * s.pas, (a) =>
          1 + 0.13 * Math.sin(3 * a + s.phase + t * 0.5 + i * 0.25)
            + 0.07 * Math.sin(5 * a - t * 0.35 + i * 0.4)
            + 0.04 * Math.sin(2 * a + t * 0.2), 1.25, 0.85));
      }
    };

    dessiner(0);
    if (mouvementReduit) return;

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('#top'));
    const boucle = (ms) => {
      if (visible) dessiner(ms / 1000);
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  }

  /* =====================================================================
     2. CARTE INTERACTIVE (Leaflet)
     Les quatre fiches ci-dessous sont des EXEMPLES : remplacez-les par vos projets.
     coords = [latitude, longitude]
     ===================================================================== */
  const projets = [
    {
      titre: 'Aléa inondation en milieu urbain',
      lieu: 'Cotonou, Bénin',
      coords: [6.37, 2.39], zoom: 11,
      problematique: "Délimiter les quartiers exposés aux inondations pluviales et lagunaires afin de prioriser les ouvrages de drainage.",
      donnees: 'MNT SRTM 30 m, imagerie radar Sentinel-1 (GRD), bâti et voirie OpenStreetMap.',
      outils: 'QGIS (GRASS r.watershed, r.fill.dir), Python (rasterio, GeoPandas).',
      resultat: "Carte d'aléa en trois classes au 1:25 000 et couche vectorielle du bâti exposé.",
    },
    {
      titre: 'Suivi diachronique du recul glaciaire',
      lieu: 'Massif du Mont-Blanc, France',
      coords: [45.88, 6.93], zoom: 11,
      problematique: "Quantifier l'évolution du front et de l'épaisseur d'un glacier alpin entre deux campagnes d'acquisition.",
      donnees: 'Orthophotographies et RGE ALTI® (IGN), séries Sentinel-2 L2A, MNS photogrammétriques.',
      outils: 'QGIS (calculatrice raster, profils topographiques), Python (NumPy, rasterio).',
      resultat: "Différentiel de MNS, cartographie des fronts successifs et profils longitudinaux.",
    },
    {
      titre: 'Détection de la déforestation',
      lieu: 'Rondônia, Brésil',
      coords: [-10.8, -63.3], zoom: 8,
      problematique: "Localiser et dater les fronts de défrichement le long des axes routiers en forêt amazonienne.",
      donnees: 'Séries temporelles Landsat 8/9 (réflectance de surface), limites administratives IBGE.',
      outils: 'Google Earth Engine (NDVI, détection de ruptures), QGIS, Python (GeoPandas).',
      resultat: "Carte annuelle des pertes de couvert forestier et statistiques zonales par commune.",
    },
    {
      titre: "Occupation du sol d'un delta rizicole",
      lieu: 'Delta du Mékong, Viêt Nam',
      coords: [10.0, 105.8], zoom: 8,
      problematique: "Distinguer rizières, bassins aquacoles et mangroves pour suivre la salinisation des terres agricoles.",
      donnees: 'Mosaïque Sentinel-2 L2A (10 m), parcelles de référence photo-interprétées.',
      outils: 'QGIS (Semi-Automatic Classification Plugin), Python (scikit-learn, Random Forest).',
      resultat: "Classification supervisée en six classes, matrice de confusion et carte de synthèse.",
    },
  ];

  // Couche vectorielle GeoJSON : emprises des zones d'étude (coordonnées en [longitude, latitude])
  const zonesEtude = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { nom: "Zone d'étude — Cotonou" }, geometry: { type: 'Polygon', coordinates: [[
        [2.28, 6.33], [2.36, 6.42], [2.50, 6.44], [2.56, 6.38], [2.48, 6.34], [2.36, 6.32], [2.28, 6.33]]] } },
      { type: 'Feature', properties: { nom: "Zone d'étude — Mont-Blanc" }, geometry: { type: 'Polygon', coordinates: [[
        [6.75, 45.80], [6.82, 45.94], [6.99, 45.97], [7.07, 45.87], [6.97, 45.79], [6.84, 45.77], [6.75, 45.80]]] } },
      { type: 'Feature', properties: { nom: "Zone d'étude — Rondônia" }, geometry: { type: 'Polygon', coordinates: [[
        [-64.2, -10.2], [-63.4, -9.9], [-62.6, -10.3], [-62.5, -11.2], [-63.3, -11.5], [-64.1, -11.1], [-64.2, -10.2]]] } },
      { type: 'Feature', properties: { nom: "Zone d'étude — Delta du Mékong" }, geometry: { type: 'Polygon', coordinates: [[
        [105.2, 10.4], [105.9, 10.6], [106.5, 10.2], [106.4, 9.6], [105.7, 9.3], [105.1, 9.7], [105.2, 10.4]]] } },
    ],
  };

  // Clé d'API CARTO pour le fond Dark Matter : gratuite pour un usage non commercial,
  // à demander sur https://carto.com/basemaps/apikey puis à coller entre les guillemets.
  const CLE_CARTO = '';

  /* ---------- Outils de mesure : distance (polyligne) et surface (polygone) ---------- */
  function initMesures(carte) {
    const STYLE = { color: '#ff6b35', weight: 3, fillColor: '#ff6b35', fillOpacity: 0.18 };
    const mesures = L.featureGroup().addTo(carte);   // mesures terminées
    const brouillon = L.featureGroup().addTo(carte); // tracé en cours
    let mode = null;      // 'distance' | 'surface' | null
    let points = [];
    let trace = null;

    // Formatage : mètres ou kilomètres, hectares ou km²
    const nombre = (v, decimales = 2) => v.toLocaleString('fr-FR', { maximumFractionDigits: decimales });
    const formatDistance = (m) => (m < 1000 ? `${nombre(m, m < 100 ? 1 : 0)} m` : `${nombre(m / 1000)} km`);
    const formatSurface = (m2) => (m2 < 1e6 ? `${nombre(m2 / 1e4)} ha` : `${nombre(m2 / 1e6)} km²`);

    // Longueur géodésique (formule de haversine, fournie par Leaflet)
    const longueur = (pts) => pts.reduce((somme, p, i) => (i ? somme + carte.distance(pts[i - 1], p) : 0), 0);
    // Surface géodésique sur la sphère (rayon équatorial WGS 84)
    const surface = (pts) => {
      const R = 6378137, rad = Math.PI / 180;
      let total = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        total += (b.lng - a.lng) * rad * (2 + Math.sin(a.lat * rad) + Math.sin(b.lat * rad));
      }
      return Math.abs(total * R * R / 2);
    };
    const valeur = (pts) => (mode === 'distance' ? formatDistance(longueur(pts)) : formatSurface(surface(pts)));

    // Barre d'outils flottante
    const icones = {
      distance: '<path d="M3 17L17 3"/><circle cx="3" cy="17" r="2"/><circle cx="17" cy="3" r="2"/>',
      surface: '<path d="M4 6L15 3L17 14L7 17Z"/>',
      terminer: '<path d="M4 10.5L8.5 15L16 5.5"/>',
      effacer: '<path d="M4 6H16M8 6V4H12V6M6 6L7 17H13L14 6"/>',
    };
    const boutons = {};
    let info;
    const Barre = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const barre = L.DomUtil.create('div', 'outils-mesure');
        barre.setAttribute('role', 'toolbar');
        barre.setAttribute('aria-label', 'Outils de mesure');
        const ajouter = (cle, libelle, action) => {
          const b = L.DomUtil.create('button', 'outil-mesure', barre);
          b.type = 'button';
          b.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${icones[cle]}</svg><span>${libelle}</span>`;
          b.addEventListener('click', action);
          boutons[cle] = b;
        };
        ajouter('distance', 'Distance', () => demarrer('distance'));
        ajouter('surface', 'Surface', () => demarrer('surface'));
        ajouter('terminer', 'Terminer', () => terminer());
        ajouter('effacer', 'Effacer les mesures', () => { annuler(); mesures.clearLayers(); afficher(''); });
        boutons.terminer.hidden = true;
        info = L.DomUtil.create('p', 'info-mesure', barre);
        info.setAttribute('role', 'status');
        info.hidden = true;
        L.DomEvent.disableClickPropagation(barre);
        L.DomEvent.disableScrollPropagation(barre);
        return barre;
      },
    });
    carte.addControl(new Barre());

    const afficher = (texte) => { info.textContent = texte; info.hidden = !texte; };
    const majBoutons = () => {
      ['distance', 'surface'].forEach((m) => {
        boutons[m].classList.toggle('actif', mode === m);
        boutons[m].setAttribute('aria-pressed', mode === m);
      });
      boutons.terminer.hidden = !mode;
      carte.getContainer().classList.toggle('mesure-active', !!mode);
    };

    function annuler() {
      mode = null; points = []; trace = null;
      brouillon.clearLayers();
      // Réactive le zoom au double-clic, mais seulement après le double-clic de fin de tracé
      // et si aucun nouvel outil n'a été activé entre-temps
      setTimeout(() => { if (!mode) carte.doubleClickZoom.enable(); }, 300);
      majBoutons();
    }

    function demarrer(nouveauMode) {
      const dejaActif = mode === nouveauMode;
      annuler();
      if (dejaActif) { afficher(''); return; } // second clic sur le bouton : on quitte l'outil
      mode = nouveauMode;
      carte.closePopup();
      carte.doubleClickZoom.disable();
      majBoutons();
      afficher(mode === 'distance'
        ? 'Cliquez pour tracer la ligne, double-cliquez pour terminer.'
        : 'Cliquez pour placer les sommets du polygone, double-cliquez pour terminer.');
    }

    function dessiner(pts) {
      if (!trace) {
        trace = (mode === 'distance' ? L.polyline(pts, STYLE) : L.polygon(pts, STYLE)).addTo(brouillon);
        trace.options.interactive = false;
      } else {
        trace.setLatLngs(pts);
      }
      const minimum = mode === 'distance' ? 2 : 3;
      if (pts.length >= minimum) afficher(`${mode === 'distance' ? 'Distance' : 'Surface'} : ${valeur(pts)}`);
    }

    function terminer() {
      if (!mode) return;
      const minimum = mode === 'distance' ? 2 : 3;
      if (points.length < minimum) {
        annuler();
        afficher(`Mesure annulée : il faut au moins ${minimum} points.`);
        return;
      }
      const texte = valeur(points);
      const forme = (mode === 'distance' ? L.polyline(points, STYLE) : L.polygon(points, STYLE)).addTo(mesures);
      forme.bindTooltip(texte, { permanent: true, direction: 'center', className: 'etiquette-mesure' });
      const libelle = mode === 'distance' ? 'Distance' : 'Surface';
      annuler();
      afficher(`${libelle} : ${texte}`);
    }

    carte.on('click', (e) => {
      if (!mode) return;
      const dernier = points[points.length - 1];
      // Ignore les clics doublons générés par un double-clic
      if (dernier && carte.latLngToContainerPoint(dernier).distanceTo(e.containerPoint) < 5) return;
      points.push(e.latlng);
      L.circleMarker(e.latlng, { radius: 4, color: '#fff', weight: 2, fillColor: '#ff6b35', fillOpacity: 1, interactive: false }).addTo(brouillon);
      dessiner(points);
    });
    carte.on('mousemove', (e) => { if (mode && points.length) dessiner([...points, e.latlng]); });
    carte.on('dblclick', () => terminer());
    document.addEventListener('keydown', (e) => {
      if (!mode) return;
      if (e.key === 'Escape') { annuler(); afficher(''); }
      if (e.key === 'Enter') terminer();
    });
  }

  function initCarte() {
    const conteneur = $('#carte');
    if (!conteneur) return;
    if (!window.L) {
      conteneur.innerHTML = '<p style="padding:24px;color:#93a199">La carte n\'a pas pu être chargée (connexion Internet requise pour Leaflet).</p>';
      return;
    }

    const VUE_INITIALE = { centre: [15, 25], zoom: 2 };
    const carte = L.map(conteneur, {
      center: VUE_INITIALE.centre, zoom: VUE_INITIALE.zoom,
      minZoom: 2, worldCopyJump: true, scrollWheelZoom: false,
    });

    // Fonds de carte
    // Dark Matter (CartoDB) exige une clé d'API CARTO (voir CLE_CARTO en haut de cette section).
    // Sans clé, un fond sombre équivalent d'Esri est utilisé à la place.
    const fondSombre = CLE_CARTO
      ? L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CLE_CARTO)}`, {
        subdomains: 'abcd', maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      })
      : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tuiles &copy; Esri — HERE, Garmin, &copy; OpenStreetMap contributors',
      });
    const nomFondSombre = CLE_CARTO ? 'Dark Matter (CartoDB)' : 'Sombre (Esri Dark Gray)';

    const fonds = {
      [nomFondSombre]: fondSombre,
      'Satellite (Esri World Imagery)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Tuiles &copy; Esri — Maxar, Earthstar Geographics',
      }),
      'Topographie (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      }),
    };
    fondSombre.addTo(carte);

    // Couche GeoJSON activable / désactivable
    const coucheZones = L.geoJSON(zonesEtude, {
      style: { color: '#5fd4a4', weight: 2, dashArray: '6 4', fillColor: '#5fd4a4', fillOpacity: 0.15 },
      onEachFeature: (entite, couche) => couche.bindTooltip(entite.properties.nom, { sticky: true }),
    }).addTo(carte);

    L.control.layers(fonds, { "Zones d'étude (GeoJSON)": coucheZones }, { position: 'topright', collapsed: false }).addTo(carte);
    L.control.scale({ imperial: false }).addTo(carte);
    initMesures(carte);

    // Marqueurs personnalisés + fiches
    const fiche = (p) => `
      <article class="fiche">
        <p class="fiche-lieu">${p.lieu}</p>
        <h3>${p.titre}</h3>
        <dl>
          <dt>Problématique</dt><dd>${p.problematique}</dd>
          <dt>Données sources</dt><dd>${p.donnees}</dd>
          <dt>Outils QGIS / Python</dt><dd>${p.outils}</dd>
          <dt>Résultat</dt><dd>${p.resultat}</dd>
        </dl>
      </article>`;

    const puces = $('#puces-projets');
    projets.forEach((p, i) => {
      const icone = L.divIcon({
        className: 'marqueur', html: `<span><b>${i + 1}</b></span>`,
        iconSize: [34, 34], iconAnchor: [17, 40], popupAnchor: [0, -40],
      });
      const marqueur = L.marker(p.coords, { icon: icone, title: p.titre, alt: p.titre })
        .bindPopup(fiche(p), { maxWidth: 330, minWidth: 240 })
        .addTo(carte);

      const puce = document.createElement('button');
      puce.className = 'puce';
      puce.type = 'button';
      puce.innerHTML = `<b>${i + 1}</b>${p.lieu}`;
      puce.addEventListener('click', () => {
        carte.closePopup();
        carte.once('moveend', () => marqueur.openPopup()); // la fiche s'ouvre une fois le vol terminé
        carte.flyTo(p.coords, p.zoom, { duration: mouvementReduit ? 0 : 1.6 });
      });
      puces.appendChild(puce);
    });

    const retour = document.createElement('button');
    retour.className = 'puce';
    retour.type = 'button';
    retour.textContent = 'Vue monde';
    retour.addEventListener('click', () => {
      carte.closePopup();
      carte.flyTo(VUE_INITIALE.centre, VUE_INITIALE.zoom, { duration: mouvementReduit ? 0 : 1.2 });
    });
    puces.appendChild(retour);

    // Barre d'état : latitude, longitude, zoom
    const stLat = $('#st-lat'), stLon = $('#st-lon'), stZoom = $('#st-zoom');
    const afficherPosition = (ll) => {
      const { lat, lng } = ll.wrap();
      stLat.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
      stLon.textContent = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'O'}`;
    };
    const afficherZoom = () => { stZoom.textContent = carte.getZoom(); };
    carte.on('mousemove', (e) => afficherPosition(e.latlng));
    carte.on('zoomend', afficherZoom);
    afficherPosition(carte.getCenter());
    afficherZoom();

    // Zoom molette actif seulement après un clic (évite de piéger le défilement de la page)
    carte.on('click', () => carte.scrollWheelZoom.enable());
    carte.on('mouseout', () => carte.scrollWheelZoom.disable());
  }

  /* =====================================================================
     3. COMPARATEUR AVANT / APRÈS
     La même scène est dessinée deux fois : "sat" (image brute) et "classe".
     ===================================================================== */
  function scene(mode) {
    const sat = mode === 'sat';
    const C = sat
      ? { foret: '#22402a', prairie: '#4f6b3a', solnu: '#8f7a5e', eau: '#1b3542', bati: '#6f6b63', route: '#b9b3a4' }
      : { foret: '#1b7837', prairie: '#a6d96a', solnu: '#c2a57a', eau: '#2b83ba', bati: '#d73027', route: '#d73027' };
    const a = alea(42);
    let s = `<rect width="800" height="450" fill="${C.foret}"/>`;

    if (sat) { // texture de canopée
      const verts = ['#1b3523', '#2a4a31', '#1f3b27', '#2f5236'];
      for (let i = 0; i < 140; i++) {
        s += `<circle cx="${(a() * 800).toFixed(0)}" cy="${(a() * 450).toFixed(0)}" r="${(6 + a() * 26).toFixed(0)}" fill="${verts[i % 4]}" opacity=".6"/>`;
      }
    }

    // Savane / prairie et sol nu
    s += `<path d="M0 0H330C300 70 220 130 120 150C70 160 30 150 0 165Z" fill="${C.prairie}"/>`;
    s += `<path d="M560 0H800V95C740 120 660 100 610 60C590 40 570 20 560 0Z" fill="${C.solnu}"/>`;

    // Parcellaire agricole
    const teintes = ['#6b7a3c', '#8a8648', '#a39558', '#566b35', '#7d6f47', '#93a34f'];
    s += '<g transform="rotate(-7 200 340)">';
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        const couleur = sat ? teintes[Math.floor(a() * teintes.length)] : '#fee08b';
        s += `<rect x="${30 + i * 64}" y="${278 + j * 40}" width="${sat ? 60 : 64.5}" height="${sat ? 36 : 40.5}" fill="${couleur}"/>`;
      }
    }
    s += '</g>';

    // Réseau hydrographique
    s += `<path d="M-20 210C120 150 230 260 400 215S640 110 820 190" fill="none" stroke="${C.eau}" stroke-width="24" stroke-linecap="round"/>`;
    s += `<path d="M610 330C650 300 720 310 740 350C755 385 700 415 650 405C605 395 585 355 610 330Z" fill="${C.eau}"/>`;

    // Route et tissu bâti
    s += `<path d="M440 285L250 258L-10 246" fill="none" stroke="${C.route}" stroke-width="${sat ? 2.5 : 4}"/>`;
    s += '<g transform="rotate(10 510 280)">';
    s += `<rect x="432" y="218" width="160" height="92" fill="${C.bati}"/>`;
    if (sat) {
      const gris = ['#9c978d', '#b5b0a6', '#857f76', '#c4beb2'];
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 5; j++) {
          s += `<rect x="${437 + i * 22}" y="${223 + j * 17}" width="18" height="13" fill="${gris[Math.floor(a() * 4)]}"/>`;
        }
      }
    }
    s += '</g>';

    if (sat) { // bruit radiométrique
      s += `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/>
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter>
        <rect width="800" height="450" filter="url(#grain)" opacity=".5"/>`;
    }
    return svg(s, '0 0 800 450');
  }

  function initComparateur() {
    const boite = $('#compare');
    if (!boite) return;
    $('#cmp-avant').innerHTML = scene('sat');
    $('#cmp-apres').innerHTML = scene('classe');

    const poignee = $('#cmp-poignee');
    let position = 50;
    const placer = (v) => {
      position = Math.min(100, Math.max(0, v));
      boite.style.setProperty('--pos', position + '%');
      poignee.setAttribute('aria-valuenow', Math.round(position));
    };
    const depuisPointeur = (e) => {
      const r = boite.getBoundingClientRect();
      placer(((e.clientX - r.left) / r.width) * 100);
    };

    let glisse = false;
    boite.addEventListener('pointerdown', (e) => {
      glisse = true;
      try { boite.setPointerCapture(e.pointerId); } catch (_) { /* pointeur non capturable */ }
      depuisPointeur(e);
    });
    boite.addEventListener('pointermove', (e) => { if (glisse) depuisPointeur(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) =>
      boite.addEventListener(type, () => { glisse = false; }));
    poignee.addEventListener('keydown', (e) => {
      const pas = { ArrowLeft: -4, ArrowRight: 4, Home: -100, End: 100 }[e.key];
      if (pas) { e.preventDefault(); placer(position + pas); }
    });
  }

  /* =====================================================================
     4. GALERIE + VISIONNEUSE
     Les six visuels sont des SVG générés par le code. Pour utiliser vos propres
     images : remplacez "visuel" par une fonction qui renvoie
     '<img src="images/ma-carte.jpg" alt="…" style="width:100%;height:100%;object-fit:cover">'
     ===================================================================== */

  // Cartographie 3D — profils de crêtes empilés
  function artCretes() {
    let s = '<rect width="400" height="300" fill="#0b1620"/>';
    for (let r = 0; r < 30; r++) {
      const y0 = 72 + r * 7.2;
      let d = `M-5 ${y0}`;
      for (let x = 0; x <= 400; x += 4) {
        const enveloppe = Math.exp(-(((x - 200 - 25 * Math.sin(r * 0.35)) / 85) ** 2));
        const relief = Math.max(0, 0.55 + 0.45 * Math.sin(x * 0.07 + r * 0.9) + 0.3 * Math.sin(x * 0.19 + r * 1.7));
        d += `L${x} ${(y0 - 62 * enveloppe * relief).toFixed(1)}`;
      }
      s += `<path d="${d}L405 ${y0}" fill="#0b1620" stroke="${rampe(R_CHALEUR, r / 29)}" stroke-width="1.1"/>`;
    }
    return svg(s);
  }

  // Cartographie 3D — bloc-diagramme isométrique d'un MNT
  function artBlocDiagramme() {
    const N = 23;
    const z = (i, j) => 46 * Math.exp(-((i - 14) ** 2 + (j - 8) ** 2) / 38)
      + 22 * Math.exp(-((i - 6) ** 2 + (j - 16) ** 2) / 24)
      + 2.5 * Math.sin(i * 0.9) * Math.cos(j * 0.8) + 3;
    const P = (i, j) => `${(200 + (i - j) * 8).toFixed(1)},${(98 + (i + j) * 4.1 - z(i, j)).toFixed(1)}`;
    let s = '<rect width="400" height="300" fill="#10161c"/>';
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const altitude = (z(i, j) + z(i + 1, j + 1)) / 2;
        const ombrage = Math.max(-0.12, Math.min(0.12, (z(i, j + 1) - z(i + 1, j)) * 0.03));
        s += `<polygon points="${P(i, j)} ${P(i + 1, j)} ${P(i + 1, j + 1)} ${P(i, j + 1)}" fill="${rampe(R_HYPSO, altitude / 50 + ombrage)}" stroke="#10161c" stroke-width=".35"/>`;
      }
    }
    return svg(s);
  }

  // Télédétection — raster NDVI
  function artNDVI() {
    let s = '<g shape-rendering="crispEdges">';
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 40; x++) {
        let v = 0.58 + 0.24 * Math.sin(x * 0.21 + y * 0.13) + 0.2 * Math.sin(x * 0.07 - y * 0.29) + 0.1 * Math.sin(x * 0.9 + y * 0.7);
        if (Math.abs(y - (15 + 5 * Math.sin(x * 0.18))) < 1.3) v = 0.04; // cours d'eau
        s += `<rect x="${x * 10}" y="${y * 10}" width="10.5" height="10.5" fill="${rampe(R_NDVI, v)}"/>`;
      }
    }
    return svg(s + '</g>');
  }

  // Télédétection — interférogramme radar (franges de déformation)
  function artInSAR() {
    let s = '<rect width="400" height="300" fill="#000"/>';
    for (let i = 72; i >= 1; i--) {
      const d = anneau(235, 140, i * 5.5, (a) => 1 + 0.12 * Math.sin(2 * a + 0.6) + 0.05 * Math.sin(3 * a + i * 0.05), 1.15, 0.8);
      s += `<path d="${d}" fill="hsl(${(i * 40) % 360} 85% 55%)"/>`;
    }
    s += '<path d="M70 262L345 30" stroke="#fff" stroke-width="1.6" stroke-dasharray="7 5" opacity=".85"/>';
    return svg(s);
  }

  // Analyse urbaine — densité bâtie par îlot
  function artDensite() {
    const a = alea(7);
    let s = '<rect width="400" height="300" fill="#191c22"/>';
    let x = 6;
    while (x < 392) {
      const l = Math.min(30 + a() * 30, 394 - x);
      let y = 6;
      while (y < 292) {
        const h = Math.min(24 + a() * 26, 294 - y);
        const n = 1 + Math.floor(a() * 3);
        const lb = (l - (n - 1) * 2) / n;
        const densite = Math.max(0, 1 - Math.hypot(x + l / 2 - 200, y + h / 2 - 150) / 230) * 0.8 + a() * 0.25;
        for (let k = 0; k < n; k++) {
          s += `<rect x="${(x + k * (lb + 2)).toFixed(1)}" y="${y.toFixed(1)}" width="${lb.toFixed(1)}" height="${h.toFixed(1)}" fill="${rampe(R_MAGMA, densite)}"/>`;
        }
        y += h + 5;
      }
      x += l + 5;
    }
    s += '<path d="M-10 236L410 58" stroke="#191c22" stroke-width="10"/>';
    return svg(s);
  }

  // Analyse urbaine — isochrones d'accessibilité
  function artIsochrones() {
    const a = alea(21);
    let s = '<rect width="400" height="300" fill="#0e1722"/><g stroke="#fff" stroke-opacity=".16" stroke-width="1">';
    for (let i = 0; i < 14; i++) {
      const y = a() * 320 - 20, x = a() * 440;
      s += `<path d="M-20 ${y.toFixed(0)}L420 ${(y + 34).toFixed(0)}"/><path d="M${x.toFixed(0)} -20L${(x - 40).toFixed(0)} 320"/>`;
    }
    s += '</g>';
    const rayons = [138, 102, 68, 36];
    const couleurs = ['#253494', '#2c7fb8', '#41b6c4', '#c7e9b4'];
    rayons.forEach((r, i) => {
      const d = anneau(200, 150, r, (ang) => 1 + 0.18 * Math.cos(4 * ang + 0.5) + 0.08 * Math.sin(7 * ang + i));
      s += `<path d="${d}" fill="${couleurs[i]}" fill-opacity=".62" stroke="${couleurs[i]}" stroke-width="1.2"/>`;
    });
    s += '<circle cx="200" cy="150" r="9" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="200" cy="150" r="3.5" fill="#fff"/>';
    return svg(s);
  }

  // Contenu de la galerie (EXEMPLES à remplacer par vos réalisations)
  const creations = [
    {
      titre: 'Lignes de crête du massif alpin', cat: 'Cartographie 3D', visuel: artCretes,
      desc: "Profils topographiques empilés extraits d'un MNT : chaque ligne est une coupe est-ouest du relief.",
      epsg: 'EPSG:2154 — RGF93 v1 / Lambert-93',
      sources: 'RGE ALTI® 5 m (IGN)',
      logiciels: 'QGIS, Python (rasterio, Matplotlib)',
    },
    {
      titre: 'Bloc-diagramme hypsométrique', cat: 'Cartographie 3D', visuel: artBlocDiagramme,
      desc: "Vue isométrique d'un modèle numérique de terrain, drapée d'une rampe hypsométrique avec ombrage.",
      epsg: 'EPSG:32631 — WGS 84 / UTM zone 31N',
      sources: 'SRTM 1 seconde d\'arc (NASA / USGS)',
      logiciels: 'QGIS (Qgis2threejs), Blender',
    },
    {
      titre: 'Indice de végétation NDVI', cat: 'Télédétection', visuel: artNDVI,
      desc: "Indice de végétation par différence normalisée calculé à partir des bandes rouge et proche infrarouge.",
      epsg: 'EPSG:32648 — WGS 84 / UTM zone 48N',
      sources: 'Sentinel-2 L2A, bandes B4 et B8 à 10 m (Copernicus)',
      logiciels: 'Google Earth Engine, QGIS',
    },
    {
      titre: 'Interférogramme radar différentiel', cat: 'Télédétection', visuel: artInSAR,
      desc: "Franges d'interférence révélant une déformation du sol de part et d'autre d'une faille.",
      epsg: 'EPSG:4326 — WGS 84',
      sources: 'Couple Sentinel-1 SLC, mode IW (Copernicus)',
      logiciels: 'ESA SNAP, QGIS',
    },
    {
      titre: 'Densité bâtie par îlot', cat: 'Analyse Urbaine', visuel: artDensite,
      desc: "Emprise au sol du bâti agrégée à l'îlot : la rampe de couleurs traduit le gradient centre-périphérie.",
      epsg: 'EPSG:32631 — WGS 84 / UTM zone 31N',
      sources: 'OpenStreetMap, Google Open Buildings',
      logiciels: 'PostGIS, QGIS',
    },
    {
      titre: "Isochrones d'accessibilité piétonne", cat: 'Analyse Urbaine', visuel: artIsochrones,
      desc: "Zones atteignables à pied en 5, 10, 15 et 20 minutes depuis un équipement, calculées sur le graphe viaire.",
      epsg: 'EPSG:32631 — WGS 84 / UTM zone 31N',
      sources: 'Réseau viaire OpenStreetMap',
      logiciels: 'QGIS (QNEAT3), Python (OSMnx, NetworkX)',
    },
  ];

  function initGalerie() {
    const grille = $('#grille-galerie');
    const visionneuse = $('#visionneuse');
    if (!grille || !visionneuse) return;

    const ouvrir = (c) => {
      $('#vis-visuel').innerHTML = c.visuel();
      $('#vis-cat').textContent = c.cat;
      $('#vis-titre').textContent = c.titre;
      $('#vis-desc').textContent = c.desc;
      $('#vis-epsg').textContent = c.epsg;
      $('#vis-sources').textContent = c.sources;
      $('#vis-logiciels').textContent = c.logiciels;
      visionneuse.showModal();
    };

    creations.forEach((c) => {
      const vignette = document.createElement('button');
      vignette.type = 'button';
      vignette.className = 'vignette';
      vignette.dataset.cat = c.cat;
      vignette.setAttribute('aria-label', `${c.titre} — ouvrir en grand`);
      vignette.innerHTML = `${c.visuel()}<span class="vignette-texte"><span class="vignette-cat">${c.cat}</span><span class="vignette-titre">${c.titre}</span></span>`;
      vignette.addEventListener('click', () => ouvrir(c));
      grille.appendChild(vignette);
    });

    // Filtres par catégorie
    const filtres = [...document.querySelectorAll('.filtre')];
    filtres.forEach((bouton) => bouton.addEventListener('click', () => {
      filtres.forEach((b) => {
        b.classList.toggle('actif', b === bouton);
        b.setAttribute('aria-pressed', b === bouton);
      });
      const cat = bouton.dataset.cat;
      grille.querySelectorAll('.vignette').forEach((v) => { v.hidden = cat !== 'tous' && v.dataset.cat !== cat; });
    }));

    // Fermeture : bouton, clic sur le fond (Échap est géré nativement par <dialog>)
    $('#vis-fermer').addEventListener('click', () => visionneuse.close());
    visionneuse.addEventListener('click', (e) => { if (e.target === visionneuse) visionneuse.close(); });
  }

  /* =====================================================================
     5. FORMULAIRE DE CONTACT (façade : validation uniquement, aucun envoi)
     Pour un envoi réel : créez un formulaire sur https://formspree.io puis
     remplacez le bloc "Simulation" par un fetch() vers l'adresse fournie.
     ===================================================================== */
  function initFormulaire() {
    const formulaire = $('#formulaire');
    if (!formulaire) return;
    const etat = $('#form-etat');

    formulaire.addEventListener('input', (e) => e.target.classList.remove('invalide'));
    formulaire.addEventListener('submit', (e) => {
      e.preventDefault();
      const champs = [...formulaire.elements].filter((c) => c.willValidate);
      const fautifs = champs.filter((c) => !c.checkValidity());
      champs.forEach((c) => c.classList.toggle('invalide', fautifs.includes(c)));

      if (fautifs.length) {
        etat.className = 'form-etat erreur';
        etat.textContent = 'Merci de renseigner votre nom, une adresse e-mail valide et un message d\'au moins 10 caractères.';
        fautifs[0].focus();
        return;
      }

      // Simulation
      const prenom = formulaire.elements.nom.value.trim().split(/\s+/)[0];
      etat.className = 'form-etat ok';
      etat.textContent = `Merci ${prenom} ! Votre message est validé (démonstration : l'envoi réel n'est pas encore branché).`;
      formulaire.reset();
    });
  }

  /* ---------- Démarrage : chaque module est isolé pour qu'une erreur n'arrête pas les autres ---------- */
  [initContours, initCarte, initComparateur, initGalerie, initFormulaire].forEach((init) => {
    try { init(); } catch (erreur) { console.error(`[portfolio] ${init.name} :`, erreur); }
  });
})();
