import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AutoSetOption, EditablePokemonSet, EditorOptions, SpeciesEditInfo, StatBlock } from '../../shared/battle-types'
import { NON_HELD_ITEM_IDS, toSpriteId } from '../../shared/battle-types'
import type { NatureOptionEntry } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import { itemIconStyle } from './itemIcon'

export type PokemonEditorSource = { kind: 'box'; monId: string } | { kind: 'premadeTeam'; teamId: string; monId: string }

function fetchMonSet(source: PokemonEditorSource): Promise<EditablePokemonSet> {
  return source.kind === 'box'
    ? window.api.getMonSet(source.monId)
    : window.api.getTeamMonSet(source.teamId, source.monId)
}

function saveMonSet(source: PokemonEditorSource, set: EditablePokemonSet, isAdmin: boolean): Promise<unknown> {
  return source.kind === 'box'
    ? window.api.updateBoxMon(source.monId, set, isAdmin)
    : window.api.updateTeamMon(source.teamId, source.monId, set)
}

function sourceKey(source: PokemonEditorSource): string {
  return source.kind === 'box' ? `box:${source.monId}` : `team:${source.teamId}:${source.monId}`
}

interface Props {
  source: PokemonEditorSource
  // Forces admin (unrestricted) mode even for a 'box' source - used by the
  // player-facing "Admin Edit" context menu option. Defaults to whatever
  // source.kind already implies (premadeTeam is always admin, box never is).
  admin?: boolean
  onClose: () => void
  onSaved: () => void
}

const STAT_LABELS: { key: keyof StatBlock; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' }
]

const STAT_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(STAT_LABELS.map((s) => [s.key, s.label]))

function natureLabel(n: NatureOptionEntry): string {
  if (!n.plus || !n.minus || n.plus === n.minus) return `${n.name} (Neutral)`
  return `${n.name} (+${STAT_LABEL_BY_KEY[n.plus]}, -${STAT_LABEL_BY_KEY[n.minus]})`
}

const GENDER_LABELS: Record<string, string> = { M: 'Male', F: 'Female', N: 'Genderless' }
const EV_TOTAL_CAP = 510

function evMax(evs: StatBlock, stat: keyof StatBlock): number {
  const otherTotal = STAT_LABELS.reduce((sum, s) => sum + (s.key === stat ? 0 : evs[s.key]), 0)
  return Math.max(0, Math.min(252, EV_TOTAL_CAP - otherTotal))
}

// The in-game stat formula (same as computeStats in sim-access.ts), so the
// editor can show what the sliders, IVs, level and nature add up to as they change.
function finalStat(
  stat: keyof StatBlock,
  base: number,
  level: number,
  iv: number,
  ev: number,
  nature: NatureOptionEntry | undefined
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100)
  if (stat === 'hp') return base === 1 ? 1 : core + level + 10
  let value = core + 5
  if (nature?.plus === stat && nature.minus !== stat) value = Math.floor(value * 1.1)
  if (nature?.minus === stat && nature.plus !== stat) value = Math.floor(value * 0.9)
  return value
}

type ActiveSelector = 'species' | 'ability' | 'item' | 0 | 1 | 2 | 3 | null

