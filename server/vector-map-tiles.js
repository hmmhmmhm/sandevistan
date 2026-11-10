import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
const RADIUS = 650;
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "track", "path", "raceway"]);
const LANDMARK_CLASSES = new Set(["hospital", "university", "college", "school", "library", "museum", "attraction", "park", "townhall", "stadium", "railway", "station", "subway"]);
const radians = (value) => value * Math.PI / 180;
const tileY = (lat, n) => Math.floor((1 - Math.asinh(Math.tan(radians(Math.max(-85.05, Math.min(85.05, lat)))))/Math.PI)/2*n);
export function vectorTileWindow(latitude, longitude) {
  const cosine = Math.max(.08, Math.cos(radians(latitude)));
  const latSpan = RADIUS / 111_320;
  const lonSpan = RADIUS / (111_320 * cosine);
  let zoom = Math.max(1, Math.min(14, Math.floor(Math.log2(40_075_016 * cosine / (RADIUS * 2)))));
  while (true) {
    const n = 2 ** zoom;
    const west = Math.floor((longitude - lonSpan + 180) / 360 * n);
    const east = Math.floor((longitude + lonSpan + 180) / 360 * n);
    const north = Math.max(0, tileY(latitude + latSpan, n));
    const south = Math.min(n-1, tileY(latitude - latSpan, n));
    if ((east-west+1)*(south-north+1)>4 && zoom>1) { zoom--; continue; }
    const tiles = [];
    for (let x=west;x<=east;x++) for(let y=north;y<=south;y++) tiles.push({z:zoom,x:((x%n)+n)%n,y});
    return tiles.slice(0,4);
  }
}
function projected(point, center) {
  const [lng,lat] = point;
  return [((lng-center.longitude+540)%360-180)*111_320*Math.cos(radians(center.latitude)),(lat-center.latitude)*111_320];
}
function lineNearby(line, center) {
  const points = line.map((point) => projected(point,center));
  return points.some(([x,y], index) => {
    if (x*x+y*y <= 2*RADIUS*RADIUS) return true;
    const next = points[index+1]; if (!next) return false;
    const dx=next[0]-x,dy=next[1]-y;
    const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy || 1)));
    return (x+t*dx)**2+(y+t*dy)**2<=2*RADIUS*RADIUS;
  });
}
function linesOf(geometry) {
  if (geometry.type==='LineString') return [geometry.coordinates];
  if (geometry.type==='MultiLineString') return geometry.coordinates;
  return [];
}
export function decodeMapTile(bytes, coordinates, center) {
  const tile = new VectorTile(new PbfReader(bytes));
  const elements = [];
  const roads = tile.layers.transportation;
  if (roads) for (let i=0;i<Math.min(roads.length,1200);i++) {
    const feature=roads.feature(i),properties=feature.properties;
    if (!ROAD_CLASSES.has(properties.class) || feature.type!==2) continue;
    const geometry=feature.toGeoJSON(coordinates.x,coordinates.y,coordinates.z).geometry;
    for (const line of linesOf(geometry)) {
      if (!lineNearby(line,center)) continue;
      elements.push({type:"way",tags:{highway:properties.class==='minor'?'residential':properties.class},geometry:line.map(([lon,lat])=>({lat,lon}))});
    }
  }
  for (const name of ['place','poi','transportation_name']) {
    const layer=tile.layers[name];if (!layer) continue;
    for (let i=0;i<Math.min(layer.length,3000);i++) {
      const feature=layer.feature(i),properties=feature.properties;
      if (typeof properties.name!=='string') continue;
      if (name==='poi' && !LANDMARK_CLASSES.has(properties.class) && !LANDMARK_CLASSES.has(properties.subclass)) continue;
      const geometry=feature.toGeoJSON(coordinates.x,coordinates.y,coordinates.z).geometry;
      let point;
      if (geometry.type==='Point') point=geometry.coordinates;
      else {
        const lines=linesOf(geometry);const line=lines[0];
        if (line?.length) point=line[Math.floor(line.length/2)];
      }
      if (!point || !lineNearby([point],center)) continue;
      const tags={...properties};
      if (name==='place') tags.place=properties.class;
      else if(name==='transportation_name') tags.highway=properties.class;
      else if(['railway','station','subway'].includes(properties.class)) tags.railway='station';
      else tags.amenity=properties.subclass || properties.class;
      elements.push({tags,center:{lat:point[1],lon:point[0]}});
    }
  }
  return elements;
}
