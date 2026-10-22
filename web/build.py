# Arma el sitio en un solo archivo: index.html (documento completo para cualquier servidor)
# y artifact.html (mismo contenido sin <html>/<head>, para publicarlo como Artifact).
import pathlib, sys
import math, sqlite3, unicodedata
raiz = pathlib.Path(__file__).parent
css = pathlib.Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else (raiz / "src/leaflet.css").read_text()
html = (raiz / "src/app.html").read_text()
# Las imágenes de img/ se incrustan como data URI para que index.html funcione solo, incluso con doble clic
import base64, json
imgs = {f.stem: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode() for f in sorted((raiz / "img").glob("*.png"))}

def normalizar(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(c) != "Mn")

archivo_plantas = raiz / "data/shapefile/mapa_siembra.gpkg"
plantas_js = "window.PLANTAS_REALES = null;\n"
if archivo_plantas.exists():
    indices_especie = {
        normalizar(nombre): indice
        for indice, nombre in enumerate((
            "Agave lechuguilla", "Agave salmiana", "Agave scabra", "Agave striata",
            "Opuntia cantabrigiensis", "Opuntia engelmannii", "Opuntia robusta",
            "Opuntia streptacantha", "Prosopis laevigata", "Yucca filifera", "vacío",
        ))
    }
    conn = sqlite3.connect(archivo_plantas)
    try:
        capa = conn.execute(
            "SELECT srs_id FROM gpkg_contents WHERE table_name = 'puntos' AND data_type = 'features'"
        ).fetchone()
        if not capa or capa[0] != 32614:
            raise ValueError("El GeoPackage debe incluir la capa «puntos» en EPSG:32614.")
        columnas = {fila[1] for fila in conn.execute('PRAGMA table_info("puntos")')}
        requeridas = {"x", "y", "fila", "columna", "pol_mapa", "especie", "cambiado"}
        if not requeridas.issubset(columnas):
            raise ValueError(f"Faltan campos en la capa «puntos»: {', '.join(sorted(requeridas - columnas))}.")
        plantas = []
        especies_desconocidas = set()
        for este, norte, especie, poligono, fila, columna, cambiado in conn.execute(
            "SELECT x, y, especie, pol_mapa, fila, columna, cambiado FROM puntos ORDER BY fid"
        ):
            indice = indices_especie.get(normalizar(especie or ""))
            if indice is None:
                especies_desconocidas.add(especie or "")
                continue
            if este is None or norte is None or not math.isfinite(este) or not math.isfinite(norte):
                raise ValueError("La capa «puntos» contiene coordenadas vacías o inválidas.")
            plantas.append([
                este, norte, indice, poligono or 0, fila if fila is not None else -1,
                columna if columna is not None else -1, bool(cambiado),
            ])
        if especies_desconocidas:
            nombres = ", ".join(sorted(especies_desconocidas)[:5])
            raise ValueError(f"Especies sin imagen/configuración en app.js: {nombres}.")
        if not plantas:
            raise ValueError("La capa «puntos» no contiene plantas.")
        plantas_js = "window.PLANTAS_REALES = " + json.dumps(plantas, separators=(",", ":"), ensure_ascii=False) + ";\n"
    finally:
        conn.close()

datos = ((raiz / "data/poligonos_utm.js").read_text() + plantas_js
         + "window.IMAGENES_INLINE = " + json.dumps(imgs) + ";\n")
html = html.replace("/*LEAFLET_CSS*/", css).replace("/*DATA*/", datos).replace("/*APP*/", (raiz / "src/app.js").read_text())
(raiz / "artifact.html").write_text(html)
doc = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<style>body{margin:0}[hidden]{display:none!important}</style>\n')
head, _, body = html.partition('<div class="app">')
(raiz / "index.html").write_text(doc + head + '</head>\n<body>\n<div class="app">' + body + "</body>\n</html>\n")
print("ok", len(html))
