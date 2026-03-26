import { create } from "zustand";
import { simulationKernel } from "../../simulation/core/engine";
import { REALTIME_TICK_MS } from "../../simulation/core/constants";
import {
  deriveInspectorTarget,
  findRoadNodeAtCoord,
  focusTileToCameraTarget,
  normalizeDraggedRect,
  planTramLine,
  resolveDemolishSelection,
  resolveSelectionAtTile,
  selectionToDemolishAction,
  validateFerryDockPlacement,
  validateFerryRoute,
  validateRoadPlacement,
  validateUtilityPlacement,
  validateZonePlacement,
} from "../../simulation/core/editing";
import type {
  ManualSaveSlotId,
  AppMode,
  CameraState,
  DistrictType,
  EditorAction,
  EditorPlacementPreview,
  OverlayKind,
  PersistenceStatus,
  SelectionState,
  SimulationSpeed,
  TileCoord,
  UtilityType,
  WorldState,
  WorldSummary,
  SaveSlotId,
  SaveSlotMeta,
} from "../../types";
import { DEFAULT_CAMERA_STATE } from "../../world/camera/contracts";
import { SAVE_SLOT_IDS } from "../../types";
import { listSlots, loadSavePreferences, loadSlot, saveSavePreferences, saveSlot } from "../../persistence/storage";

function createDefaultWorld(): WorldState {
  return simulationKernel.createInitialWorld("starter-seed");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveCameraTarget(
  camera: CameraState,
  deltaX: number,
  deltaZ: number,
): CameraState["target"] {
  return {
    x: clamp(camera.target.x + deltaX, 0, 128),
    y: camera.target.y,
    z: clamp(camera.target.z + deltaZ, 0, 128),
  };
}

export function summarizeWorld(world: WorldState): WorldSummary {
  const districtCountByType = {
    residential: 0,
    commercial: 0,
    industrial: 0,
    leisure: 0,
  } satisfies WorldSummary["districtCountByType"];
  const districtCountByLevel = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  } satisfies WorldSummary["districtCountByLevel"];
  const utilityCountByType = {
    power_plant: 0,
    water_tower: 0,
    waste_center: 0,
    park: 0,
    fire_station: 0,
  } satisfies WorldSummary["utilityCountByType"];

  for (const district of world.districts) {
    districtCountByType[district.type] += 1;
    districtCountByLevel[district.level] += 1;
  }

  for (const utility of world.utilities) {
    utilityCountByType[utility.type] += 1;
  }

  const averageSatisfaction =
    world.districts.length === 0
      ? 0
      : world.districts.reduce((sum, district) => sum + district.satisfaction, 0) / world.districts.length;

  return {
    districtCountByType: { ...districtCountByType },
    districtCountByLevel: { ...districtCountByLevel },
    utilityCountByType: { ...utilityCountByType },
    averageSatisfaction,
    averageCongestion: world.traffic.averageCongestion,
  };
}

export interface WorldVitals {
  population: number;
  jobs: number;
  activeEvents: number;
  power: WorldState["utilitiesState"]["power"];
  water: WorldState["utilitiesState"]["water"];
  waste: WorldState["utilitiesState"]["waste"];
  runtime: WorldState["runtime"];
  summary: WorldSummary;
}

export interface AlertSummary {
  id: string;
  title: string;
  detail: string;
  type: WorldState["events"][number]["type"];
  remainingTicks: number;
  affectedDistricts: number;
  severity: "info" | "warning" | "critical";
}

export interface SaveSlotEntry {
  id: SaveSlotId;
  label: string;
  updatedAt?: number;
  occupied: boolean;
}

function defaultManualSlotLabels(): Record<ManualSaveSlotId, string> {
  return loadSavePreferences().manualSlotLabels;
}

function isManualSaveSlotId(slotId: SaveSlotId): slotId is ManualSaveSlotId {
  return slotId !== "autosave";
}

