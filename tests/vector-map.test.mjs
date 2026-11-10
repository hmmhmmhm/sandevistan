import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { vectorTileWindow, decodeMapTile } from "../server/vector-map-tiles.js";
import { handleVectorMapRequest } from "../server/vector-map.js";
import { normalizeMapPayload } from "../server/map.js";
const fixture = JSON.parse(await readFile(new URL('./fixtures/seoul-vector-tile.json',import.meta.url),'utf8'));
const bytes = new Uint8Array(await readFile(new URL('./fixtures/seoul-vector-tile.pbf',import.meta.url)));
const center = { latitude:fixture.latitude, longitude:fixture.longitude };
test("bounds tile requests at normal latitudes and across the date line", () => {
  for(const [lat,lng] of [[37.5665,126.978],[0,179.999],[0,-179.999],[84,0],[-84,0]]){
    const tiles=vectorTileWindow(lat,lng);
    assert.ok(tiles.length>0 && tiles.length<=4);
    assert.ok(tiles.every(t=>t.x>=0 && t.x<2**t.z && t.y>=0 && t.y<2**t.z));
  }
});
test("decodes real OSM vector data into the existing bounded map contract", () => {
  const elements=decodeMapTile(bytes,fixture,center);
  const map=normalizeMapPayload({elements},'test-cell');
  assert.ok(map.roads.length>0 && map.roads.length<=180);
  assert.ok(map.roads.reduce((n,r)=>n+r.points.length,0)<=4000);
  assert.ok(map.labels.length>0 && map.labels.length<=24);
  assert.ok(map.roads.every(r=>r.points.every(([lat,lng])=>Math.abs(lat-37.5665)<.2 && Math.abs(lng-126.978)<.2)));
});
test("returns cached maps before any tile request", async () => {
  let calls=0;
  const response=await handleVectorMapRequest(new Request('https://api.test/api/map?lat=37.5665&lng=126.978'),{}, {
    cache:{match:async()=>new Response('{"cached":true}')},fetchImpl:async()=>{calls++;throw Error('unexpected');},
  });
  assert.equal(await response.text(),'{"cached":true}');assert.equal(calls,0);
});
test("rejects invalid coordinates and a tile template pointing off the fixed provider", async () => {
  const invalid=await handleVectorMapRequest(new Request('https://api.test/api/map?lat=900&lng=0'));
  assert.equal(invalid.status,400);
  const unsafe=await handleVectorMapRequest(new Request('https://api.test/api/map?lat=37&lng=127'),{}, {
    fetchImpl:async()=>Response.json({tiles:['https://127.0.0.1/{z}/{x}/{y}']}),cache:undefined,
  });
  assert.equal(unsafe.status,502);
});

test("uses Workers-compatible manual redirects and refuses provider redirects", async () => {
  let calls = 0;
  const response = await handleVectorMapRequest(new Request('https://api.test/api/map?lat=37&lng=127'), {}, {
    cache: undefined,
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: { location: 'https://unexpected.test' } });
    },
  });
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
});

test("keeps long place names and translations trimmed at the client length limit", () => {
  const base = 'NHS Soho Walk-In Centre (Minor Injuries Centre)';
  const localized = 'Times Square–42nd Street/Port Authority Bus Terminal';
  const map = normalizeMapPayload({ elements: [{ type: 'node', lat: 51.51, lon: -0.13,
    tags: { railway: 'station', name: base, 'name:en': localized } }] }, 'london');
  assert.equal(map.labels.length, 1);
  for (const name of [map.labels[0].name, ...Object.values(map.labels[0].localizedNames)]) {
    assert.equal(name, name.trim());
    assert.ok([...name].length <= 40);
  }
});
