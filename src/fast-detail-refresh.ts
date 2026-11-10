import type { FastCanvasRefreshTarget } from "./fast-canvas-transport";
import type { FastHudViewMode } from "./fast-hud-view";
import type {
  Coordinate,
  LiveDashboardState,
  MapLabel,
  MapRoad,
  NewsItem,
  RouteManeuver,
  TodoItem,
} from "./live-state";

function coordinatesMatch(
  left: Coordinate | undefined,
  right: Coordinate | undefined,
): boolean {
  return left?.latitude === right?.latitude
    && left?.longitude === right?.longitude;
}

function coordinateListsMatch(
  left: readonly Coordinate[],
  right: readonly Coordinate[],
): boolean {
  return left.length === right.length
    && left.every((point, index) => coordinatesMatch(point, right[index]));
}

function roadsMatch(
  left: readonly MapRoad[],
  right: readonly MapRoad[],
): boolean {
  return left.length === right.length
    && left.every((road, index) => {
      const other = right[index];
      return road.kind === other?.kind
        && coordinateListsMatch(road.points, other.points);
    });
}

function labelsMatch(
  left: readonly MapLabel[],
  right: readonly MapLabel[],
): boolean {
  return left.length === right.length
    && left.every((label, index) => {
      const other = right[index];
      return label.kind === other?.kind
        && label.name === other.name
        && coordinatesMatch(label.point, other.point);
    });
}

function newsItemsMatch(
  left: readonly NewsItem[] | undefined,
  right: readonly NewsItem[] | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.length === right.length
    && left.every((item, index) => {
      const other = right[index];
      return item.id === other?.id
        && item.title === other.title
        && item.summary === other.summary
        && item.url === other.url
        && item.publishedAt === other.publishedAt;
    });
}

function todoItemsMatch(
  left: readonly TodoItem[] | undefined,
  right: readonly TodoItem[] | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.length === right.length
    && left.every((item, index) => {
      const other = right[index];
      return item.id === other?.id
        && item.title === other.title
        && item.completed === other.completed;
    });
}

function distanceBucket(distance: number): number {
  const safe = Math.max(0, distance);
  return safe >= 1_000
    ? Math.round(safe / 100)
    : Math.round(safe);
}

function maneuversMatch(
  left: readonly RouteManeuver[],
  right: readonly RouteManeuver[],
): boolean {
  return left.length === right.length
    && left.every((maneuver, index) => {
      const other = right[index];
      return maneuver.instruction === other?.instruction
        && distanceBucket(maneuver.distance)
          === distanceBucket(other.distance)
        && maneuver.wayPoints[0] === other.wayPoints[0]
        && maneuver.wayPoints[1] === other.wayPoints[1];
    });
}

function mapVisibleStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  const leftLocation = left.location.value;
  const rightLocation = right.location.value;
  const leftMap = left.map.value;
  const rightMap = right.map.value;
  const leftRoute = left.route.value;
  const rightRoute = right.route.value;
  return left.location.status === right.location.status
    && leftLocation?.source === rightLocation?.source
    && leftLocation?.heading === rightLocation?.heading
    && coordinatesMatch(
      leftLocation?.coordinate,
      rightLocation?.coordinate,
    )
    && left.map.status === right.map.status
    && leftMap?.cell === rightMap?.cell
    && (
      !leftMap || !rightMap
        ? leftMap === rightMap
        : roadsMatch(leftMap.roads, rightMap.roads)
          && labelsMatch(leftMap.labels, rightMap.labels)
    )
    && left.route.status === right.route.status
    && (
      !leftRoute || !rightRoute
        ? leftRoute === rightRoute
        : distanceBucket(leftRoute.remainingDistance)
            === distanceBucket(rightRoute.remainingDistance)
          && coordinateListsMatch(
            leftRoute.geometry,
            rightRoute.geometry,
          )
    );
}

function newsStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  return left.news.status === right.news.status
    && left.news.fetchedAt === right.news.fetchedAt
    && newsItemsMatch(left.news.value, right.news.value);
}

function todoStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  return left.todos.status === right.todos.status
    && left.todos.fetchedAt === right.todos.fetchedAt
    && todoItemsMatch(left.todos.value, right.todos.value);
}

function weatherStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  const a = left.weather.value;
  const b = right.weather.value;
  return left.weather.status === right.weather.status
    && left.weather.fetchedAt === right.weather.fetchedAt
    && a?.temperature === b?.temperature
    && a?.apparentTemperature === b?.apparentTemperature
    && a?.humidity === b?.humidity
    && a?.windSpeed === b?.windSpeed
    && a?.precipitationProbability === b?.precipitationProbability
    && a?.weatherCode === b?.weatherCode
    && a?.condition === b?.condition;
}

function navigationStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  const leftRoute = left.route.value;
  const rightRoute = right.route.value;
  return left.route.status === right.route.status
    && left.route.fetchedAt === right.route.fetchedAt
    && (
      !leftRoute || !rightRoute
        ? leftRoute === rightRoute
        : leftRoute.destinationName === rightRoute.destinationName
          && leftRoute.activeManeuverIndex
            === rightRoute.activeManeuverIndex
          && distanceBucket(leftRoute.remainingDistance)
            === distanceBucket(rightRoute.remainingDistance)
          && maneuversMatch(
            leftRoute.maneuvers,
            rightRoute.maneuvers,
          )
    );
}

export function detailRefreshTarget(
  mode: FastHudViewMode,
  previous: LiveDashboardState,
  next: LiveDashboardState,
  sourceTarget: FastCanvasRefreshTarget,
): FastCanvasRefreshTarget | undefined {
  if (mode === "dashboard") return sourceTarget;
  if (mode === "ai" || mode === "conversate") return undefined;
  const unchanged = mode === "map"
    ? mapVisibleStateMatches(previous, next)
    : mode === "news"
      ? newsStateMatches(previous, next)
      : mode === "weather"
        ? weatherStateMatches(previous, next)
      : mode === "todo"
        ? todoStateMatches(previous, next)
        : navigationStateMatches(previous, next);
  return unchanged ? undefined : "all";
}
