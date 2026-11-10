import { expect,it,vi } from "vitest";
import { requestAiWeather } from "./ai-weather";
const forecast={timezone:"Asia/Seoul",current:{time:"2026-11-08T21:00",precipitation:0,temperature_2m:7,apparent_temperature:5,relative_humidity_2m:70,weather_code:61,wind_speed_10m:9},hourly:{time:["2026-11-08T22:00"],precipitation_probability:[60]},daily:{temperature_2m_max:[12],temperature_2m_min:[3],precipitation_probability_max:[70]}};
it("resolves a Korean city instead of a same-named mountain and returns sourced weather without GPS",async()=>{
 const fetchImpl=vi.fn(async(url:RequestInfo|URL)=>{
  const value=new URL(String(url));
  if(value.hostname==="api.open-meteo.com")return Response.json(forecast);
  return Response.json({results:value.searchParams.get("name")==="안산"?[{name:"안산",country_code:"KR",feature_code:"MT",latitude:38.1,longitude:128.3}]:[{name:"안산시",country_code:"KR",feature_code:"PPLA2",latitude:37.32361,longitude:126.82194,population:650000,admin1:"경기도"}]});
 });
 const result=await requestAiWeather({place:"안산",countryCode:"KR"},{locale:"ko",fetchImpl});
 expect(result.data.location).toMatchObject({name:"안산시",latitude:37.32361,longitude:126.82194});
 expect(result.data.current.temperature).toBe(7);expect(result.data.current.precipitationMm).toBe(0);expect(result.data.current).not.toHaveProperty("precipitationProbability");expect(result.data.today.rainProbabilityPercent).toBe(70);
 expect(result.sources[0]?.url).toContain("latitude=37.32361");expect(result.data.asOf).toBe(forecast.current.time);
});
it("rejects invalid coordinates and missing country information before network use",async()=>{
 const fetchImpl=vi.fn();await expect(requestAiWeather({latitude:999,longitude:2},{locale:"en",fetchImpl})).rejects.toThrow();
 await expect(requestAiWeather({place:"Cambridge"},{locale:"en",fetchImpl})).rejects.toThrow();expect(fetchImpl).not.toHaveBeenCalled();
});
