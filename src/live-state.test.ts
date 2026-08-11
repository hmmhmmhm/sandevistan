import { describe, expect, it } from "vitest";
import {
  DEMO_COORDINATE,
  createInitialLiveDashboardState,
  type Coordinate,
  type DataState,
  type LiveDashboardState,
  type LocationValue,
  type MapLabel,
  type MapRoad,
  type MapValue,
  type NewsItem,
  type RouteManeuver,
  type RouteValue,
  type WeatherValue,
} from "./live-state";

describe("live dashboard state", () => {
  it("uses the Hongdae demo coordinate", () => {
    expect(DEMO_COORDINATE).toEqual({
      latitude: 37.5563,
      longitude: 126.922,
    });
  });

  it("creates the exact initial provider states", () => {
    const state = createInitialLiveDashboardState();

    expect(state).toEqual({
      location: {
        status: "loading",
        value: {
          coordinate: { latitude: 37.5563, longitude: 126.922 },
          source: "demo",
        },
      },
      weather: { status: "loading" },
      news: { status: "loading", value: [] },
      x: { status: "unavailable", value: [] },
      todos: {
        status: "fresh",
        value: [
          { id: "station", title: "지하철역으로 이동", completed: false },
          { id: "umbrella", title: "우산 챙기기", completed: false },
          { id: "route", title: "경로 확인", completed: true },
        ],
      },
      map: {
        status: "loading",
        value: {
          roads: [],
          labels: [],
          attribution: "© OSM CONTRIBUTORS",
        },
      },
      route: { status: "disabled" },
    });
  });

  it("returns independent fresh instances", () => {
    const first = createInitialLiveDashboardState();
    const second = createInitialLiveDashboardState();

    expect(first).not.toBe(second);
    expect(first.location.value).not.toBe(second.location.value);
    expect(first.location.value?.coordinate).not.toBe(
      second.location.value?.coordinate,
    );
    expect(first.news.value).not.toBe(second.news.value);
    expect(first.map.value).not.toBe(second.map.value);
    expect(first.map.value?.roads).not.toBe(second.map.value?.roads);
    expect(first.map.value?.labels).not.toBe(second.map.value?.labels);
  });

  it("exposes practical typed values for each provider", () => {
    const coordinate: Coordinate = { latitude: 37.5, longitude: 127 };
    const location: LocationValue = {
      coordinate,
      source: "live",
      accuracy: 10,
      heading: 45,
      speed: 1.2,
    };
    const weather: WeatherValue = {
      temperature: 28,
      apparentTemperature: 30,
      humidity: 65,
      windSpeed: 8,
      precipitationProbability: 20,
      weatherCode: 1,
      condition: "맑음",
    };
    const news: NewsItem = {
      id: "example-1",
      title: "제목",
      url: "https://example.com/article",
      publishedAt: 1_785_120_000_000,
    };
    const road: MapRoad = { kind: "major", points: [coordinate] };
    const label: MapLabel = {
      kind: "transit",
      name: "홍대입구역",
      point: coordinate,
    };
    const map: MapValue = {
      roads: [road],
      labels: [label],
      attribution: "© OSM CONTRIBUTORS",
      cell: "37.5,127.0",
    };
    const maneuver: RouteManeuver = {
      instruction: "우회전",
      distance: 120,
      wayPoints: [0, 1],
    };
    const route: RouteValue = {
      destinationName: "홍대입구역",
      geometry: [coordinate],
      maneuvers: [maneuver],
      activeManeuverIndex: 0,
      remainingDistance: 800,
      profile: "foot-walking",
    };
    const locationState: DataState<LocationValue> = {
      status: "fresh",
      value: location,
      fetchedAt: 1,
    };
    const dashboard: LiveDashboardState = {
      location: locationState,
      weather: { status: "fresh", value: weather, fetchedAt: 1 },
      news: { status: "fresh", value: [news], fetchedAt: 1 },
      x: { status: "unavailable", value: [] },
      todos: createInitialLiveDashboardState().todos,
      map: { status: "fresh", value: map, fetchedAt: 1 },
      route: { status: "fresh", value: route, fetchedAt: 1 },
    };

    expect(dashboard.weather.value?.precipitationProbability).toBe(20);
    expect(dashboard.map.value?.roads[0]?.points[0]).toBe(coordinate);
    expect(dashboard.map.value?.labels[0]).toBe(label);
    expect(dashboard.route.value?.maneuvers[0]).toBe(maneuver);
  });
});
