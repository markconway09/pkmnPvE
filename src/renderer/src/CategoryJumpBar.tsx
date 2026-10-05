import { useEffect, useState } from 'react'

interface Props {
  /** Each category in page order, with how many items it holds right now. */
  categories: [string, number][]
  /** The list that scrolls; each category's section in it carries `data-category`. */
  scrollRef: React.RefObject<HTMLDivElement | null>
}

// Where a category's section starts inside the scrolling list, or null when it isn't shown.
function sectionTop(scroll: HTMLElement, category: string): number | null {
  const section = scroll.querySelector<HTMLElement>(`[data-category="${CSS.escape(category)}"]`)
  if (!section) return null
  return scroll.scrollTop + section.getBoundingClientRect().top - scroll.getBoundingClientRect().top
}

/**
 * One button per category above a long item list (the Bag and the Shop), like the Achievements
 * window: a click scrolls down to that category, and the one being read is lit.
 */
function CategoryJumpBar({ categories, scrollRef }: Props): React.JSX.Element | null {
  const [current, setCurrent] = useState<string | null>(null)
  const names = categories.map(([name]) => name)
  const key = names.join('|')

  // On scroll: light the category whose heading was last scrolled past.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const onScroll = (): void => {
      let reading = names[0] ?? null
      for (const name of names) {
        const top = sectionTop(scroll, name)
        if (top !== null && top <= scroll.scrollTop + 4) reading = name
      }
      // Scrolled to the very bottom: the last category, even if its heading can't reach the top.
      if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2 && names.length > 0) {
        reading = names[names.length - 1]
      }
      setCurrent(reading)
    }
    onScroll()
    scroll.addEventListener('scroll', onScroll)
    return () => scroll.removeEventListener('scroll', onScroll)
  }, [key, scrollRef])

  function goTo(name: string): void {
    const scroll = scrollRef.current
    if (!scroll) return
    const top = sectionTop(scroll, name)
    if (top !== null) scroll.scrollTo({ top, behavior: 'smooth' })
  }

  if (categories.length < 2) return null
  return (
    <span className="tms-filter achievements-categories category-jump-bar">
      {categories.map(([name, count]) => (
        <button key={name} className={current === name ? 'tms-filter-on' : undefined} onClick={() => goTo(name)}>
          {name}
          <span className="achievements-tab-count">{count}</span>
        </button>
      ))}
    </span>
  )
}

export default CategoryJumpBar
