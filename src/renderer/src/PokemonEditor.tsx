import { useEffect, useRef, useState } from 'react'
import { loadSpriteStyle } from './spriteStyle'
import { createPortal } from 'react-dom'
import type { AutoSetOption, EditablePokemonSet, EditorOptions, SpeciesEditInfo, StatBlock, BoxPokemonView } from '../../shared/battle-types'
import { MERGE_MAX_STARS, NON_HELD_ITEM_IDS, mergeBonusText, mergeStarsFor, mergeStatMultiplier, toSpriteId } from '../../shared/battle-types'
import type { RarityTier } from '../../shared/battle-types'
import { starRow } from './MergeModal'
import type { NatureOptionEntry } from '../../shared/battle-types'
import SpriteImage from './SpriteImage'
import ItemSprite from './ItemSprite'
import ShinyIcon from './ShinyIcon'
import { itemIconStyle } from './itemIcon'
import { TYPE_COLORS } from './moveAnimations'
import ModalSpinner from './ModalSpinner'
import { TmIcon } from './TmBits'

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
  // A box Pokemon's favorite heart, in the corner of its portrait: whether it's a
  // favorite, and toggling that (straight away - not part of Save).
  favorite?: boolean
  onToggleFavorite?: () => void
  // A box Pokemon's Rare Candy, beside its level: whether one can be used (there's one
  // in the bag and it's under the level cap), and using it - which resolves to its new
  // level (null if it didn't go up).
  canUseRareCandy?: boolean
  onUseRareCandy?: () => Promise<number | null>
  // A box Pokemon's evolutions (see BoxPokemonView.evolutionPaths), listed under Auto-fill:
  // a ready one evolves it on click, like the right-click menu.
  evolutionPaths?: BoxPokemonView['evolutionPaths']
  onEvolve?: (species: string) => void
  // Its form changes (Rotom Catalog, Prison Bottle...), listed the same way.
  formChanges?: BoxPokemonView['formChanges']
  onChangeForm?: (form: string) => void
  // Opened from the right-click Change Form: scroll to the Form changes and flash them.
  focusForms?: boolean
  // A box Pokemon's merge stars: the Stat column shows them (+10% each in classic battles - less for red and gold).
  mergeStars?: number
  // And how many copies it's made of - its progress to the next star, under the portrait.
  mergeCopies?: number
  // Its rarity - red and gold Pokemon get less from each star.
  rarityTier?: RarityTier
}

// A sideways-scrolling strip (the evolutions and form changes): the mouse wheel scrolls it
// sideways too, while there's more of it to see that way - otherwise the editor scrolls as usual.
function wheelScrollsSideways(strip: HTMLDivElement | null): void {
  if (!strip || strip.dataset.wheel) return
  strip.dataset.wheel = '1'
  strip.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || strip.scrollWidth <= strip.clientWidth) return
      const atEnd = e.deltaY > 0 ? strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1 : strip.scrollLeft <= 0
      if (atEnd) return
      e.preventDefault()
      strip.scrollLeft += e.deltaY
    },
    { passive: false }
  )
}

// A box Pokemon's stars and how far it is to the next one (stars at 2, 4, 8, 16, 32 copies).
function MergeProgress({ copies, tier }: { copies: number; tier: RarityTier | undefined }): React.JSX.Element {
  const stars = mergeStarsFor(copies)
  const maxed = stars >= MERGE_MAX_STARS
  const from = 2 ** stars
  const to = 2 ** (stars + 1)
  const percent = maxed ? 100 : ((copies - from) / (to - from)) * 100
  return (
    <div className="editor-merge" title={stars > 0 ? `${mergeBonusText(stars, tier)} to all stats in classic battles` : 'Merge duplicates in to earn stars'}>
      <span className="merge-stars">{starRow(stars)}</span>
      <div className="editor-merge-bar">
        <div className="editor-merge-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="editor-merge-text">
        {copies} cop{copies === 1 ? 'y' : 'ies'}
        {maxed ? ' · fully merged' : ` · ${to - copies} more for ★${stars + 1}`}
      </span>
    </div>
  )
}

