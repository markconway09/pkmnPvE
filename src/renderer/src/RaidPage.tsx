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
import RarityOddsTooltip from './RarityOddsTooltip'
import { t } from './i18n'

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
        <span>{t('raid.possible')}</span>
        <span className="raid-bosses-seen">{t('raid.registered', { n: seen, of: bosses.length })}</span>
      </div>
      <div className="raid-bosses-viewport">
        <div className="raid-bosses-track" style={{ '--raid-scroll': `${bosses.length * 2.2}s` } as React.CSSProperties}>
          {strip.map((b, i) => (
            <div
              key={i}
              className={`raid-boss${b.registered ? '' : ' raid-boss-unknown'}`}
              title={b.registered ? (b.gigantamax ? t('raid.gmaxTitle', { name: b.species }) : b.species) : t('raid.unknown')}
              aria-hidden={i >= bosses.length}
            >
              <RarityGlow tier={b.registered ? b.rarityTier : 'common'} size={72} stand={b.registered}>
                <SpriteImage style="3d-static" spriteId={toSpriteId(b.species)} gmax={b.gigantamax} alt="" draggable={false} />
              </RarityGlow>
              <span className="raid-boss-name">{b.registered ? b.species : '???'}</span>
              {b.gigantamax && <span className="raid-boss-gmax">{t('raid.gmax')}</span>}
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
  else if (!unlocked) hint = t('raid.locked', { boss: eligibility.raidUnlockBoss ?? t('bag.theRightBoss') })
  else if (teamEmpty) hint = t('raid.teamEmpty')
  else if (crystals === 0) hint = t('raid.needCrystal')
  else hint = t('raid.uses', { count: crystals })

  const pct = (chance: number): string => `${Math.round(chance * 100)}%`

  return (
    <div className="raid-page">
      <div className={`raid-hero${unlocked ? '' : ' raid-hero-locked'}`}>
        <div className="raid-hero-crystal">
          <img src="./sprites/misc/raidcrystal.png" alt="" />
        </div>
        <div className="raid-hero-title">{unlocked ? t('nav.raid') : `🔒 ${t('nav.raid')}`}</div>
        <div className="raid-hero-sub">
          {levelCap !== null ? t('raid.subLevel', { stars: RAID_STARS, level: levelCap }) : t('raid.sub', { stars: RAID_STARS })}
        </div>
        <div className="raid-hero-crystals">
          <img src="./sprites/misc/raidcrystal.png" alt="" />×{crystals}
          <span>{t('raid.crystals', { count: crystals })}</span>
        </div>
        <RarityOddsTooltip source={{ kind: 'raid' }}>
          <button className="raid-start" disabled={!canStart} onClick={onStart}>
            {t('raid.start')}
          </button>
        </RarityOddsTooltip>
        {hint && <div className="raid-hero-hint">{hint}</div>}
        <div className="raid-get">
          <span>{t('raid.getCrystals')}</span>
          <button onClick={onOpenShop}>{t('raid.shop')}</button>
          <button onClick={onOpenCoinShop}>{t('raid.coinShop')}</button>
        </div>
      </div>

      <div className="raid-side">
        <div className="raid-panel">
          <div className="raid-panel-title">{t('raid.how')}</div>
          <ul className="raid-rules">
            <li>{t('raid.rule1')}</li>
            <li>{t('raid.rule2', { n: RAID_ATTACKS_PER_TURN })}</li>
            <li>{t('raid.rule3', { n: RAID_HP_MULTIPLIER })}</li>
            <li>{t('raid.rule4', { share: pct(RAID_SOFT_CAP_SHARE), rest: pct(RAID_OVERFLOW_FACTOR) })}</li>
            <li>{t('raid.rule5', { gmax: pct(RAID_GIGANTAMAX_CHANCE), gold: pct(RAID_RESTRICTED_CHANCE) })}</li>
            <li>{t('raid.rule6', { stars: RAID_STARS })}</li>
          </ul>
        </div>

        {raidsWon !== null && (
          <div className="raid-panel raid-stat">
            <span>{t('raid.won')}</span>
            <strong>{raidsWon}</strong>
          </div>
        )}

        {bosses && bosses.length > 0 && <RaidBossCarousel bosses={bosses} />}
      </div>
    </div>
  )
}

export default RaidPage
