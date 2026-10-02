import { createPortal } from 'react-dom'
import { RarityGlow } from './RarityCard'
import FitName from './FitName'
import type { BoxState } from '../../shared/battle-types'
import { toSpriteId } from '../../shared/battle-types'
import { spriteUrl } from './spriteStyle'
import { STARTER_SPECIES } from './starterSpecies'

interface Props {
  onClose: () => void
  onChosen: (box: BoxState) => void
}

function StarterPicker({ onClose, onChosen }: Props): React.JSX.Element {
  async function choose(species: string): Promise<void> {
    const box = await window.api.addStarter(species)
    onChosen(box)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel starter-picker" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Choose Your Starter</h2>
        <div className="starter-grid">
          {STARTER_SPECIES.map((species) => (
            <button
              key={species}
              // Starters are all unevolved, low-BST Pokemon: the grey (common) tier.
              className="starter-option rarity-card rarity-tier-common"
              title={species}
              onClick={() => void choose(species)}
            >
              <RarityGlow size={48}>
                <img
                  className="starter-img"
                  src={spriteUrl('2d-static', 'front', toSpriteId(species))}
                  alt={species}
                  draggable={false}
                />
              </RarityGlow>
              <FitName className="starter-name" text={species} />
            </button>
          ))}
          <button className="starter-option" title="Random Unevolved" onClick={() => void choose('random')}>
            <span className="starter-random-icon">?</span>
            <span className="starter-name">Random Unevolved</span>
          </button>
        </div>
        <div className="editor-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default StarterPicker
