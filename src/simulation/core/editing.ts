import { UTILITY_DEFAULTS, WORLD_GRID_SIZE } from "./constants";
import type {
  DemolishEntityAction,
  District,
  DistrictType,
  EditorSelectionPreview,
  FerryRoute,
  InspectorTarget,
  RoadEdge,
  RoadNode,
  SelectionState,
  TileCoord,
  TileRect,
  TramLine,
  UtilityType,
  WorldState,
} from "../../types";
import { expandRectToTiles, getTile } from "../../world/terrain/terrain";

const MIN_ZONE_FOOTPRINT = 4;
const MAX_ZONE_FOOTPRINT = 20;
const LINE_HIT_DISTANCE = 0.8;

function clampRect(rect: TileRect): TileRect {
  return {
    x: Math.max(0, Math.min(rect.x, WORLD_GRID_SIZE - 1)),
    y: Math.max(0, Math.min(rect.y, WORLD_GRID_SIZE - 1)),
    width: Math.max(1, Math.min(rect.width, WORLD_GRID_SIZE - rect.x)),
    height: Math.max(1, Math.min(rect.height, WORLD_GRID_SIZE - rect.y)),
  };
}

export function normalizeDraggedRect(start: TileCoord, end: TileCoord): TileRect {
  return clampRect({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1,
  });
}

function pointKey(point: TileCoord): string {
  return `${point.x},${point.y}`;
}

function sampleSegmentPoints(from: TileCoord, to: TileCoord): TileCoord[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) {
    return [{ ...from }];
  }

  const points: TileCoord[] = [];
  for (let step = 0; step <= steps; step += 1) {
    points.push({
      x: Math.round(from.x + (dx * step) / steps),
      y: Math.round(from.y + (dy * step) / steps),
    });
  }
  return points;
}

function samplePathTiles(path: TileCoord[]): TileCoord[] {
  const points: TileCoord[] = [];

  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (!point) {
      continue;
    }
    const previous = path[index - 1];
    if (!previous) {
      points.push(point);
      continue;
    }
    const segmentPoints = sampleSegmentPoints(previous, point);
    for (let segmentIndex = 1; segmentIndex < segmentPoints.length; segmentIndex += 1) {
      points.push(segmentPoints[segmentIndex]!);
    }
  }

  return points;
}

function isInBounds(coord: TileCoord): boolean {
  return coord.x >= 0 && coord.x < WORLD_GRID_SIZE && coord.y >= 0 && coord.y < WORLD_GRID_SIZE;
}

function baseValidation(reason?: string): EditorSelectionPreview {
  return {
    valid: false,
    invalidTiles: [],
    reason,
  };
}

export function validateZonePlacement(
  state: WorldState,
  rect: TileRect,
  districtType?: DistrictType,
): EditorSelectionPreview {
  void districtType;
  const invalidTiles: TileCoord[] = [];

  if (rect.width < MIN_ZONE_FOOTPRINT || rect.height < MIN_ZONE_FOOTPRINT) {
    return { valid: false, invalidTiles, reason: "Zones must be at least 4x4 tiles." };
  }
  if (rect.width > MAX_ZONE_FOOTPRINT || rect.height > MAX_ZONE_FOOTPRINT) {
    return { valid: false, invalidTiles, reason: "Zones cannot exceed 20x20 tiles." };
  }

  for (const coord of expandRectToTiles(rect, rect.width, rect.height)) {
    const tile = getTile(state.terrain, coord.x, coord.y);
    if (!tile || !tile.isBuildable || tile.districtId || tile.utilityId) {
      invalidTiles.push(coord);
    }
  }

  return {
    valid: invalidTiles.length === 0,
    invalidTiles,
    reason: invalidTiles.length === 0 ? undefined : "Every tile in the zone footprint must be buildable and empty.",
  };
}

export function validateUtilityPlacement(
  state: WorldState,
  utilityType: UtilityType,
  origin: TileCoord,
): EditorSelectionPreview & { footprint: TileRect } {
  const defaults = UTILITY_DEFAULTS[utilityType];
  const footprint = {
    x: origin.x,
    y: origin.y,
    width: defaults.width,
    height: defaults.height,
  };
  const invalidTiles: TileCoord[] = [];

  for (const coord of expandRectToTiles(origin, defaults.width, defaults.height)) {
    const tile = getTile(state.terrain, coord.x, coord.y);
    if (!tile || !tile.isBuildable || tile.districtId || tile.utilityId) {
      invalidTiles.push(coord);
    }
  }

  return {
    footprint,
    valid: invalidTiles.length === 0,
    invalidTiles,
    reason:
      invalidTiles.length === 0
        ? undefined
        : "Utility buildings need an empty buildable footprint that fits entirely on land.",
  };
}

