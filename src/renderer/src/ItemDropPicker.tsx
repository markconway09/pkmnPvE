import type { ItemOptionEntry } from '../../shared/battle-types'

interface Props {
  label: string
  items: ItemOptionEntry[]
  itemId: string | null
  chance: number
  onChangeItem: (id: string | null) => void
  onChangeChance: (chance: number) => void
}

function ItemDropPicker({ label, items, itemId, chance, onChangeItem, onChangeChance }: Props): React.JSX.Element {
  return (
    <label className="editor-field editor-field-full">
      <span>{label}</span>
      <div className="item-drop-picker">
        <select value={itemId ?? ''} onChange={(e) => onChangeItem(e.target.value || null)}>
          <option value="">(No drop)</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {itemId && (
          <span className="item-drop-chance">
            <input
              type="number"
              min={0}
              max={100}
              value={chance}
              onChange={(e) => onChangeChance(Number(e.target.value))}
            />
            <span>%</span>
          </span>
        )}
      </div>
    </label>
  )
}

export default ItemDropPicker
