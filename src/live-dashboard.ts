import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
  type TodoItem,
  type XHudPost,
} from "./live-state";
import {
  resolveInitialLocation,
  type LocationBridge,
} from "./location";
import {
  createLiveDashboardRefresh,
  type LiveRefreshTarget,
} from "./live-dashboard-refresh";
import { createLiveRouteSession } from "./live-route-session";
import { MAP_MAX_AGE_MS } from "./map";
import { NEWS_MAX_AGE_MS } from "./news";
import type {
  Destination,
  RouteProfile,
  RoutingStatus,
} from "./routing";
import {
  localizeBuiltInTodos,
  resolveTodos,
  toggleTodo,
  writeTodos,
} from "./todos";
import { WEATHER_MAX_AGE_MS } from "./weather";
import { logDiagnostic } from "./diagnostic-log";
import type { PhoneLocale } from "./phone-types";
import { createLiveLocationStream } from "./live-location-stream";

export type LiveDashboardUpdate = {
  readonly state: LiveDashboardState;
  readonly target: LiveRefreshTarget;
};

type DocumentTarget = Pick<
  Document,
  "addEventListener" | "removeEventListener" | "visibilityState"
>;

type LiveDashboardSessionOptions = {
  readonly bridge: LocationBridge;
  readonly onUpdate: (update: LiveDashboardUpdate) => void;
  readonly canRefreshNews?: () => boolean;
  readonly getLocale?: () => PhoneLocale;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly documentTarget?: DocumentTarget;
  readonly routingStatus?: RoutingStatus;
};

const diagnosticNow = () => (
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
);

const diagnosticDuration = (startedAt: number) => (
  diagnosticNow() - startedAt
);

const diagnosticErrorKind = (error: unknown) => (
  error instanceof Error ? error.name : typeof error
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function todosMatch(
  left: LiveDashboardState["todos"]["value"],
  right: LiveDashboardState["todos"]["value"],
): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return item.id === other.id
      && item.title === other.title
      && item.completed === other.completed;
  });
}

