/* Mapa de siembra CONAFOR
 * Polígonos en UTM 14N (EPSG:32614) -> WGS84 para Leaflet.
 * Las plantas se generan en metros (UTM) y se dibujan en una capa de canvas por teselas,
 * así el mapa aguanta >100 mil plantas sin crear un marcador por planta.
 */
(function () {
  "use strict";

  // ---------- Configuración ----------
  // Arreglo de plantación: plantas cada 8 m sobre la hilera, hileras a 2 m,
  // hileras alternas desplazadas 4 m (tresbolillo, 16 m² por planta = 625 plantas/ha).
  const MARCO = { enHilera: 8, entreHileras: 2, desfase: 4 };

  // `img`: ruta a la imagen de la especie (png/svg con fondo transparente). Con null se dibuja
  // un hexágono de su color. `color` se usa en la vista lejana, donde cada planta es un punto.
  const ESPECIES = [
    { id: "lech", nombre: "Agave lechuguilla",        color: "#8fc80c", peso: 7,  img: "img/lech.png" },
    { id: "salm", nombre: "Agave salmiana",           color: "#00dc7f", peso: 24, img: "img/salm.png" },
    { id: "scab", nombre: "Agave scabra",             color: "#0073ac", peso: 7,  img: "img/scab.png" },
    { id: "stri", nombre: "Agave striata",            color: "#ffed49", peso: 6,  img: "img/stri.png" },
    { id: "cant", nombre: "Opuntia cantabrigiensis",  color: "#10b509", peso: 7,  img: "img/cant.png" },
    { id: "enge", nombre: "Opuntia engelmannii",      color: "#6f44eb", peso: 6,  img: "img/enge.png" },
    { id: "robu", nombre: "Opuntia robusta",          color: "#37ffd6", peso: 10, img: "img/robu.png" },
    { id: "stre", nombre: "Opuntia streptacantha",    color: "#00ac98", peso: 10, img: "img/stre.png" },
    { id: "pros", nombre: "Prosopis laevigata",       color: "#ffa730", peso: 12, img: "img/pros.png" },
    { id: "yucc", nombre: "Yucca filifera",           color: "#ff5cab", peso: 4,  img: "img/yucc.png" },
    { id: "vaci", nombre: "vacío",                    color: "#d9d6cf", peso: 2,  img: null },
  ];
  const TASA_CAMBIADA = 0.003; // solo para la distribución simulada
  const CELDA = 50;            // m, índice espacial

  // ---------- Proyección UTM <-> geográficas (WGS84) ----------
  const A = 6378137, F = 1 / 298.257223563, K0 = 0.9996;
  const E2 = F * (2 - F), EP2 = E2 / (1 - E2);
  const ZONA = 14, LON0 = ((ZONA - 1) * 6 - 180 + 3) * Math.PI / 180;
  const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

  function utmALatLng(E, N) {
    const x = E - 500000, M = N / K0;
    const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
    const p1 = mu + (3 * E1 / 2 - 27 * E1 ** 3 / 32) * Math.sin(2 * mu)
      + (21 * E1 ** 2 / 16 - 55 * E1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * E1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * E1 ** 4 / 512) * Math.sin(8 * mu);
    const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
    const N1 = A / Math.sqrt(1 - E2 * s * s), T1 = t * t, C1 = EP2 * c * c;
    const R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5), D = x / (N1 * K0);
    const lat = p1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / c;
    return [lat * 180 / Math.PI, lon * 180 / Math.PI];
  }

  function latLngAUtm(latDeg, lonDeg) {
    const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
    const s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat);
    const N = A / Math.sqrt(1 - E2 * s * s), T = t * t, C = EP2 * c * c, Aa = c * (lon - LON0);
    const M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * lat
      - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * lat)
      + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * lat)
      - (35 * E2 ** 3 / 3072) * Math.sin(6 * lat));
    const E = K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
    const Nn = K0 * (M + N * t * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
    return [E, Nn];
  }

  // ---------- Geometría ----------
  function dentro(x, y, ring) {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function bbox(ring) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return [a, b, c, d];
  }
  // Punto de etiqueta: el centro de la hilera interior más larga cerca del centro vertical
  function puntoEtiqueta(ring) {
    const [x0, y0, x1, y1] = bbox(ring);
    let mejor = null, largo = -1;
    for (let k = 3; k <= 7; k++) {
      const y = y0 + (y1 - y0) * k / 10, xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const l = xs[i + 1] - xs[i] - Math.abs(k - 5) * 8;
        if (l > largo) { largo = l; mejor = [(xs[i] + xs[i + 1]) / 2, y]; }
      }
    }
    return mejor || [(x0 + x1) / 2, (y0 + y1) / 2];
  }

  // ---------- Datos ----------
  const POLIS = POLIGONOS_UTM.map(p => ({ ...p, bb: bbox(p.ring), ll: p.ring.map(([x, y]) => utmALatLng(x, y)) }));
  const AREA_TOTAL = POLIS.reduce((s, p) => s + p.ha, 0);

  // PRNG determinista por posición en la retícula, para que la distribución simulada no cambie entre visitas
  function hash(i, j, s) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const PESO_TOTAL = ESPECIES.reduce((s, e) => s + e.peso, 0);
  function especieAleatoria(r) {
    let acc = 0;
    for (let k = 0; k < ESPECIES.length; k++) { acc += ESPECIES[k].peso / PESO_TOTAL; if (r < acc) return k; }
    return ESPECIES.length - 1;
  }

  // Almacén columnar de plantas
  let P = null;

  function construirIndice(n, E, N) {
    const [gx0, gy0] = [Math.floor(AREA_BB[0] / CELDA), Math.floor(AREA_BB[1] / CELDA)];
    const gw = Math.ceil(AREA_BB[2] / CELDA) - gx0 + 1, gh = Math.ceil(AREA_BB[3] / CELDA) - gy0 + 1;
    const conteo = new Uint32Array(gw * gh + 1);
    const celda = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      const cx = Math.floor(E[k] / CELDA) - gx0, cy = Math.floor(N[k] / CELDA) - gy0;
      const c = (cx < 0 || cy < 0 || cx >= gw || cy >= gh) ? -1 : cy * gw + cx;
      celda[k] = c; if (c >= 0) conteo[c + 1]++;
    }
    for (let c = 0; c < gw * gh; c++) conteo[c + 1] += conteo[c];
    const orden = new Uint32Array(n), pos = conteo.slice(0, gw * gh);
    for (let k = 0; k < n; k++) if (celda[k] >= 0) orden[pos[celda[k]]++] = k;
    return { gx0, gy0, gw, gh, inicio: conteo, orden };
  }

  const AREA_BB = (() => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of POLIS) { b[0] = Math.min(b[0], p.bb[0]); b[1] = Math.min(b[1], p.bb[1]); b[2] = Math.max(b[2], p.bb[2]); b[3] = Math.max(b[3], p.bb[3]); }
    return b;
  })();

  function cargarPlantas(lista, fuente) {
    // lista: arreglo de {E, N, esp, pol, cambiada, hilera, pos}
    const n = lista.length;
    const st = {
      n, fuente,
      E: new Float64Array(n), N: new Float64Array(n), lat: new Float64Array(n), lng: new Float64Array(n),
      esp: new Uint8Array(n), pol: new Uint8Array(n), cam: new Uint8Array(n),
      hil: new Int32Array(n), pos: new Int32Array(n),
    };
    for (let k = 0; k < n; k++) {
      const o = lista[k];
      const E = Array.isArray(o) ? o[0] : o.E, N = Array.isArray(o) ? o[1] : o.N;
      st.E[k] = E; st.N[k] = N; st.esp[k] = Array.isArray(o) ? o[2] : o.esp;
      st.pol[k] = (Array.isArray(o) ? o[3] : o.pol) || 0;
      st.cam[k] = (Array.isArray(o) ? o[6] : o.cambiada) ? 1 : 0;
      st.hil[k] = Array.isArray(o) ? o[4] : (o.hilera ?? -1);
      st.pos[k] = Array.isArray(o) ? o[5] : (o.pos ?? -1);
      const [la, lo] = utmALatLng(E, N); st.lat[k] = la; st.lng[k] = lo;
    }
    st.idx = construirIndice(n, st.E, st.N);
    st.porPol = new Map();
    for (const p of POLIS) st.porPol.set(p.p, new Uint32Array(ESPECIES.length));
    for (let k = 0; k < n; k++) { const m = st.porPol.get(st.pol[k]); if (m) m[st.esp[k]]++; }
    P = st;
  }

  function generarSimulada() {
    const { enHilera, entreHileras, desfase } = MARCO;
    const j0 = Math.floor(AREA_BB[1] / entreHileras), j1 = Math.ceil(AREA_BB[3] / entreHileras);
    const lista = [];
    for (const p of POLIS) {
      const [x0, y0, x1, y1] = p.bb;
      for (let j = Math.max(j0, Math.floor(y0 / entreHileras)); j <= Math.min(j1, Math.ceil(y1 / entreHileras)); j++) {
        const y = j * entreHileras, off = (j & 1) ? desfase : 0;
        for (let i = Math.floor((x0 - off) / enHilera); i * enHilera + off <= x1; i++) {
          const x = i * enHilera + off;
          if (!dentro(x, y, p.ring)) continue;
          if (reclamado.has(i + "," + j)) continue;
          reclamado.add(i + "," + j);
          lista.push({
            E: x, N: y, pol: p.p,
            hilera: j - Math.floor(y0 / entreHileras) + 1, pos: i - Math.floor(x0 / enHilera) + 1, // relativas al polígono
            esp: especieAleatoria(hash(i, j, 7)),
            cambiada: hash(i, j, 13) < TASA_CAMBIADA,
          });
        }
      }
    }
    reclamado.clear();
    cargarPlantas(lista, "simulada");
  }
  const reclamado = new Set(); // evita duplicar plantas sobre linderos compartidos

  // ---------- Mapa ----------
  const map = L.map("mapa", {
    zoomControl: false, maxZoom: 22, minZoom: 13, zoomSnap: 0.25, wheelPxPerZoomLevel: 90,
    preferCanvas: true, attributionControl: true,
  });
  L.control.zoom({ position: "topright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false, maxWidth: 160 }).addTo(map);
  map.attributionControl.setPrefix(false);

  const FONDOS = {
    sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 18, maxZoom: 22, attribution: "Imagen © Esri, Maxar, Earthstar Geographics" }),
    osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxNativeZoom: 19, maxZoom: 22, attribution: "© OpenStreetMap" }),
    no: null,
  };
  let fondoActual = null, erroresFondo = 0;
  function ponerFondo(id) {
    if (fondoActual) map.removeLayer(fondoActual);
    fondoActual = FONDOS[id];
    erroresFondo = 0; document.getElementById("aviso-fondo").hidden = true;
    if (fondoActual) {
      fondoActual.off("tileerror").on("tileerror", () => {
        if (++erroresFondo === 3) document.getElementById("aviso-fondo").hidden = false;
      });
      fondoActual.addTo(map); fondoActual.bringToBack();
    }
    document.querySelectorAll("#fondos button").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === id));
    try { localStorage.setItem("fondo", id); } catch (e) {}
  }

  // Polígonos
  let seleccion = null;
  const capasPol = new Map();
  const grupoPol = L.featureGroup().addTo(map);
  for (const p of POLIS) {
    const capa = L.polygon(p.ll, { className: "pol", weight: 1.4, color: "#2b2118", fillOpacity: 0, interactive: true });
    capa.on("click", (ev) => {
      if (!clicEnPlanta(ev)) seleccionar(p.p, false);
    });
    capa.bindTooltip(`Polígono ${p.p} · ${p.ha.toFixed(2)} ha`, { sticky: true, className: "tip", direction: "top", offset: [0, -8] });
    capa.addTo(grupoPol);
    const [ex, ny] = puntoEtiqueta(p.ring);
    const et = L.marker(utmALatLng(ex, ny), {
      icon: L.divIcon({ className: "etq", html: `<span>${p.p}</span>`, iconSize: [0, 0] }), interactive: false, keyboard: false,
    }).addTo(map);
    capasPol.set(p.p, { capa, et });
  }

  // Recuadro de detalle 80 × 80 m
  let recuadro = null;
  function vistaDetalle(lado = 80) {
    const p = POLIS.find(q => q.p === (seleccion ?? 9));
    const [cx, cy] = puntoEtiqueta(p.ring);
    const h = lado / 2;
    const esquinas = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]].map(([x, y]) => utmALatLng(x, y));
    if (recuadro) map.removeLayer(recuadro);
    recuadro = L.polygon(esquinas, { className: "recuadro", weight: 1.5, dashArray: "6 5", fill: false, interactive: false }).addTo(map);
    map.fitBounds(recuadro.getBounds(), { padding: [24, 24], maxZoom: 22 });
    if (seleccion == null) seleccionar(9, false);
  }

  // ---------- Capa de plantas (canvas por teselas) ----------
  const visibles = new Array(ESPECIES.length).fill(true);
  const imagenes = ESPECIES.map(e => {
    if (!e.img) return null;
    const im = new Image();
    im.src = (window.IMAGENES_INLINE && IMAGENES_INLINE[e.id]) || e.img; // build.py las incrusta en index.html
    im.onload = () => capaPlantas.redraw(); return im;
  });
  const fuenteImg = (s) => imagenes[s] ? imagenes[s].src : null;
  function icono(s, clase = "ico-esp") {
    const src = simbolo === "pol" ? null : fuenteImg(s);
    return src ? `<img class="${clase}" src="${src}" alt="">` : `<span class="hex" style="--c:${ESPECIES[s].color}"></span>`;
  }

  function metrosPorPx(z) {
    return 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / (256 * Math.pow(2, z));
  }

  function hexagono(ctx, x, y, r) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.866, y - r * 0.5); ctx.lineTo(x + r * 0.866, y + r * 0.5);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.866, y + r * 0.5); ctx.lineTo(x - r * 0.866, y - r * 0.5);
    ctx.closePath();
  }

  // Recorre las plantas cuyas coordenadas UTM caen en el rectángulo [e0,n0]-[e1,n1]
  function porRango(e0, n0, e1, n1, fn) {
    if (!P) return;
    const { gx0, gy0, gw, gh, inicio, orden } = P.idx;
    const cx0 = Math.max(0, Math.floor(e0 / CELDA) - gx0), cx1 = Math.min(gw - 1, Math.floor(e1 / CELDA) - gx0);
    const cy0 = Math.max(0, Math.floor(n0 / CELDA) - gy0), cy1 = Math.min(gh - 1, Math.floor(n1 / CELDA) - gy0);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cy * gw + cx;
      for (let q = inicio[c]; q < inicio[c + 1]; q++) fn(orden[q]);
    }
  }

  const CapaPlantas = L.GridLayer.extend({
    createTile(coords) {
      const t = document.createElement("canvas"), ts = this.getTileSize(), dpr = window.devicePixelRatio || 1;
      t.width = ts.x * dpr; t.height = ts.y * dpr;
      const ctx = t.getContext("2d"); ctx.scale(dpr, dpr);
      if (!P) return t;
      const z = coords.z, origen = coords.scaleBy(ts);
      const nw = map.unproject(origen, z), se = map.unproject(origen.add(ts), z);
      const mpp = metrosPorPx(z);
      const radioM = 1.5; // radio "real" del símbolo, en metros
      let r = radioM / mpp;
      const margen = Math.max(r * 1.6, 2) * mpp + 1; // las imágenes sobresalen del radio
      const a = latLngAUtm(nw.lat, nw.lng), b = latLngAUtm(se.lat, se.lng);
      const c = latLngAUtm(nw.lat, se.lng), d = latLngAUtm(se.lat, nw.lng);
      const e0 = Math.min(a[0], b[0], c[0], d[0]) - margen, e1 = Math.max(a[0], b[0], c[0], d[0]) + margen;
      const n0 = Math.min(a[1], b[1], c[1], d[1]) - margen, n1 = Math.max(a[1], b[1], c[1], d[1]) + margen;

      const modo = r < 1.6 ? "pixel" : (simbolo === "pol" || r < 3.5) ? "hex" : "img";
      if (modo === "pixel") r = Math.max(0.7, r);
      const sel = seleccion;
      const cambiadas = [];
      const grupos = ESPECIES.map(() => []);
      const pixeles = modo === "pixel" ? new Map() : null;
      porRango(e0, n0, e1, n1, (k) => {
        const s = P.esp[k]; if (!visibles[s]) return;
        const pt = map.project([P.lat[k], P.lng[k]], z);
        const x = pt.x - origen.x, y = pt.y - origen.y;
        const m = r * 1.6 + 2;
        if (x < -m || y < -m || x > ts.x + m || y > ts.y + m) return;
        const atenuado = sel != null && P.pol[k] !== sel;
        if (pixeles) {
          if (x < 0 || y < 0 || x >= ts.x || y >= ts.y) return;
          const pixel = Math.floor(y * dpr) * t.width + Math.floor(x * dpr);
          const muestra = pixeles.get(pixel);
          if (!muestra) pixeles.set(pixel, { cantidad: 1, especie: s, atenuado });
          else {
            muestra.cantidad++;
            if (hash(k, pixel, muestra.cantidad) < 1 / muestra.cantidad) {
              muestra.especie = s; muestra.atenuado = atenuado;
            }
          }
        } else grupos[s].push(x, y, atenuado ? 1 : 0);
        if (P.cam[k]) cambiadas.push(x, y);
      });

      if (pixeles) {
        const imagen = ctx.createImageData(t.width, t.height), datos = imagen.data;
        for (const [pixel, muestra] of pixeles) {
          const color = ESPECIES[muestra.especie].color;
          const q = pixel * 4;
          datos[q] = parseInt(color.slice(1, 3), 16);
          datos[q + 1] = parseInt(color.slice(3, 5), 16);
          datos[q + 2] = parseInt(color.slice(5, 7), 16);
          datos[q + 3] = muestra.atenuado ? 72 : 255;
        }
        ctx.putImageData(imagen, 0, 0);
        return t;
      }

      for (let s = 0; s < ESPECIES.length; s++) {
        const g = grupos[s]; if (!g.length) continue;
        const im = imagenes[s];
        for (const atenuado of [0, 1]) {
          ctx.globalAlpha = atenuado ? 0.28 : 1;
          ctx.fillStyle = ESPECIES[s].color;
          if (modo === "pixel") {
            const w = r * 2;
            for (let q = 0; q < g.length; q += 3) if (g[q + 2] === atenuado) ctx.fillRect(g[q] - r, g[q + 1] - r, w, w);
          } else if (modo === "img" && im && im.complete && im.naturalWidth) {
            // la imagen ocupa ~3.9 m en su lado mayor, conservando proporciones
            const lado = r * 2.6, esc = lado / Math.max(im.naturalWidth, im.naturalHeight);
            const w = im.naturalWidth * esc, h = im.naturalHeight * esc;
            for (let q = 0; q < g.length; q += 3) if (g[q + 2] === atenuado) ctx.drawImage(im, g[q] - w / 2, g[q + 1] - h / 2, w, h);
          } else {
            ctx.beginPath();
            const rh = modo === "img" ? r * 0.45 : r; // en vista de imágenes, los huecos se marcan pequeños
            for (let q = 0; q < g.length; q += 3) if (g[q + 2] === atenuado) hexagono(ctx, g[q], g[q + 1], rh);
            ctx.fill();
            if (r > 5) { ctx.strokeStyle = "rgba(20,14,8,.35)"; ctx.lineWidth = 0.8; ctx.stroke(); }
          }
        }
      }
      ctx.globalAlpha = 1;
      if (r >= 2.5 && cambiadas.length) {
        ctx.beginPath();
        for (let q = 0; q < cambiadas.length; q += 2) { ctx.moveTo(cambiadas[q] + r * 1.5, cambiadas[q + 1]); ctx.arc(cambiadas[q], cambiadas[q + 1], r * 1.5, 0, Math.PI * 2); }
        ctx.lineWidth = Math.max(1.5, r * 0.22); ctx.strokeStyle = "#111"; ctx.stroke();
        ctx.lineWidth = Math.max(0.8, r * 0.1); ctx.strokeStyle = "#fff"; ctx.stroke();
      }
      return t;
    },
  });
  const capaPlantas = new CapaPlantas({ pane: "overlayPane", maxZoom: 22, updateWhenZooming: false, keepBuffer: 1 });

  // Clic sobre una planta -> ficha
  function clicEnPlanta(ev) {
    if (!P) return false;
    const z = map.getZoom(), mpp = metrosPorPx(z);
    if (1.5 / mpp < 3) return false; // demasiado lejos para elegir una planta
    const [E, N] = latLngAUtm(ev.latlng.lat, ev.latlng.lng);
    const tol = Math.max(2.2, 7 * mpp);
    let mejor = -1, dmin = tol * tol;
    porRango(E - tol, N - tol, E + tol, N + tol, (k) => {
      if (!visibles[P.esp[k]]) return;
      const d = (P.E[k] - E) ** 2 + (P.N[k] - N) ** 2;
      if (d < dmin) { dmin = d; mejor = k; }
    });
    if (mejor < 0) return false;
    const k = mejor, sp = ESPECIES[P.esp[k]];
    const fila = P.hil[k] >= 0 ? `<div><dt>Hilera / posición</dt><dd>${P.hil[k]} / ${P.pos[k]}</dd></div>` : "";
    const popup = L.popup({ className: "ficha", offset: [0, -4], maxWidth: 280 })
      .setLatLng([P.lat[k], P.lng[k]])
      .setContent(`<div class="ficha-cab">${icono(P.esp[k], "ico-ficha")}<strong>${sp.nombre}</strong></div>
        <dl>
          <div><dt>Planta</dt><dd>#${k + 1}</dd></div>
          <div><dt>Polígono</dt><dd>${P.pol[k] || "—"}</dd></div>
          ${fila}
          <div><dt>UTM 14N</dt><dd>${fmt(P.E[k], 1)} E<br>${fmt(P.N[k], 1)} N</dd></div>
          <div><dt>Geográficas</dt><dd>${P.lat[k].toFixed(6)}, ${P.lng[k].toFixed(6)}</dd></div>
        </dl>
        ${P.cam[k] ? '<p class="ficha-nota">Posición cambiada</p>' : ""}
        <button class="btn-pildora" type="button" data-report-plant="${k}"><span class="ms">flag</span>Reportar</button>`)
    map.once("popupopen", (evento) => {
      if (evento.popup !== popup) return;
      popup.getElement().querySelector("[data-report-plant]")?.addEventListener("click", () => {
        map.closePopup(popup);
        abrirReporte(k);
      });
    });
    popup.openOn(map);
    return true;
  }

  // ---------- Interfaz ----------
  const fmt = (v, d = 0) => v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
  const $ = (s) => document.querySelector(s);
  const CLAVE_REPORTES = "reportes-siembra-v1";
  const etiquetasHallazgo = { corresponde: "Coincide con la especie indicada", otra: "Otra especie", vacio: "Espacio vacío" };
  const etiquetasSalud = { sana: "Sana", regular: "Condición regular", mala: "Mala salud", muerta: "Muerta" };
  let reportes = [];
  let plantaReportada = null;

  function mostrarMensajeReporte(mensaje, tipo = "") {
    const el = $("#reporte-msg");
    el.textContent = mensaje;
    el.dataset.tipo = tipo;
  }

  function renderizarReportes() {
    $("#reporte-total").textContent = fmt(reportes.length);
    $("#descargar-reportes").disabled = reportes.length === 0;
    const lista = $("#lista-reportes");
    lista.replaceChildren();
    for (const reporte of [...reportes].reverse()) {
      const item = document.createElement("li");
      const titulo = document.createElement("strong");
      const nombre = reporte.hallazgo === "otra"
        ? reporte.especieObservada
        : etiquetasHallazgo[reporte.hallazgo];
      titulo.textContent = `Planta #${reporte.planta} · ${nombre}`;
      const detalle = document.createElement("small");
      const salud = reporte.salud ? ` · ${etiquetasSalud[reporte.salud]}` : "";
      detalle.textContent = `Polígono ${reporte.poligono || "—"} · ${new Date(reporte.fecha).toLocaleString("es-MX")}${salud}`;
      item.append(titulo, detalle);
      if (reporte.notas) {
        const notas = document.createElement("small");
        notas.textContent = reporte.notas;
        item.append(notas);
      }
      lista.append(item);
    }
  }

  function cargarReportes() {
    try {
      const guardados = localStorage.getItem(CLAVE_REPORTES);
      if (guardados) {
        const datos = JSON.parse(guardados);
        if (!Array.isArray(datos)) throw new Error("El contenido guardado no es una lista.");
        reportes = datos;
      }
    } catch (error) {
      mostrarMensajeReporte(`No se pudieron leer los reportes guardados: ${error.message}`, "error");
    }
    renderizarReportes();
  }

  function actualizarCamposReporte() {
    const vacio = $("#hallazgo").value === "vacio";
    $("#reporte-especie-wrap").hidden = $("#hallazgo").value !== "otra";
    $("#reporte-especie").required = $("#hallazgo").value === "otra";
    $("#reporte-salud-wrap").hidden = vacio;
    $("#reporte-salud").required = !vacio;
  }

  function abrirReporte(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= P.n) return;
    plantaReportada = indice;
    $("#reporte-form").hidden = false;
    $("#reporte-form").reset();
    $("#reporte-especie").innerHTML = ESPECIES
      .filter((especie, especieIndice) => especie.id !== "vaci" && especieIndice !== P.esp[indice])
      .map(especie => `<option value="${especie.id}">${especie.nombre}</option>`).join("");
    $("#reporte-objetivo").textContent =
      `Planta #${indice + 1} · ${ESPECIES[P.esp[indice]].nombre} · polígono ${P.pol[indice] || "—"} · UTM ${fmt(P.E[indice], 1)} E, ${fmt(P.N[indice], 1)} N`;
    actualizarCamposReporte();
    mostrarMensajeReporte("");
    abrirPestana("rep");
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.body.classList.add("panel-abierto");
      $("#panel-toggle").setAttribute("aria-expanded", "true");
    }
  }

  function escaparCSV(valor) {
    return `"${String(valor ?? "").replace(/"/g, '""')}"`;
  }

  $("#hallazgo").addEventListener("change", actualizarCamposReporte);
  $("#reporte-form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (plantaReportada == null) {
      mostrarMensajeReporte("Selecciona una planta antes de guardar el reporte.", "error");
      return;
    }
    const hallazgo = $("#hallazgo").value;
    const especieObservada = hallazgo === "otra" ? $("#reporte-especie").value : "";
    const salud = hallazgo === "vacio" ? "" : $("#reporte-salud").value;
    if (!(hallazgo in etiquetasHallazgo) || (hallazgo === "otra" && !ESPECIES.some(e => e.id === especieObservada && e.id !== "vaci"))
      || (salud && !(salud in etiquetasSalud))) {
      mostrarMensajeReporte("Revisa el hallazgo, la especie y la condición seleccionados.", "error");
      return;
    }
    const registro = {
      fecha: new Date().toISOString(),
      planta: plantaReportada + 1,
      poligono: P.pol[plantaReportada],
      este: P.E[plantaReportada],
      norte: P.N[plantaReportada],
      especiePlaneada: ESPECIES[P.esp[plantaReportada]].nombre,
      hallazgo,
      especieObservada: hallazgo === "otra" ? ESPECIES.find(e => e.id === especieObservada).nombre : "",
      salud,
      notas: $("#reporte-notas").value.trim(),
    };
    const nuevos = [...reportes, registro];
    try {
      localStorage.setItem(CLAVE_REPORTES, JSON.stringify(nuevos));
    } catch (error) {
      mostrarMensajeReporte(`No se pudo guardar el reporte en este navegador: ${error.message}`, "error");
      return;
    }
    reportes = nuevos;
    renderizarReportes();
    mostrarMensajeReporte("Reporte guardado en este navegador.", "ok");
  });
  $("#descargar-reportes").addEventListener("click", () => {
    if (!reportes.length) return;
    const filas = [
      ["fecha", "planta", "poligono", "este_utm", "norte_utm", "especie_planeada", "hallazgo", "especie_observada", "salud", "notas"],
      ...reportes.map(reporte => [
        reporte.fecha, reporte.planta, reporte.poligono, reporte.este, reporte.norte,
        reporte.especiePlaneada, etiquetasHallazgo[reporte.hallazgo] || reporte.hallazgo,
        reporte.especieObservada, etiquetasSalud[reporte.salud] || "", reporte.notas,
      ]),
    ];
    const csv = "\uFEFF" + filas.map(fila => fila.map(escaparCSV).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "reportes-siembra.csv";
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  cargarReportes();

  function totalesEspecie(pol) {
    const t = new Uint32Array(ESPECIES.length);
    if (!P) return t;
    if (pol == null) { for (const m of P.porPol.values()) for (let s = 0; s < t.length; s++) t[s] += m[s]; }
    else { const m = P.porPol.get(pol); if (m) t.set(m); }
    return t;
  }

  function pintarLeyenda() {
    const t = totalesEspecie(seleccion);
    const total = t.reduce((a, b) => a + b, 0) || 1;
    $("#especies").innerHTML = ESPECIES.map((e, s) => `
      <li>
        <label class="esp" for="esp-${e.id}">
          <input type="checkbox" id="esp-${e.id}" data-s="${s}" ${visibles[s] ? "checked" : ""}>
          ${icono(s)}
          <span class="esp-txt">
            <span class="esp-nom${e.id === "vaci" ? "" : " cursiva"}">${e.nombre}</span>
            <span class="esp-sub">${fmt(t[s])} · ${(t[s] / total * 100).toFixed(1)} %</span>
          </span>
        </label>
      </li>`).join("");
    pintarBotonTodas();
    const plantas = t.reduce((a, b) => a + b, 0) - t[ESPECIES.length - 1];
    const ha = seleccion == null ? AREA_TOTAL : POLIS.find(p => p.p === seleccion).ha;
    $("#kpi-plantas").textContent = fmt(plantas);
    $("#kpi-ha").textContent = fmt(ha, 2);
    $("#kpi-dens").textContent = fmt(plantas / ha);
    $("#limpiar").hidden = seleccion == null;
  }

  function pintarPoligonos() {
    $("#poligonos").innerHTML = POLIS.map(p =>
      `<button type="button" data-p="${p.p}" aria-pressed="${seleccion === p.p}" title="${p.ha.toFixed(2)} ha">${p.p}</button>`).join("");
  }

  // ---------- Símbolo de las plantas: ilustración ("plantas") o hexágono de color ("pol") ----------
  let simbolo = "plantas";
  function ponerModo(m) {
    simbolo = m;
    document.querySelectorAll("#modo button").forEach(b => b.setAttribute("aria-checked", b.dataset.m === m));
    try { localStorage.setItem("simbolo", m); } catch (e) {}
    pintarLeyenda(); capaPlantas.redraw();
  }
  document.querySelectorAll("#modo button").forEach(b => b.addEventListener("click", () => ponerModo(b.dataset.m)));

  function seleccionar(id, encuadrar = true) {
    seleccion = id;
    for (const [pid, { capa, et }] of capasPol) {
      const on = pid === id;
      capa.setStyle({ weight: on ? 3 : 1.4, color: on ? "#fff4dc" : "#2b2118" });
      if (on) capa.bringToFront();
      et.getElement()?.classList.toggle("on", on);
    }
    if (id != null && encuadrar) map.fitBounds(capasPol.get(id).capa.getBounds(), { padding: [30, 30] });
    pintarLeyenda(); pintarPoligonos();
    capaPlantas.redraw();
  }

  $("#especies").addEventListener("change", (e) => {
    const s = +e.target.dataset.s; if (Number.isNaN(s)) return;
    visibles[s] = e.target.checked; capaPlantas.redraw();
  });
  $("#todas").addEventListener("click", () => {
    const todas = visibles.every(Boolean);
    visibles.fill(!todas); pintarLeyenda(); capaPlantas.redraw();
  });
  function pintarBotonTodas() {
    const todas = visibles.every(Boolean);
    $("#todas .ms").textContent = todas ? "visibility_off" : "visibility";
    $("#todas-txt").textContent = todas ? "Ocultar" : "Mostrar";
  }

  // Pestañas del panel
  function abrirPestana(id) {
    document.querySelectorAll('[role="tab"]').forEach(t => {
      const on = t.dataset.tab === id;
      t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  }
  document.querySelectorAll('[role="tab"]').forEach(t => t.addEventListener("click", () => abrirPestana(t.dataset.tab)));

  // Buscador: número de polígono o nombre de especie
  const buscador = $("#buscar"), sugerencias = $("#sugerencias");
  function sugerir() {
    const q = buscador.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    $("#buscar-limpiar").hidden = !q;
    if (!q) { sugerencias.hidden = true; return; }
    const num = q.replace(/^(poligono|pol)\s*/, "");
    const pols = POLIS.filter(p => String(p.p).startsWith(num) && /^\d+$/.test(num)).slice(0, 5);
    const esps = ESPECIES.map((e, s) => ({ e, s })).filter(({ e }) => e.nombre.toLowerCase().includes(q)).slice(0, 6);
    const items = [
      ...pols.map(p => `<li><button type="button" data-p="${p.p}"><span class="ms">location_on</span><span><b>Polígono ${p.p}</b><small>${fmt(p.ha, 2)} ha</small></span></button></li>`),
      ...esps.map(({ e, s }) => `<li><button type="button" data-s="${s}">${icono(s)}<span><b class="${e.id === "vaci" ? "" : "cursiva"}">${e.nombre}</b><small>Mostrar solo esta especie</small></span></button></li>`),
    ];
    sugerencias.innerHTML = items.length ? items.join("") : `<li class="vacio">Sin resultados para «${buscador.value.trim()}»</li>`;
    sugerencias.hidden = false;
  }
  function elegirSugerencia(b) {
    if (b.dataset.p) { seleccionar(+b.dataset.p); abrirPestana("pol"); buscador.value = `Polígono ${b.dataset.p}`; }
    else { const s = +b.dataset.s; visibles.fill(false); visibles[s] = true; pintarLeyenda(); capaPlantas.redraw(); abrirPestana("esp"); buscador.value = ESPECIES[s].nombre; }
    sugerencias.hidden = true; $("#buscar-limpiar").hidden = false;
  }
  buscador.addEventListener("input", sugerir);
  buscador.addEventListener("focus", () => { if (buscador.value.trim()) sugerir(); });
  buscador.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const b = sugerencias.querySelector("button"); if (b) elegirSugerencia(b); }
    if (e.key === "Escape") sugerencias.hidden = true;
  });
  sugerencias.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirSugerencia(b); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".busqueda")) sugerencias.hidden = true; });
  $("#buscar-limpiar").addEventListener("click", () => {
    buscador.value = ""; sugerencias.hidden = true; $("#buscar-limpiar").hidden = true;
    visibles.fill(true); pintarLeyenda(); capaPlantas.redraw(); buscador.focus();
  });
  $("#poligonos").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const id = +b.dataset.p; seleccionar(seleccion === id ? null : id, seleccion !== id);
  });
  $("#limpiar").addEventListener("click", () => { seleccionar(null); map.fitBounds(grupoPol.getBounds(), { padding: [20, 20] }); });
  $("#btn-detalle").addEventListener("click", () => vistaDetalle(80));
  $("#btn-todo").addEventListener("click", () => {
    if (recuadro) { map.removeLayer(recuadro); recuadro = null; }
    map.fitBounds(grupoPol.getBounds(), { padding: [20, 20] });
  });
  document.querySelectorAll("#fondos button").forEach(b => b.addEventListener("click", () => ponerFondo(b.dataset.f)));
  $("#panel-toggle").addEventListener("click", () => {
    const abierto = document.body.classList.toggle("panel-abierto");
    $("#panel-toggle").setAttribute("aria-expanded", abierto);
  });

  // Coordenadas bajo el cursor
  map.on("mousemove", (e) => {
    const [E, N] = latLngAUtm(e.latlng.lat, e.latlng.lng);
    $("#coords").textContent = `${fmt(E, 1)} E  ${fmt(N, 1)} N   ·   ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
  map.on("zoomend", () => {
    const m = metrosPorPx(map.getZoom());
    $("#nivel").textContent = 1.5 / m < 1.6 ? "Acércate para ver cada planta" : 1.5 / m < 3 ? "Plantas visibles" : "Toca una planta para ver su ficha";
  });

  // ---------- CSV con plantas reales ----------
  // Columnas: especie, y "este,norte" (UTM 14N) o "lat,lon". Opcionales: poligono, cambiada (1/0, si/no).
  function parseCSV(txt) {
    const lineas = txt.replace(/\r/g, "").split("\n").filter(l => l.trim());
    const sep = (lineas[0].match(/;/g) || []).length > (lineas[0].match(/,/g) || []).length ? ";" : ",";
    const cab = lineas[0].split(sep).map(h => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const col = (...n) => cab.findIndex(h => n.includes(h));
    const ci = { esp: col("especie", "species", "nombre"), e: col("este", "x", "easting", "e"), n: col("norte", "y", "northing", "n"),
      lat: col("lat", "latitud"), lon: col("lon", "lng", "longitud"), pol: col("poligono", "polygon"), cam: col("cambiada", "cambio", "changed") };
    if (ci.esp < 0 || ((ci.e < 0 || ci.n < 0) && (ci.lat < 0 || ci.lon < 0)))
      throw new Error("El archivo necesita las columnas «especie» y «este, norte» (UTM 14N) o «lat, lon».");
    const nombres = ESPECIES.map(e => e.nombre.toLowerCase());
    const out = [], noReconocidas = new Set();
    for (let i = 1; i < lineas.length; i++) {
      const c = lineas[i].split(sep).map(v => v.trim());
      const nom = (c[ci.esp] || "").toLowerCase();
      let s = nombres.indexOf(nom);
      if (s < 0) s = nombres.findIndex(n => n.split(" ")[1] && nom.includes(n.split(" ")[1]));
      if (s < 0) { noReconocidas.add(c[ci.esp]); continue; }
      let E, N;
      if (ci.e >= 0 && ci.n >= 0) { E = parseFloat(c[ci.e]); N = parseFloat(c[ci.n]); }
      else [E, N] = latLngAUtm(parseFloat(c[ci.lat]), parseFloat(c[ci.lon]));
      if (!isFinite(E) || !isFinite(N)) continue;
      let pol = ci.pol >= 0 ? parseInt(c[ci.pol], 10) : 0;
      if (!pol) { const q = POLIS.find(p => E >= p.bb[0] && E <= p.bb[2] && N >= p.bb[1] && N <= p.bb[3] && dentro(E, N, p.ring)); pol = q ? q.p : 0; }
      const cam = ci.cam >= 0 && /^(1|si|sí|true|x|s)$/i.test(c[ci.cam] || "");
      out.push({ E, N, esp: s, pol, cambiada: cam });
    }
    return { out, noReconocidas };
  }
  $("#csv").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const msg = $("#csv-msg");
    try {
      const { out, noReconocidas } = parseCSV(await f.text());
      if (!out.length) throw new Error("No se encontró ninguna planta con especie y coordenadas válidas.");
      cargarPlantas(out, f.name);
      msg.textContent = `${fmt(out.length)} plantas cargadas.` + (noReconocidas.size ? ` Especies sin reconocer: ${[...noReconocidas].slice(0, 4).join(", ")}.` : "");
      msg.dataset.tipo = "ok";
      $("#volver-sim").hidden = false;
      pintarLeyenda(); capaPlantas.redraw();
    } catch (err) { msg.textContent = err.message; msg.dataset.tipo = "error"; }
    e.target.value = "";
  });
  $("#volver-sim").addEventListener("click", () => {
    generarSimulada(); $("#volver-sim").hidden = true; $("#csv-msg").textContent = "";
    pintarLeyenda(); capaPlantas.redraw();
  });

  // ---------- Correr el modelo (solo cuando el sitio se sirve con web/servidor.py) ----------
  const API_MODELO = "api/modelo";
  let vioCorrida = false, sondeo = null;
  function duracion(seg) {
    const m = Math.floor(seg / 60), s = Math.round(seg % 60);
    return m ? `${m} min ${s} s` : `${s} s`;
  }
  function pintarModelo(st) {
    const corriendo = st.estado === "corriendo", msg = $("#modelo-msg"), av = $("#modelo-avance");
    $("#modelo-correr").disabled = corriendo;
    $("#modelo-detener").hidden = !corriendo;
    av.hidden = !corriendo;
    if (st.total) { av.max = st.total; av.value = st.celda; } else av.removeAttribute("value");
    if (corriendo) {
      vioCorrida = true; $("#modelo-problemas").hidden = true;
      msg.textContent = `${st.mensaje}${st.seccion ? " · " + st.seccion : ""} · ${duracion(st.ahora - st.inicio)}`;
      msg.dataset.tipo = "";
    } else if (st.estado === "inactivo") {
      msg.textContent = "";
    } else {
      const cuando = st.fin ? ` · ${new Date(st.fin * 1000).toLocaleString("es-MX")} · ${duracion(st.fin - st.inicio)}` : "";
      msg.textContent = st.mensaje + cuando;
      msg.dataset.tipo = st.estado === "ok" ? "ok" : st.estado === "error" ? "error" : "";
    }
    const log = (st.log || []).join("\n");
    $("#modelo-log-wrap").hidden = !log; $("#modelo-log").textContent = log;
    // El sitio se regeneró: se recarga para leer el nuevo index.html (solo si la corrida se vio en esta página)
    if (st.estado === "ok" && vioCorrida) { msg.textContent = "Listo. Recargando el mapa…"; setTimeout(() => location.reload(), 1200); }
  }
  async function consultarModelo() {
    clearTimeout(sondeo);
    try {
      const r = await fetch(API_MODELO, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const st = await r.json(); pintarModelo(st);
      if (st.estado === "corriendo") sondeo = setTimeout(consultarModelo, 2000);
      return st;
    } catch (err) {
      if (vioCorrida) {                                  // se perdió la conexión a media corrida: se reintenta
        $("#modelo-msg").textContent = "Sin conexión con el servidor; reintentando…";
        sondeo = setTimeout(consultarModelo, 5000);
      }
      throw err;
    }
  }
  function mostrarProblemas(lista) {
    const ul = $("#modelo-problemas"); ul.replaceChildren();
    lista.forEach(p => { const li = document.createElement("li"); li.textContent = p; ul.append(li); });
    ul.hidden = !lista.length;
  }
  $("#modelo-correr").addEventListener("click", async () => {
    if (!confirm("Se correrá el modelo completo y el mapa se reemplazará con el resultado. Puede tardar varios minutos. ¿Continuar?")) return;
    const msg = $("#modelo-msg"); mostrarProblemas([]);
    $("#modelo-correr").disabled = true; msg.textContent = "Revisando datos y dependencias…"; msg.dataset.tipo = "";
    try {
      const r = await fetch(API_MODELO, { method: "POST" }), res = await r.json();
      if (!r.ok) {
        msg.textContent = res.error; msg.dataset.tipo = "error"; mostrarProblemas(res.problemas || []);
        $("#modelo-correr").disabled = false; return;
      }
      vioCorrida = true; consultarModelo().catch(() => {});
    } catch (err) {
      msg.textContent = "No se pudo contactar al servidor."; msg.dataset.tipo = "error"; $("#modelo-correr").disabled = false;
    }
  });
  $("#modelo-detener").addEventListener("click", async () => {
    await fetch(API_MODELO + "/detener", { method: "POST" }).catch(() => {});
    consultarModelo().catch(() => {});
  });
  if (location.protocol.startsWith("http")) {
    consultarModelo().then(() => { $("#tab-mod").hidden = false; }).catch(() => {});
  }

  // ---------- Arranque ----------
  if (window.PLANTAS_REALES) cargarPlantas(window.PLANTAS_REALES, "mapa_siembra.gpkg");
  else generarSimulada();
  capaPlantas.addTo(map);
  let sim = "plantas"; try { sim = localStorage.getItem("simbolo") || "plantas"; } catch (e) {}
  ponerModo(sim === "pol" ? "pol" : "plantas");
  map.fitBounds(grupoPol.getBounds(), { padding: [20, 20] });
  let fondo = "sat"; try { fondo = localStorage.getItem("fondo") || "sat"; } catch (e) {}
  ponerFondo(FONDOS.hasOwnProperty(fondo) ? fondo : "sat");
  $("#kpi-pol").textContent = POLIS.length;
  $("#marco").textContent = P.fuente === "simulada"
    ? `${MARCO.enHilera} m en hilera · ${MARCO.entreHileras} m entre hileras · tresbolillo`
    : "Acomodo y coordenadas del GeoPackage";
  $("#marco").nextElementSibling.textContent = P.fuente === "simulada" ? "marco de plantación" : "fuente de posiciones";
  pintarPoligonos(); pintarLeyenda();
  map.fire("zoomend");
})();
