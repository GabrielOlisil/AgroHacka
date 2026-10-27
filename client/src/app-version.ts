import tauriConfig from "../src-tauri/tauri.conf.json";

// Same source as the installer names, so the screen never shows a different number.
export const APP_VERSION: string = tauriConfig.version;
