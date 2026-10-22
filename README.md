# Agave deforestation algorithm

## Mapa de siembra (`web/`)

Sitio web para visualizar los 31 polígonos del proyecto CONAFOR (196 ha, WGS 84 / UTM zona 14N) sobre un mapa geográfico real, con cada planta dibujada en su posición.

- Abrir `web/index.html` en el navegador, o publicarlo con cualquier servidor estático (por ejemplo GitHub Pages). No requiere instalación: Leaflet se carga desde cdnjs.
- Fondo satelital (Esri), de calles (OpenStreetMap) o sin fondo, con barra de escala métrica.
- Botones "Por plantas" y "Por polígonos" sobre el mapa: el primero dibuja cada planta con la ilustración de su especie; el segundo, con un hexágono del color de su especie (como en el diseño original). La elección se recuerda en el navegador.
- Clic en un polígono para seleccionarlo; "Detalle 80 × 80 m" reproduce la vista de detalle del diseño.
- Al acercarse, cada planta es un hexágono del color de su especie; al tocarla se abre su ficha (especie, polígono, hilera, coordenadas UTM y geográficas). Las plantas con posición cambiada llevan un círculo.

### Datos de plantas

Por ahora la distribución es **simulada**: tresbolillo de 8 m en hilera y 2 m entre hileras (625 plantas/ha), con especies asignadas al azar de forma determinista. La carga de un CSV con los datos reales ya está programada pero oculta; para mostrarla, quita `hidden` del botón `tab-dat` en `web/src/app.html` y ejecuta `python3 web/build.py`. Columnas del CSV:

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
  shp_a_js.py           convierte el shapefile a data/poligonos_utm.js (pyshp)
  src/app.html          maquetación y estilos
  src/app.js            mapa, proyección UTM, generación y dibujo de plantas
  src/leaflet.css       estilos de Leaflet 1.9.4
  data/shapefile/       MapaCONAFOR.* (original)
  data/poligonos.geojson  polígonos en WGS 84
  data/poligonos_utm.js   polígonos en UTM usados por el sitio
```

Después de editar algo en `src/` o `data/`, ejecuta `python3 web/build.py` para regenerar `web/index.html`.
