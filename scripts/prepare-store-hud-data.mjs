import {mkdir,writeFile} from 'node:fs/promises';
import {handleVectorMapRequest} from '../server/vector-map.js';
import {createServer} from 'vite';
const root='output/store-hud-english-2026-11-09';await mkdir(root+'/data',{recursive:true});
const cities=[{id:'london',name:'London',latitude:51.5098,longitude:-0.1337,timeZone:'Europe/London'},{id:'new-york',name:'New York',latitude:40.7580,longitude:-73.9855,timeZone:'America/New_York'}];
const sources=[];
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
async function read(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Source HTTP ${response.status}: ${new URL(url).hostname}`);return response;}
try{
 const {buildWeatherUrl,parseWeatherResponse}=await server.ssrLoadModule('/src/weather.ts');
 for(const city of cities){
  const url=`https://capture.invalid/api/map?lat=${city.latitude}&lng=${city.longitude}`;
  const mapResponse=await handleVectorMapRequest(new Request(url),{});const map=await mapResponse.json();
  if(!mapResponse.ok||!map.roads?.length)throw Error('Map capture unavailable '+city.id);
  await writeFile(`${root}/data/${city.id}-map.json`,JSON.stringify(map));
  const weatherUrl=buildWeatherUrl(city).href;const weather=await(await read(weatherUrl)).json();parseWeatherResponse(weather);
  await writeFile(`${root}/data/${city.id}-weather.json`,JSON.stringify(weather));
  sources.push({city:city.id,coordinate:{latitude:city.latitude,longitude:city.longitude},mapProvider:'https://tiles.openfreemap.org/planet',weatherUrl,roads:map.roads.length,labels:map.labels.length});
  console.log('Fetched map/weather '+city.id+' roads='+map.roads.length+' labels='+map.labels.length);
 }
 const feedUrl='https://feeds.bbci.co.uk/news/technology/rss.xml';const xml=await(await read(feedUrl)).text();await writeFile(root+'/data/news.xml',xml);
 await writeFile(root+'/data/capture.json',JSON.stringify({capturedAt:new Date().toISOString(),cities,news:{name:'BBC Technology',url:feedUrl},sources,disclosure:'Selected simulator locations; actual provider snapshots. Battery is simulated. These images are renders, not a physical device photo.'},null,2));
 console.log('Saved English source snapshots');
}finally{await server.close();}