function fallbackManualSlotLabel(slotId: ManualSaveSlotId): string {
  switch (slotId) {
    case "slot-1":
      return "Slot One";
    case "slot-2":
      return "Slot Two";
    case "slot-3":
      return "Slot Three";
    default:
      return "Manual Slot";
  }
}

export function deriveWorldVitals(world: WorldState): WorldVitals {
  const summary = summarizeWorld(world);
  return {
    population: world.districts.reduce((sum, district) => sum + district.population, 0),
    jobs: world.districts.reduce((sum, district) => sum + district.jobs, 0),
    activeEvents: world.events.length,
    power: world.utilitiesState.power,
    water: world.utilitiesState.water,
    waste: world.utilitiesState.waste,
    runtime: world.runtime,
    summary,
  };
}

function alertSeverityForEvent(type: WorldState["events"][number]["type"]): AlertSummary["severity"] {
  switch (type) {
    case "blackout":
    case "fire":
      return "critical";
    case "traffic_collapse":
    case "storm":
      return "warning";
    default:
      return "info";
  }
}

function alertDetailForEvent(event: WorldState["events"][number]): string {
  switch (event.type) {
    case "storm":
      return "Storm conditions are reducing ferry efficiency and citywide satisfaction.";
    case "blackout":
      return "District outages are active until power stability recovers.";
    case "traffic_collapse":
      return "Road congestion has stayed severe long enough to choke district flow.";
    case "fire":
      return "A district fire is suppressing efficiency until the event burns out.";
    default:
      return `Affecting ${event.affectedDistrictIds.length} district${event.affectedDistrictIds.length === 1 ? "" : "s"}.`;
  }
}

export function deriveRecentAlerts(world: WorldState): AlertSummary[] {
  return [...world.events]
    .sort((left, right) => right.startTick - left.startTick)
    .slice(0, 4)
    .map((event) => ({
      id: event.id,
      title: event.type.replaceAll("_", " "),
      detail: alertDetailForEvent(event),
      type: event.type,
      remainingTicks: Math.max(0, event.endTick - world.clock.tick),
      affectedDistricts: event.affectedDistrictIds.length,
      severity: alertSeverityForEvent(event.type),
    }));
}

export function deriveSaveSlotEntries(
  saveSlots: SaveSlotMeta[],
  manualSlotLabels: Record<ManualSaveSlotId, string>,
): SaveSlotEntry[] {
  const slotsById = new Map(saveSlots.map((slot) => [slot.id, slot]));
  return SAVE_SLOT_IDS.map((slotId) => {
    const slot = slotsById.get(slotId);
    if (slotId === "autosave") {
      return {
        id: slotId,
        label: slot?.label ?? "Autosave",
        updatedAt: slot?.updatedAt,
        occupied: Boolean(slot),
      };
    }

    return {
      id: slotId,
      label: manualSlotLabels[slotId] || fallbackManualSlotLabel(slotId),
      updatedAt: slot?.updatedAt,
      occupied: Boolean(slot),
    };
  });
}

function speedToMultiplier(speed: SimulationSpeed): number {
  switch (speed) {
    case "pause":
      return 0;
    case "1x":
      return 1;
    case "4x":
      return 4;
    case "16x":
      return 16;
    case "timelapse":
      return 32;
    default:
      return 1;
  }
}

function emptyEditorState(): AppStoreEditorState {
  return {
    activeDistrictType: "residential",
    activeUtilityType: "power_plant",
    roadDraft: [],
    tramDraftNodeIds: [],
    ferryDraftDockIds: [],
  };
}

function previewForRoad(world: WorldState, path: TileCoord[]): EditorPlacementPreview {
  const validation = validateRoadPlacement(world, path);
  return {
    kind: "road",
    path,
    valid: validation.valid,
    invalidTiles: validation.invalidTiles,
    reason: validation.reason,
  };
}

function trimTerminalDuplicateRoadPoints(path: TileCoord[]): TileCoord[] {
  const normalizedPath = [...path];
  while (normalizedPath.length >= 2) {
    const last = normalizedPath[normalizedPath.length - 1];
    const previous = normalizedPath[normalizedPath.length - 2];
    if (!last || !previous || last.x !== previous.x || last.y !== previous.y) {
      break;
    }
    normalizedPath.pop();
  }
  return normalizedPath;
}

