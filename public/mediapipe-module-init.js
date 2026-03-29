// Pre-declare global Module object BEFORE pose.js loads.
// MediaPipe's pose.js is an Emscripten IIFE that checks for an existing window.Module
// and merges into it rather than creating a private local object.
// Helper scripts (pose_solution_packed_assets_loader.js, etc.) run in global scope
// and reference Module.CDN_URL — they can only find it if Module is on window.
// This file must be loaded as a beforeInteractive script BEFORE pose.js.
window.Module = window.Module || {};
