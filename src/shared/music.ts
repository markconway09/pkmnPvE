/** One audio file found in the player's own music folder (the "local folder" music source). */
export interface LocalMusicFile {
  // A pkmn-music:// address the main process serves the file from.
  url: string
  // The file name without its extension.
  title: string
  // The folder it's in.
  artist: string
}
