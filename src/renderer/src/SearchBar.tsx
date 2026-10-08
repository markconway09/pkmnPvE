import { useRef } from 'react'
import { IS_MOBILE } from './platform'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  // Takes the keyboard as soon as it appears, so typing searches straight away (not on the
  // phone, where the keyboard popping up would cover half the screen).
  autoFocus?: boolean
  className?: string
}

/**
 * The bag's and shop's search box: a magnifier, the text, and a button to clear it
 * (Esc clears it too).
 */
function SearchBar({ value, onChange, placeholder = 'Search...', autoFocus, className }: Props): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={`search-bar${className ? ` ${className}` : ''}`} onClick={() => inputRef.current?.focus()}>
      <svg className="search-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus && !IS_MOBILE}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            // Clears the search rather than closing whatever it's in.
            e.stopPropagation()
            onChange('')
          }
        }}
      />
      {value && (
        <button
          type="button"
          className="search-bar-clear"
          title="Clear the search"
          onClick={(e) => {
            e.stopPropagation()
            onChange('')
            inputRef.current?.focus()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default SearchBar
