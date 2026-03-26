import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { simulationKernel } from "../../simulation/core/engine";
import { OVERLAY_PALETTE } from "../../simulation/core/constants";
import type { RendererFrameInput } from "../../simulation/core/contracts";
import { deriveInspectorTarget } from "../../simulation/core/editing";
import { useAppStore } from "../../app/store/appStore";
import { WorldRenderer } from "../../world/rendering/WorldRenderer";
import { getTile } from "../../world/terrain/terrain";

const GRID_HALF = 64;
const PICK_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const PICK_VECTOR = new THREE.Vector2();
const PICK_RAYCASTER = new THREE.Raycaster();
const PICK_INTERSECTION = new THREE.Vector3();
const PICK_CAMERA = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
const PROJECT_CAMERA = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);

type PointerDragState =
  | {
      kind: "orbit" | "pan" | "zone";
      lastClientX: number;
      lastClientY: number;
      moved: boolean;
    }
  | {
      kind: "click";
      moved: boolean;
      startClientX: number;
      startClientY: number;
    };

function configureCamera(camera: THREE.PerspectiveCamera, width: number, height: number, cameraState: RendererFrameInput["camera"]) {
  const distance = cameraState.distance;
  const pitchY = Math.sin(cameraState.pitch) * distance;
  const pitchXZ = Math.cos(cameraState.pitch) * distance;
  const orbitX = Math.cos(cameraState.yaw) * pitchXZ;
  const orbitZ = Math.sin(cameraState.yaw) * pitchXZ;
  const targetY = cameraState.target.y + 8;

  camera.aspect = Math.max(1, width) / Math.max(1, height);
  camera.updateProjectionMatrix();
  camera.position.set(cameraState.target.x - GRID_HALF + orbitX, targetY + pitchY, cameraState.target.z - GRID_HALF + orbitZ);
  camera.lookAt(new THREE.Vector3(cameraState.target.x - GRID_HALF, targetY, cameraState.target.z - GRID_HALF));
}

function pickTileFromEvent(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  element: HTMLElement,
  cameraState: RendererFrameInput["camera"],
) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return undefined;
  }

  PICK_VECTOR.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  PICK_VECTOR.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  configureCamera(PICK_CAMERA, rect.width, rect.height, cameraState);
  PICK_RAYCASTER.setFromCamera(PICK_VECTOR, PICK_CAMERA);

  const hit = PICK_RAYCASTER.ray.intersectPlane(PICK_PLANE, PICK_INTERSECTION);
  if (!hit) {
    return undefined;
  }

  const x = Math.floor(PICK_INTERSECTION.x + GRID_HALF);
  const y = Math.floor(PICK_INTERSECTION.z + GRID_HALF);
  if (x < 0 || x >= 128 || y < 0 || y >= 128) {
    return undefined;
  }
  return { x, y };
}

function projectPoint(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  cameraState: RendererFrameInput["camera"],
) {
  configureCamera(PROJECT_CAMERA, width, height, cameraState);
  const vector = new THREE.Vector3(x - GRID_HALF, y, z - GRID_HALF).project(PROJECT_CAMERA);
  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (-vector.y * 0.5 + 0.5) * height,
  };
}

function tileSurfaceHeight(world: ReturnType<typeof useAppStore.getState>["world"], x: number, y: number): number {
  const tile = getTile(world.terrain, x, y);
  return tile ? 0.35 + tile.elevation * 12 + 0.25 : 0.6;
}