function findCreatedEntityId<T extends { id: string }>(before: readonly T[], after: readonly T[]): string | undefined {
  const beforeIds = new Set(before.map((entity) => entity.id));
  return after.find((entity) => !beforeIds.has(entity.id))?.id;
}

function previewForTram(world: WorldState, nodeIds: string[]): EditorPlacementPreview | undefined {
  const plan = planTramLine(world, nodeIds);
  return {
    kind: "tram",
    path: plan.path,
    valid: plan.valid,
    invalidTiles: [],
    reason: plan.reason,
  };
}

function previewForFerry(world: WorldState, dockIds: string[]): EditorPlacementPreview | undefined {
  if (dockIds.length === 0) {
    return undefined;
  }
  const path = dockIds
    .map((dockId) => world.ferryDocks.find((dock) => dock.id === dockId)?.position)
    .filter((position): position is TileCoord => Boolean(position));
  return {
    kind: "ferry",
    path,
    valid: dockIds.length < 2 ? true : validateFerryRoute(world, dockIds).valid,
    invalidTiles: [],
    reason: dockIds.length < 2 ? "Select a second dock to create the route." : validateFerryRoute(world, dockIds).reason,
  };
}

function zonePreview(world: WorldState, districtType: DistrictType, start: TileCoord, current: TileCoord): EditorPlacementPreview {
  const rect = normalizeDraggedRect(start, current);
  const validation = validateZonePlacement(world, rect, districtType);
  return {
    kind: "zone",
    districtType,
    rect,
    valid: validation.valid,
    invalidTiles: validation.invalidTiles,
    reason: validation.reason,
  };
}

function utilityPreview(world: WorldState, utilityType: UtilityType, origin: TileCoord): EditorPlacementPreview {
  const validation = validateUtilityPlacement(world, utilityType, origin);
  return {
    kind: "utility",
    utilityType,
    footprint: validation.footprint,
    valid: validation.valid,
    invalidTiles: validation.invalidTiles,
    reason: validation.reason,
  };
}

export interface AppStoreEditorState {
  activeDistrictType: DistrictType;
  activeUtilityType: UtilityType;
  hoverTile?: TileCoord;
  preview?: EditorPlacementPreview;
  statusText?: string;
  zoneDragStart?: TileCoord;
  roadDraft: TileCoord[];
  tramDraftNodeIds: string[];
  ferryDraftDockIds: string[];
}

export interface AppStoreState {
  world: WorldState;
  mode: AppMode;
  selection?: SelectionState;
  simulationSpeed: SimulationSpeed;
  overlay: OverlayKind;
  camera: CameraState;
  persistence: PersistenceStatus;
  saveSlots: SaveSlotMeta[];
  manualSlotLabels: Record<ManualSaveSlotId, string>;
  editor: AppStoreEditorState;
  lastFrameMs: number;
  setMode: (mode: AppMode) => void;
  setSelection: (selection?: SelectionState) => void;
  setOverlay: (overlay: OverlayKind) => void;
  setCamera: (update: Partial<CameraState>) => void;
  setSimulationSpeed: (speed: SimulationSpeed) => void;
  setDistrictType: (districtType: DistrictType) => void;
  setUtilityType: (utilityType: UtilityType) => void;
  setHoverTile: (tile?: TileCoord) => void;
  startZoneDrag: (tile: TileCoord) => void;
  updateZoneDrag: (tile: TileCoord) => void;
  finishZoneDrag: (tile: TileCoord) => void;
  cancelDraft: () => void;
  finalizeActiveDraft: () => void;
  handleWorldClick: (tile: TileCoord) => void;
  focusSelectionAt: (tile: TileCoord) => void;
  focusSelection: () => void;
  orbitCamera: (deltaX: number, deltaY: number) => void;
  panCamera: (deltaX: number, deltaY: number) => void;
  zoomCamera: (deltaY: number) => void;
  handleShortcut: (key: string) => void;
  tick: () => void;
  dispatchEditorAction: (action: EditorAction) => void;
  newWorld: (seed: string) => void;
  autosave: () => Promise<void>;
  saveToSlot: (slotId: ManualSaveSlotId) => Promise<void>;
  loadSave: (slotId: SaveSlotId) => Promise<void>;
  refreshSaveSlots: () => Promise<void>;
  setManualSaveSlotLabel: (slotId: ManualSaveSlotId, label: string) => void;
  getWorldSummary: () => WorldSummary;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  world: createDefaultWorld(),
  mode: "inspect",
  simulationSpeed: "1x",
  overlay: "none",
  camera: DEFAULT_CAMERA_STATE,
  persistence: {
    pending: false,
  },
  saveSlots: [],
  manualSlotLabels: defaultManualSlotLabels(),
  editor: emptyEditorState(),
  lastFrameMs: REALTIME_TICK_MS,

