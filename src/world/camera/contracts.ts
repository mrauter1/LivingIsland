import type { CameraState } from "../../types";

export const DEFAULT_CAMERA_STATE: CameraState = {
  target: { x: 64, y: 0, z: 64 },
  yaw: 0.45,
  pitch: 0.85,
  distance: 150,
  cinematic: false,
  hudHidden: false,
};
