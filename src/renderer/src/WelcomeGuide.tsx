import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IS_MOBILE } from './platform'
import { t } from './i18n'

interface Page {
  icon: string
  title: string
  lines: string[]
}

// The tour, one page per part of the game. Kept short: a new player reads it once
// before picking a starter, and can open it again from Options → About.
function pages(): Page[] {
  return [
    {
      icon: './icons/nav/box.png',
      title: t('guide.welcome.title'),
      lines: [t('guide.welcome.1'), t('guide.welcome.2')]
    },
    {
      icon: './icons/nav/pokedex.png',
      title: t('guide.catch.title'),
      lines: [t('guide.catch.1'), t('guide.catch.2'), t('guide.catch.3')]
    },
    {
      icon: './icons/nav/achievements.png',
      title: t('guide.battles.title'),
      lines: [t('guide.battles.1'), t('guide.battles.2')]
    },
    {
      icon: './icons/nav/roguelite.png',
      title: t('guide.tower.title'),
      lines: [t('guide.tower.1'), t('guide.tower.2')]
    },
    {
      icon: './icons/nav/gamecorner.png',
      title: t('guide.corner.title'),
      lines: [t('guide.corner.1'), t('guide.corner.2')]
    },
    {
      icon: './icons/nav/options.png',
      title: t('guide.save.title'),
      lines: [t('guide.save.1'), t('guide.save.2'), ...(IS_MOBILE ? [] : [t('guide.save.tip')])]
    }
  ]
}
const PAGE_COUNT = 6

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
  const all = pages()
  const page = all[index]
  const last = index === PAGE_COUNT - 1

  // Esc closes just this window; the arrow keys turn the pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, PAGE_COUNT - 1))
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
          {all.map((p, i) => (
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
              {t('guide.skip')}
            </button>
          )}
          {index > 0 && <button onClick={() => setIndex(index - 1)}>{t('guide.back')}</button>}
          <button className="welcome-guide-next" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? t('guide.go') : t('guide.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default WelcomeGuide