  setMode(mode) {
    set((state) => ({
      mode,
      editor: {
        ...state.editor,
        preview: undefined,
        statusText: mode === "inspect" ? undefined : state.editor.statusText,
        zoneDragStart: undefined,
        roadDraft: [],
        tramDraftNodeIds: [],
        ferryDraftDockIds: [],
      },
    }));
  },

  setSelection(selection) {
    set({ selection });
  },

  setOverlay(overlay) {
    set({ overlay });
  },

  setCamera(update) {
    set((state) => ({
      camera: { ...state.camera, ...update },
    }));
  },

  setSimulationSpeed(simulationSpeed) {
    set({ simulationSpeed });
  },

  setDistrictType(activeDistrictType) {
    set((state) => ({
      editor: {
        ...state.editor,
        activeDistrictType,
      },
    }));
  },

  setUtilityType(activeUtilityType) {
    set((state) => ({
      editor: {
        ...state.editor,
        activeUtilityType,
      },
    }));
  },

  setManualSaveSlotLabel(slotId, label) {
    const nextLabels = {
      ...get().manualSlotLabels,
      [slotId]: label,
    };
    saveSavePreferences({ manualSlotLabels: nextLabels });
    set({ manualSlotLabels: nextLabels });
  },

  setHoverTile(tile) {
    set((state) => ({
      editor: {
        ...state.editor,
        hoverTile: tile,
        preview:
          state.mode === "place_utility" && tile
            ? utilityPreview(state.world, state.editor.activeUtilityType, tile)
            : state.editor.zoneDragStart && tile && state.mode === "build_zone"
              ? zonePreview(state.world, state.editor.activeDistrictType, state.editor.zoneDragStart, tile)
              : state.editor.preview?.kind === "road" && state.editor.roadDraft.length > 0 && tile
                ? previewForRoad(state.world, [...state.editor.roadDraft, tile])
                : state.editor.preview,
      },
    }));
  },

  startZoneDrag(tile) {
    set((state) => ({
      editor: {
        ...state.editor,
        zoneDragStart: tile,
        preview: zonePreview(state.world, state.editor.activeDistrictType, tile, tile),
        statusText: "Drag to size the zone footprint.",
      },
    }));
  },

  updateZoneDrag(tile) {
    set((state) => {
      if (!state.editor.zoneDragStart) {
        return state;
      }
      return {
        editor: {
          ...state.editor,
          hoverTile: tile,
          preview: zonePreview(state.world, state.editor.activeDistrictType, state.editor.zoneDragStart, tile),
        },
      };
    });
  },

