import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RendererFrameInput } from "../../simulation/core/contracts";
import { useAppStore } from "../../app/store/appStore";

const rendererSpies = vi.hoisted(() => ({
  disposeCalls: 0,
  renderCalls: [] as RendererFrameInput[],
  resizeCalls: 0,
}));

vi.mock("../../world/rendering/WorldRenderer", () => ({
  WorldRenderer: class {
    constructor(container: HTMLElement) {
      void container;
    }

    resize(): void {
      rendererSpies.resizeCalls += 1;
    }

    render(frame: RendererFrameInput): void {
      rendererSpies.renderCalls.push(frame);
    }

    dispose(): void {
      rendererSpies.disposeCalls += 1;
    }
  },
}));

import { WorldViewport } from "./WorldViewport";

describe("WorldViewport", () => {
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let originalGetBoundingClientRect: PropertyDescriptor | undefined;

  beforeEach(() => {
    rendererSpies.disposeCalls = 0;
    rendererSpies.renderCalls.length = 0;
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

  it("finalizes a road from the viewport double-click gesture", () => {
    const world = structuredClone(useAppStore.getState().world);
    world.roadNodes = [];
    world.roadEdges = [];
    world.districts = [];
    world.utilities = [];
    world.terrain.tiles = world.terrain.tiles.map((tile) => ({
      ...tile,
      terrain: "plains",
      isBuildable: true,
      districtId: undefined,
      utilityId: undefined,
      coastline: false,
    }));
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
});
