# Agave deforestation algorithm

## Mapa de siembra (`web/`)

Sitio web para visualizar los 31 polígonos del proyecto CONAFOR (196 ha, WGS 84 / UTM zona 14N) sobre un mapa geográfico real, con cada planta dibujada en su posición.

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
