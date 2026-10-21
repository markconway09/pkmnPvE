import { useEffect, useState } from 'react'
import type { BattleEligibility, RunDifficulty, RunView } from '../../shared/battle-types'
import type { MissionsState } from '../../shared/missions'
import type { DexNavState } from '../../shared/dexnav'
import { DRAFT_ROUNDS, type DraftView } from '../../shared/draft'
import { toSpriteId } from '../../shared/battle-types'
import type { MenuPage } from './menuMode'
import CoinIcon from './CoinIcon'
import HordeIcon from './HordeIcon'
import { HORDE_DURATION_MS, formatHordeTime, type HordeRecord } from '../../shared/horde'
import SpriteImage from './SpriteImage'
import { trainerSpriteUrl } from './trainerSprite'
import { missionText, useT, type Translate } from './i18n'

interface Props {
  // The phone layout's Modes page: only the Battle Tower, Draft and Horde cards (and their
  // Continue banners), which its bottom bar gathers behind one button.
  modesOnly?: boolean
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
  onItems: () => void
  onPokedex: () => void
  onRewards: () => void
  onOptions: () => void
}

// Where a draft in progress stands, for its Continue banner.
function draftProgress(draft: DraftView, t: Translate): string {
  if (draft.status === 'drafting') return t('home.draftPicking', { round: draft.round, rounds: DRAFT_ROUNDS })
  if (draft.status === 'modifier') return t('home.draftModifier')
  return draft.opponent
    ? t('home.draftRecordNext', { wins: draft.wins, losses: draft.losses, name: draft.opponent.name })
    : t('home.draftRecord', { wins: draft.wins, losses: draft.losses })
}

/**
 * Home: the hub the game opens on. One card per mode, each saying where things stand
 * (the next boss, a run in progress, the coins held), a banner to jump back into a run,
 * and the day's missions. Clicking a card opens that mode's page, like the sidebar does.
 */