function roadPathDuplicates(path: TileCoord[]): boolean {
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const point = path[index];
    if (previous && point && previous.x === point.x && previous.y === point.y) {
      return true;
    }
  }
  return false;
}

export function validateRoadPlacement(state: WorldState, path: TileCoord[]): EditorSelectionPreview {
  if (path.length < 2) {
    return { valid: false, invalidTiles: [], reason: "Roads need at least two intersections." };
  }
  if (roadPathDuplicates(path)) {
    return { valid: false, invalidTiles: [], reason: "Road bends must advance to a new intersection." };
  }

  const invalidTiles: TileCoord[] = [];
  const sampled = samplePathTiles(path);
  for (const coord of sampled) {
    const tile = getTile(state.terrain, coord.x, coord.y);
    if (!tile || tile.terrain === "water") {
      invalidTiles.push(coord);
    }
  }

  const first = path[0];
  const last = path[path.length - 1];
  const duplicateEdge = state.roadEdges.some(
    (edge) =>
      first &&
      last &&
      ((edge.path[0]?.x === first.x &&
        edge.path[0]?.y === first.y &&
        edge.path[edge.path.length - 1]?.x === last.x &&
        edge.path[edge.path.length - 1]?.y === last.y) ||
        (edge.path[0]?.x === last.x &&
          edge.path[0]?.y === last.y &&
          edge.path[edge.path.length - 1]?.x === first.x &&
          edge.path[edge.path.length - 1]?.y === first.y)),
  );

  if (duplicateEdge) {
    return { valid: false, invalidTiles, reason: "That road segment already exists." };
  }

  return {
    valid: invalidTiles.length === 0,
    invalidTiles,
    reason:
      invalidTiles.length === 0
        ? undefined
        : "Roads cannot cross water in P0.",
  };
}

export function findRoadNodeAtCoord(
  state: WorldState,
  coord: TileCoord,
  options?: { coastlineOnly?: boolean; tolerance?: number },
): RoadNode | undefined {
  const tolerance = options?.tolerance ?? 0;
  return state.roadNodes.find((node) => {
    if (options?.coastlineOnly && !node.isCoastlineNode) {
      return false;
    }
    return Math.abs(node.x - coord.x) <= tolerance && Math.abs(node.y - coord.y) <= tolerance;
  });
}

type RoadAdjacency = Map<string, Array<{ edgeId: string; nextNodeId: string }>>;

function buildRoadAdjacency(state: WorldState): RoadAdjacency {
  const adjacency: RoadAdjacency = new Map();

  for (const edge of state.roadEdges) {
    const fromList = adjacency.get(edge.fromNodeId) ?? [];
    fromList.push({ edgeId: edge.id, nextNodeId: edge.toNodeId });
    adjacency.set(edge.fromNodeId, fromList);

    const toList = adjacency.get(edge.toNodeId) ?? [];
    toList.push({ edgeId: edge.id, nextNodeId: edge.fromNodeId });
    adjacency.set(edge.toNodeId, toList);
  }

  return adjacency;
}

function findEdgePathBetweenNodes(state: WorldState, fromNodeId: string, toNodeId: string): string[] | undefined {
  if (fromNodeId === toNodeId) {
    return [];
  }

  const adjacency = buildRoadAdjacency(state);
  const queue: string[] = [fromNodeId];
  const visited = new Set(queue);
  const cameFrom = new Map<string, { edgeId: string; previousNodeId: string }>();

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      break;
    }
    if (nodeId === toNodeId) {
      break;
    }
    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nextNodeId)) {
        continue;
      }
      visited.add(neighbor.nextNodeId);
      cameFrom.set(neighbor.nextNodeId, { edgeId: neighbor.edgeId, previousNodeId: nodeId });
      queue.push(neighbor.nextNodeId);
    }
  }

  if (!cameFrom.has(toNodeId)) {
    return undefined;
  }

  const edgeIds: string[] = [];
  let cursor = toNodeId;
  while (cursor !== fromNodeId) {
    const step = cameFrom.get(cursor);
    if (!step) {
      return undefined;
    }
    edgeIds.unshift(step.edgeId);
    cursor = step.previousNodeId;
  }

  return edgeIds;
}

