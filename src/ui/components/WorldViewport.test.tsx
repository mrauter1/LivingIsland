import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RendererFrameInput } from "../../simulation/core/contracts";
import { useAppStore } from "../../app/store/appStore";

const rendererSpies = vi.hoisted(() => ({
  constructorError: null as Error | null,
  disposeCalls: 0,
  renderCalls: [] as RendererFrameInput[],
  renderErrorOnCall: null as number | null,
  resizeCalls: 0,
}));

vi.mock("../../world/rendering/WorldRenderer", () => ({
  WorldRenderer: class {
    constructor(container: HTMLElement) {
      void container;
      if (rendererSpies.constructorError) {
        throw rendererSpies.constructorError;
      }
    }

    resize(): void {
      rendererSpies.resizeCalls += 1;
    }

    render(frame: RendererFrameInput): void {
      const callIndex = rendererSpies.renderCalls.length + 1;
      if (rendererSpies.renderErrorOnCall === callIndex) {
        throw new Error("render failed");
      }
      rendererSpies.renderCalls.push(frame);
    }

    dispose(): void {
      rendererSpies.disposeCalls += 1;
    }
  },
}));

import { WorldViewport } from "./WorldViewport";

function createOpenBuildWorld() {
  const world = structuredClone(useAppStore.getState().world);
  world.districts = [];
  world.utilities = [];
  world.roadNodes = [];
  world.roadEdges = [];
  world.tramLines = [];
  world.tramStops = [];
  world.ferryDocks = [];
  world.ferryRoutes = [];
  world.terrain.tiles = world.terrain.tiles.map((tile) => ({
    ...tile,
    terrain: "plains",
    isBuildable: true,
    districtId: undefined,
    utilityId: undefined,
    coastline: false,
  }));
  return world;
}

