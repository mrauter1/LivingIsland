import { cleanup, render, screen } from "@testing-library/react";
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

  it("renders the browser shell with the phase-required panels", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Living Island")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "World Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "timelapse" })).toBeInTheDocument();
  });
});