export interface PlannedTramLine {
  valid: boolean;
  reason?: string;
  edgeIds: string[];
  nodeIds: string[];
  path: TileCoord[];
}

export function planTramLine(state: WorldState, nodeIds: string[]): PlannedTramLine {
  const normalizedNodeIds = nodeIds.filter((nodeId, index) => nodeId !== nodeIds[index - 1]);
  if (normalizedNodeIds.length < 2) {
    return { valid: false, reason: "Tram lines need at least two stops.", edgeIds: [], nodeIds: normalizedNodeIds, path: [] };
  }

  const nodes = normalizedNodeIds.map((nodeId) => state.roadNodes.find((node) => node.id === nodeId));
  if (nodes.some((node) => !node || node.connectedEdgeIds.length === 0)) {
    return {
      valid: false,
      reason: "Tram stops must be placed on connected road nodes.",
      edgeIds: [],
      nodeIds: normalizedNodeIds,
      path: [],
    };
  }

  const edgeIds: string[] = [];
  for (let index = 1; index < normalizedNodeIds.length; index += 1) {
    const previousNodeId = normalizedNodeIds[index - 1];
    const nodeId = normalizedNodeIds[index];
    if (!previousNodeId || !nodeId) {
      continue;
    }
    const segmentEdges = findEdgePathBetweenNodes(state, previousNodeId, nodeId);
    if (!segmentEdges) {
      return {
        valid: false,
        reason: "Each tram stop must connect through existing road edges.",
        edgeIds: [],
        nodeIds: normalizedNodeIds,
        path: [],
      };
    }
    for (const edgeId of segmentEdges) {
      if (edgeIds[edgeIds.length - 1] !== edgeId) {
        edgeIds.push(edgeId);
      }
    }
  }

  const path = edgeIds.flatMap((edgeId, index) => {
    const edge = state.roadEdges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      return [];
    }
    return index === 0 ? edge.path : edge.path.slice(1);
  });

  return {
    valid: edgeIds.length > 0,
    reason: edgeIds.length > 0 ? undefined : "Tram lines need at least one traversable road segment.",
    edgeIds,
    nodeIds: normalizedNodeIds,
    path,
  };
}

export function validateFerryDockPlacement(state: WorldState, nodeId: string): EditorSelectionPreview {
  const node = state.roadNodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return baseValidation("Ferry docks must snap to an existing road node.");
  }
  if (!node.isCoastlineNode) {
    return baseValidation("Ferry docks must be placed on coastline road nodes.");
  }
  if (state.ferryDocks.some((dock) => dock.nodeId === nodeId)) {
    return baseValidation("That coastline road node already has a dock.");
  }

  return { valid: true, invalidTiles: [] };
}

export function validateFerryRoute(state: WorldState, dockIds: string[]): EditorSelectionPreview {
  if (dockIds.length !== 2) {
    return baseValidation("Ferry routes connect exactly two docks.");
  }

  const [dockAId, dockBId] = dockIds;
  const dockA = state.ferryDocks.find((dock) => dock.id === dockAId);
  const dockB = state.ferryDocks.find((dock) => dock.id === dockBId);
  if (!dockA || !dockB || dockA.id === dockB.id) {
    return baseValidation("Select two different ferry docks.");
  }
  if (
    state.ferryRoutes.some(
      (route) =>
        (route.dockAId === dockA.id && route.dockBId === dockB.id) ||
        (route.dockAId === dockB.id && route.dockBId === dockA.id),
    )
  ) {
    return baseValidation("That ferry route already exists.");
  }

  return { valid: true, invalidTiles: [] };
}

function pointToSegmentDistance(point: TileCoord, from: TileCoord, to: TileCoord): number {
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const wx = point.x - from.x;
  const wy = point.y - from.y;
  const segmentLengthSquared = vx * vx + vy * vy;
  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y);
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / segmentLengthSquared));
  const closestX = from.x + vx * t;
  const closestY = from.y + vy * t;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function pathDistance(point: TileCoord, path: TileCoord[]): number {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (path.length === 1) {
    return Math.hypot(point.x - path[0]!.x, point.y - path[0]!.y);
  }

  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) {
      continue;
    }
    best = Math.min(best, pointToSegmentDistance(point, from, to));
  }
  return best;
}

