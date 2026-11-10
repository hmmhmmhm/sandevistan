import { createTimeout, jsonResponse, readLimitedBytes } from "./http.js";
import { mapCell, normalizeMapPayload } from "./map.js";
import { vectorTileWindow, decodeMapTile } from "./vector-map-tiles.js";
const PROVIDER = 'https://tiles.openfreemap.org';
const USER_AGENT = 'SANDEVISTAN (+https://github.com/hmmhmmhm/sandevistan)';
export async function handleVectorMapRequest(request, _env, {fetchImpl=fetch,cache=globalThis.caches?.default}={}) {
  const url=new URL(request.url);
  const latText=url.searchParams.get('lat'),lngText=url.searchParams.get('lng');
  const latitude=Number(latText),longitude=Number(lngText);
  if (!latText?.trim() || !lngText?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude)>85.05 || Math.abs(longitude)>180) {
    return jsonResponse({error:{code:'INVALID_COORDINATE',message:'Latitude or longitude is outside map coverage'}},{status:400});
  }
  const cell=mapCell(latitude,longitude);
  const key=new Request(`https://sandevistan-map-cache.invalid/vector-v2?cell=${encodeURIComponent(cell)}`);
  try { const hit=await cache?.match(key);if(hit)return hit; } catch {}
  const timeout=createTimeout(8_000);
  let stage = "metadata-fetch";
  try {
    const headers={'user-agent':USER_AGENT};
    const metadata=await fetchImpl(PROVIDER+'/planet',{headers,signal:timeout.signal,redirect:'manual'});
    if(!metadata.ok) { stage = `metadata-http-${metadata.status}`; throw new Error('MAP_PROVIDER_METADATA'); }
    stage = 'metadata-decode';
    const info=JSON.parse(new TextDecoder().decode(await readLimitedBytes(metadata,256_000)));
    const template=info?.tiles?.[0];
    if(typeof template!=='string' || new URL(template).origin!==PROVIDER)throw new Error('MAP_PROVIDER_TEMPLATE');
    const elements=[];
    for(const tile of vectorTileWindow(latitude,longitude)) {
      const tileUrl=template.replace('{z}',tile.z).replace('{x}',tile.x).replace('{y}',tile.y);
      stage = 'tile-fetch';
      const response=await fetchImpl(tileUrl,{headers,signal:timeout.signal,redirect:'manual'});
      if(!response.ok) { stage = `tile-http-${response.status}`; throw new Error('MAP_PROVIDER_TILE'); }
      stage = 'tile-read';
      const bytes=await readLimitedBytes(response,1_500_000);
      stage = 'tile-decode';
      elements.push(...decodeMapTile(bytes,tile,{latitude,longitude}));
    }
    stage = 'map-normalize';
    const value={...normalizeMapPayload({elements},cell),tileSource:'openmaptiles'};
    const response=jsonResponse(value,{headers:{'cache-control':'public, max-age=3600, s-maxage=86400'}});
    try { await cache?.put(key,response.clone()); } catch {}
    return response;
  } catch {
    return jsonResponse({error:{code:timeout.signal.aborted?'MAP_TIMEOUT':'MAP_UPSTREAM_ERROR',message:'Map tile service unavailable',stage}},{status:timeout.signal.aborted?504:502});
  } finally {timeout.dispose();}
}
