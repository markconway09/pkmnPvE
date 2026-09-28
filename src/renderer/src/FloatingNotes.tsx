import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Note {
  id: number
  text: string
  x: number
  y: number
  ms: number
  tone: NoteTone
}

// Green for something done, red for something that couldn't be.
export type NoteTone = 'good' | 'bad'

export interface NotePoint {
  x: number
  y: number
}

// Long enough to read: a base time plus a bit per character, for the longer results
// (an Exp. Candy's level-ups, a case opening).
function durationFor(text: string): number {
  return Math.min(6000, 1600 + text.length * 35)
}

/**
 * Short confirmations ("Sold 3× Oran Berry for ₽120") that float up from where the
 * action happened and fade out, instead of a line of text at the top of the window.
 * Render `layer` once; call `show` with the point to rise from (screen coordinates).
 */
export function useFloatingNotes(): {
  show: (text: string, at: NotePoint, tone?: NoteTone) => void
  layer: React.JSX.Element
} {
  const [notes, setNotes] = useState<Note[]>([])
  const nextId = useRef(0)

  const show = useCallback((text: string, at: NotePoint, tone: NoteTone = 'good') => {
    const id = nextId.current++
    const ms = durationFor(text)
    setNotes((all) => [...all, { id, text, x: at.x, y: at.y, ms, tone }])
    setTimeout(() => setNotes((all) => all.filter((n) => n.id !== id)), ms)
  }, [])

  const layer = createPortal(
    <>
      {notes.map((note) => (
        <div
          key={note.id}
          className={`floating-note${note.tone === 'bad' ? ' floating-note-bad' : ''}`}
          style={{
            // Kept on screen: centred on the point, but never past either edge.
            left: Math.max(150, Math.min(window.innerWidth - 150, note.x)),
            top: note.y,
            animationDuration: `${note.ms}ms`
          }}
        >
          {note.text}
        </div>
      ))}
    </>,
    document.body
  )

  return { show, layer }
}

/**
 * An error's message for the player: without the "Error invoking remote method
 * 'bag:...': Error:" that Electron puts in front of anything thrown in the main process.
 */
export function errorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e)
  return text.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '')
}

/** The middle of the element an event came from - where a note about it should rise. */
export function pointOf(e: React.MouseEvent): NotePoint {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top }
}