function centerOfRect(rect: TileRect): TileCoord {
  return {
    x: rect.x + Math.floor(rect.width / 2),
    y: rect.y + Math.floor(rect.height / 2),
  };
}

function routePath(state: WorldState, route: FerryRoute): TileCoord[] {
  const dockA = state.ferryDocks.find((dock) => dock.id === route.dockAId);
  const dockB = state.ferryDocks.find((dock) => dock.id === route.dockBId);
  if (!dockA || !dockB) {
    return [];
  }
  return [dockA.position, dockB.position];
}

function linePath(state: WorldState, line: TramLine): TileCoord[] {
  return line.edgeIds.flatMap((edgeId, index) => {
    const edge = state.roadEdges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      return [];
    }
    return index === 0 ? edge.path : edge.path.slice(1);
  });
}

export function resolveSelectionAtTile(state: WorldState, coord: TileCoord): SelectionState | undefined {
  const district = state.districts.find(
    (candidate) =>
      coord.x >= candidate.footprint.x &&
      coord.x < candidate.footprint.x + candidate.footprint.width &&
      coord.y >= candidate.footprint.y &&
      coord.y < candidate.footprint.y + candidate.footprint.height,
  );
  if (district) {
    return { kind: "district", entityId: district.id };
  }

  const utility = state.utilities.find(
    (candidate) =>
      coord.x >= candidate.footprint.x &&
      coord.x < candidate.footprint.x + candidate.footprint.width &&
      coord.y >= candidate.footprint.y &&
      coord.y < candidate.footprint.y + candidate.footprint.height,
  );
  if (utility) {
    return { kind: "utility", entityId: utility.id };
  }

  const tramStop = state.tramStops.find((stop) => {
    const node = state.roadNodes.find((candidate) => candidate.id === stop.nodeId);
    return node ? Math.abs(node.x - coord.x) <= 1 && Math.abs(node.y - coord.y) <= 1 : false;
  });
  if (tramStop) {
    return { kind: "tram_stop", entityId: tramStop.id };
  }

  const ferryDock = state.ferryDocks.find(
    (dock) => Math.abs(dock.position.x - coord.x) <= 1 && Math.abs(dock.position.y - coord.y) <= 1,
  );
  if (ferryDock) {
    return { kind: "ferry_dock", entityId: ferryDock.id };
  }

  const tramLine = state.tramLines.find((line) => pathDistance(coord, linePath(state, line)) <= LINE_HIT_DISTANCE);
  if (tramLine) {
    return { kind: "tram_line", entityId: tramLine.id };
  }

  const roadEdge = state.roadEdges.find((edge) => pathDistance(coord, edge.path) <= LINE_HIT_DISTANCE);
  if (roadEdge) {
    return { kind: "road_edge", entityId: roadEdge.id };
  }

  const ferryRoute = state.ferryRoutes.find((route) => pathDistance(coord, routePath(state, route)) <= 1.25);
  if (ferryRoute) {
    return { kind: "ferry_route", entityId: ferryRoute.id };
  }

  return undefined;
}

function formatDistrictSubtitle(district: District): string {
  return `${district.type.replaceAll("_", " ")} district, level ${district.level}`;
}

function formatEntityFields(entries: Array<[string, string | number]>): InspectorTarget["fields"] {
  return entries.map(([label, value]) => ({ label, value: `${value}` }));
}

function findFocusTileForRoad(roadEdge: RoadEdge): TileCoord {
  const midpoint = roadEdge.path[Math.floor(roadEdge.path.length / 2)];
  return midpoint ?? centerOfRect({ x: 64, y: 64, width: 1, height: 1 });
}

