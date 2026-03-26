import type { SavePayload } from "../types";
import { SAVE_SCHEMA_VERSION } from "../types";

export function isSavePayload(value: unknown): value is SavePayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SavePayload>;
  return candidate.version === SAVE_SCHEMA_VERSION && typeof candidate.state === "object";
}
