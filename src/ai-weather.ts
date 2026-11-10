import { createTimeout, readLimitedBytes } from "../server/http.js";
import { buildWeatherUrl, parseWeatherResponse } from "./weather";
import type { PhoneLocale } from "./phone-types";

function record(value: unknown): value is Record<string,unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function coordinates(latitude: unknown,longitude: unknown) { return finite(latitude) && finite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180; }
function candidate(value: unknown) {
  if (!record(value) || typeof value.name!=="string" || typeof value.country_code!=="string"
    || typeof value.feature_code!=="string" || !value.feature_code.startsWith("PPL")
    || !finite(value.latitude) || !finite(value.longitude) || !coordinates(value.latitude,value.longitude)) return;
  return { name:value.name,countryCode:value.country_code,region:typeof value.admin1==="string"?value.admin1:"",
    latitude:value.latitude,longitude:value.longitude,population:finite(value.population)?value.population:0 };
}
function firstNumber(value: unknown) { if (!Array.isArray(value) || !finite(value[0])) throw Error("Incomplete weather forecast"); return value[0]; }

export async function requestAiWeather(args: unknown, options: { locale:PhoneLocale;fetchImpl?:typeof fetch;signal?:AbortSignal }) {
  if (!record(args)) throw Error("Invalid weather arguments");
  const timeout=createTimeout(12_000,undefined,undefined,options.signal);
  const fetchImpl=options.fetchImpl??globalThis.fetch.bind(globalThis);
  const read=async(url:URL):Promise<unknown>=>{
    const response=await fetchImpl(url,{signal:timeout.signal,redirect:"error"});
    if(!response.ok) throw Error("Weather provider is unavailable");
    return JSON.parse(new TextDecoder().decode(await readLimitedBytes(response,1_000_000)));
  };
  try {
    let location:{name:string;region:string;latitude:number;longitude:number;countryCode?:string};
    if (finite(args.latitude) && finite(args.longitude) && coordinates(args.latitude,args.longitude)) {
      location={name:"Requested coordinates",region:"",latitude:args.latitude,longitude:args.longitude};
    } else {
      const place=typeof args.place==="string"?args.place.trim():"";
      const countryCode=typeof args.countryCode==="string"?args.countryCode.toUpperCase():"";
      if(!place || place.length>100 || !/^[A-Z]{2}$/.test(countryCode)) throw Error("A city and ISO country code, or valid coordinates, are required");
      const names=/^[\uac00-\ud7a3]{2}$/.test(place)?[place,`${place}\uC2DC`]:[place];
      const matches:NonNullable<ReturnType<typeof candidate>>[]=[];
      for(const name of names) {
        const url=new URL("https://geocoding-api.open-meteo.com/v1/search");
        for(const [key,value] of Object.entries({name,countryCode,count:"10",language:options.locale.split("-")[0]})) url.searchParams.set(key,value);
        const data=await read(url);
        if(record(data)&&Array.isArray(data.results)) for(const value of data.results) {
          const parsed=candidate(value);if(parsed&&parsed.countryCode===countryCode) matches.push(parsed);
        }
      }
      const selected=matches.sort((a,b)=>b.population-a.population)[0];
      if(!selected) throw Error("No matching city found; clarify the city or use its Latin name");
      location=selected;
    }
    const url=buildWeatherUrl(location);
    url.searchParams.set("current",`${url.searchParams.get("current")},precipitation`);
    url.searchParams.set("forecast_days","2");
    url.searchParams.set("daily","temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    const data=await read(url),weather=parseWeatherResponse(data);
    if(!record(data)||!record(data.current)||typeof data.current.time!=="string"||!record(data.daily)||typeof data.timezone!=="string") throw Error("Incomplete weather forecast");
    if(!finite(data.current.precipitation) || data.current.precipitation<0) throw Error("Incomplete current precipitation");
    const {precipitationProbability: _nextHourProbability,...currentWeather}=weather;
    const rainProbability=firstNumber(data.daily.precipitation_probability_max);
    if(rainProbability<0||rainProbability>100) throw Error("Invalid rain probability");
    const nextHours:{localTime:string;rainProbabilityPercent:number}[]=[];
    if(record(data.hourly)&&Array.isArray(data.hourly.time)&&Array.isArray(data.hourly.precipitation_probability)) {
      for(let index=0;index<data.hourly.time.length && nextHours.length<8;index++) {
        const time=data.hourly.time[index],probability=data.hourly.precipitation_probability[index];
        if(typeof time==="string"&&time>=data.current.time&&finite(probability)) nextHours.push({localTime:time,rainProbabilityPercent:probability});
      }
    }
    return { data:{provider:"Open-Meteo model forecast",location,asOf:data.current.time,timezone:data.timezone,
      current:{...currentWeather,precipitationMm:data.current.precipitation},nextHours,today:{highC:firstNumber(data.daily.temperature_2m_max),lowC:firstNumber(data.daily.temperature_2m_min),rainProbabilityPercent:rainProbability},
      units:{temperature:"Celsius",windSpeed:"km/h",precipitation:"mm per current interval",rainProbability:"percent"}},
      sources:[{title:"Open-Meteo forecast",url:url.toString()}] };
  } finally { timeout.dispose(); }
}

export const AI_WEATHER_TOOL={
  type:"function" as const,name:"get_weather",
  description:"Get current model weather and today's forecast from Open-Meteo. For a named city use a short city name (e.g. Ansan) and ISO country code (KR); GPS is not required. current.precipitationMm and weatherCode describe current modeled conditions; nextHours/today probabilities are forecasts, not proof that rain is falling now. For weather near the user, get live GPS first and pass latitude/longitude. Clarify ambiguous cities instead of guessing.",
  parameters:{type:"object",properties:{place:{type:"string",maxLength:100},countryCode:{type:"string",minLength:2,maxLength:2},latitude:{type:"number",minimum:-90,maximum:90},longitude:{type:"number",minimum:-180,maximum:180}},additionalProperties:false},
};