function focusTileForSelection(state: WorldState, selection: SelectionState): TileCoord | undefined {
  switch (selection.kind) {
    case "district": {
      const district = state.districts.find((candidate) => candidate.id === selection.entityId);
      return district ? centerOfRect(district.footprint) : undefined;
    }
    case "utility": {
      const utility = state.utilities.find((candidate) => candidate.id === selection.entityId);
      return utility ? centerOfRect(utility.footprint) : undefined;
    }
    case "road_edge": {
      const edge = state.roadEdges.find((candidate) => candidate.id === selection.entityId);
      return edge ? findFocusTileForRoad(edge) : undefined;
    }
    case "tram_stop": {
      const stop = state.tramStops.find((candidate) => candidate.id === selection.entityId);
      const node = stop ? state.roadNodes.find((candidate) => candidate.id === stop.nodeId) : undefined;
      return node ? { x: node.x, y: node.y } : undefined;
    }
    case "tram_line": {
      const line = state.tramLines.find((candidate) => candidate.id === selection.entityId);
      const path = line ? linePath(state, line) : [];
      return path[Math.floor(path.length / 2)];
    }
    case "ferry_dock": {
      const dock = state.ferryDocks.find((candidate) => candidate.id === selection.entityId);
      return dock ? dock.position : undefined;
    }
    case "ferry_route": {
      const route = state.ferryRoutes.find((candidate) => candidate.id === selection.entityId);
      const path = route ? routePath(state, route) : [];
      if (path.length < 2) {
        return path[0];
      }
      return {
        x: Math.round((path[0]!.x + path[1]!.x) / 2),
        y: Math.round((path[0]!.y + path[1]!.y) / 2),
      };
    }
    case "event": {
      const event = state.events.find((candidate) => candidate.id === selection.entityId);
      const district = event?.affectedDistrictIds[0]
        ? state.districts.find((candidate) => candidate.id === event.affectedDistrictIds[0])
        : undefined;
      return district ? centerOfRect(district.footprint) : undefined;
    }
    default:
      return undefined;
  }
}

export function deriveInspectorTarget(
  state: WorldState,
  selection?: SelectionState,
): InspectorTarget | undefined {
  if (!selection) {
    return undefined;
  }

  const focusTile = focusTileForSelection(state, selection);
  if (!focusTile) {
    return undefined;
  }

  switch (selection.kind) {
    case "district": {
      const district = state.districts.find((candidate) => candidate.id === selection.entityId);
      if (!district) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: district.id,
        title: `District ${district.id}`,
        subtitle: formatDistrictSubtitle(district),
        focusTile,
        fields: formatEntityFields([
          ["Population", district.population],
          ["Jobs", district.jobs],
          ["Satisfaction", `${district.satisfaction.toFixed(0)}%`],
          ["Attractiveness", district.attractiveness],
          ["Operational efficiency", `${Math.round(district.operationalEfficiency * 100)}%`],
          ["Growth score", district.demandScore.growthScore],
          ["Growth progress", district.growthProgress],
          ["Transport bonus", district.serviceCoverage.transportBonus],
          ["Congestion penalty", district.congestionPenalty],
          ["Active events", district.activeEventIds.length],
          ["Power deficit", district.deficits.power],
          ["Water deficit", district.deficits.water],
          ["Waste deficit", district.deficits.waste],
        ]),
      };
    }
    case "utility": {
      const utility = state.utilities.find((candidate) => candidate.id === selection.entityId);
      if (!utility) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: utility.id,
        title: `Utility ${utility.id}`,
        subtitle: utility.type.replaceAll("_", " "),
        focusTile,
        fields: formatEntityFields([
          ["Footprint", `${utility.footprint.width}x${utility.footprint.height}`],
          ["Capacity", utility.capacity ?? "service"],
          ["Radius", utility.serviceRadius ?? "n/a"],
        ]),
      };
    }
    case "road_edge": {
      const edge = state.roadEdges.find((candidate) => candidate.id === selection.entityId);
      if (!edge) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: edge.id,
        title: `Road ${edge.id}`,
        subtitle: "Road segment",
        focusTile,
        fields: formatEntityFields([
          ["Length", edge.length.toFixed(1)],
          ["Capacity", edge.capacity],
          ["Load", edge.load],
          ["Congestion", `${Math.round(edge.congestion * 100)}%`],
        ]),
      };
    }
    case "tram_stop": {
      const stop = state.tramStops.find((candidate) => candidate.id === selection.entityId);
      if (!stop) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: stop.id,
        title: `Tram stop ${stop.id}`,
        subtitle: "Road-node tram stop",
        focusTile,
        fields: formatEntityFields([
          ["Road node", stop.nodeId],
          ["Connected lines", state.tramLines.filter((line) => line.stopIds.includes(stop.id)).length],
        ]),
      };
    }
    case "tram_line": {
      const line = state.tramLines.find((candidate) => candidate.id === selection.entityId);
      if (!line) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: line.id,
        title: `Tram line ${line.id}`,
        subtitle: "Road-aligned tram corridor",
        focusTile,
        fields: formatEntityFields([
          ["Stops", line.stopIds.length],
          ["Road edges", line.edgeIds.length],
          ["Frequency", line.lineFrequency],
          ["Capacity bonus", line.capacityContribution],
        ]),
      };
    }
    case "ferry_dock": {
      const dock = state.ferryDocks.find((candidate) => candidate.id === selection.entityId);
      if (!dock) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: dock.id,
        title: `Ferry dock ${dock.id}`,
        subtitle: "Coastline road node",
        focusTile,
        fields: formatEntityFields([
          ["Road node", dock.nodeId],
          ["Routes", state.ferryRoutes.filter((route) => route.dockAId === dock.id || route.dockBId === dock.id).length],
        ]),
      };
    }
    case "ferry_route": {
      const route = state.ferryRoutes.find((candidate) => candidate.id === selection.entityId);
      if (!route) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: route.id,
        title: `Ferry route ${route.id}`,
        subtitle: "Dock-to-dock route",
        focusTile,
        fields: formatEntityFields([
          ["Dock A", route.dockAId],
          ["Dock B", route.dockBId],
          ["Length", route.length.toFixed(1)],
          ["Capacity bonus", route.capacityContribution],
        ]),
      };
    }
    case "event": {
      const event = state.events.find((candidate) => candidate.id === selection.entityId);
      if (!event) {
        return undefined;
      }
      return {
        kind: selection.kind,
        entityId: event.id,
        title: `Event ${event.id}`,
        subtitle: event.type.replaceAll("_", " "),
        focusTile,
        fields: formatEntityFields([
          ["Start tick", event.startTick],
          ["End tick", event.endTick],
          ["Affected districts", event.affectedDistrictIds.length],
          ["Remaining ticks", Math.max(0, event.endTick - state.clock.tick)],
        ]),
      };
    }
    default:
      return undefined;
  }
}

