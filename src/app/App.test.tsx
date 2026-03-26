import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./store/appStore";

vi.mock("../world/rendering/WorldRenderer", () => ({
  WorldRenderer: class {
    constructor(container: HTMLElement) {
      void container;
    }

    resize(): void {}

    render(): void {}

    dispose(): void {}
  },
}));

vi.mock("../ui/panels/RightInspectorPanel", () => ({
  RightInspectorPanel: () => (
    <aside>
      <h2>World Summary</h2>
    </aside>
  ),
}));

vi.mock("../debug/DebugPanel", () => ({
  DebugPanel: () => null,
}));

import { App } from "./App";

describe("app shell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.getState().newWorld("app-shell-seed");
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the browser shell with the phase-required panels", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("Living Island")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "World Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "timelapse" })).toBeInTheDocument();
    expect(screen.getByLabelText("World seed")).toBeInTheDocument();
  });

  it("hides the desktop HUD and overlay legend in photo mode while keeping the viewport mounted", async () => {
    useAppStore.setState({ overlay: "traffic" });

    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => {});

    expect(screen.getByText("Traffic")).toBeInTheDocument();

    act(() => {
      useAppStore.setState((state) => ({
        camera: {
          ...state.camera,
          hudHidden: true,
        },
      }));
    });

    expect(screen.queryByText("Living Island")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Build" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "World Summary" })).not.toBeInTheDocument();
    expect(screen.queryByText("Traffic")).not.toBeInTheDocument();
    expect(container.querySelector(".world-viewport")).not.toBeNull();
  });

  it("generates a new world from the explicit seed control", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => {});

    fireEvent.change(screen.getByLabelText("World seed"), {
      target: { value: "qa-seed-42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate World" }));

    expect(useAppStore.getState().world.metadata.seed).toBe("qa-seed-42");
  });

  it("resynchronizes the seed input when the canonical world changes externally", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => {});

    const seedInput = screen.getByLabelText("World seed") as HTMLInputElement;

    fireEvent.change(seedInput, {
      target: { value: "draft-seed" },
    });
    expect(seedInput.value).toBe("draft-seed");

    act(() => {
      useAppStore.getState().newWorld("loaded-seed");
    });

    expect(seedInput.value).toBe("loaded-seed");
    expect(useAppStore.getState().world.metadata.seed).toBe("loaded-seed");
  });
});
