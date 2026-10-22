# Agave deforestation algorithm

## Mapa de siembra (`web/`)

Sitio web para visualizar los 31 polígonos del proyecto CONAFOR (196 ha, WGS 84 / UTM zona 14N) sobre un mapa geográfico real, con cada planta dibujada en su posición.

- Abrir `web/index.html` en el navegador, o publicarlo con cualquier servidor estático (por ejemplo GitHub Pages). No requiere instalación: Leaflet se carga desde cdnjs.
- Fondo satelital (Esri), de calles (OpenStreetMap) o sin fondo, con barra de escala métrica.
- Clic en un polígono para seleccionarlo; "Detalle 80 × 80 m" reproduce la vista de detalle del diseño.
- Al acercarse, cada planta es un hexágono del color de su especie; al tocarla se abre su ficha (especie, polígono, hilera, coordenadas UTM y geográficas). Las plantas con posición cambiada llevan un círculo.

### Datos de plantas

Por ahora la distribución es **simulada**: tresbolillo de 8 m en hilera y 2 m entre hileras (625 plantas/ha), con especies asignadas al azar de forma determinista. Para ver los datos reales usa "Cargar CSV de plantas" con estas columnas:

| columna | obligatoria | ejemplo |
|---|---|---|
| `especie` | sí | `Agave salmiana` |
| `este`, `norte` (UTM 14N) o `lat`, `lon` | sí | `261234.5`, `2586012.0` |
| `poligono` | no (se calcula) | `9` |
| `cambiada` | no | `1` / `si` |

### Imágenes por especie (siguiente paso)

En `web/src/app.js`, cada especie de `ESPECIES` tiene un campo `img: null`. Al poner una ruta (por ejemplo `img: "img/agave_salmiana.png"`, PNG o SVG con fondo transparente), esa imagen sustituye al hexágono cuando el zoom es suficiente; mientras tanto se usan los puntos de color.

### Estructura

```
web/
  index.html            sitio listo para abrir (generado)
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
