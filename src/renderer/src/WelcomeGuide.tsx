import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IS_MOBILE } from './platform'

interface Page {
  icon: string
  title: string
  lines: string[]
}

// The tour, one page per part of the game. Kept short: a new player reads it once
// before picking a starter, and can open it again from Options → About.
const PAGES: Page[] = [
  {
    icon: './icons/nav/box.png',
    title: 'Welcome to pkmnPvE',
    lines: [
      'A Pokémon game built on the Pokémon Showdown battle engine: catch Pokémon, build teams and take on trainers, bosses, the Battle Tower and the Game Corner.',
      'Everything starts from the home screen. First, you pick a starter.'
    ]
  },
  {
    icon: './icons/nav/pokedex.png',
    title: 'Catch and Box',
    lines: [
      'Catch finds wild Pokémon to battle. Beating one is the only way to catch it, and the catch is guaranteed.',
      'Everything you catch goes to your Box.',
      'In the Box you choose your team of six, change moves and items, evolve and merge duplicates for stars.'
    ]
  },
  {
    icon: './icons/nav/achievements.png',
    title: 'Battles',
    lines: [
      "Fight trainers for money and items, then the bosses. Your Pokémon can't level past the level cap, and beating certain bosses raises it.",
      'Beat enough bosses and Max Raids open: giant Dynamax Pokémon to take down for rare rewards.'
    ]
  },
  {
    icon: './icons/nav/roguelite.png',
    title: 'Battle Tower and Draft',
    lines: [
      'The Battle Tower is a run: start with one Pokémon, climb floor by floor and grow your team as you go. Lose a battle and the run is over.',
      'Draft builds a whole team from random picks, then puts it to the test.'
    ]
  },
  {
    icon: './icons/nav/gamecorner.png',
    title: 'Game Corner',
    lines: [
      'Slots, blackjack, roulette, Plinko, dice and Pokémon cases, played with coins you earn in the game.',
      'Coins are play money only: they can never be bought or cashed out.'
    ]
  },
  {
    icon: './icons/nav/options.png',
    title: 'Your save',
    lines: [
      'The game saves by itself as you play.',
      'Options → Saves backs your save up or moves it to another device. Export a save file now and then, especially before reinstalling or switching devices.',
      ...(IS_MOBILE ? [] : ['Tip: the number keys 1-7 jump straight to the home screen cards.'])
    ]
  }
]

// Remembered per device, so a new save on a device that's already seen the tour
// skips it (it's still in Options). Without storage it just shows again.
const SEEN_KEY = 'pkmnpve.welcomeSeen'

export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // localStorage unavailable - the tour just shows again next time
  }
}

/** The first-run tour: shown to a new player before the starter picker, and from Options. */
function WelcomeGuide({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [index, setIndex] = useState(0)
  const page = PAGES[index]
  const last = index === PAGES.length - 1

  // Esc closes just this window; the arrow keys turn the pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, PAGES.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      else return
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-panel welcome-guide">
        <img className="welcome-guide-icon" src={page.icon} alt="" />
        <h2 className="welcome-guide-title">{page.title}</h2>
        {page.lines.map((line) => (
          <p key={line} className="welcome-guide-line">
            {line}
          </p>
        ))}
        <div className="welcome-guide-dots">
          {PAGES.map((p, i) => (
            <button
              key={p.title}
              className={`welcome-guide-dot ${i === index ? 'welcome-guide-dot-on' : ''}`}
              aria-label={p.title}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <div className="editor-actions welcome-guide-actions">
          {!last && (
            <button className="welcome-guide-skip" onClick={onClose}>
              Skip
            </button>
          )}
          {index > 0 && <button onClick={() => setIndex(index - 1)}>Back</button>}
          <button className="welcome-guide-next" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default WelcomeGuide