  finishZoneDrag(tile) {
    set((state) => {
      const start = state.editor.zoneDragStart;
      if (!start) {
        return state;
      }
      const preview = zonePreview(state.world, state.editor.activeDistrictType, start, tile);
      if (preview.kind !== "zone" || !preview.valid) {
        return {
          editor: {
            ...state.editor,
            zoneDragStart: undefined,
            preview,
            statusText: preview.reason ?? "Zone placement rejected.",
          },
        };
      }

      const nextWorld = simulationKernel.applyEditorAction(state.world, {
        type: "build_zone",
        districtType: state.editor.activeDistrictType,
        rect: preview.rect,
      });
      const districtId = findCreatedEntityId(state.world.districts, nextWorld.districts);
      return {
        world: nextWorld,
        selection: districtId ? { kind: "district", entityId: districtId } : state.selection,
        editor: {
          ...state.editor,
          zoneDragStart: undefined,
          preview: undefined,
          statusText: `Placed ${state.editor.activeDistrictType} zone.`,
        },
      };
    });
  },

  cancelDraft() {
    set((state) => ({
      editor: {
        ...state.editor,
        preview: undefined,
        statusText: undefined,
        zoneDragStart: undefined,
        roadDraft: [],
        tramDraftNodeIds: [],
        ferryDraftDockIds: [],
      },
    }));
  },

  finalizeActiveDraft() {
    set((state) => {
      if (state.mode === "build_road") {
        const roadPath = trimTerminalDuplicateRoadPoints(state.editor.roadDraft);
        const preview = previewForRoad(state.world, roadPath);
        if (!preview.valid) {
          return {
            editor: {
              ...state.editor,
              preview,
              statusText: preview.reason ?? "Road placement rejected.",
            },
          };
        }
        const nextWorld = simulationKernel.applyEditorAction(state.world, {
          type: "build_road",
          path: roadPath,
        });
        const roadId = findCreatedEntityId(state.world.roadEdges, nextWorld.roadEdges);
        return {
          world: nextWorld,
          selection: roadId ? { kind: "road_edge", entityId: roadId } : state.selection,
          editor: {
            ...state.editor,
            roadDraft: [],
            preview: undefined,
            statusText: "Road segment placed.",
          },
        };
      }

      if (state.mode === "build_tram") {
        const plan = planTramLine(state.world, state.editor.tramDraftNodeIds);
        if (!plan.valid) {
          return {
            editor: {
              ...state.editor,
              preview: previewForTram(state.world, state.editor.tramDraftNodeIds),
              statusText: plan.reason ?? "Tram line rejected.",
            },
          };
        }

        let workingWorld = state.world;
        const stopIds: string[] = [];
        for (const nodeId of plan.nodeIds) {
          const existingStop = workingWorld.tramStops.find((stop) => stop.nodeId === nodeId);
          if (existingStop) {
            stopIds.push(existingStop.id);
            continue;
          }
          workingWorld = simulationKernel.applyEditorAction(workingWorld, {
            type: "place_tram_stop",
            nodeId,
          });
          const createdStop = workingWorld.tramStops[workingWorld.tramStops.length - 1];
          if (createdStop) {
            stopIds.push(createdStop.id);
          }
        }
        const nextWorld = simulationKernel.applyEditorAction(workingWorld, {
          type: "build_tram",
          stopIds,
          edgeIds: plan.edgeIds,
        });
        const lineId = findCreatedEntityId(workingWorld.tramLines, nextWorld.tramLines);
        return {
          world: nextWorld,
          selection: lineId ? { kind: "tram_line", entityId: lineId } : state.selection,
          editor: {
            ...state.editor,
            tramDraftNodeIds: [],
            preview: undefined,
            statusText: "Tram line placed.",
          },
        };
      }

      return state;
    });
  },

