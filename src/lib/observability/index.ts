/**
 * AFD façade — single import surface for the entire app. Vendor swap = swap one folder.
 *
 * Plan: docs/planning/analytics-and-failure-detection-plan.md
 */
export { track, identify, type TrackEvent, type TrackProps } from "./analytics";
export { captureError, type ErrorContext } from "./errors";
export { heartbeat } from "./uptime";
export { withJobRun } from "./jobs";
export { observabilityGateOn, readObservabilityConfig } from "./config";