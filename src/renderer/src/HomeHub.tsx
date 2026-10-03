import { useEffect, useState } from 'react'
import type { BattleEligibility, RunDifficulty, RunView } from '../../shared/battle-types'
import type { MissionsState } from '../../shared/missions'
import type { MenuPage } from './menuMode'
import CoinIcon from './CoinIcon'
import { trainerSpriteUrl } from './trainerSprite'

interface Props {
  levelCap: number | null
  eligibility: BattleEligibility | null
  // What the Boss Battle button's hint says ("Beat 2 more trainers to challenge Blaine").
  bossHint: string
  run: RunView | null
  bestFloor: { floor: number; difficulty: RunDifficulty | null } | null
  // How many Pokemon the box holds, for the Box card.
  boxCount: number | null
  missions: MissionsState | null
  fightBusy: boolean
  onGo: (page: MenuPage, from: HTMLElement) => void
  onOpenMissions: () => void
  // Mission rewards and achievements waiting to be claimed, shown on the Rewards button.
  rewardsWaiting: number
  onBag: () => void
  onShop: () => void
  onPokedex: () => void
  onRewards: () => void
  onOptions: () => void
}

const DIFFICULTY_LABELS: Record<RunDifficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', extreme: 'Extreme' }

/**
 * Home: the hub the game opens on. One card per mode, each saying where things stand
 * (the next boss, a run in progress, the coins held), a banner to jump back into a run,
 * and the day's missions. Clicking a card opens that mode's page, like the sidebar does.
 */