  handleWorldClick(tile) {
    set((state) => {
      switch (state.mode) {
        case "inspect":
          return {
            selection: resolveSelectionAtTile(state.world, tile),
            editor: {
              ...state.editor,
              statusText: undefined,
            },
          };
        case "build_road": {
          const nextRoadDraft = [...state.editor.roadDraft, tile];
          return {
            editor: {
              ...state.editor,
              roadDraft: nextRoadDraft,
              preview: previewForRoad(state.world, nextRoadDraft),
              statusText:
                nextRoadDraft.length < 2
                  ? "Click another intersection, then press Enter or double-click to finish."
                  : "Press Enter or double-click to build the road.",
            },
          };
        }
        case "build_tram": {
          const node = findRoadNodeAtCoord(state.world, tile, { tolerance: 1 });
          if (!node) {
            return {
              editor: {
                ...state.editor,
                statusText: "Tram stops must be chosen on existing road nodes.",
              },
            };
          }
          const nextNodeIds = [...state.editor.tramDraftNodeIds, node.id];
          return {
            editor: {
              ...state.editor,
              tramDraftNodeIds: nextNodeIds,
              preview: previewForTram(state.world, nextNodeIds),
              statusText:
                nextNodeIds.length < 2
                  ? "Select a second road node for the tram line."
                  : "Press Enter or double-click to create the tram line.",
            },
          };
        }
        case "build_ferry": {
          const node = findRoadNodeAtCoord(state.world, tile, { coastlineOnly: true, tolerance: 1 });
          if (!node) {
            return {
              editor: {
                ...state.editor,
                statusText: "Ferry docks must be placed on coastline road nodes.",
              },
            };
          }

          let workingWorld = state.world;
          let dockId = workingWorld.ferryDocks.find((dock) => dock.nodeId === node.id)?.id;
          if (!dockId) {
            const dockValidation = validateFerryDockPlacement(workingWorld, node.id);
            if (!dockValidation.valid) {
              return {
                editor: {
                  ...state.editor,
                  statusText: dockValidation.reason ?? "Ferry dock rejected.",
                },
              };
            }
            workingWorld = simulationKernel.applyEditorAction(workingWorld, {
              type: "place_ferry_dock",
              nodeId: node.id,
            });
            dockId = workingWorld.ferryDocks[workingWorld.ferryDocks.length - 1]?.id;
          }

          if (!dockId) {
            return state;
          }

          const nextDockIds = [...state.editor.ferryDraftDockIds, dockId].filter(
            (candidate, index, dockIds) => dockIds.indexOf(candidate) === index,
          );

          if (nextDockIds.length < 2) {
            return {
              world: workingWorld,
              selection: { kind: "ferry_dock", entityId: dockId },
              editor: {
                ...state.editor,
                ferryDraftDockIds: nextDockIds,
                preview: previewForFerry(workingWorld, nextDockIds),
                statusText: "Select a second dock to create the ferry route.",
              },
            };
          }

          const routeValidation = validateFerryRoute(workingWorld, nextDockIds);
          if (!routeValidation.valid) {
            return {
              world: workingWorld,
              editor: {
                ...state.editor,
                ferryDraftDockIds: nextDockIds,
                preview: previewForFerry(workingWorld, nextDockIds),
                statusText: routeValidation.reason ?? "Ferry route rejected.",
              },
            };
          }
          const nextWorld = simulationKernel.applyEditorAction(workingWorld, {
            type: "build_ferry",
            dockIds: [nextDockIds[0]!, nextDockIds[1]!],
          });
          const routeId = findCreatedEntityId(workingWorld.ferryRoutes, nextWorld.ferryRoutes);
          return {
            world: nextWorld,
            selection: routeId ? { kind: "ferry_route", entityId: routeId } : state.selection,
            editor: {
              ...state.editor,
              ferryDraftDockIds: [],
              preview: undefined,
              statusText: "Ferry route placed.",
            },
          };
        }
        case "place_utility": {
          const preview = utilityPreview(state.world, state.editor.activeUtilityType, tile);
          if (preview.kind !== "utility" || !preview.valid) {
            return {
              editor: {
                ...state.editor,
                preview,
                statusText: preview.reason ?? "Utility placement rejected.",
              },
            };
          }
          const nextWorld = simulationKernel.applyEditorAction(state.world, {
            type: "place_utility",
            utilityType: state.editor.activeUtilityType,
            origin: tile,
          });
          const utilityId = findCreatedEntityId(state.world.utilities, nextWorld.utilities);
          return {
            world: nextWorld,
            selection: utilityId ? { kind: "utility", entityId: utilityId } : state.selection,
            editor: {
              ...state.editor,
              preview,
              statusText: `Placed ${state.editor.activeUtilityType.replaceAll("_", " ")}.`,
            },
          };
        }
        case "demolish": {
          const selection = resolveDemolishSelection(state.world, tile);
          const action = selectionToDemolishAction(selection);
          if (!selection || !action) {
            return {
              editor: {
                ...state.editor,
                statusText: "Select one district, segment, route, dock, or utility to demolish.",
              },
            };
          }
          return {
            world: simulationKernel.applyEditorAction(state.world, action),
            selection: undefined,
            editor: {
              ...state.editor,
              preview: undefined,
              statusText: `${selection.kind.replaceAll("_", " ")} demolished.`,
            },
          };
        }
        default:
          return state;
      }
    });
  },

