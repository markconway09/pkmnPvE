import type { BattleRewardsView, RewardItemView } from '../../shared/battle-types'
import ItemSprite from './ItemSprite'

interface Props {
  // Null for a friendly match against another player's team, which pays nothing.
  rewards: BattleRewardsView | null
}

const SOURCE_LABELS: Record<RewardItemView['source'], string> = {
  trainer: 'Trainer',
  team: 'This team',
  wild: 'Wild'
}

// What winning the battle can pay out, with each chance - stacked under the
// opponent's Pokemon tooltip.
function RewardsTooltipContent({ rewards }: Props): React.JSX.Element {
  if (!rewards) {
    return (
      <div className="tooltip-panel rewards-tooltip">
        <div className="tooltip-title">Rewards</div>
        <div className="tooltip-row">Friendly match - no rewards</div>
      </div>
    )
  }
  const nothing = rewards.money === null && rewards.items.length === 0 && rewards.randomDropChance <= 0
  return (
    <div className="tooltip-panel rewards-tooltip">
      <div className="tooltip-title">Rewards for winning</div>
      {rewards.money !== null && (
        <div className="rewards-row">
          <span className="rewards-money">₽{rewards.money.toLocaleString('en-US')}</span>
          <span className="rewards-chance">100%</span>
        </div>
      )}
      {rewards.items.map((item, i) => (
        <div key={`${item.itemId}-${i}`} className="rewards-row">
          <ItemSprite spritenum={item.spritenum} />
          <span className="rewards-name">{item.itemName}</span>
          <span className="rewards-source">{SOURCE_LABELS[item.source]}</span>
          <span className="rewards-chance">{item.chance}%</span>
        </div>
      ))}
      {rewards.randomDropChance > 0 && (
        <div className="rewards-row">
          <span className="rewards-random-icon">?</span>
          <span className="rewards-name">A random item</span>
          <span className="rewards-chance">{rewards.randomDropChance}%</span>
        </div>
      )}
      {nothing && <div className="tooltip-row">No item drops</div>}
    </div>
  )
}

export default RewardsTooltipContent