function HomeHub({
  modesOnly = false,
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
  onItems,
  onPokedex,
  onRewards,
  onOptions
}: Props): React.JSX.Element {
  const t = useT()
  const [coins, setCoins] = useState<number | null>(null)
  useEffect(() => {
    window.api
      .getCoins()
      .then(setCoins)
      .catch(() => setCoins(null))
  }, [])
  // The best Horde run, for its card.
  const [hordeBest, setHordeBest] = useState<HordeRecord | null>(null)
  useEffect(() => {
    window.api
      .getHordeBest()
      .then(setHordeBest)
      .catch(() => setHordeBest(null))
  }, [])
  // The DexNav hunt, so the Catch card can show a chain in progress.
  const [dexNav, setDexNav] = useState<DexNavState | null>(null)
  useEffect(() => {
    window.api
      .getDexNavState()
      .then(setDexNav)
      .catch(() => setDexNav(null))
  }, [])
  const dexNavChain = dexNav?.owned && dexNav.target && dexNav.chain > 0 ? dexNav : null
  // A draft still going (drafting or battling), for its own Continue banner.
  const [draft, setDraft] = useState<DraftView | null>(null)
  useEffect(() => {
    window.api
      .getDraft()
      .then(setDraft)
      .catch(() => setDraft(null))
  }, [])
  const draftActive = !!draft && draft.status !== 'finished'

  const runActive = run?.status === 'active'
  const nextBoss = eligibility?.nextBoss ?? null
  const raidsUnlocked = !!eligibility?.raidsUnlocked
  const crystals = eligibility?.wishingPieces ?? 0
  // The windows the sidebar's lower buttons open, repeated as small buttons under the cards.
  const tools: { label: string; icon: string; smooth?: boolean; action: () => void; badge?: number }[] = [
    { label: t('nav.items'), icon: './icons/nav/bag.png', action: onItems },
    { label: t('nav.pokedex'), icon: './icons/nav/pokedex.png', action: onPokedex },
    { label: t('nav.achievements'), icon: './icons/nav/achievements.png', action: onRewards, badge: rewardsWaiting },
    { label: t('nav.options'), icon: './icons/nav/options.png', action: onOptions }
  ]

  return (
    <div className="home-hub">
      {/* A banner per run in progress; with both, they sit side by side. */}
      {((runActive && run) || (draftActive && draft)) && (
        <div className="home-continues">
          {runActive && run && (
            <button className="home-continue" onClick={(e) => onGo('roguelite', e.currentTarget)}>
              <img className="home-continue-icon" src="./icons/nav/roguelite.png" alt="" />
              <span className="home-continue-text">
                <span className="home-continue-title">{t('home.continueRun')}</span>
                <span className="home-continue-sub">
                  {t('home.runLine', { floor: run.floor, count: run.team.length, boss: run.nextBossLabel })}
                </span>
              </span>
              <span className="home-continue-go">{t('common.continue')}</span>
            </button>
          )}
          {draftActive && draft && (
            <button className="home-continue home-continue-draft" onClick={(e) => onGo('draft', e.currentTarget)}>
              <img className="home-continue-icon" src="./icons/nav/draft.png" alt="" />
              <span className="home-continue-text">
                <span className="home-continue-title">{t('home.continueDraft')}</span>
                <span className="home-continue-sub">
                  {t(`draftFormat.${draft.format}`)} · {draftProgress(draft, t)}
                </span>
              </span>
              <span className="home-continue-go">{t('common.continue')}</span>
            </button>
          )}
        </div>
      )}

      <div className={`home-grid${modesOnly ? ' home-grid-modes' : ''}`}>
        {!modesOnly && (
        <button className="home-card home-card-classic" onClick={(e) => onGo('classic', e.currentTarget)}>
          <span className="home-card-key">3</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/challenge.png" alt="" />
            <span className="home-card-title">{t('nav.battles')}</span>
          </span>
          <span className="home-classic-body">
            <span className="home-card-lines">
              {levelCap !== null && <span className="home-card-stat">{t('home.levelCap', { cap: levelCap })}</span>}
              <span className="home-card-sub">{bossHint}</span>
            </span>
            {nextBoss && !eligibility?.allBossesDefeated && (
              <img className="home-classic-boss" src={trainerSpriteUrl(nextBoss.spriteId || 'giovanni')} alt="" />
            )}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>
        )}

        <button className="home-card home-card-roguelite" onClick={(e) => onGo('roguelite', e.currentTarget)}>
          <span className="home-card-key">4</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/roguelite.png" alt="" />
            <span className="home-card-title">{t('nav.tower')}</span>
          </span>
          <span className="home-card-sub">
            {runActive && run
              ? t('home.runInProgress', { floor: run.floor })
              : bestFloor
              ? bestFloor.difficulty
                ? t('home.bestFloorDifficulty', { floor: bestFloor.floor, difficulty: t(`difficulty.${bestFloor.difficulty}`) })
                : t('home.bestFloor', { floor: bestFloor.floor })
              : t('home.towerPitch')}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>

        <button className="home-card home-card-draft" onClick={(e) => onGo('draft', e.currentTarget)}>
          <span className="home-card-key">5</span>
          <span className="home-card-head">
            <span className="home-card-icon home-card-icon-tile">
              <img className="home-card-icon-draft" src="./icons/nav/draft.png" alt="" />
            </span>
            <span className="home-card-title">{t('nav.draft')}</span>
          </span>
          <span className="home-card-sub">
            {draftActive && draft ? t('home.draftInProgress', { progress: draftProgress(draft, t) }) : t('home.draftPitch')}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>

        {!modesOnly && (
        <>
        <button className="home-card home-card-raid" onClick={(e) => onGo('raid', e.currentTarget)}>
          <span className="home-card-key">6</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./sprites/misc/raidcrystal.png" alt="" />
            <span className="home-card-title">{raidsUnlocked ? t('nav.raid') : `🔒 ${t('nav.raid')}`}</span>
          </span>
          <span className="home-card-sub">
            {raidsUnlocked
              ? t('home.raidCrystals', { count: crystals })
              : t('home.raidLocked', { boss: eligibility?.raidUnlockBoss ?? t('home.moreBosses') })}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>

        <button className="home-card home-card-corner" onClick={(e) => onGo('corner', e.currentTarget)}>
          <span className="home-card-key">7</span>
          <span className="home-card-head">
            <img className="home-card-icon" src="./icons/nav/gamecorner.png" alt="" />
            <span className="home-card-title">{t('nav.corner')}</span>
          </span>
          <span className="home-card-sub">
            <CoinIcon /> {coins === null ? '…' : t('home.coins', { count: coins })}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>
        </>
        )}

        <button className="home-card home-card-horde" onClick={(e) => onGo('horde', e.currentTarget)}>
          <span className="home-card-key">8</span>
          <span className="home-card-head">
            <span className="home-card-icon home-card-icon-tile">
              <HordeIcon className="home-card-icon-horde" />
            </span>
            <span className="home-card-title">{t('nav.horde')}</span>
          </span>
          <span className="home-card-sub">
            {hordeBest
              ? t('home.hordeBest', {
                  time: hordeBest.won
                    ? t('horde.clearedPlus', { time: formatHordeTime(hordeBest.survivedMs - HORDE_DURATION_MS) })
                    : formatHordeTime(hordeBest.survivedMs),
                  kos: hordeBest.kos
                })
              : t('home.hordePitch')}
          </span>
          <span className="home-card-go">{t('common.open')}</span>
        </button>

        {!modesOnly && (
        <div className="home-pair">
          <button className="home-card home-card-catch" onClick={(e) => onGo('catch', e.currentTarget)}>
            <span className="home-card-key">1</span>
            <span className="home-card-head">
              <img className="home-card-icon" src="./icons/nav/classic.png" alt="" />
              <span className="home-card-title">{t('nav.catch')}</span>
            </span>
            {dexNavChain?.target ? (
              <span className="home-dexnav" title={t('home.dexNavHunting', { species: dexNavChain.target.species })}>
                <SpriteImage
                  style="3d-static"
                  className="home-dexnav-sprite"
                  spriteId={toSpriteId(dexNavChain.target.species)}
                  alt={dexNavChain.target.species}
                />
                <span className="home-dexnav-info">
                  <span className="home-dexnav-name">{dexNavChain.target.species}</span>
                  <span className="home-card-sub">
                    {t('home.chain', { chain: dexNavChain.chain })}
                    {dexNavChain.chain >= dexNavChain.maxChain && ' · MAX'}
                  </span>
                  <span className="dexnav-chain-bar home-dexnav-bar">
                    <span style={{ width: `${(Math.min(dexNavChain.chain, dexNavChain.maxChain) / dexNavChain.maxChain) * 100}%` }} />
                  </span>
                </span>
              </span>
            ) : (
              <span className="home-card-sub">{t('home.catchPitch')}</span>
            )}
            <span className="home-card-go">{t('common.open')}</span>
          </button>

          <button className="home-card home-card-box" onClick={(e) => onGo('box', e.currentTarget)}>
            <span className="home-card-key">2</span>
            <span className="home-card-head">
              <img className="home-card-icon" src="./icons/nav/box.png" alt="" />
              <span className="home-card-title">{t('nav.box')}</span>
            </span>
            <span className="home-card-sub">
              {boxCount === null ? t('home.boxPitch') : t('home.boxCount', { count: boxCount })}
            </span>
            <span className="home-card-go">{t('common.open')}</span>
          </button>
        </div>
        )}

        {!modesOnly && missions && (
          <button className="home-missions" onClick={onOpenMissions}>
            <span className="home-missions-head">
              <img className="home-card-icon" src="./icons/nav/missions.png" alt="" />
              {t('home.missions')}
            </span>
            {missions.missions.map((m) => {
              const done = m.progress >= m.goal
              return (
                <span
                  key={m.slot}
                  className={`home-mission home-mission-${m.tier}${m.claimed ? ' home-mission-claimed' : done ? ' home-mission-done' : ''}`}
                >
                  <span className="home-mission-text">{missionText(m.templateId, m.text)}</span>
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

      {!modesOnly && (
      <div className="home-tools">
        {tools.map((tool) => (
          <button key={tool.label} className="home-tool" onClick={tool.action}>
            <img className={`home-tool-icon${tool.smooth ? ' home-tool-icon-smooth' : ''}`} src={tool.icon} alt="" />
            {tool.label}
            {!!tool.badge && <span className="home-tool-badge">{tool.badge}</span>}
          </button>
        ))}
      </div>
      )}
    </div>
  )
}

export default HomeHub
