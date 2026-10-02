import { useEffect, useState } from 'react'
import type { BattleEligibility, RaidBossPreview } from '../../shared/battle-types'
import {
  RAID_ATTACKS_PER_TURN,
  RAID_GIGANTAMAX_CHANCE,
  RAID_HP_MULTIPLIER,
  RAID_OVERFLOW_FACTOR,
  RAID_RESTRICTED_CHANCE,
  RAID_SOFT_CAP_SHARE,
  RAID_STARS,
  toSpriteId
} from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import { RarityGlow } from './RarityCard'

interface Props {
  eligibility: BattleEligibility | null
  // How many are on the team - the whole of it goes into the raid (shown in the team
  // dock, its two leads marked).
  teamSize: number
  levelCap: number | null
  fightBusy: boolean
  onStart: () => void
  // Where Raid Crystals are sold: the Shop, and the Game Corner's Coin Shop.
  onOpenShop: () => void
  onOpenCoinShop: () => void
}

/**
 * Every Pokemon a raid can bring, drifting past in a strip that stops under the mouse:
 * Gigantamax ones in their Gigantamax form, and the ones not yet in the Pokedex as
 * black silhouettes with no name.
 */
function RaidBossCarousel({ bosses }: { bosses: RaidBossPreview[] }): React.JSX.Element {
  const seen = bosses.filter((b) => b.registered).length
  // Twice over, so the strip scrolls round without a gap; a steady speed whatever its length.
  const strip = [...bosses, ...bosses]
  return (
    <div className="raid-panel raid-bosses">
      <div className="raid-panel-title raid-bosses-title">
        <span>Possible raid bosses</span>
        <span className="raid-bosses-seen">
          {seen}/{bosses.length} registered
        </span>
      </div>
      <div className="raid-bosses-viewport">
        <div className="raid-bosses-track" style={{ '--raid-scroll': `${bosses.length * 2.2}s` } as React.CSSProperties}>
          {strip.map((b, i) => (
            <div
              key={i}
              className={`raid-boss${b.registered ? '' : ' raid-boss-unknown'}`}
              title={b.registered ? `${b.species}${b.gigantamax ? ' (Gigantamax)' : ''}` : '??? - not in your Pokédex yet'}
              aria-hidden={i >= bosses.length}
            >
              <RarityGlow tier={b.registered ? b.rarityTier : 'common'} size={72} stand={b.registered}>
                <SpriteImage style="3d-static" spriteId={toSpriteId(b.species)} gmax={b.gigantamax} alt="" draggable={false} />
              </RarityGlow>
              <span className="raid-boss-name">{b.registered ? b.species : '???'}</span>
              {b.gigantamax && <span className="raid-boss-gmax">G-Max</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The Max Raid page: the Raid Crystals held and the button that spends one, and how a
 * raid plays out. The team going in is the team dock's, its first two marked as leads.
 */
function RaidPage({
  eligibility,
  teamSize,
  levelCap,
  fightBusy,
  onStart,
  onOpenShop,
  onOpenCoinShop
}: Props): React.JSX.Element {
  const [raidsWon, setRaidsWon] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getTrainerProfile()
      .then((profile) => setRaidsWon(profile.stats.raidsWon))
      .catch(() => setRaidsWon(null))
  }, [])
  const [bosses, setBosses] = useState<RaidBossPreview[] | null>(null)
  useEffect(() => {
    window.api
      .getRaidBosses()
      .then(setBosses)
      .catch(() => setBosses(null))
  }, [])

  const unlocked = !!eligibility?.raidsUnlocked
  const crystals = eligibility?.wishingPieces ?? 0
  const teamEmpty = teamSize === 0
  const canStart = unlocked && crystals > 0 && !teamEmpty && !fightBusy
  let hint = ''
  if (!eligibility) hint = ''
  else if (!unlocked) hint = `Max Raids open up once you beat ${eligibility.raidUnlockBoss ?? 'the right boss'}`
  else if (teamEmpty) hint = 'Put some Pokémon on your team first'
  else if (crystals === 0) hint = 'You need a Raid Crystal - the Shop and the Coin Shop sell them'
  else hint = `Uses 1 of your ${crystals} Raid Crystal${crystals === 1 ? '' : 's'}`

  const pct = (chance: number): string => `${Math.round(chance * 100)}%`

  return (
    <div className="raid-page">
      <div className={`raid-hero${unlocked ? '' : ' raid-hero-locked'}`}>
        <div className="raid-hero-crystal">
          <img src="./sprites/misc/raidcrystal.png" alt="" />
        </div>
        <div className="raid-hero-title">{unlocked ? 'Max Raid' : '🔒 Max Raid'}</div>
        <div className="raid-hero-sub">
          A Dynamaxed ★{RAID_STARS} boss{levelCap !== null ? ` at Lv ${levelCap}` : ''} - win and it's yours.
        </div>
        <div className="raid-hero-crystals">
          <img src="./sprites/misc/raidcrystal.png" alt="" />×{crystals}
          <span>Raid Crystal{crystals === 1 ? '' : 's'}</span>
        </div>
        <button className="raid-start" disabled={!canStart} onClick={onStart}>
          Start Max Raid
        </button>
        {hint && <div className="raid-hero-hint">{hint}</div>}
        <div className="raid-get">
          <span>Get crystals:</span>
          <button onClick={onOpenShop}>Shop</button>
          <button onClick={onOpenCoinShop}>Coin Shop</button>
        </div>
      </div>

      <div className="raid-side">
        <div className="raid-panel">
          <div className="raid-panel-title">How a raid works</div>
          <ul className="raid-rules">
            <li>A doubles battle: your first two lead, the rest switch in.</li>
            <li>The boss stays Dynamaxed the whole fight and attacks {RAID_ATTACKS_PER_TURN} times a turn.</li>
            <li>It has {RAID_HP_MULTIPLIER}× its HP before Dynamaxing doubles it.</li>
            <li>
              Big hits are softened: past {pct(RAID_SOFT_CAP_SHARE)} of its HP in one hit, only {pct(RAID_OVERFLOW_FACTOR)} of the rest lands.
            </li>
            <li>
              {pct(RAID_GIGANTAMAX_CHANCE)} of bosses are Gigantamax; otherwise a red Pokémon, or a gold legendary {pct(RAID_RESTRICTED_CHANCE)} of the time.
            </li>
            <li>Win to catch it, with its ★{RAID_STARS} merge stars.</li>
          </ul>
        </div>

        {raidsWon !== null && (
          <div className="raid-panel raid-stat">
            <span>Raids won</span>
            <strong>{raidsWon}</strong>
          </div>
        )}

        {bosses && bosses.length > 0 && <RaidBossCarousel bosses={bosses} />}
      </div>
    </div>
  )
}

export default RaidPage
