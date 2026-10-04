import { createPortal } from 'react-dom'
import type { AchievementsState } from '../../shared/achievements'
import type { MissionsState } from '../../shared/missions'
import TabStrip from './TabStrip'
import MissionsPanel from './MissionsPanel'
import AchievementsPanel from './AchievementsPanel'

export type RewardsTab = 'missions' | 'achievements'

interface Props {
  tab: RewardsTab
  onSwitch: (tab: RewardsTab) => void
  missions: MissionsState | null
  achievements: AchievementsState | null
  onMissionsChange: (state: MissionsState) => void
  onAchievementsChange: (state: AchievementsState) => void
  // A reward was claimed - the money, box and bag may have changed.
  onClaimed: (money: number) => void
  onClose: () => void
  // An achievement to scroll to and flash (a clicked pop-up), cleared once shown.
  focus?: string | null
  onFocused?: () => void
}

/**
 * Daily Missions and Achievements as one window, with tabs across the top to go between
 * them. A tab glows, with a count, while it has rewards waiting to be claimed.
 */
function RewardsModal({
  tab,
  onSwitch,
  missions,
  achievements,
  onMissionsChange,
  onAchievementsChange,
  onClaimed,
  onClose,
  focus,
  onFocused
}: Props): React.JSX.Element {
  // Rewards waiting: finished missions not yet claimed (and the bonus), unlocked achievements.
  const missionsWaiting = missions
    ? missions.missions.filter((m) => m.progress >= m.goal && !m.claimed).length +
      (missions.bonusReady && !missions.bonusClaimed ? 1 : 0)
    : 0
  const achievementsWaiting = achievements?.achievements.filter((a) => a.unlocked && !a.claimed).length ?? 0

  const label = (name: string, icon: string, waiting: number): React.JSX.Element => (
    <>
      <img className="bag-shop-tab-icon" src={icon} alt="" />
      {name}
      {waiting > 0 && <span className="rewards-tab-badge">{waiting}</span>}
    </>
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel rewards-modal" onMouseDown={(e) => e.stopPropagation()}>
        <TabStrip
          className="bag-shop-tabs"
          tabs={[
            {
              id: 'missions',
              label: label('Daily Missions', './icons/nav/missions.png', missionsWaiting),
              className: missionsWaiting > 0 ? 'rewards-tab-glow' : undefined
            },
            {
              id: 'achievements',
              label: label('Achievements', './icons/nav/achievements.png', achievementsWaiting),
              className: achievementsWaiting > 0 ? 'rewards-tab-glow' : undefined
            }
          ]}
          current={tab}
          onSwitch={onSwitch}
          onClose={onClose}
        />
        {tab === 'missions' ? (
          missions && <MissionsPanel state={missions} onChange={onMissionsChange} onClaimed={onClaimed} />
        ) : (
          achievements && (
            <AchievementsPanel
              state={achievements}
              onChange={onAchievementsChange}
              onClaimed={onClaimed}
              focus={focus}
              onFocused={onFocused}
            />
          )
        )}
      </div>
    </div>,
    document.body
  )
}

export default RewardsModal