function HomeHub({
  levelCap,
  eligibility,
  bossHint,
  run,
  bestFloor,
  boxCount,
  missions,
  fightBusy,
  onGo,
  onOpenMissions,
  rewardsWaiting,
  onBag,
  onShop,
  onPokedex,
  onRewards,
  onOptions
}: Props): React.JSX.Element {
  const [coins, setCoins] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch(() => setCoins(null))
  }, [])

  const runActive = run?.status === 'active'
  const nextBoss = eligibility?.nextBoss ?? null
  const raidsUnlocked = !!eligibility?.raidsUnlocked
  const crystals = eligibility?.wishingPieces ?? 0
  // The windows the sidebar's lower buttons open, repeated as small buttons under the cards.
  const tools: { label: string; icon: string; smooth?: boolean; action: () => void; badge?: number }[] = [
    { label: 'Bag', icon: './icons/nav/bag.png', action: onBag },
    { label: 'Shop', icon: './icons/nav/shop.svg', smooth: true, action: onShop },
    { label: 'Pokédex', icon: './icons/nav/pokedex.png', action: onPokedex },
    { label: 'Achievements', icon: './icons/nav/achievements.png', action: onRewards, badge: rewardsWaiting },
    { label: 'Options', icon: './icons/nav/options.png', action: onOptions }
  ]

  return (
    <div className="home-hub">
      {runActive && run && (
        <button className="home-continue" onClick={(e) => onGo('roguelite', e.currentTarget)}>
          <img className="home-continue-icon" src="./icons/nav/roguelite.png" alt="" />
          <span className="home-continue-text">
            <span className="home-continue-title">Continue your run</span>
            <span className="home-continue-sub">
              Floor {run.floor} · {run.team.length} Pokémon · next: {run.nextBossLabel}
            </span>
          </span>
          <span className="home-continue-go">Continue ▸</span>
        </button>
      )}

      <div className="home-grid">
        <button className="home-card home-card-classic" onClick={(e) => onGo('classic', e.currentTarget)}>
          <span className="home-card-key">1</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/classic.png" alt="" />
            <span className="home-card-title">Classic</span>
          </span>
          <span className="home-classic-body">
            <span className="home-card-lines">
              {levelCap !== null && <span className="home-card-stat">Level cap {levelCap}</span>}
              <span className="home-card-sub">{bossHint}</span>
            </span>
            {nextBoss && !eligibility?.allBossesDefeated && (
              <img className="home-classic-boss" src={trainerSpriteUrl(nextBoss.spriteId || 'giovanni')} alt="" />
            )}
          </span>
          <span className="home-card-go">Open ▸</span>
        </button>

        <button className="home-card home-card-roguelite" onClick={(e) => onGo('roguelite', e.currentTarget)}>
          <span className="home-card-key">2</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/roguelite.png" alt="" />
            <span className="home-card-title">Roguelite</span>
          </span>
          <span className="home-card-sub">
            {runActive && run
              ? `Run in progress · floor ${run.floor}`
              : bestFloor
              ? `Best: floor ${bestFloor.floor}${bestFloor.difficulty ? ` (${DIFFICULTY_LABELS[bestFloor.difficulty]})` : ''}`
              : 'Climb floor by floor with one starter'}
          </span>
          <span className="home-card-go">Open ▸</span>
        </button>

        <button className="home-card home-card-draft" onClick={(e) => onGo('draft', e.currentTarget)}>
          <span className="home-card-key">3</span>
          <span className="home-card-head">
            <span className="home-card-icon home-card-icon-tile">
              <img className="home-card-icon-draft" src="./icons/nav/draft.png" alt="" />
            </span>
            <span className="home-card-title">Draft</span>
          </span>
          <span className="home-card-sub">Build a team from random picks</span>
          <span className="home-card-go">Open ▸</span>
        </button>

        <button className="home-card home-card-raid" onClick={(e) => onGo('raid', e.currentTarget)}>
          <span className="home-card-key">4</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./sprites/misc/raidcrystal.png" alt="" />
            <span className="home-card-title">{raidsUnlocked ? 'Max Raid' : '🔒 Max Raid'}</span>
          </span>
          <span className="home-card-sub">
            {raidsUnlocked ? `${crystals} Raid Crystal${crystals === 1 ? '' : 's'}` : `Beat ${eligibility?.raidUnlockBoss ?? 'more bosses'} to open`}
          </span>
          <span className="home-card-go">Open ▸</span>
        </button>

        <button className="home-card home-card-corner" onClick={(e) => onGo('corner', e.currentTarget)}>
          <span className="home-card-key">5</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/gamecorner.png" alt="" />
            <span className="home-card-title">Game Corner</span>
          </span>
          <span className="home-card-sub">
            <CoinIcon /> {coins === null ? '…' : coins.toLocaleString('en-US')} coins
          </span>
          <span className="home-card-go">Open ▸</span>
        </button>

        <button className="home-card home-card-box" onClick={(e) => onGo('box', e.currentTarget)}>
          <span className="home-card-key">6</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/box.png" alt="" />
            <span className="home-card-title">Box</span>
          </span>
          <span className="home-card-sub">
            {boxCount === null ? 'Your Pokémon and team' : `${boxCount} Pokémon`}
          </span>
          <span className="home-card-go">Open ▸</span>
        </button>

        {missions && (
          <button className="home-missions" onClick={onOpenMissions}>
            <span className="home-missions-head">
              <img className="home-card-icon" src="./icons/nav/missions.png" alt="" />
              Today&apos;s missions
            </span>
            {missions.missions.map((m) => {
              const done = m.progress >= m.goal
              return (
                <span
                  key={m.slot}
                  className={`home-mission home-mission-${m.tier}${m.claimed ? ' home-mission-claimed' : done ? ' home-mission-done' : ''}`}
                >
                  <span className="home-mission-text">{m.text}</span>
                  <span className="home-mission-bar">
                    <span style={{ width: `${Math.min(100, (m.progress / m.goal) * 100)}%` }} />
                  </span>
                  <span className="home-mission-count">{m.claimed ? '✓' : `${Math.min(m.progress, m.goal)}/${m.goal}`}</span>
                </span>
              )
            })}
          </button>
        )}
      </div>

      <div className="home-tools">
        {tools.map((t) => (
          <button key={t.label} className="home-tool" onClick={t.action}>
            <img className={`home-tool-icon${t.smooth ? ' home-tool-icon-smooth' : ''}`} src={t.icon} alt="" />
            {t.label}
            {!!t.badge && <span className="home-tool-badge">{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default HomeHub