function rectPolygonPoints(
  world: ReturnType<typeof useAppStore.getState>["world"],
  rect: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
  cameraState: RendererFrameInput["camera"],
) {
  const level = tileSurfaceHeight(world, rect.x, rect.y);
  return [
    projectPoint(rect.x, level, rect.y, width, height, cameraState),
    projectPoint(rect.x + rect.width, level, rect.y, width, height, cameraState),
    projectPoint(rect.x + rect.width, level, rect.y + rect.height, width, height, cameraState),
    projectPoint(rect.x, level, rect.y + rect.height, width, height, cameraState),
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

function tilePolygonPoints(
  world: ReturnType<typeof useAppStore.getState>["world"],
  tile: { x: number; y: number },
  width: number,
  height: number,
  cameraState: RendererFrameInput["camera"],
) {
  return rectPolygonPoints(world, { x: tile.x, y: tile.y, width: 1, height: 1 }, width, height, cameraState);
}

function pathPoints(
  world: ReturnType<typeof useAppStore.getState>["world"],
  path: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  cameraState: RendererFrameInput["camera"],
) {
  return path
    .map((point) => {
      const projected = projectPoint(point.x + 0.5, tileSurfaceHeight(world, point.x, point.y), point.y + 0.5, width, height, cameraState);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

function overlayColorForValue(overlay: Exclude<RendererFrameInput["presentation"]["overlay"], "none">, value: number): string {
  const palette = OVERLAY_PALETTE[overlay];
  if (value < 0.34) {
    return palette[0];
  }
  if (value < 0.67) {
    return palette[1];
  }
  return palette[2];
}

function overlayOpacityForValue(overlay: Exclude<RendererFrameInput["presentation"]["overlay"], "none">, value: number): number {
  if (overlay === "satisfaction") {
    return 0.14 + value * 0.3;
  }
  return 0.18 + value * 0.36;
}

function selectionPath(
  world: ReturnType<typeof useAppStore.getState>["world"],
  selection: ReturnType<typeof useAppStore.getState>["selection"],
): Array<{ x: number; y: number }> | undefined {
  if (!selection) {
    return undefined;
  }

  switch (selection.kind) {
    case "road_edge":
      return world.roadEdges.find((edge) => edge.id === selection.entityId)?.path;
    case "tram_line": {
      const line = world.tramLines.find((candidate) => candidate.id === selection.entityId);
      return line?.edgeIds.flatMap((edgeId, index) => {
        const edge = world.roadEdges.find((candidate) => candidate.id === edgeId);
        if (!edge) {
          return [];
        }
        return index === 0 ? edge.path : edge.path.slice(1);
      });
    }
    case "tram_stop": {
      const stop = world.tramStops.find((candidate) => candidate.id === selection.entityId);
      const node = stop ? world.roadNodes.find((candidate) => candidate.id === stop.nodeId) : undefined;
      return node ? [{ x: node.x, y: node.y }] : undefined;
    }
    case "ferry_dock":
      return world.ferryDocks.find((dock) => dock.id === selection.entityId)?.position
        ? [world.ferryDocks.find((dock) => dock.id === selection.entityId)!.position]
        : undefined;
    case "ferry_route": {
      const route = world.ferryRoutes.find((candidate) => candidate.id === selection.entityId);
      const dockA = route ? world.ferryDocks.find((dock) => dock.id === route.dockAId) : undefined;
      const dockB = route ? world.ferryDocks.find((dock) => dock.id === route.dockBId) : undefined;
      return dockA && dockB ? [dockA.position, dockB.position] : undefined;
    }
    default:
      return undefined;
  }
}

export function WorldViewport() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rendererMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const frameRef = useRef<RendererFrameInput | null>(null);
  const dragStateRef = useRef<PointerDragState | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ height: 1, width: 1 });

  const world = useAppStore((state) => state.world);
  const overlay = useAppStore((state) => state.overlay);
  const camera = useAppStore((state) => state.camera);
  const mode = useAppStore((state) => state.mode);
  const selection = useAppStore((state) => state.selection);
  const editor = useAppStore((state) => state.editor);
  const setHoverTile = useAppStore((state) => state.setHoverTile);
  const startZoneDrag = useAppStore((state) => state.startZoneDrag);
  const updateZoneDrag = useAppStore((state) => state.updateZoneDrag);
  const finishZoneDrag = useAppStore((state) => state.finishZoneDrag);
  const handleWorldClick = useAppStore((state) => state.handleWorldClick);
  const focusSelectionAt = useAppStore((state) => state.focusSelectionAt);
  const orbitCamera = useAppStore((state) => state.orbitCamera);
  const panCamera = useAppStore((state) => state.panCamera);
  const zoomCamera = useAppStore((state) => state.zoomCamera);
  const finalizeActiveDraft = useAppStore((state) => state.finalizeActiveDraft);
  const presentation = simulationKernel.derivePresentation(world, overlay);

  useEffect(() => {
    if (!rendererMountRef.current) {
      return undefined;
    }

    const renderer = new WorldRenderer(rendererMountRef.current);
    rendererRef.current = renderer;
    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);
    let animationFrameId = 0;

    const renderFrame = (time: number) => {
      const frame = frameRef.current;
      if (frame) {
        renderer.render(frame, time);
      }
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    frameRef.current = {
      presentation,
      camera,
    };
  }, [camera, presentation]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return undefined;
    }

    const updateViewportSize = () => {
      setViewportSize({
        width: Math.max(1, element.clientWidth),
        height: Math.max(1, element.clientHeight),
      });
    };

    updateViewportSize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateViewportSize();
          })
        : undefined;
    resizeObserver?.observe(element);
    window.addEventListener("resize", updateViewportSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  const viewportWidth = viewportSize.width;
  const viewportHeight = viewportSize.height;
  const inspector = deriveInspectorTarget(world, selection);
  const selectionStroke =
    selection?.kind === "district" || selection?.kind === "utility"
      ? inspector
        ? rectPolygonPoints(
            world,
            selection.kind === "district"
              ? world.districts.find((district) => district.id === selection.entityId)?.footprint ?? {
                  x: inspector.focusTile.x,
                  y: inspector.focusTile.y,
                  width: 1,
                  height: 1,
                }
              : world.utilities.find((utility) => utility.id === selection.entityId)?.footprint ?? {
                  x: inspector.focusTile.x,
                  y: inspector.focusTile.y,
                  width: 1,
                  height: 1,
                },
            viewportWidth,
            viewportHeight,
            camera,
          )
        : undefined
      : undefined;
  const selectedPath = selectionPath(world, selection);
  const districtOverlayKind = presentation.overlay !== "none" && presentation.overlay !== "traffic" ? presentation.overlay : undefined;

  return (
    <div
      className="world-viewport interactive"
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={(event) => {
        const element = wrapperRef.current;
        if (!element) {
          return;
        }
        const tile = pickTileFromEvent(event.nativeEvent, element, camera);
        if (!tile) {
          return;
        }
        if (mode === "build_road" || mode === "build_tram") {
          finalizeActiveDraft();
          return;
        }
        focusSelectionAt(tile);
      }}
      onPointerDown={(event) => {
        const element = wrapperRef.current;
        if (!element) {
          return;
        }
        pointerIdRef.current = event.pointerId;
        if (typeof event.currentTarget.setPointerCapture === "function") {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const tile = pickTileFromEvent(event.nativeEvent, element, camera);
        if (tile) {
          setHoverTile(tile);
        }
        if (event.button === 2 || (event.button === 0 && event.shiftKey)) {
          dragStateRef.current = {
            kind: "pan",
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            moved: false,
          };
          return;
        }
        if (event.button !== 0) {
          return;
        }
        if (mode === "inspect") {
          dragStateRef.current = {
            kind: "orbit",
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            moved: false,
          };
          return;
        }
        if (mode === "build_zone" && tile) {
          dragStateRef.current = {
            kind: "zone",
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            moved: false,
          };
          startZoneDrag(tile);
          return;
        }
        dragStateRef.current = {
          kind: "click",
          startClientX: event.clientX,
          startClientY: event.clientY,
          moved: false,
        };
      }}
      onPointerLeave={() => {
        if (!dragStateRef.current) {
          setHoverTile(undefined);
        }
      }}
      onPointerMove={(event) => {
        const element = wrapperRef.current;
        if (!element) {
          return;
        }
        const tile = pickTileFromEvent(event.nativeEvent, element, camera);
        setHoverTile(tile);

        const dragState = dragStateRef.current;
        if (!dragState) {
          return;
        }

        if (dragState.kind === "click") {
          if (
            Math.abs(event.clientX - dragState.startClientX) > 4 ||
            Math.abs(event.clientY - dragState.startClientY) > 4
          ) {
            dragState.moved = true;
          }
          return;
        }

        const deltaX = event.clientX - dragState.lastClientX;
        const deltaY = event.clientY - dragState.lastClientY;
        dragState.lastClientX = event.clientX;
        dragState.lastClientY = event.clientY;
        dragState.moved = dragState.moved || Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;

        if (dragState.kind === "orbit") {
          orbitCamera(deltaX, deltaY);
          return;
        }
        if (dragState.kind === "pan") {
          panCamera(deltaX, deltaY);
          return;
        }
        if (dragState.kind === "zone" && tile) {
          updateZoneDrag(tile);
        }
      }}
      onPointerUp={(event) => {
        const element = wrapperRef.current;
        if (
          pointerIdRef.current !== null &&
          typeof event.currentTarget.releasePointerCapture === "function" &&
          event.currentTarget.hasPointerCapture(pointerIdRef.current)
        ) {
          event.currentTarget.releasePointerCapture(pointerIdRef.current);
        }
        pointerIdRef.current = null;
        if (!element) {
          dragStateRef.current = null;
          return;
        }

        const tile = pickTileFromEvent(event.nativeEvent, element, camera);
        const dragState = dragStateRef.current;
        dragStateRef.current = null;
        if (!dragState) {
          return;
        }

        if (dragState.kind === "zone") {
          if (tile) {
            finishZoneDrag(tile);
          }
          return;
        }

        if (dragState.kind === "orbit" && !dragState.moved && tile && mode === "inspect") {
          handleWorldClick(tile);
          return;
        }

        if (dragState.kind === "click" && !dragState.moved && tile) {
          handleWorldClick(tile);
        }
      }}
      onPointerCancel={(event) => {
        if (
          pointerIdRef.current !== null &&
          typeof event.currentTarget.releasePointerCapture === "function" &&
          event.currentTarget.hasPointerCapture(pointerIdRef.current)
        ) {
          event.currentTarget.releasePointerCapture(pointerIdRef.current);
        }
        pointerIdRef.current = null;
        dragStateRef.current = null;
        setHoverTile(undefined);
      }}
      onWheel={(event) => {
        event.preventDefault();
        zoomCamera(event.deltaY);
      }}
      ref={wrapperRef}
    >
      <div className="world-canvas" ref={rendererMountRef} />
      <svg className="world-overlay" height={viewportHeight} viewBox={`0 0 ${viewportWidth} ${viewportHeight}`} width={viewportWidth}>
        {districtOverlayKind
          ? presentation.districts.map((district) => {
              const overlayValue = district.overlayMetrics[districtOverlayKind];
              return (
                <polygon
                  className="overlay-district"
                  key={`overlay-${district.id}`}
                  points={rectPolygonPoints(world, district.footprint, viewportWidth, viewportHeight, camera)}
                  style={{
                    fill: overlayColorForValue(districtOverlayKind, overlayValue),
                    opacity: overlayOpacityForValue(districtOverlayKind, overlayValue),
                  }}
                />
              );
            })
          : null}
        {presentation.overlay === "traffic"
          ? presentation.roadEdges.map((edge) => (
              <polyline
                className="overlay-traffic-path"
                key={`overlay-traffic-${edge.id}`}
                points={pathPoints(world, edge.path, viewportWidth, viewportHeight, camera)}
                style={{
                  opacity: 0.25 + edge.congestion * 0.65,
                  stroke: overlayColorForValue("traffic", edge.congestion),
                }}
              />
            ))
          : null}
        {selectionStroke ? <polygon className="selection-shape" points={selectionStroke} /> : null}
        {selectedPath && !selectionStroke ? <polyline className="selection-path" points={pathPoints(world, selectedPath, viewportWidth, viewportHeight, camera)} /> : null}
        {editor.preview?.kind === "zone" ? (
          <>
            <polygon
              className={`preview-zone ${editor.preview.valid ? "valid" : "invalid"}`}
              points={rectPolygonPoints(world, editor.preview.rect, viewportWidth, viewportHeight, camera)}
            />
            {editor.preview.invalidTiles.map((tile) => (
              <polygon
                className="preview-invalid"
                key={`${tile.x}-${tile.y}`}
                points={tilePolygonPoints(world, tile, viewportWidth, viewportHeight, camera)}
              />
            ))}
          </>
        ) : null}
        {editor.preview?.kind === "utility" ? (
          <>
            <polygon
              className={`preview-zone ${editor.preview.valid ? "valid" : "invalid"}`}
              points={rectPolygonPoints(world, editor.preview.footprint, viewportWidth, viewportHeight, camera)}
            />
            {editor.preview.invalidTiles.map((tile) => (
              <polygon
                className="preview-invalid"
                key={`${tile.x}-${tile.y}`}
                points={tilePolygonPoints(world, tile, viewportWidth, viewportHeight, camera)}
              />
            ))}
          </>
        ) : null}
        {editor.preview?.kind === "road" || editor.preview?.kind === "tram" || editor.preview?.kind === "ferry" ? (
          <polyline
            className={`preview-path ${editor.preview.valid ? "valid" : "invalid"}`}
            points={pathPoints(world, editor.preview.path, viewportWidth, viewportHeight, camera)}
          />
        ) : null}
      </svg>
    </div>
  );
}
