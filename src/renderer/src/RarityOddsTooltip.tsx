import { useEffect, useState, type ReactNode } from 'react'
import type { RarityTier } from '../../shared/battle-types'
import { RARITY_TIERS, type RarityOddsReport, type RarityOddsSource } from '../../shared/rarity'
import Tooltip from './Tooltip'

export const TIER_LABELS: Record<RarityTier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Mythical',
  legendary: 'Legendary'
}

// Whole percents from 10% up, finer below so a rare gold still shows (0.25%, not 0%).
function formatChance(chance: number): string {
  const pct = chance * 100
  const shown = pct >= 10 ? Math.round(pct).toString() : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)
  return `${shown.includes('.') ? shown.replace(/\.?0+$/, '') : shown}%`
}

// Asked for when the tooltip opens, so a title or the TM pity is always counted as it is now.
function OddsPanel({ source, heading }: { source: RarityOddsSource; heading?: ReactNode }): React.JSX.Element {
  const [odds, setOdds] = useState<RarityOddsReport | null | undefined>(undefined)
  // The source is a fresh object each render; what it points at is what matters.
  const sourceKey = JSON.stringify(source)
  useEffect(() => {
    let live = true
    window.api
      .getRarityOdds(JSON.parse(sourceKey) as RarityOddsSource)
      .then((o) => live && setOdds(o))
      .catch(() => live && setOdds(null))
    return () => {
      live = false
    }
  }, [sourceKey])

  return (
    <div className="tooltip-panel rarity-odds-panel">
      {heading && <div className="rarity-odds-heading">{heading}</div>}
      <div className="tooltip-title">{odds && 'kinds' in odds ? 'Chances by type' : 'Rarity chances'}</div>
      {odds === undefined && <div className="rarity-odds-note">Loading...</div>}
      {odds === null && <div className="rarity-odds-note">Not available</div>}
      {odds &&
        !('kinds' in odds) &&
        RARITY_TIERS.filter((tier) => odds[tier] > 0).map((tier) => (
          <div key={tier} className={`rarity-odds-row rarity-tier-${tier}`}>
            <span className="rarity-odds-dot" />
            <span className="rarity-odds-name">{TIER_LABELS[tier]}</span>
            <span className="rarity-odds-bar">
              <span style={{ width: `${Math.max(2, odds[tier] * 100)}%` }} />
            </span>
            <span className="rarity-odds-chance">{formatChance(odds[tier])}</span>
          </div>
        ))}
      {odds &&
        'kinds' in odds &&
        odds.kinds.map((kind) => (
          <div key={kind.label} className={`rarity-odds-row rarity-odds-kind rarity-tier-${kind.tone}`}>
            <span className="rarity-odds-dot" />
            <span className="rarity-odds-name">{kind.label}</span>
            <span className="rarity-odds-bar">
              <span style={{ width: `${Math.max(2, kind.chance * 100)}%` }} />
            </span>
            <span className="rarity-odds-chance">{formatChance(kind.chance)}</span>
          </div>
        ))}
    </div>
  )
}

interface Props {
  source: RarityOddsSource
  // A line above the chances (what the button does, searches left...).
  heading?: ReactNode
  className?: string
  children: ReactNode
}

/** Wraps a button whose outcome is random by rarity (a case, a raid, a TM search): hovering it shows each rarity's chance. */
function RarityOddsTooltip({ source, heading, className, children }: Props): React.JSX.Element {
  return (
    <Tooltip
      placement="below"
      className={`rarity-odds-trigger${className ? ` ${className}` : ''}`}
      content={<OddsPanel source={source} heading={heading} />}
    >
      {children}
    </Tooltip>
  )
}

export default RarityOddsTooltip
