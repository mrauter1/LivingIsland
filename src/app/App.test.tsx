import { act, cleanup, render, screen } from "@testing-library/react";
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
});
