import shapefile, json, sys
# Uso: python3 shp_a_js.py data/shapefile data/poligonos_utm.js
d=sys.argv[1]
r=shapefile.Reader(shp=open(d+"/MapaCONAFOR.shp","rb"), dbf=open(d+"/MapaCONAFOR.dbf","rb"))
out=[]
for sr in r.iterShapeRecords():
    rec=sr.record.as_dict()
    ring=[[round(x,2),round(y,2)] for x,y in sr.shape.points]
    out.append({"p":rec['poligono'],"ha":rec['area_calc'],"ring":ring})
out.sort(key=lambda o:o['p'])
open(sys.argv[2],"w").write("const POLIGONOS_UTM = "+json.dumps(out,separators=(',',':'))+";\n")