function PokemonEditor({ source, admin, onClose, onSaved }: Props): React.JSX.Element {
  // Premade team rosters are admin/debug tooling, not the player's own
  // Pokemon - they keep every option (no bag restriction, no level-gated
  // movepool) regardless of whatever limits get added to the player-facing
  // (box) side later. A box mon can also be opened in admin mode explicitly
  // (the "Admin Edit" context menu option) without changing what kind of
  // source it is.
  const isAdmin = admin ?? source.kind === 'premadeTeam'
  const [options, setOptions] = useState<EditorOptions | null>(null)
  const [bagItemIds, setBagItemIds] = useState<Set<string> | null>(null)
  const [speciesInfo, setSpeciesInfo] = useState<SpeciesEditInfo | null>(null)
  const [set, setSet] = useState<EditablePokemonSet | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Premade team Pokemon can have a level that follows the player's level cap
  // (see capOffset); this is the cap it's shown against.
  const isTeamMon = source.kind === 'premadeTeam'
  const [levelCap, setLevelCap] = useState<number | null>(null)
  useEffect(() => {
    if (!isTeamMon) return
    window.api
      .getProgression()
      .then((p) => setLevelCap(p.levelCap))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [activeSelector, setActiveSelector] = useState<ActiveSelector>(null)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [abilityQuery, setAbilityQuery] = useState('')
  const [itemQuery, setItemQuery] = useState('')
  const [moveQuery, setMoveQuery] = useState('')

  // Auto-fill: the sets on offer for this species (Smogon's, then Random Battle
  // roles, then one worked out from its stats - see auto-sets.ts), the one picked,
  // and what had to change to fit the game's rules the last time one was applied.
  const [autoSets, setAutoSets] = useState<AutoSetOption[]>([])
  const [autoSetId, setAutoSetId] = useState('')
  const [autoNotes, setAutoNotes] = useState<string[] | null>(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const speciesForSets = set?.species
  useEffect(() => {
    if (!speciesForSets) return
    let cancelled = false
    window.api
      .listAutoSets(speciesForSets)
      .then((options) => {
        if (cancelled) return
        setAutoSets(options)
        setAutoSetId(options[0]?.id ?? '')
        setAutoNotes(null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [speciesForSets])

  async function applyAutoSet(): Promise<void> {
    if (!set || !autoSetId) return
    setAutoBusy(true)
    try {
      const result = await window.api.buildAutoSet(set.species, set.level, autoSetId, isAdmin)
      setSet((prev) =>
        prev
          ? {
              ...prev,
              moves: [0, 1, 2, 3].map((i) => result.moves[i] ?? ''),
              ability: result.ability ?? prev.ability,
              item: result.item ?? prev.item,
              nature: result.nature,
              evs: result.evs,
              ivs: result.ivs,
              teraType: result.teraType ?? prev.teraType
            }
          : prev
      )
      setAutoNotes(result.notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAutoBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const [opts, mon, bag] = await Promise.all([
          window.api.getEditorOptions(),
          fetchMonSet(source),
          isAdmin ? Promise.resolve(null) : window.api.listBag()
        ])
        if (cancelled) return
        setOptions(opts)
        setBagItemIds(bag ? new Set(bag.map((i) => i.id)) : null)
        setSet(mon)
        const info = await window.api.getSpeciesInfo(mon.species, isAdmin ? 100 : mon.level)
        if (cancelled) return
        setSpeciesInfo(info)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey(source)])

  function update<K extends keyof EditablePokemonSet>(key: K, value: EditablePokemonSet[K]): void {
    setSet((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateEv(stat: keyof StatBlock, rawValue: number): void {
    setSet((prev) => {
      if (!prev) return prev
      const max = evMax(prev.evs, stat)
      const clamped = Math.max(0, Math.min(max, Math.round(rawValue / 4) * 4))
      return { ...prev, evs: { ...prev.evs, [stat]: clamped } }
    })
  }

  function updateIv(stat: keyof StatBlock, rawValue: number): void {
    setSet((prev) => {
      if (!prev) return prev
      const clamped = Math.max(0, Math.min(31, Math.round(rawValue)))
      return { ...prev, ivs: { ...prev.ivs, [stat]: clamped } }
    })
  }

  async function updateLevel(rawValue: number): Promise<void> {
    const level = Math.max(1, Math.min(100, Number.isFinite(rawValue) ? Math.round(rawValue) : 1))
    setSet((prev) => (prev ? { ...prev, level } : prev))
    if (!set) return
    if (isAdmin) return // movepool is already unrestricted, no need to refetch on level change
    try {
      const info = await window.api.getSpeciesInfo(set.species, level)
      setSpeciesInfo(info)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Ties the level to the cap (offset = levels below it) or back to a fixed level.
  function updateCapOffset(offset: number | null): void {
    setSet((prev) => {
      if (!prev) return prev
      if (offset === null) return { ...prev, capOffset: null }
      const clamped = Math.max(0, Math.min(99, Number.isFinite(offset) ? Math.round(offset) : 0))
      const level = levelCap !== null ? Math.max(1, Math.min(100, levelCap - clamped)) : prev.level
      return { ...prev, capOffset: clamped, level }
    })
  }

  function updateMove(index: number, id: string): void {
    setSet((prev) => {
      if (!prev) return prev
      const moves = [prev.moves[0] ?? '', prev.moves[1] ?? '', prev.moves[2] ?? '', prev.moves[3] ?? '']
      moves[index] = id
      return { ...prev, moves }
    })
  }

  function updateNickname(raw: string): void {
    setSet((prev) => {
      if (!prev) return prev
      return { ...prev, name: raw.trim() === '' ? prev.species : raw }
    })
  }

  async function handleSpeciesChange(newSpecies: string): Promise<void> {
    if (!newSpecies) return
    setSet((prev) => {
      if (!prev) return prev
      // A form's default name can be its plain species ("Oinkologne" for Oinkologne-F).
      const wasDefaultName = prev.name === prev.species || prev.species.startsWith(`${prev.name}-`)
      return {
        ...prev,
        species: newSpecies,
        name: wasDefaultName ? newSpecies : prev.name,
        moves: ['', '', '', '']
      }
    })
    try {
      const info = await window.api.getSpeciesInfo(newSpecies, isAdmin ? 100 : (set?.level ?? 1))
      setSpeciesInfo(info)
      setSet((prev) => {
        if (!prev || prev.species !== newSpecies) return prev
        return {
          ...prev,
          ability: info.abilities[0]?.name ?? '',
          gender: info.genders.includes(prev.gender) ? prev.gender : info.genders[0]
        }
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function save(): Promise<void> {
    if (!set) return
    setSaving(true)
    setError(null)
    try {
      await saveMonSet(source, set, isAdmin)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function handleFormFocus(e: React.FocusEvent<HTMLDivElement>): void {
    const field = (e.target as HTMLElement).dataset.selectorField
    if (field === 'species') {
      setActiveSelector('species')
      setSpeciesQuery(set?.species ?? '')
    } else if (field === 'ability') {
      setActiveSelector('ability')
      setAbilityQuery(set?.ability ?? '')
    } else if (field === 'item') {
      setActiveSelector('item')
      setItemQuery(set?.item ?? '')
    } else if (field?.startsWith('move-')) {
      setActiveSelector(Number(field.slice(5)) as 0 | 1 | 2 | 3)
      setMoveQuery('')
    } else {
      setActiveSelector(null)
    }
  }

  function handleSelectorKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      setActiveSelector(null)
      ;(e.target as HTMLElement).blur()
    }
  }

  function moveDisplayName(id: string): string {
    if (!id) return ''
    return speciesInfo?.moves.find((m) => m.id === id)?.name ?? id
  }

  const evTotal = set ? STAT_LABELS.reduce((sum, { key }) => sum + set.evs[key], 0) : 0
  const nicknameValue = set && set.name === set.species ? '' : (set?.name ?? '')
  const baseStats = options?.species.find((s) => s.name === set?.species)?.baseStats
  const nature = options?.natures.find((n) => n.name === set?.nature)

  const speciesResults =
    options && activeSelector === 'species'
      ? options.species.filter((s) => s.name.toLowerCase().includes(speciesQuery.toLowerCase()))
      : []
  const abilityResults =
    speciesInfo && activeSelector === 'ability'
      ? speciesInfo.abilities.filter((a) => a.name.toLowerCase().includes(abilityQuery.toLowerCase()))
      : []
  const itemResults =
    options && (isAdmin || bagItemIds) && activeSelector === 'item'
      ? options.items.filter(
          (i) =>
            !NON_HELD_ITEM_IDS.has(i.id) &&
            (isAdmin || bagItemIds!.has(i.id)) &&
            i.name.toLowerCase().includes(itemQuery.toLowerCase())
        )
      : []
  const currentItemSpritenum = options?.items.find((i) => i.name === set?.item)?.spritenum
  const moveResults =
    speciesInfo && typeof activeSelector === 'number'
      ? speciesInfo.moves.filter((m) => m.name.toLowerCase().includes(moveQuery.toLowerCase()))
      : []

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-row" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-panel pokemon-editor">
          <h2>Edit Pokemon</h2>
          {!(options && set && speciesInfo) && !error && <p>Loading...</p>}
          {options && set && speciesInfo && (
            <div className="editor-form" onFocus={handleFormFocus}>
              <label className="editor-field">
                <span>Nickname</span>
                <input
                  type="text"
                  value={nicknameValue}
                  placeholder={set.species}
                  onChange={(e) => updateNickname(e.target.value)}
                />
              </label>

              {isAdmin && (
                <label className="editor-field">
                  <span>Species</span>
                  <input
                    type="text"
                    data-selector-field="species"
                    value={activeSelector === 'species' ? speciesQuery : set.species}
                    placeholder="Species"
                    onChange={(e) => setSpeciesQuery(e.target.value)}
                    onKeyDown={handleSelectorKeyDown}
                  />
                </label>
              )}

              {isAdmin && (
                <label className="editor-field">
                  <span>Level</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={set.level}
                    disabled={typeof set.capOffset === 'number'}
                    title={typeof set.capOffset === 'number' ? 'Set by the level cap - untick "Level follows the cap" to fix it' : undefined}
                    onChange={(e) => void updateLevel(Number(e.target.value))}
                  />
                </label>
              )}

              {isTeamMon && (
                <div className="editor-field editor-cap-offset">
                  <label className="editor-field-checkbox">
                    <input
                      type="checkbox"
                      checked={typeof set.capOffset === 'number'}
                      onChange={(e) => updateCapOffset(e.target.checked ? Math.max(0, (levelCap ?? set.level) - set.level) : null)}
                    />
                    <span>Level follows the cap</span>
                  </label>
                  {typeof set.capOffset === 'number' && (
                    <span className="editor-cap-offset-detail">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={set.capOffset}
                        onChange={(e) => updateCapOffset(Number(e.target.value))}
                      />{' '}
                      below the cap
                      {levelCap !== null && (
                        <span className="editor-hint">
                          {' '}
                          (Lv {set.level} at the current cap of {levelCap})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <label className="editor-field">
                <span>Gender</span>
                <select value={set.gender} onChange={(e) => update('gender', e.target.value)}>
                  {speciesInfo.genders.map((g) => (
                    <option key={g} value={g}>
                      {GENDER_LABELS[g] ?? g}
                    </option>
                  ))}
                </select>
              </label>

              {isAdmin && (
                <label className="editor-field editor-field-checkbox">
                  <span>Shiny</span>
                  <input type="checkbox" checked={set.shiny} onChange={(e) => update('shiny', e.target.checked)} />
                </label>
              )}

              {isAdmin && (
                <label className="editor-field">
                  <span>Happiness</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={set.happiness}
                    onChange={(e) => update('happiness', Number(e.target.value))}
                  />
                </label>
              )}

              <label className="editor-field">
                <span>Ability</span>
                <input
                  type="text"
                  data-selector-field="ability"
                  value={activeSelector === 'ability' ? abilityQuery : set.ability}
                  placeholder="Ability"
                  onChange={(e) => setAbilityQuery(e.target.value)}
                  onKeyDown={handleSelectorKeyDown}
                />
              </label>

              <label className="editor-field">
                <span>Item</span>
                <div className="editor-field-with-icon">
                  {set.item && currentItemSpritenum !== undefined && (
                    <span style={itemIconStyle(currentItemSpritenum)} />
                  )}
                  <input
                    type="text"
                    data-selector-field="item"
                    value={activeSelector === 'item' ? itemQuery : set.item}
                    placeholder="(None)"
                    onChange={(e) => setItemQuery(e.target.value)}
                    onKeyDown={handleSelectorKeyDown}
                  />
                </div>
              </label>

              <label className="editor-field">
                <span>Nature</span>
                <select value={set.nature} onChange={(e) => update('nature', e.target.value)}>
                  {options.natures.map((n) => (
                    <option key={n.name} value={n.name}>
                      {natureLabel(n)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="editor-field">
                <span>Tera Type</span>
                <select value={set.teraType} onChange={(e) => update('teraType', e.target.value)}>
                  {options.types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <div className="editor-section">
                <h3>Auto-fill</h3>
                <div className="auto-set-row">
                  <select value={autoSetId} onChange={(e) => setAutoSetId(e.target.value)}>
                    {autoSets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button disabled={autoBusy || !autoSetId} onClick={() => void applyAutoSet()}>
                    Apply
                  </button>
                </div>
                <p className="editor-hint">
                  Fills in moves, ability, item, nature, EVs, IVs and Tera type - check them over before saving.
                </p>
                {autoNotes && autoNotes.length > 0 && (
                  <ul className="auto-set-notes">
                    {autoNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="editor-section">
                <h3>
                  Moves <span className="editor-hint">(up to 4, {speciesInfo.moves.length} available)</span>
                </h3>
                <div className="editor-moves-grid">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      type="text"
                      data-selector-field={`move-${i}`}
                      value={activeSelector === i ? moveQuery : moveDisplayName(set.moves[i] ?? '')}
                      placeholder={`Move ${i + 1}`}
                      onChange={(e) => setMoveQuery(e.target.value)}
                      onKeyDown={handleSelectorKeyDown}
                    />
                  ))}
                </div>
              </div>

              <div className="editor-section">
                <h3>
                  EVs{' '}
                  <span className="editor-hint">
                    ({evTotal}/{EV_TOTAL_CAP})
                  </span>
                </h3>
                <div className="editor-ev-row editor-ev-header">
                  <span className="editor-ev-label" />
                  <span className="editor-ev-base">Base</span>
                  <span className="editor-ev-spacer" />
                  <span className="editor-ev-value">EVs</span>
                  <span className="editor-ev-stat">Stat</span>
                </div>
                {STAT_LABELS.map(({ key, label }) => {
                  const natureMark =
                    nature && nature.plus !== nature.minus
                      ? nature.plus === key
                        ? ' editor-ev-stat-up'
                        : nature.minus === key
                          ? ' editor-ev-stat-down'
                          : ''
                      : ''
                  return (
                    <div key={key} className="editor-ev-row">
                      <span className="editor-ev-label">{label}</span>
                      <span className="editor-ev-base">{baseStats?.[key] ?? '—'}</span>
                      <input
                        type="range"
                        min={0}
                        max={252}
                        step={4}
                        value={set.evs[key]}
                        onChange={(e) => updateEv(key, Number(e.target.value))}
                      />
                      <span className="editor-ev-value">{set.evs[key]}</span>
                      <span className={`editor-ev-stat${natureMark}`}>
                        {baseStats
                          ? finalStat(key, baseStats[key], set.level, set.ivs[key], set.evs[key], nature)
                          : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="editor-section">
                <h3>IVs</h3>
                <div className="editor-stats-grid">
                  {STAT_LABELS.map(({ key, label }) => (
                    <label key={key} className="editor-stat-field">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        value={set.ivs[key]}
                        onChange={(e) => updateIv(key, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {error && <p className="editor-error">{error}</p>}
          <div className="editor-actions">
            <button onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button onClick={() => void save()} disabled={saving || !set}>
              Save
            </button>
          </div>
        </div>

        {isAdmin && activeSelector === 'species' && (
          <div className="selector-panel">
            <div className="selector-panel-header">Species ({speciesResults.length})</div>
            <div className="selector-list">
              {speciesResults.map((s) => (
                <button
                  key={s.name}
                  className="selector-row"
                  onClick={() => {
                    void handleSpeciesChange(s.name)
                    setActiveSelector(null)
                  }}
                >
                  <SpriteImage
                    style="2d-static"
                    className="selector-row-icon"
                    spriteId={toSpriteId(s.name)}
                    draggable={false}
                  />
                  <div className="selector-row-main">
                    <div className="selector-row-title">
                      {s.name}
                      {s.types.map((t) => (
                        <span key={t} className={`type-badge type-${t.toLowerCase()}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="selector-row-sub">{s.abilities.join(' / ')}</div>
                    <div className="selector-row-stats">
                      HP {s.baseStats.hp} Atk {s.baseStats.atk} Def {s.baseStats.def} SpA {s.baseStats.spa} SpD{' '}
                      {s.baseStats.spd} Spe {s.baseStats.spe}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSelector === 'ability' && (
          <div className="selector-panel">
            <div className="selector-panel-header">Abilities ({abilityResults.length})</div>
            <div className="selector-list">
              {abilityResults.map((a) => (
                <button
                  key={a.id}
                  className="selector-row"
                  onClick={() => {
                    update('ability', a.name)
                    setActiveSelector(null)
                  }}
                >
                  <div className="selector-row-main">
                    <div className="selector-row-title">{a.name}</div>
                    <div className="selector-row-desc">{a.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSelector === 'item' && (
          <div className="selector-panel">
            <div className="selector-panel-header">Items ({itemResults.length})</div>
            <div className="selector-list">
              <button
                className="selector-row selector-row-clear"
                onClick={() => {
                  update('item', '')
                  setActiveSelector(null)
                }}
              >
                (None)
              </button>
              {!isAdmin && itemResults.length === 0 && (bagItemIds?.size ?? 0) === 0 && (
                <p className="box-empty-hint">Your bag is empty - held items come from your bag.</p>
              )}
              {itemResults.map((i) => (
                <button
                  key={i.id}
                  className="selector-row"
                  onClick={() => {
                    update('item', i.name)
                    setActiveSelector(null)
                  }}
                >
                  <span style={itemIconStyle(i.spritenum)} />
                  <div className="selector-row-main">
                    <div className="selector-row-title">{i.name}</div>
                    <div className="selector-row-desc">{i.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {typeof activeSelector === 'number' && (
          <div className="selector-panel">
            <div className="selector-panel-header">
              Move {activeSelector + 1} ({moveResults.length})
            </div>
            <div className="selector-list">
              <button
                className="selector-row selector-row-clear"
                onClick={() => {
                  updateMove(activeSelector, '')
                  setActiveSelector(null)
                }}
              >
                (None)
              </button>
              {(() => {
                const currentMoves = set?.moves ?? []
                return moveResults.map((m) => {
                  const learnedElsewhere = currentMoves.some((id, i) => id === m.id && i !== activeSelector)
                  return (
                    <button
                      key={m.id}
                      className={`selector-row ${learnedElsewhere ? 'selector-row-disabled' : ''}`}
                      disabled={learnedElsewhere}
                      onClick={() => {
                        updateMove(activeSelector, m.id)
                        setActiveSelector(null)
                      }}
                    >
                      <div className="selector-row-main">
                        <div className="selector-row-title">
                          {m.name}
                          <span className={`type-badge type-${m.type.toLowerCase()}`}>{m.type}</span>
                          {learnedElsewhere && <span className="learned-badge">Learned</span>}
                        </div>
                        <div className="selector-row-sub">
                          {m.category} · Pow {m.basePower || '—'} · Acc {m.accuracy === true ? '—' : m.accuracy} · PP{' '}
                          {m.pp}
                        </div>
                        <div className="selector-row-desc">{m.description}</div>
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default PokemonEditor