// The Rare Candy's icon (see ItemSprite).
const RARE_CANDY_SPRITENUM = -2
// The Poke Ball item icon - an evolution already in the Pokedex.
const POKE_BALL_SPRITENUM = 345

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

// The Tera Type picker in its type's colour (Stellar, which has no type colour, in a
// rainbow), with white text shadowed so it reads on the light colours too.
const STELLAR_BACKGROUND = 'linear-gradient(90deg, #e8453c, #f0a030, #f8d030, #58c060, #4890f0, #9b59d0)'

export function teraTypeStyle(type: string): React.CSSProperties {
  const color = TYPE_COLORS[type.toLowerCase()]
  return {
    background: color ?? (type === 'Stellar' ? STELLAR_BACKGROUND : undefined),
    color: '#ffffff',
    textShadow: '0 1px 2px #000'
  }
}

type ActiveSelector = 'species' | 'ability' | 'item' | 0 | 1 | 2 | 3 | null

function PokemonEditor({
  source,
  admin,
  onClose,
  onSaved,
  favorite = false,
  onToggleFavorite,
  canUseRareCandy = false,
  onUseRareCandy,
  evolutionPaths,
  onEvolve,
  formChanges,
  onChangeForm,
  focusForms = false,
  mergeStars,
  rarityTier,
  mergeCopies
}: Props): React.JSX.Element {
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
  // The set as it was opened - Save stays greyed out until something differs from it.
  const [loadedSet, setLoadedSet] = useState<string | null>(null)
  // The moves it knew when the editor opened: it keeps them at any level.
  const knownMovesRef = useRef<string[]>([])
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

  // The Form changes section only appears once the species has loaded, so it's
  // scrolled to (and highlighted) the first time it shows up.
  const formsFocusedRef = useRef(false)
  function focusFormsSection(section: HTMLDivElement | null): void {
    if (!section || !focusForms || formsFocusedRef.current) return
    formsFocusedRef.current = true
    section.scrollIntoView({ block: 'center', behavior: 'smooth' })
    section.classList.add('editor-section-highlight')
  }

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
        setLoadedSet(JSON.stringify(mon))
        knownMovesRef.current = mon.moves.filter(Boolean)
        const info = await window.api.getSpeciesInfo(mon.species, isAdmin ? 100 : mon.level, knownMovesRef.current)
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

  // Typed EVs: any number up to what's left of the 510 (the slider snaps to 4s, typing
  // doesn't). Like Showdown, a + or - after it ("252+", "0-") also picks the nature that
  // raises or lowers that stat, keeping the other half of the current nature.
  function handleEvInput(stat: keyof StatBlock, text: string): void {
    const digits = text.replace(/[^0-9]/g, '')
    const value = digits === '' ? 0 : Number(digits)
    setSet((prev) => {
      if (!prev) return prev
      const clamped = Math.max(0, Math.min(evMax(prev.evs, stat), value))
      return { ...prev, evs: { ...prev.evs, [stat]: clamped } }
    })
    const sign = text.trim().endsWith('+') ? '+' : text.trim().endsWith('-') ? '-' : null
    if (sign && stat !== 'hp') applyNatureSign(stat, sign)
  }

  function applyNatureSign(stat: keyof StatBlock, sign: '+' | '-'): void {
    if (!options || !set) return
    const current = options.natures.find((n) => n.name === set.nature)
    const neutral = !current || !current.plus || current.plus === current.minus
    let plus = neutral ? null : current!.plus
    let minus = neutral ? null : current!.minus
    if (sign === '+') {
      plus = stat
      if (minus === stat) minus = null
    } else {
      minus = stat
      if (plus === stat) plus = null
    }
    // Only one half given (from a neutral nature): the usual trade is to lower the
    // attacking stat this Pokemon uses less, and raise the one it uses more.
    const [weaker, stronger] = (['atk', 'spa'] as const)
      .slice()
      .sort((a, b) => (baseStats?.[a] ?? 0) - (baseStats?.[b] ?? 0))
    if (!minus) minus = plus === weaker ? stronger : weaker
    if (!plus) plus = minus === stronger ? weaker : stronger
    const nature = options.natures.find((n) => n.plus === plus && n.minus === minus)
    if (nature) update('nature', nature.name)
  }

  function updateIv(stat: keyof StatBlock, rawValue: number): void {
    setSet((prev) => {
      if (!prev) return prev
      const clamped = Math.max(0, Math.min(31, Math.round(rawValue)))
      return { ...prev, ivs: { ...prev.ivs, [stat]: clamped } }
    })
  }

  // A Rare Candy used from beside the level: the level here follows, so saving afterwards
  // keeps it (and the moves on offer are the new level's).
  const [usingCandy, setUsingCandy] = useState(false)
  async function useRareCandy(): Promise<void> {
    if (!onUseRareCandy) return
    setUsingCandy(true)
    try {
      const level = await onUseRareCandy()
      if (level !== null) await updateLevel(level)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUsingCandy(false)
    }
  }

  async function updateLevel(rawValue: number): Promise<void> {
    const level = Math.max(1, Math.min(100, Number.isFinite(rawValue) ? Math.round(rawValue) : 1))
    setSet((prev) => (prev ? { ...prev, level } : prev))
    if (!set) return
    if (isAdmin) return // movepool is already unrestricted, no need to refetch on level change
    try {
      const info = await window.api.getSpeciesInfo(set.species, level, knownMovesRef.current)
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
      // A new species starts with no moves, so there's nothing it already knows.
      knownMovesRef.current = []
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

  const changed = !!set && JSON.stringify(set) !== loadedSet

  async function save(): Promise<void> {
    if (!set || !changed) return
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
    // Each picker opens with an empty search - the whole list at once - and the current
    // choice showing as the placeholder, instead of having to clear it out first.
    if (field === 'species') {
      setActiveSelector('species')
      setSpeciesQuery('')
    } else if (field === 'ability') {
      setActiveSelector('ability')
      setAbilityQuery('')
    } else if (field === 'item') {
      setActiveSelector('item')
      setItemQuery('')
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
        <div className={`modal-panel pokemon-editor pokemon-editor-main${!(options && set && speciesInfo) && !error ? ' modal-panel-loading' : ''}`}>
          {!(options && set && speciesInfo) && !error && <ModalSpinner />}
          {options && set && speciesInfo && (
            <div className="pokemon-editor-layout" onFocus={handleFormFocus}>
              <div className="pokemon-editor-top">
                {/* The Pokemon itself, with its merge stars under it. */}
                <div className="pokemon-editor-side">
                  <div className="pokemon-editor-portrait" title={set.shiny ? `Shiny ${set.species}` : set.species}>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        className={`pokemon-editor-favorite${favorite ? ' pokemon-editor-favorite-on' : ''}`}
                        title={favorite ? 'Favorite - click to unfavorite' : 'Click to favorite'}
                        onClick={onToggleFavorite}
                      >
                        {favorite ? '❤️' : '🤍'}
                      </button>
                    )}
                    {/* Cosmetic only: its Gigantamax sprite everywhere, same size, no Dynamax. Saved with the rest. */}
                    {set.canGmax && (
                      <button
                        type="button"
                        className={`pokemon-editor-gmax${set.gmaxLook ? ' pokemon-editor-gmax-on' : ''}`}
                        title={set.gmaxLook ? 'Gigantamax look - click to show its usual sprite' : 'Click to show its Gigantamax sprite (cosmetic only)'}
                        onClick={() => update('gmaxLook', !set.gmaxLook)}
                      >
                        <img src={set.gmaxLook ? './sprites/misc/gmax-on.png' : './sprites/misc/gmax-off.png'} alt="" />
                      </button>
                    )}
                    {/* In the sprite style picked in Options. */}
                    <SpriteImage
                      style={loadSpriteStyle()}
                      spriteId={toSpriteId(set.species)}
                      shiny={set.shiny}
                      gmax={!!set.gmaxLook && !!set.canGmax}
                      alt={set.species}
                    />
                    <span className="pokemon-editor-portrait-name">
                      {set.shiny && <ShinyIcon />}
                      {set.species} · Lv {set.level}
                      {onUseRareCandy && (
                        <button
                          type="button"
                          className="pokemon-editor-candy"
                          disabled={!canUseRareCandy || usingCandy}
                          title={canUseRareCandy ? 'Use a Rare Candy (+1 level)' : 'No Rare Candy in your bag, or already at the level cap'}
                          onClick={() => void useRareCandy()}
                        >
                          <ItemSprite spritenum={RARE_CANDY_SPRITENUM} />
                        </button>
                      )}
                    </span>
                  </div>
                  {mergeCopies !== undefined && <MergeProgress copies={mergeCopies} tier={rarityTier} />}
                </div>

                <div className="pokemon-editor-details">
                  <div className="pokemon-editor-inline">
                    <label className="editor-field">
                      <span>Nickname</span>
                      <input
                        type="text"
                        value={nicknameValue}
                        placeholder={set.species}
                        onChange={(e) => updateNickname(e.target.value)}
                      />
                    </label>
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
                    <label className="editor-field">
                      <span>Tera Type</span>
                      <select
                        className="editor-tera-select"
                        style={teraTypeStyle(set.teraType)}
                        value={set.teraType}
                        onChange={(e) => update('teraType', e.target.value)}
                      >
                        {options.types.map((t) => (
                          <option key={t} value={t} style={teraTypeStyle(t)}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="pokemon-editor-inline pokemon-editor-inline-pair">
                    <label className="editor-field">
                      <span>Ability</span>
                      <input
                        type="text"
                        data-selector-field="ability"
                        value={activeSelector === 'ability' ? abilityQuery : set.ability}
                        placeholder={set.ability || 'Ability'}
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
                          placeholder={set.item || '(None)'}
                          onChange={(e) => setItemQuery(e.target.value)}
                          onKeyDown={handleSelectorKeyDown}
                        />
                      </div>
                    </label>
                  </div>
                  {isAdmin && (
                    <div className="pokemon-editor-inline">
                      {isAdmin && (
                        <label className="editor-field">
                          <span>Species</span>
                          <input
                            type="text"
                            data-selector-field="species"
                            value={activeSelector === 'species' ? speciesQuery : set.species}
                            placeholder={set.species || 'Species'}
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
                    </div>
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
                    {autoNotes && autoNotes.length > 0 && (
                      <ul className="auto-set-notes">
                        {autoNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* What it can evolve or change form into, in a row across the whole editor. */}
              <div className="editor-previews-row">
                {onEvolve && evolutionPaths && evolutionPaths.length > 0 && (
                  <div className="editor-section">
                    <h3>Evolutions</h3>
                    <div className="editor-evolutions" ref={wheelScrollsSideways}>
                      {evolutionPaths.map((evo) => (
                        <button
                          key={evo.species}
                          type="button"
                          className={`editor-evolution${evo.ready ? '' : ' editor-evolution-locked'}`}
                          disabled={!evo.ready}
                          title={evo.ready ? `Evolve into ${evo.species}` : `Not yet: ${evo.method}`}
                          onClick={() => onEvolve(evo.species)}
                        >
                          <SpriteImage
                            style="3d-static"
                            className="editor-evolution-sprite"
                            spriteId={toSpriteId(evo.species)}
                            shiny={set.shiny}
                            alt={evo.species}
                          />
                          <span className="editor-evolution-text">
                            <span className="editor-evolution-name">
                              {evo.species}
                              {evo.registered && (
                                <span className="context-menu-caught" title="Already in your Pokédex">
                                  <ItemSprite spritenum={POKE_BALL_SPRITENUM} />
                                </span>
                              )}
                            </span>
                            <span className="editor-evolution-method">{evo.method}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {onChangeForm && formChanges && formChanges.forms.length > 0 && (
                  <div className="editor-section" ref={focusFormsSection}>
                    {/* Many forms (Rotom, Alcremie): small tiles, the item named once in the heading. */}
                    <h3>
                      Form changes
                      {formChanges.forms.length > 4 && (
                        <span className="editor-form-item-heading">
                          <ItemSprite spritenum={formChanges.spritenum} className="editor-form-item" />
                          {formChanges.ready ? formChanges.itemName : `Needs the ${formChanges.itemName}`}
                        </span>
                      )}
                    </h3>
                    <div
                      className={`editor-evolutions${formChanges.forms.length > 4 ? ' editor-evolutions-compact' : ''}`}
                      ref={wheelScrollsSideways}
                    >
                      {formChanges.forms.map((form) => (
                        <button
                          key={form}
                          type="button"
                          className={`editor-evolution${formChanges.ready ? '' : ' editor-evolution-locked'}`}
                          disabled={!formChanges.ready}
                          title={
                            formChanges.ready
                              ? `Change into ${form} (use the ${formChanges.itemName})`
                              : `Needs the ${formChanges.itemName} - a key item unlocked by an achievement`
                          }
                          onClick={() => onChangeForm(form)}
                        >
                          <SpriteImage
                            style="3d-static"
                            className="editor-evolution-sprite"
                            spriteId={toSpriteId(form)}
                            shiny={set.shiny}
                            alt={form}
                          />
                          {formChanges.forms.length > 4 ? (
                            // Just the form's own part of the name: "Ruby Cream", "Wash" (plain Alcremie is Vanilla Cream).
                            <span className="editor-evolution-name">{form.split('-').slice(1).join(' ') || (form === 'Alcremie' ? 'Vanilla Cream' : 'Normal')}</span>
                          ) : (
                            <span className="editor-evolution-text">
                              <span className="editor-evolution-name">{form}</span>
                              <span className="editor-evolution-method">
                                <ItemSprite spritenum={formChanges.spritenum} className="editor-form-item" />
                                {formChanges.ready ? formChanges.itemName : `Needs the ${formChanges.itemName}`}
                              </span>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="editor-section">
                <h3>
                  Moves <span className="editor-hint">(up to 4, {speciesInfo.moves.length} available)</span>
                </h3>
                <div className="editor-moves-grid">
                  {[0, 1, 2, 3].map((i) => {
                    // The chosen move's type, category, power, accuracy and PP under its box.
                    const move = speciesInfo.moves.find((m) => m.id === set.moves[i])
                    return (
                      <div
                        key={i}
                        className="editor-move-slot"
                        style={move ? { borderLeftColor: TYPE_COLORS[move.type.toLowerCase()] } : undefined}
                      >
                        <input
                          type="text"
                          data-selector-field={`move-${i}`}
                          value={activeSelector === i ? moveQuery : moveDisplayName(set.moves[i] ?? '')}
                          placeholder={moveDisplayName(set.moves[i] ?? '') || `Move ${i + 1}`}
                          onChange={(e) => setMoveQuery(e.target.value)}
                          onKeyDown={handleSelectorKeyDown}
                        />
                        <div className="editor-move-info">
                          {move ? (
                            <>
                              <span className={`type-badge type-${move.type.toLowerCase()}`}>{move.type}</span>
                              <img
                                className="editor-move-category"
                                src={`./sprites/misc/category-${move.category.toLowerCase()}.png`}
                                alt={move.category}
                                title={move.category}
                              />
                              <span>Pow {move.basePower || '—'}</span>
                              <span>Acc {move.accuracy === true ? '—' : move.accuracy}</span>
                              <span>PP {move.pp}</span>
                            </>
                          ) : (
                            <span className="editor-hint">No move</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="editor-section">
                {/* The heading, with the nature picker on the same line. */}
                <div className="editor-stats-header">
                  <h3>
                    Stats{' '}
                    <span className="editor-hint">
                      (EVs {evTotal}/{EV_TOTAL_CAP})
                    </span>
                    {/* Its merge bonus, as a badge - the gold numbers beside each stat include it. */}
                    {!!mergeStars && (
                      <span
                        className="merge-stat-badge"
                        title={`Merged ★${mergeStars}: ${mergeBonusText(mergeStars, rarityTier)} to all stats in classic battles - shown in gold beside each stat`}
                      >
                        ★{mergeStars} {mergeBonusText(mergeStars, rarityTier)}
                      </span>
                    )}
                  </h3>
                  <label className="editor-field editor-nature-field">
                    <span>Nature</span>
                    <select value={set.nature} onChange={(e) => update('nature', e.target.value)}>
                      {options.natures.map((n) => (
                        <option key={n.name} value={n.name}>
                          {natureLabel(n)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="editor-ev-row editor-ev-header">
                  <span className="editor-ev-label" />
                  <span className="editor-ev-base">Base</span>
                  <span className="editor-ev-iv">IVs</span>
                  <span className="editor-ev-spacer" />
                  <span className="editor-ev-input-head">EVs</span>
                  <span className={`editor-ev-stat${mergeStars ? ' editor-ev-stat-wide' : ''}`}>Stat</span>
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
                        className="editor-ev-iv"
                        type="number"
                        min={0}
                        max={31}
                        value={set.ivs[key]}
                        title={`${label} IV (0-31)`}
                        onChange={(e) => updateIv(key, Number(e.target.value))}
                      />
                      <input
                        type="range"
                        min={0}
                        max={252}
                        step={4}
                        value={set.evs[key]}
                        onChange={(e) => updateEv(key, Number(e.target.value))}
                      />
                      <input
                        className="editor-ev-input"
                        type="text"
                        inputMode="numeric"
                        value={set.evs[key]}
                        title={
                          key === 'hp'
                            ? 'HP EVs (0-252)'
                            : `${label} EVs (0-252) - type + or - after the number to raise or lower ${label} with the nature`
                        }
                        onChange={(e) => handleEvInput(key, e.target.value)}
                      />
                      <span className={`editor-ev-stat${natureMark}${mergeStars ? ' editor-ev-stat-wide' : ''}`}>
                        {baseStats
                          ? finalStat(key, baseStats[key], set.level, set.ivs[key], set.evs[key], nature)
                          : '—'}
                        {!!mergeStars && baseStats && (
                          <span className="editor-ev-stat-merged" title={`With the ★${mergeStars} merge bonus`}>
                            {Math.floor(
                              finalStat(key, baseStats[key], set.level, set.ivs[key], set.evs[key], nature) *
                                mergeStatMultiplier(mergeStars, rarityTier)
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {error && <p className="editor-error">{error}</p>}
          {/* Pinned to the bottom of the panel, however far it's scrolled. */}
          <div className="editor-actions editor-actions-pinned">
            <button
              className="editor-save-full"
              title={changed ? undefined : 'Nothing has changed yet'}
              onClick={() => void save()}
              disabled={saving || !changed}
            >
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
                    style="3d-static"
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
                  // Learned only by TM, and the TM isn't owned yet (admin editing ignores it).
                  const tmLocked = !isAdmin && !!m.tmLocked
                  return (
                    <button
                      key={m.id}
                      className={`selector-row ${learnedElsewhere || tmLocked ? 'selector-row-disabled' : ''}`}
                      disabled={learnedElsewhere || tmLocked}
                      title={tmLocked ? `Find or buy the ${m.name} TM to teach it` : undefined}
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
                          {tmLocked && (
                            <span className="tm-locked-badge">
                              <TmIcon type={m.type} /> Needs TM
                            </span>
                          )}
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