export function resolveDemolishSelection(state: WorldState, coord: TileCoord): SelectionState | undefined {
  const selection = resolveSelectionAtTile(state, coord);
  if (!selection) {
    return undefined;
  }
  if (selection.kind === "tram_stop") {
    const line = state.tramLines.find((candidate) => candidate.stopIds.includes(selection.entityId));
    return line ? { kind: "tram_line", entityId: line.id } : undefined;
  }
  if (selection.kind === "event") {
    return undefined;
  }
  return selection;
}

export function selectionToDemolishAction(
  selection?: SelectionState,
): DemolishEntityAction | undefined {
  if (!selection) {
    return undefined;
  }

  switch (selection.kind) {
    case "district":
      return { type: "demolish_entity", entityKind: "district", entityId: selection.entityId };
    case "road_edge":
      return { type: "demolish_entity", entityKind: "road_edge", entityId: selection.entityId };
    case "tram_line":
      return { type: "demolish_entity", entityKind: "tram_line", entityId: selection.entityId };
    case "ferry_dock":
      return { type: "demolish_entity", entityKind: "ferry_dock", entityId: selection.entityId };
    case "ferry_route":
      return { type: "demolish_entity", entityKind: "ferry_route", entityId: selection.entityId };
    case "utility":
      return { type: "demolish_entity", entityKind: "utility", entityId: selection.entityId };
    default:
      return undefined;
  }
}

export function focusTileToCameraTarget(state: WorldState, tile: TileCoord): { x: number; y: number; z: number } {
  const terrainTile = getTile(state.terrain, tile.x, tile.y);
  return {
    x: tile.x + 0.5,
    y: terrainTile ? terrainTile.elevation * 12 : 0,
    z: tile.y + 0.5,
  };
}

export function uniqueTilePath(path: TileCoord[]): TileCoord[] {
  const unique: TileCoord[] = [];
  const seen = new Set<string>();
  for (const point of path) {
    if (!isInBounds(point)) {
      continue;
    }
    const key = pointKey(point);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(point);
  }
  return unique;
}
