import { contextBridge, ipcRenderer } from 'electron'
import { createApi } from '../shared/api'

// The desktop transport: each call goes to the main process over IPC.
const api = createApi({
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on(channel, listener) {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]): void => listener(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
})

contextBridge.exposeInMainWorld('api', api)
// Options → Screen size → Mobile: the phone layout on the PC (see src/renderer/src/platform.ts).
contextBridge.exposeInMainWorld('desktopLayout', ipcRenderer.sendSync('uiScale:layout'))

export type { Api } from '../shared/api'
