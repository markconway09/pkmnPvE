import type { ComponentProps } from 'react'
import type { BoxPokemonView, RunView } from '../../shared/battle-types'
import { ROGUELITE_START_LEVEL, runBossCount, runDifficultyInfo } from '../../shared/battle-types'
import type { OnlinePlayer } from '../../shared/online'
import type { OnlineCoopState } from './online'
import RoguelitePanel, { StarterSlot } from './RoguelitePanel'
import PokemonIconVisual from './PokemonIconVisual'
import PokemonTooltipContent from './PokemonTooltipContent'
import Tooltip from './Tooltip'
import ItemSprite from './ItemSprite'
import { trainerSpriteUrl } from './trainerSprite'
import { clickWord, itemName, t } from './i18n'

// The run screen's handlers, as MainMenu wires them (the same as a solo run's).
type RunHandlers = Omit<
  ComponentProps<typeof RoguelitePanel>,
  'run' | 'picked' | 'busy' | 'bestFloor' | 'onStart' | 'onChoose' | 'api' | 'hudExtra' | 'floorOverride' | 'forfeitConfirm'
>

interface Props {
  coop: OnlineCoopState
  friend: OnlinePlayer
  // This player's co-op run (whichever it is - only the one with this room's seed counts).
  run: RunView | null
  // The box Pokemon dropped on the starter slot.
  picked: BoxPokemonView | undefined
  busy: boolean
  // The host's copy is setting the fight up.
  starting: boolean
  onStart: () => void
  onChoose: (index: number) => void
  onCancelReady: () => void
  onLeave: () => void
  handlers: RunHandlers
}

/**
 * A co-op Battle Tower run on the Battle page (see shared/online.ts): picking a starter,
 * then the run itself - the usual run screen, with the friend's progress along the top and
 * a waiting room while one of them is at a boss or villain before the other.
 */