export function createLiveDashboardSession(
  options: LiveDashboardSessionOptions,
): {
  start(): Promise<void>;
  startRoute(
    destination: Destination,
    profile: RouteProfile,
  ): Promise<void>;
  resumeRoute(): Promise<void>;
  endRoute(): Promise<void>;
  setRoutingKey(key: string | undefined): void;
  refreshWeather(): Promise<"accepted" | "dropped">;
  refreshNewsSources(): Promise<"accepted" | "dropped">;
  refreshNewsIfDue(): void;
  refreshLocale(): void;
  replaceTodos(items: readonly TodoItem[]): void;
  replaceX(items: readonly XHudPost[]): void;
  toggleTodo(index: number): Promise<boolean>;
  getState(): LiveDashboardState;
  dispose(): void;
} {
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const documentTarget = options.documentTarget
    ?? (typeof document === "undefined" ? undefined : document);
  let routingKey: string | undefined;
  const isRoutingEnabled = () => (
    options.routingStatus?.enabled === true || routingKey !== undefined
  );
  let state: LiveDashboardState = {
    ...createInitialLiveDashboardState(),
    route: isRoutingEnabled()
      ? { status: "fresh" }
      : { status: "disabled" },
  };
  let disposed = false;
  let listenerRegistered = false;
  let locationResolved = false;
  let startPromise: Promise<void> | undefined;
  let newsSourceVersion = 0;
  let refreshedNewsSourceVersion = 0;

  const emit = (target: LiveRefreshTarget) => {
    if (disposed) return;
    try {
      options.onUpdate({ state: clone(state), target });
      logDiagnostic("LIVE", `dashboard emitted · ${target}`);
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `dashboard update callback failed · ${diagnosticErrorKind(error)}`,
      );
      // A preview/render callback must not stop the live-data session.
    }
  };
  const setRoute = (route: LiveDashboardState["route"]) => {
    state = { ...state, route: clone(route) };
  };
  const replaceX = (items: readonly XHudPost[]) => {
    state = {
      ...state,
      x: {
        status: items.length > 0 ? "fresh" : "unavailable",
        value: items.map((item) => ({ ...item })),
        ...(items.length > 0 ? { fetchedAt: now() } : {}),
      },
    };
    emit("right");
  };

  const refresh = createLiveDashboardRefresh({
    bridge: options.bridge,
    fetchImpl,
    now,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    emit,
    isDisposed: () => disposed,
    getLocale: options.getLocale,
  });

  let routeSession: ReturnType<typeof createLiveRouteSession>;
  const locationStream = createLiveLocationStream({
    bridge: options.bridge,
    now,
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    emit,
    refreshMap: refresh.refreshMap,
    getRouteSession: () => routeSession,
    isDisposed: () => disposed,
  });

  const onVisibilityChange = () => {
    if (
      disposed
      || !locationResolved
      || documentTarget?.visibilityState !== "visible"
    ) {
      return;
    }
    logDiagnostic("LIVE", "visibility refresh check");
    const currentTime = now();
    if (
      state.weather.fetchedAt === undefined
      || currentTime - state.weather.fetchedAt >= WEATHER_MAX_AGE_MS
    ) {
      void refresh.refreshWeather();
    }
    refreshNewsIfDue();
    if (
      state.map.fetchedAt === undefined
      || currentTime - state.map.fetchedAt >= MAP_MAX_AGE_MS
    ) {
      void refresh.refreshMap();
    }
  };

  const refreshNewsIfDue = () => {
    if (disposed) {
      logDiagnostic("LIVE", "news due check skipped · disposed");
      return;
    }
    if (options.canRefreshNews && !options.canRefreshNews()) {
      logDiagnostic("LIVE", "news refill skipped · reading");
      return;
    }
    const fetchedAt = state.news.fetchedAt;
    const sourceVersion = newsSourceVersion;
    const sourcesChanged = sourceVersion !== refreshedNewsSourceVersion;
    if (
      !sourcesChanged
      &&
      fetchedAt !== undefined
      && now() - fetchedAt < NEWS_MAX_AGE_MS
    ) {
      return;
    }
    void refresh.refreshNews(sourcesChanged).then((decision) => {
      if (decision === "accepted") {
        refreshedNewsSourceVersion = Math.max(
          refreshedNewsSourceVersion,
          sourceVersion,
        );
      }
    });
  };

  const start = (): Promise<void> => {
    if (disposed) {
      logDiagnostic("LIVE", "session start skipped · disposed");
      return Promise.resolve();
    }
    if (startPromise) {
      logDiagnostic("LIVE", "session start joined");
      return startPromise;
    }
    logDiagnostic("LIVE", "session start");
    if (documentTarget && !listenerRegistered) {
      documentTarget.addEventListener("visibilitychange", onVisibilityChange);
      listenerRegistered = true;
    }
    startPromise = (async () => {
      const todos = await resolveTodos(
        options.bridge,
        options.getLocale?.() ?? "ko",
      );
      if (disposed) return;
      if (!todosMatch(state.todos.value, todos)) {
        state = {
          ...state,
          todos: { status: "fresh", value: clone(todos) },
        };
        emit("right");
      }

      let location = state.location;
      try {
        location = await resolveInitialLocation(options.bridge, now());
      } catch (error) {
        logDiagnostic(
          "ERROR",
          `initial location failed · ${diagnosticErrorKind(error)}`,
        );
        // The demo coordinate remains usable when initial location fails.
      }
      if (disposed) return;
      state = { ...state, location: clone(location) };
      locationResolved = true;
      emit(await routeSession.restore() ? "all" : "left");
      await Promise.all([
        refresh.refreshWeather(),
        refresh.refreshNews(),
        refresh.refreshMap(),
      ]);
      await locationStream.start();
      logDiagnostic("LIVE", "session ready");
    })();
    return startPromise;
  };

  routeSession = createLiveRouteSession({
    bridge: options.bridge,
    routingStatus: options.routingStatus,
    isRoutingEnabled,
    getRoutingKey: () => routingKey,
    fetchImpl,
    now,
    getState: () => state,
    setRoute,
    emit,
    isDisposed: () => disposed,
    ensureStarted: start,
    setLocationMode: locationStream.start,
  });

  const toggleTodoAt = async (index: number): Promise<boolean> => {
    if (disposed) return false;
    const current = state.todos.value ?? [];
    const next = toggleTodo(current, index);
    if (next === current) return false;
    state = {
      ...state,
      todos: { status: "fresh", value: clone(next) },
    };
    emit("right");
    await writeTodos(options.bridge, next);
    return true;
  };

  const replaceTodos = (items: readonly TodoItem[]) => {
    if (disposed || todosMatch(state.todos.value, items)) return;
    state = {
      ...state,
      todos: { status: "fresh", value: clone(items) },
    };
    emit("right");
  };

  const refreshLocale = () => {
    if (disposed || !state.todos.value) return;
    const next = localizeBuiltInTodos(
      state.todos.value,
      options.getLocale?.() ?? "ko",
    );
    if (todosMatch(state.todos.value, next)) return;
    state = {
      ...state,
      todos: { ...state.todos, value: clone(next) },
    };
    emit("right");
  };

  const setRoutingKey = (key: string | undefined) => {
    if (routingKey === key) return;
    routingKey = key;
    if (routeSession.activeRoute()) return;
    state = {
      ...state,
      route: isRoutingEnabled()
        ? { status: "fresh" }
        : { status: "disabled" },
    };
    emit("all");
  };

  return {
    start,
    startRoute: routeSession.startRoute,
    resumeRoute: routeSession.resumeRoute,
    endRoute: routeSession.endRoute,
    setRoutingKey,
    refreshWeather: () => refresh.refreshWeather(true),
    refreshNewsSources: () => {
      newsSourceVersion += 1;
      if (options.canRefreshNews && !options.canRefreshNews()) {
        logDiagnostic("LIVE", "news source refresh dropped · reading");
        return Promise.resolve("dropped");
      }
      const sourceVersion = newsSourceVersion;
      return refresh.refreshNews(true).then((decision) => {
        if (decision === "accepted") {
          refreshedNewsSourceVersion = Math.max(
            refreshedNewsSourceVersion,
            sourceVersion,
          );
        }
        return decision;
      });
    },
    refreshNewsIfDue,
    refreshLocale,
    replaceTodos,
    replaceX,
    toggleTodo: toggleTodoAt,
    getState: () => clone(state),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      logDiagnostic("LIVE", "session dispose");
      routeSession.dispose();
      void locationStream.stop();
      if (documentTarget && listenerRegistered) {
        documentTarget.removeEventListener(
          "visibilitychange",
          onVisibilityChange,
        );
      }
    },
  };
}