  focusSelectionAt(tile) {
    set((state) => {
      const selection = resolveSelectionAtTile(state.world, tile);
      const inspector = deriveInspectorTarget(state.world, selection);
      if (!selection || !inspector) {
        return state;
      }
      return {
        selection,
        camera: {
          ...state.camera,
          target: focusTileToCameraTarget(state.world, inspector.focusTile),
        },
      };
    });
  },

  focusSelection() {
    set((state) => {
      const inspector = deriveInspectorTarget(state.world, state.selection);
      if (!inspector) {
        return state;
      }
      return {
        camera: {
          ...state.camera,
          target: focusTileToCameraTarget(state.world, inspector.focusTile),
        },
      };
    });
  },

  orbitCamera(deltaX, deltaY) {
    set((state) => ({
      camera: {
        ...state.camera,
        yaw: state.camera.yaw - deltaX * 0.005,
        pitch: clamp(state.camera.pitch + deltaY * 0.005, 0.35, 1.45),
      },
    }));
  },

  panCamera(deltaX, deltaY) {
    set((state) => {
      const panScale = Math.max(0.08, state.camera.distance * 0.0035);
      const sinYaw = Math.sin(state.camera.yaw);
      const cosYaw = Math.cos(state.camera.yaw);
      const worldDeltaX = -deltaX * cosYaw * panScale + deltaY * sinYaw * panScale;
      const worldDeltaZ = deltaX * sinYaw * panScale + deltaY * cosYaw * panScale;
      return {
        camera: {
          ...state.camera,
          target: moveCameraTarget(state.camera, worldDeltaX, worldDeltaZ),
        },
      };
    });
  },

  zoomCamera(deltaY) {
    set((state) => ({
      camera: {
        ...state.camera,
        distance: clamp(state.camera.distance + deltaY * 0.08, 40, 240),
      },
    }));
  },

