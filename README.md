# Agave deforestation algorithm

## Mapa de siembra (`web/`)

Sitio web para visualizar los 31 polígonos del proyecto CONAFOR (196 ha, WGS 84 / UTM zona 14N) sobre un mapa geográfico real, con cada planta dibujada en su posición.

- Abrir `web/index.html` en el navegador, o publicarlo con cualquier servidor estático (por ejemplo GitHub Pages). No requiere instalación: Leaflet se carga desde cdnjs.
- Fondo satelital (Esri), de calles (OpenStreetMap) o sin fondo, con barra de escala métrica.
- Botones "Por plantas" y "Por polígonos" sobre el mapa: el primero dibuja cada planta con la ilustración de su especie; el segundo, con un hexágono del color de su especie (como en el diseño original). La elección se recuerda en el navegador.
- Clic en un polígono para seleccionarlo; "Detalle 80 × 80 m" reproduce la vista de detalle del diseño.
- Al acercarse, cada planta es un hexágono del color de su especie; al tocarla se abre su ficha (especie, polígono, hilera, coordenadas UTM y geográficas). Las plantas con posición cambiada llevan un círculo.
- En la ficha, "Reportar" abre un formulario para indicar si la planta coincide, es de otra especie o el espacio está vacío, además de su condición de salud. Los reportes se guardan en el navegador y pueden descargarse como CSV desde la pestaña "Reportes".

### Correr el modelo desde la web

Con el servidor local, el panel muestra la pestaña **Modelo** con el botón «Correr modelo». Este ejecuta `modelo_compra_acoplado_v6.ipynb` celda por celda y muestra el avance. Al terminar, copia `../salidas/mapa_siembra.gpkg` a `web/data/shapefile/`, ejecuta `build.py` y recarga el mapa. Si el notebook falla o se detiene, el sitio queda como estaba.

```
MODELO_PYTHON=/ruta/al/.venv/bin/python python3 web/servidor.py     # http://127.0.0.1:8000
```

- `MODELO_PYTHON` es el Python que tiene las dependencias del modelo (`pip install -r requirements.txt`). Si no se indica, se usa el mismo Python que corre el servidor.
- El notebook se ejecuta desde la carpeta del repositorio, así que lee `datos/especies y poligonos/` y `datos/mapa/MapaCONAFOR.shp`, y escribe en `../salidas/`. Si falta un archivo o un módulo, la pestaña lo indica antes de empezar.
- La copia ejecutada del notebook (con sus tablas y gráficas) queda en `../salidas/modelo_compra_acoplado_v6.ejecutado.ipynb`; el notebook original no se modifica. El mapa anterior se guarda como `mapa_siembra.anterior.gpkg`.
- Al abrir `index.html` directamente o publicarlo en un servidor estático, la pestaña no aparece.

### Datos de plantas

Al ejecutar `python3 web/build.py`, si existe `web/data/shapefile/mapa_siembra.gpkg`, el sitio incorpora sus puntos reales (coordenadas UTM, especie, polígono, hilera y columna). Cada punto se asocia con la ilustración homónima de `web/img/`; al acercar el zoom, se dibuja la imagen correspondiente y al tocar una planta se muestra su ficha. El GeoPackage debe tener una capa `puntos` en EPSG:32614. Las imágenes y los datos se incrustan en `web/index.html`, que sigue funcionando como archivo independiente. Si el GeoPackage no está disponible, se conserva la distribución simulada como demostración.

La carga de un CSV con otros datos reales también está programada pero oculta; para mostrarla, quita `hidden` del botón `tab-dat` en `web/src/app.html` y ejecuta `python3 web/build.py`. Columnas del CSV:

| columna | obligatoria | ejemplo |
|---|---|---|
| `especie` | sí | `Agave salmiana` |
| `este`, `norte` (UTM 14N) o `lat`, `lon` | sí | `261234.5`, `2586012.0` |
| `poligono` | no (se calcula) | `9` |
| `cambiada` | no | `1` / `si` |

### Imágenes por especie

Las ilustraciones de cada especie están en `web/img/` (extraídas del diseño de Canva, en el orden de la leyenda). Al acercarse, cada planta se dibuja con su imagen; en la vista lejana se usa un punto del color de la especie. Para cambiar una ilustración, reemplaza el PNG (fondo transparente) con el mismo nombre y ejecuta `python3 web/build.py`, que las incrusta en `index.html`.

| archivo | especie |
|---|---|
| `lech.png` | Agave lechuguilla |
| `salm.png` | Agave salmiana |
| `scab.png` | Agave scabra |
| `stri.png` | Agave striata |
| `cant.png` | Opuntia cantabrigiensis |
| `enge.png` | Opuntia engelmannii |
| `robu.png` | Opuntia robusta |
| `stre.png` | Opuntia streptacantha |
| `pros.png` | Prosopis laevigata |
| `yucc.png` | Yucca filifera |

### Estructura

```
web/
  index.html            sitio listo para abrir (generado)
  img/                  ilustraciones de cada especie
  build.py              une src/ + data/ en index.html
  servidor.py           servidor local con el botón «Correr modelo»
  correr_modelo.py      ejecuta el notebook e informa el avance (lo usa servidor.py)
  shp_a_js.py           convierte el shapefile a data/poligonos_utm.js (pyshp)
  src/app.html          maquetación y estilos
  src/app.js            mapa, proyección UTM, generación y dibujo de plantas
  src/leaflet.css       estilos de Leaflet 1.9.4
  data/shapefile/       MapaCONAFOR.* y mapa_siembra.gpkg (datos de plantas)
  data/poligonos.geojson  polígonos en WGS 84
  data/poligonos_utm.js   polígonos en UTM usados por el sitio
```

Después de editar algo en `src/` o `data/`, ejecuta `python3 web/build.py` para regenerar `web/index.html`.
