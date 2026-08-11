export type DataStatus =
  | "loading"
  | "fresh"
  | "stale"
  | "unavailable"
  | "disabled";

export type Coordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

export type DataState<T> = {
  readonly status: DataStatus;
  readonly value?: T;
  readonly fetchedAt?: number;
};

export type LocationValue = {
  readonly coordinate: Coordinate;
  readonly source: "live" | "cache" | "demo";
  readonly accuracy?: number;
  readonly heading?: number;
  readonly speed?: number;
};

export type WeatherValue = {
  readonly temperature: number;
  readonly apparentTemperature: number;
  readonly humidity: number;
  readonly windSpeed: number;
  readonly precipitationProbability: number;
  readonly weatherCode: number;
  readonly condition: string;
};

export type NewsItem = {
  readonly id: string;
  readonly title: string;
  readonly source?: string;
  readonly url?: string;
  readonly publishedAt?: number;
  readonly summary?: string;
};

export type XHudPost = {
  readonly id: string;
  readonly text: string;
  readonly author: string;
  readonly username: string;
  readonly createdAt?: string;
  readonly imageUrl?: string;
  readonly avatarUrl?: string;
  readonly repostedFrom?: { readonly name: string; readonly username: string };
  readonly metrics?: { readonly replies: number; readonly reposts: number; readonly likes: number; readonly quotes: number };
};

export type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

export type MapRoad = {
  readonly kind: "major" | "minor";
  readonly points: readonly Coordinate[];
};

export type MapLabel = {
  readonly kind: "place" | "transit" | "landmark" | "road";
  readonly name: string;
  readonly localizedNames?: Readonly<Record<string, string>>;
  readonly point: Coordinate;
};

export type MapValue = {
  readonly roads: readonly MapRoad[];
  readonly labels: readonly MapLabel[];
  readonly attribution: "© OSM CONTRIBUTORS";
  readonly cell?: string;
};

export type RouteManeuver = {
  readonly instruction: string;
  readonly distance: number;
  readonly wayPoints: readonly [number, number];
};

export type RouteValue = {
  readonly destinationName: string;
  readonly geometry: readonly Coordinate[];
  readonly maneuvers: readonly RouteManeuver[];
  readonly activeManeuverIndex: number;
  readonly remainingDistance: number;
  readonly profile: "foot-walking" | "cycling-regular" | "driving-car";
};

export type LiveDashboardState = {
  readonly location: DataState<LocationValue>;
  readonly weather: DataState<WeatherValue>;
  readonly news: DataState<readonly NewsItem[]>;
  readonly x: DataState<readonly XHudPost[]>;
  readonly todos: DataState<readonly TodoItem[]>;
  readonly map: DataState<MapValue>;
  readonly route: DataState<RouteValue>;
};

export const DEMO_COORDINATE = {
  latitude: 37.5563,
  longitude: 126.922,
} as const;

export const DEFAULT_TODOS: readonly TodoItem[] = [
  { id: "station", title: "지하철역으로 이동", completed: false },
  { id: "umbrella", title: "우산 챙기기", completed: false },
  { id: "route", title: "경로 확인", completed: true },
];

export function createInitialLiveDashboardState(): LiveDashboardState {
  return {
    location: {
      status: "loading",
      value: {
        coordinate: { ...DEMO_COORDINATE },
        source: "demo",
      },
    },
    weather: { status: "loading" },
    news: { status: "loading", value: [] },
    x: { status: "unavailable", value: [] },
    todos: {
      status: "fresh",
      value: DEFAULT_TODOS.map((item) => ({ ...item })),
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
  };
}