  handleShortcut(key) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "escape") {
      get().cancelDraft();
      return;
    }
    if (normalizedKey === "enter") {
      get().finalizeActiveDraft();
      return;
    }

    switch (normalizedKey) {
      case "i":
        get().setMode("inspect");
        return;
      case "z":
        get().setMode("build_zone");
        return;
      case "r":
        get().setMode("build_road");
        return;
      case "m":
        get().setMode("build_tram");
        return;
      case "f":
        get().setMode("build_ferry");
        return;
      case "u":
        get().setMode("place_utility");
        return;
      case "x":
        get().setMode("demolish");
        return;
      case "c":
        set((state) => ({ camera: { ...state.camera, cinematic: !state.camera.cinematic } }));
        return;
      case "h":
        set((state) => ({ camera: { ...state.camera, hudHidden: !state.camera.hudHidden } }));
        return;
      case "t":
        set((state) => ({
          simulationSpeed: state.simulationSpeed === "timelapse" ? "1x" : "timelapse",
        }));
        return;
      default:
        return;
    }
  },

  tick() {
    const { simulationSpeed, world } = get();
    const multiplier = speedToMultiplier(simulationSpeed);
    if (multiplier === 0) {
      return;
    }
    const nextWorld = simulationKernel.stepWorld(world, multiplier, { speed: multiplier });
    set({ world: nextWorld });
  },

  dispatchEditorAction(action) {
    set((state) => ({
      world: simulationKernel.applyEditorAction(state.world, action),
    }));
  },

  newWorld(seed) {
    set({
      world: simulationKernel.createInitialWorld(seed),
      selection: undefined,
      editor: emptyEditorState(),
      camera: DEFAULT_CAMERA_STATE,
      persistence: {
        pending: false,
      },
    });
  },

  async autosave() {
    if (get().persistence.pending) {
      return;
    }
    const { world, camera } = get();
    set((state) => ({
      persistence: { ...state.persistence, pending: true, error: undefined },
    }));
    try {
      const payload = simulationKernel.serializeSave(world, "autosave", camera);
      await saveSlot(payload);
      const slots = await listSlots();
      set((state) => ({
        saveSlots: slots,
        persistence: {
          ...state.persistence,
          pending: false,
          lastAutosaveAt: payload.slot.updatedAt,
          activeSlotId: payload.slot.id,
        },
      }));
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          pending: false,
          error: error instanceof Error ? error.message : "Autosave failed",
        },
      }));
    }
  },

  async saveToSlot(slotId) {
    if (get().persistence.pending) {
      return;
    }
    const { world, camera, manualSlotLabels } = get();
    const label = manualSlotLabels[slotId].trim() || fallbackManualSlotLabel(slotId);
    set((state) => ({
      persistence: { ...state.persistence, pending: true, error: undefined },
    }));
    try {
      const payload = simulationKernel.serializeSave(world, slotId, camera);
      payload.slot.label = label;
      await saveSlot(payload);
      const slots = await listSlots();
      const nextLabels = {
        ...manualSlotLabels,
        [slotId]: label,
      };
      saveSavePreferences({ manualSlotLabels: nextLabels });
      set((state) => ({
        saveSlots: slots,
        manualSlotLabels: nextLabels,
        persistence: {
          ...state.persistence,
          pending: false,
          activeSlotId: slotId,
        },
      }));
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          pending: false,
          error: error instanceof Error ? error.message : "Manual save failed",
        },
      }));
    }
  },

  async loadSave(slotId) {
    if (get().persistence.pending) {
      return;
    }
    set((state) => ({
      persistence: { ...state.persistence, pending: true, error: undefined },
    }));
    try {
      const payload = await loadSlot(slotId);
      if (!payload) {
        set((state) => ({
          persistence: { ...state.persistence, pending: false, error: `No save found in ${slotId}` },
        }));
        return;
      }
      const nextLabels = isManualSaveSlotId(slotId)
        ? {
            ...get().manualSlotLabels,
            [slotId]: payload.slot.label || fallbackManualSlotLabel(slotId),
          }
        : get().manualSlotLabels;
      if (isManualSaveSlotId(slotId)) {
        saveSavePreferences({ manualSlotLabels: nextLabels });
      }
      set((state) => ({
        world: simulationKernel.hydrateSave(payload),
        selection: undefined,
        editor: emptyEditorState(),
        camera: payload.camera ?? state.camera,
        manualSlotLabels: nextLabels,
        persistence: {
          ...state.persistence,
          pending: false,
          activeSlotId: slotId,
        },
      }));
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          pending: false,
          error: error instanceof Error ? error.message : "Load failed",
        },
      }));
    }
  },

  async refreshSaveSlots() {
    try {
      const slots = await listSlots();
      const nextLabels = { ...get().manualSlotLabels };
      let labelsChanged = false;
      for (const slot of slots) {
        if (!isManualSaveSlotId(slot.id)) {
          continue;
        }
        if (slot.label && nextLabels[slot.id] !== slot.label) {
          nextLabels[slot.id] = slot.label;
          labelsChanged = true;
        }
      }
      if (labelsChanged) {
        saveSavePreferences({ manualSlotLabels: nextLabels });
      }
      set({
        saveSlots: slots,
        manualSlotLabels: nextLabels,
      });
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          error: error instanceof Error ? error.message : "Unable to load save slots",
        },
      }));
    }
  },

  getWorldSummary() {
    return summarizeWorld(get().world);
  },
}));
