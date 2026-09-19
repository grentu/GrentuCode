import { contextBridge, ipcRenderer } from "electron";

// The seam between the renderer UI and the orchestrator core. For now the
// renderer drives itself from a mock run-state; when the core is wired into the
// main process, `runTask` will stream real RunState updates over IPC.
contextBridge.exposeInMainWorld("grentu", {
  runTask: (description: string) => ipcRenderer.invoke("grentu:run-task", description),
  onStateUpdate: (cb: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => cb(state);
    ipcRenderer.on("grentu:state", listener);
    return () => ipcRenderer.removeListener("grentu:state", listener);
  },
});