describe("WorldViewport", () => {
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let originalGetBoundingClientRect: PropertyDescriptor | undefined;

  beforeEach(() => {
    rendererSpies.constructorError = null;
    rendererSpies.disposeCalls = 0;
    rendererSpies.renderCalls.length = 0;
    rendererSpies.renderErrorOnCall = null;
    rendererSpies.resizeCalls = 0;
    useAppStore.getState().newWorld("viewport-seed");
    useAppStore.setState({ overlay: "none" });

    frameCallbacks = new Map();
    nextFrameId = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        nextFrameId += 1;
        frameCallbacks.set(nextFrameId, callback);
        return nextFrameId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        frameCallbacks.delete(frameId);
      }),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}

        disconnect(): void {}
      },
    );
    originalGetBoundingClientRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getBoundingClientRect");
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 400,
      right: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    cleanup();
    if (originalGetBoundingClientRect) {
      Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", originalGetBoundingClientRect);
    }
    vi.unstubAllGlobals();
  });

  it("keeps scheduling frames and renders the latest derived presentation", () => {
    render(<WorldViewport />);

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    const firstFrame = frameCallbacks.get(1);
    expect(firstFrame).toBeTypeOf("function");
    act(() => {
      firstFrame?.(100);
    });

    expect(rendererSpies.renderCalls).toHaveLength(1);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    const firstRenderFrame = rendererSpies.renderCalls[0];
    expect(firstRenderFrame?.presentation.seed).toBe("viewport-seed");

    act(() => {
      useAppStore.getState().newWorld("viewport-seed-updated");
      useAppStore.getState().setOverlay("traffic");
    });

    const secondFrame = frameCallbacks.get(2);
    expect(secondFrame).toBeTypeOf("function");
    act(() => {
      secondFrame?.(116);
    });

    expect(rendererSpies.renderCalls).toHaveLength(2);
    const secondRenderFrame = rendererSpies.renderCalls[1];
    expect(secondRenderFrame?.presentation.seed).toBe("viewport-seed-updated");
    expect(secondRenderFrame?.presentation.overlay).toBe("traffic");
  });

  it("cancels the outstanding animation frame and disposes the renderer on unmount", () => {
    const { unmount } = render(<WorldViewport />);

    const firstFrame = frameCallbacks.get(1);
    act(() => {
      firstFrame?.(100);
    });

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(rendererSpies.disposeCalls).toBe(1);
  });

  it("selects an entity on inspect-mode single click", () => {
    const world = structuredClone(useAppStore.getState().world);
    const templateDistrict = world.districts[0]!;
    world.districts = [
      {
        ...templateDistrict,
        id: "district-click-target",
        footprint: { x: 0, y: 0, width: 128, height: 128 },
        tiles: [{ x: 64, y: 64 }],
      },
    ];
    useAppStore.setState({ world, selection: undefined, mode: "inspect" });

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 200, clientY: 200 });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 200, clientY: 200 });
    });

    expect(useAppStore.getState().selection).toEqual({
      kind: "district",
      entityId: "district-click-target",
    });
  });

  it("routes primary touch taps through the existing build action path", () => {
    const world = createOpenBuildWorld();
    useAppStore.setState((state) => ({
      world,
      selection: undefined,
      mode: "place_utility",
      editor: {
        ...state.editor,
        activeUtilityType: "park",
        preview: undefined,
        statusText: undefined,
      },
    }));

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 180, clientY: 180, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 180, clientY: 180, pointerId: 1, pointerType: "touch" });
    });

    expect(useAppStore.getState().world.utilities).toHaveLength(1);
    expect(useAppStore.getState().selection?.kind).toBe("utility");
  });

  it("routes primary pen taps through the existing inspect selection path", () => {
    const world = structuredClone(useAppStore.getState().world);
    const templateDistrict = world.districts[0]!;
    world.districts = [
      {
        ...templateDistrict,
        id: "district-pen-target",
        footprint: { x: 0, y: 0, width: 128, height: 128 },
        tiles: [{ x: 64, y: 64 }],
      },
    ];
    useAppStore.setState({ world, selection: undefined, mode: "inspect" });

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 200, clientY: 200, pointerId: 9, pointerType: "pen" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 200, clientY: 200, pointerId: 9, pointerType: "pen" });
    });

    expect(useAppStore.getState().selection).toEqual({
      kind: "district",
      entityId: "district-pen-target",
    });
  });

  it("finalizes a road from the viewport double-click gesture", () => {
    const world = createOpenBuildWorld();
    useAppStore.setState({ world, selection: undefined, mode: "build_road" });

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 140, clientY: 220 });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 140, clientY: 220 });
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 240, clientY: 220 });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 240, clientY: 220 });
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 240, clientY: 220 });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 240, clientY: 220 });
      fireEvent.doubleClick(viewport!, { button: 0, clientX: 240, clientY: 220 });
    });

    expect(useAppStore.getState().world.roadEdges).toHaveLength(1);
    expect(useAppStore.getState().world.roadEdges[0]?.path).toHaveLength(2);
    expect(useAppStore.getState().selection?.kind).toBe("road_edge");
  });

  it("uses pinch gestures to zoom without finishing a zone drag", () => {
    const world = createOpenBuildWorld();
    useAppStore.setState((state) => ({
      world,
      selection: undefined,
      mode: "build_zone",
      editor: {
        ...state.editor,
        preview: undefined,
        statusText: undefined,
        zoneDragStart: undefined,
      },
    }));
    const initialDistance = useAppStore.getState().camera.distance;

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 150, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 250, clientY: 200, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 120, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 280, clientY: 200, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 120, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 280, clientY: 200, pointerId: 2, pointerType: "touch" });
    });

    expect(useAppStore.getState().camera.distance).toBeLessThan(initialDistance);
    expect(useAppStore.getState().world.districts).toHaveLength(0);
    expect(useAppStore.getState().editor.preview).toBeUndefined();
  });

  it("uses pinch gestures to zoom without completing a click-driven build action", () => {
    const world = createOpenBuildWorld();
    useAppStore.setState((state) => ({
      world,
      selection: undefined,
      mode: "place_utility",
      editor: {
        ...state.editor,
        activeUtilityType: "park",
        preview: undefined,
        statusText: undefined,
      },
    }));
    const initialDistance = useAppStore.getState().camera.distance;

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 170, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 250, clientY: 200, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 135, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 285, clientY: 200, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 135, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 285, clientY: 200, pointerId: 2, pointerType: "touch" });
    });

    expect(useAppStore.getState().camera.distance).toBeLessThan(initialDistance);
    expect(useAppStore.getState().world.utilities).toHaveLength(0);
    expect(useAppStore.getState().selection).toBeUndefined();
  });

  it("uses pinch gestures to zoom without selecting or orbiting in inspect mode", () => {
    const world = structuredClone(useAppStore.getState().world);
    const templateDistrict = world.districts[0]!;
    world.districts = [
      {
        ...templateDistrict,
        id: "district-pinch-target",
        footprint: { x: 0, y: 0, width: 128, height: 128 },
        tiles: [{ x: 64, y: 64 }],
      },
    ];
    useAppStore.setState({ world, mode: "inspect", selection: undefined });
    const initialCamera = useAppStore.getState().camera;

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 180, clientY: 200, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerDown(viewport!, { button: 0, clientX: 240, clientY: 200, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 150, clientY: 170, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerMove(viewport!, { button: 0, clientX: 270, clientY: 230, pointerId: 2, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 150, clientY: 170, pointerId: 1, pointerType: "touch" });
      fireEvent.pointerUp(viewport!, { button: 0, clientX: 270, clientY: 230, pointerId: 2, pointerType: "touch" });
    });

    const nextCamera = useAppStore.getState().camera;
    expect(nextCamera.distance).toBeLessThan(initialCamera.distance);
    expect(nextCamera.yaw).toBe(initialCamera.yaw);
    expect(nextCamera.pitch).toBe(initialCamera.pitch);
    expect(useAppStore.getState().selection).toBeUndefined();
  });

  it("keeps desktop wheel zoom active alongside touch zoom support", () => {
    const initialDistance = useAppStore.getState().camera.distance;

    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport");
    expect(viewport).not.toBeNull();

    act(() => {
      fireEvent.wheel(viewport!, { deltaY: -120 });
    });

    expect(useAppStore.getState().camera.distance).toBeLessThan(initialDistance);
  });

  it("renders traffic and district overlays from derived presentation data", () => {
    const { container, rerender } = render(<WorldViewport />);

    act(() => {
      useAppStore.getState().setOverlay("traffic");
    });
    rerender(<WorldViewport />);
    expect(container.querySelectorAll(".overlay-traffic-path").length).toBeGreaterThan(0);

    act(() => {
      useAppStore.getState().setOverlay("satisfaction");
    });
    rerender(<WorldViewport />);
    expect(container.querySelectorAll(".overlay-district").length).toBeGreaterThan(0);
  });

  it("captures pointer drags so controls release cleanly on pointer cancellation", () => {
    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport") as HTMLDivElement;
    expect(viewport).not.toBeNull();

    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);
    Object.assign(viewport, { hasPointerCapture, releasePointerCapture, setPointerCapture });

    act(() => {
      fireEvent.pointerDown(viewport, { button: 0, clientX: 200, clientY: 200, pointerId: 7 });
      fireEvent.pointerCancel(viewport, { pointerId: 7 });
    });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(hasPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("keeps desktop pan controls on secondary or shift-primary mouse drags", () => {
    const { container } = render(<WorldViewport />);
    const viewport = container.querySelector(".world-viewport") as HTMLDivElement;
    expect(viewport).not.toBeNull();

    const initialTarget = useAppStore.getState().camera.target;

    act(() => {
      fireEvent.pointerDown(viewport, { button: 0, buttons: 1, clientX: 200, clientY: 200, pointerId: 11, pointerType: "mouse", shiftKey: true });
      fireEvent.pointerMove(viewport, { button: 0, buttons: 1, clientX: 240, clientY: 220, pointerId: 11, pointerType: "mouse", shiftKey: true });
      fireEvent.pointerUp(viewport, { button: 0, clientX: 240, clientY: 220, pointerId: 11, pointerType: "mouse", shiftKey: true });
    });

    const afterShiftPan = useAppStore.getState().camera.target;
    expect(afterShiftPan).not.toEqual(initialTarget);

    act(() => {
      fireEvent.pointerDown(viewport, { button: 2, buttons: 2, clientX: 210, clientY: 210, pointerId: 12, pointerType: "mouse" });
      fireEvent.pointerMove(viewport, { button: 2, buttons: 2, clientX: 250, clientY: 250, pointerId: 12, pointerType: "mouse" });
      fireEvent.pointerUp(viewport, { button: 2, clientX: 250, clientY: 250, pointerId: 12, pointerType: "mouse" });
    });

    expect(useAppStore.getState().camera.target).not.toEqual(afterShiftPan);
  });

  it("keeps UI available and displays a fallback surface when renderer construction fails", () => {
    rendererSpies.constructorError = new Error("webgl init failed");

    const { container } = render(<WorldViewport />);

    expect(container.querySelector(".world-canvas-error")?.textContent).toContain("3D viewport unavailable");
    expect(container.querySelector(".world-overlay")).not.toBeNull();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("stops the render loop and shows fallback surface when rendering throws", () => {
    rendererSpies.renderErrorOnCall = 2;
    const { container } = render(<WorldViewport />);

    const firstFrame = frameCallbacks.get(1);
    act(() => {
      firstFrame?.(100);
    });
    const secondFrame = frameCallbacks.get(2);
    act(() => {
      secondFrame?.(116);
    });

    expect(rendererSpies.renderCalls).toHaveLength(1);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".world-canvas-error")?.textContent).toContain("3D viewport unavailable");
  });
});
