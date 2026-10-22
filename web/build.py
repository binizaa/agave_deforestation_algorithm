# Arma el sitio en un solo archivo: index.html (documento completo para cualquier servidor)
# y artifact.html (mismo contenido sin <html>/<head>, para publicarlo como Artifact).
import pathlib, sys
raiz = pathlib.Path(__file__).parent
css = pathlib.Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else (raiz / "src/leaflet.css").read_text()
html = (raiz / "src/app.html").read_text()
html = html.replace("/*LEAFLET_CSS*/", css).replace("/*DATA*/", (raiz / "data/poligonos_utm.js").read_text()).replace("/*APP*/", (raiz / "src/app.js").read_text())
(raiz / "artifact.html").write_text(html)
doc = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<style>body{margin:0}[hidden]{display:none!important}</style>\n')
head, _, body = html.partition('<div class="app">')
(raiz / "index.html").write_text(doc + head + '</head>\n<body>\n<div class="app">' + body + "</body>\n</html>\n")
print("ok", len(html))