function CoopRunPanel({ coop, friend, run, picked, busy, starting, onStart, onChoose, onCancelReady, onLeave, handlers }: Props): React.JSX.Element {
  const mine = run?.coop?.seed === coop.setup.seed ? run : null
  const partner = coop.partner?.seed === coop.setup.seed ? coop.partner : null
  const info = runDifficultyInfo(coop.setup.difficulty)
  const settings = `${info.label}${coop.setup.generation ? t('tower.gen', { n: coop.setup.generation }) : ''}`

  // Where the friend is, in a few words.
  const partnerStatus = !coop.partner
    ? t('coop.connecting')
    : !partner || partner.status === 'none'
      ? t('coop.picking')
      : partner.status === 'lost'
        ? t('coop.runOver')
        : partner.status === 'won'
          ? t('coop.runWon')
          : partner.ready
            ? partner.ready.kind === 'boss'
              ? t('coop.waitingAtBoss')
              : t('coop.waitingAtVillain')
            : t('coop.floor', { n: partner.floor })

  // The friend: who they are, where they are and their team (names and details on hover).
  const partnerStrip = (
    <div className="coop-partner">
      <img className="coop-partner-sprite" src={trainerSpriteUrl(friend.spriteId)} alt="" />
      <span className="coop-partner-text">
        <span className="coop-partner-name">{friend.name}</span>
        <span className={`coop-partner-status${partner?.ready ? ' coop-partner-ready' : ''}`}>{partnerStatus}</span>
      </span>
      <span className="coop-partner-team">
        {(partner?.team ?? []).map((mon, i) => (
          <Tooltip key={`${mon.id}-${i}`} className="coop-partner-mon" placement="below" content={<PokemonTooltipContent pokemon={mon} />}>
            <PokemonIconVisual mon={{ ...mon, expPercent: undefined }} />
            <span className="coop-partner-mon-level">{t('tower.lv', { level: mon.level })}</span>
          </Tooltip>
        ))}
      </span>
      <button className="coop-leave" disabled={busy || starting} title={t('coop.leaveTip')} onClick={onLeave}>
        {t('coop.leave')}
      </button>
    </div>
  )

  if (!mine) {
    // Picking a starter: the room's settings are the host's, the starter this player's own.
    return (
      <div className="run-panel run-setup coop-setup">
        <div className={`run-setup-card run-hud-${coop.setup.difficulty}`}>
          <div className="run-starter-row">
            <div className="run-starter-column">
              <span className="run-hud-label">{t('tower.starter')}</span>
              <div
                className={`run-starter-pedestal${picked ? ' run-starter-pedestal-filled' : ''}`}
                title={t('tower.starterTip', { level: ROGUELITE_START_LEVEL })}
              >
                <StarterSlot picked={picked} />
              </div>
              <span className="run-starter-name">
                {picked ? t('tower.starterName', { name: picked.species, level: ROGUELITE_START_LEVEL }) : t('tower.dragHere')}
              </span>
              <button className={`run-start-button${picked ? ' run-start-ready' : ''}`} disabled={busy || !picked} onClick={onStart}>
                {picked ? t('coop.start') : t('tower.pickStarter')}
              </button>
            </div>
            <div className="run-settings">
              <div className="run-setup-header">
                <span className="run-hud-label">{t('coop.title')}</span>
                <span className={`run-difficulty-tag run-difficulty-${coop.setup.difficulty}`}>{settings}</span>
              </div>
              <p className="run-difficulty-text">{t('coop.rules', { name: friend.name })}</p>
              {partnerStrip}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mine.status !== 'active') {
    // The run is over: how it went, its rewards, and the way back to the room.
    return (
      <div className="run-panel run-setup coop-setup">
        <div className={`run-result ${mine.status === 'won' ? 'run-result-won' : 'run-result-lost'}`}>
          <span className="run-result-title">{mine.status === 'won' ? t('coop.wonTogether') : t('coop.over')}</span>
          <span className="run-result-summary">
            {mine.starterSpecies} · {runDifficultyInfo(mine.difficulty).label} ·{' '}
            {mine.status === 'won'
              ? t('tower.allBosses', { n: runBossCount(mine.difficulty) })
              : t('tower.floorBosses', { floor: mine.floor, beaten: mine.bossesBeaten, of: runBossCount(mine.difficulty) })}
          </span>
          {mine.rewards.length > 0 ? (
            <span className="run-reward-list" title={t('tower.sentToBag')}>
              {mine.rewards.map((line, i) => (
                <span
                  key={line.label}
                  className="run-reward-line"
                  style={{ '--i': i } as React.CSSProperties}
                  title={line.itemId ? `${line.quantity}× ${itemName(line.label)}` : line.label}
                >
                  {line.spritenum !== null ? (
                    <>
                      <ItemSprite spritenum={line.spritenum} />
                      {line.itemId && line.quantity > 1 ? `×${line.quantity}` : ''}
                    </>
                  ) : (
                    line.label
                  )}
                </span>
              ))}
            </span>
          ) : (
            <span className="run-result-none">{t('tower.noRewards')}</span>
          )}
        </div>
        {partnerStrip}
      </div>
    )
  }

  // Waiting at the boss (or villain) for the friend - or both are, and the fight is starting.
  const ready = coop.ready?.floor === mine.floor ? coop.ready : null
  const both = !!ready && partner?.ready?.floor === ready.floor
  const waitingRoom = ready ? (
    <div className="run-floor-pick coop-waiting">
      <p className="run-floor-title">{ready.kind === 'boss' ? mine.nextBossLabel : t('coop.villainTakeover')}</p>
      <div className="online-draft-standby coop-waiting-standby">
        <span className="online-draft-spinner" />
        <img className="coop-waiting-sprite" src={trainerSpriteUrl(friend.spriteId)} alt="" />
        <span>
          {both || starting
            ? t('coop.starting', { name: friend.name })
            : partner?.status === 'active'
              ? t('coop.waitingFloor', { name: friend.name, floor: partner.floor })
              : t('coop.waiting', { name: friend.name })}
        </span>
      </div>
      <p className="box-empty-hint">{ready.kind === 'boss' ? t('coop.bossTogether') : t('coop.villainTogether')}</p>
      <div className="run-item-row">
        <button className="run-item-button run-item-skip" disabled={both || starting} onClick={onCancelReady}>
          {t('tower.back')}
        </button>
      </div>
    </div>
  ) : null

  return (
    <RoguelitePanel
      {...handlers}
      run={mine}
      picked={undefined}
      busy={busy || !!ready}
      bestFloor={null}
      onStart={() => {}}
      onChoose={onChoose}
      api={window.api.coopRun}
      hudExtra={partnerStrip}
      floorOverride={waitingRoom}
      forfeitConfirm={t('coop.forfeit', { click: clickWord() })}
    />
  )
}

export default CoopRunPanel
