import type { BattleRewardsView, RewardItemView } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'
import { TmIcon } from './TmBits'
import { formatMoney } from './money'
import { itemName, moveName, t } from './i18n'

interface Props {
  // Null for a friendly match against another player's team, which pays nothing.
  rewards: BattleRewardsView | null
}

const SOURCE_LABELS: Record<RewardItemView['source'], 'rewards.trainer' | 'rewards.team' | 'rewards.wild'> = {
  trainer: 'rewards.trainer',
  team: 'rewards.team',
  wild: 'rewards.wild'
}

// What winning the battle can pay out, with each chance - stacked under the
// opponent's Pokemon tooltip.
function RewardsTooltipContent({ rewards }: Props): React.JSX.Element {
  if (!rewards) {
    return (
      <div className="tooltip-panel rewards-tooltip">
        <div className="tooltip-title">{t('rewards.title')}</div>
        <div className="tooltip-row">{t('rewards.friendly')}</div>
      </div>
    )
  }
  const tms = rewards.tms ?? []
  const nothing = rewards.money === null && rewards.items.length === 0 && rewards.randomDropChance <= 0 && tms.length === 0
  return (
    <div className="tooltip-panel rewards-tooltip">
      <div className="tooltip-title">{t('rewards.forWinning')}</div>
      {rewards.money !== null && (
        <div className="rewards-row">
          <span className="rewards-money">{formatMoney(rewards.money)}</span>
          <span className="rewards-chance">100%</span>
        </div>
      )}
      {rewards.items.map((item, i) => (
        <div key={`${item.itemId}-${i}`} className="rewards-row">
          <ItemSprite spritenum={item.spritenum} />
          <span className="rewards-name">{itemName(item.itemName)}</span>
          <span className="rewards-source">{t(SOURCE_LABELS[item.source])}</span>
          <span className="rewards-chance">{item.chance}%</span>
        </div>
      ))}
      {tms.map((tm) => (
        <div key={tm.moveId} className="rewards-row">
          <TmIcon type={tm.type} className="rewards-tm-icon" />
          <span className="rewards-name">{t('rewards.tm', { name: moveName(tm.name) })}</span>
          <span className="rewards-source">{t('rewards.firstWin')}</span>
          <span className="rewards-chance">100%</span>
        </div>
      ))}
      {rewards.randomDropChance > 0 && (
        <div className="rewards-row">
          <span className="rewards-random-icon">?</span>
          <span className="rewards-name">{t('rewards.randomItem')}</span>
          <span className="rewards-chance">{rewards.randomDropChance}%</span>
        </div>
      )}
      {nothing && <div className="tooltip-row">{t('rewards.noDrops')}</div>}
    </div>
  )
}

export default RewardsTooltipContent
