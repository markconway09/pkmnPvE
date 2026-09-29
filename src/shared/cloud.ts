// Cloud saves on Google Drive: what the renderer is told about the connection and the
// saves stored there (see src/main/cloud/google-drive.ts).

export interface CloudStatus {
  // False when the game was built without the Google client (no .env.local).
  available: boolean
  connected: boolean
  // The Google account connected, when it's known.
  email: string | null
}

export interface CloudSave {
  id: string
  // When it was exported (ISO date).
  createdAt: string
  // A glimpse of what's in it, recorded at export.
  pokemon: number | null
  money: number | null
  appVersion: string | null
}
