import { useEffect, useMemo, useState } from 'react'
import type {
  AiDifficulty,
  BossStep,
  ItemOptionEntry,
  PremadeTeamSummary,
  ProgressionState,
  RogueliteBossClass,
  TeamMode,
  Trainer
} from '../../shared/battle-types'
import {
  POKEMON_GENERATIONS,
  ROGUELITE_BOSS_CLASSES,
  ROGUELITE_ELITE_FOUR,
  ROGUELITE_GYM_LEADERS
} from '../../shared/battle-types'
import { trainerSpriteUrl } from './trainerSprite'
import TrainerEditor from './TrainerEditor'
import RogueliteBossEditor from './RogueliteBossEditor'
import { TeamIcons } from './TrainerTeamsSection'
import ItemSprite from './ItemSprite'

interface Props {
  onBack: () => void
  onPremadeTeams: () => void
  // The Roguelite bosses' own list (Debug → Edit Roguelite Bosses) instead of the
  // normal game's trainers - each list only ever shows its own.
  roguelite?: boolean
}

type DraftStep = Omit<BossStep, 'id'>

const DIFFICULTY_LABELS: Record<AiDifficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }
const TEAM_MODE_LABELS: Record<TeamMode, string> = { random: 'Random', monotype: 'Monotype', custom: 'Premade' }
const CLASS_LABELS = Object.fromEntries(ROGUELITE_BOSS_CLASSES.map((c) => [c.id, c.label])) as Record<RogueliteBossClass, string>
// How many of each class a generation needs for a whole run.
const CLASS_NEEDED: Record<RogueliteBossClass, number> = {
  gymLeader: ROGUELITE_GYM_LEADERS,
  eliteFour: ROGUELITE_ELITE_FOUR,
  champion: 1
}
const DIFFICULTY_RANK: Record<AiDifficulty, number> = { easy: 0, normal: 1, hard: 2 }
// Only so many rows are drawn at once - "Show more" adds the next lot.
const PAGE = 100

// The classic list's views: everyone, or one kind of trainer. "Boss order" is the
// progression's own view (what the Progression screen was), in fight order.
type Category = 'all' | 'trainers' | 'bosses' | 'order' | 'rocket' | 'always'
type SortKey = 'added' | 'name' | 'difficulty' | 'teams' | 'level' | 'generation'

const stepsOf = (p: ProgressionState): DraftStep[] =>
  p.bossOrder.map(({ trainerId, requiredTrainerWins, levelCapAfterWin, unlocksLateItems }) => ({
    trainerId,
    requiredTrainerWins,
    levelCapAfterWin,
    unlocksLateItems: !!unlocksLateItems
  }))

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function TrainerList({ onBack, onPremadeTeams, roguelite = false }: Props): React.JSX.Element {
  const [trainers, setTrainers] = useState<Trainer[] | null>(null)
  const [premadeTeams, setPremadeTeams] = useState<PremadeTeamSummary[]>([])
  const [progression, setProgression] = useState<ProgressionState | null>(null)
  const [items, setItems] = useState<ItemOptionEntry[]>([])
  const [abilityNames, setAbilityNames] = useState<Map<string, string>>(new Map())
  const [editingTrainer, setEditingTrainer] = useState<Trainer | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Filters.
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [difficulties, setDifficulties] = useState<Set<AiDifficulty>>(new Set())
  const [teamModes, setTeamModes] = useState<Set<TeamMode>>(new Set())
  const [generations, setGenerations] = useState<Set<number | 'none'>>(new Set())
  const [classes, setClasses] = useState<Set<RogueliteBossClass | 'none'>>(new Set())
  const [fitsCap, setFitsCap] = useState(false)
  const [needsAttention, setNeedsAttention] = useState(false)
  const [sort, setSort] = useState<SortKey>('added')
  const [descending, setDescending] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [levelCapInput, setLevelCapInput] = useState('')
  // The boss order as edited here - ahead of the saved one while a save is on its way.
  const [steps, setSteps] = useState<DraftStep[]>([])

  function refresh(): void {
    window.api
      .listTrainers()
      .then(setTrainers)
      .catch((e) => setError(errorText(e)))
    window.api.listPremadeTeams().then(setPremadeTeams).catch(() => {})
    window.api
      .getProgression()
      .then((p) => {
        setProgression(p)
        setSteps(stepsOf(p))
        setLevelCapInput(String(p.levelCap))
      })
      .catch(() => {})
  }

  useEffect(refresh, [])
  useEffect(() => {
    window.api
      .getEditorOptions()
      .then((opts) => setItems(opts.items))
      .catch(() => {})
    if (roguelite) {
      window.api
        .listAllAbilities()
        .then((list) => setAbilityNames(new Map(list.map((a) => [a.id, a.name]))))
        .catch(() => {})
    }
  }, [roguelite])
  // A new filter starts from the top of the list again.
  useEffect(() => setShown(PAGE), [query, category, difficulties, teamModes, generations, classes, fitsCap, needsAttention, sort])

  const teamsByTrainer = useMemo(() => {
    const map = new Map<string, PremadeTeamSummary[]>()
    for (const team of premadeTeams) map.set(team.trainerId, [...(map.get(team.trainerId) ?? []), team])
    return map
  }, [premadeTeams])

  const orderIndex = useMemo(
    () => new Map((progression?.bossOrder ?? []).map((step, i) => [step.trainerId, i])),
    [progression]
  )
  const levelCap = progression?.levelCap ?? 1
  const defeated = new Set(progression?.bossesDefeated ?? [])
  const nextBossId = progression?.bossOrder.find((s) => !defeated.has(s.trainerId))?.trainerId

  const listed = (trainers ?? []).filter((t) => !!t.rogueliteBoss === roguelite)
  const itemOf = (id: string | null): ItemOptionEntry | undefined => (id ? items.find((i) => i.id === id) : undefined)
  const teamsOf = (t: Trainer): PremadeTeamSummary[] => teamsByTrainer.get(t.id) ?? []
  const usableTeams = (t: Trainer): PremadeTeamSummary[] => teamsOf(t).filter((team) => team.mons.length > 0)
  const lowestCap = (t: Trainer): number => Math.min(...usableTeams(t).map((team) => team.requiredLevelCap), 101)

  // What's wrong with a trainer, if anything: a premade trainer with no team to field, a
  // run boss missing its class or generation.
  function problemsOf(t: Trainer): string[] {
    const problems: string[] = []
    if (t.teamMode === 'custom' && usableTeams(t).length === 0) problems.push('No premade team')
    if (t.teamMode === 'custom' && teamsOf(t).some((team) => team.mons.length === 0)) problems.push('An empty team')
    if (roguelite && !t.rogueliteClass) problems.push('No class')
    if (roguelite && !t.rogueliteGeneration) problems.push('No generation')
    if (!roguelite && t.isBoss && !orderIndex.has(t.id)) problems.push('Not in the boss order')
    return problems
  }

  // A trainer it can field a team for at the current level cap (roughly - a random
  // fight also keeps a team inside the cap's stat ceiling).
  const fitsLevelCap = (t: Trainer): boolean => t.teamMode !== 'custom' || lowestCap(t) <= levelCap

  function inCategory(t: Trainer, c: Category): boolean {
    if (c === 'trainers') return !t.isBoss
    if (c === 'bosses') return t.isBoss
    if (c === 'order') return orderIndex.has(t.id)
    if (c === 'rocket') return !!t.teamRocket
    if (c === 'always') return !!t.alwaysAvailable
    return true
  }

  // Matches the name, the reward ability, or "boss" / "#12" / the difficulty.
  const needle = query.trim().toLowerCase()
  const matchesQuery = (t: Trainer): boolean =>
    !needle ||
    [
      t.name,
      t.spriteId,
      DIFFICULTY_LABELS[t.difficulty],
      t.isBoss ? `boss #${(orderIndex.get(t.id) ?? -2) + 1}` : '',
      t.monotype ?? '',
      t.rogueliteRewardAbility ? (abilityNames.get(t.rogueliteRewardAbility) ?? '') : '',
      ...teamsOf(t).flatMap((team) => [team.name, ...team.mons.map((m) => m.species)])
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle)

  // Everything but the category / generation filter itself, so their counts show what
  // picking them would leave.
  const passesOthers = (t: Trainer): boolean =>
    matchesQuery(t) &&
    (difficulties.size === 0 || difficulties.has(t.difficulty)) &&
    (teamModes.size === 0 || teamModes.has(t.teamMode)) &&
    (classes.size === 0 || classes.has(t.rogueliteClass ?? 'none')) &&
    (!fitsCap || fitsLevelCap(t)) &&
    (!needsAttention || problemsOf(t).length > 0)
  const passesGeneration = (t: Trainer): boolean =>
    !roguelite || generations.size === 0 || generations.has(t.rogueliteGeneration ?? 'none')

  const filtered = listed.filter((t) => passesOthers(t) && passesGeneration(t) && inCategory(t, category))

  const sortValue = (t: Trainer): number | string => {
    if (sort === 'name') return t.name.toLowerCase()
    if (sort === 'difficulty') return DIFFICULTY_RANK[t.difficulty]
    if (sort === 'teams') return teamsOf(t).length
    if (sort === 'level') return lowestCap(t)
    if (sort === 'generation') return (t.rogueliteGeneration ?? 99) * 10 + ROGUELITE_BOSS_CLASSES.findIndex((c) => c.id === t.rogueliteClass)
    return 0
  }
  const visible =
    category === 'order'
      ? [...filtered].sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!)
      : sort === 'added'
        ? descending
          ? [...filtered].reverse()
          : filtered
        : [...filtered].sort((a, b) => {
            const x = sortValue(a)
            const y = sortValue(b)
            const order = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
            return (descending ? -order : order) || a.name.localeCompare(b.name)
          })
  // Bosses left out of the order - listed under it in the Boss order view, to add.
  const unordered = category === 'order' ? listed.filter((t) => t.isBoss && !orderIndex.has(t.id) && passesOthers(t)) : []

  function toggle<T>(set: Set<T>, value: T, update: (next: Set<T>) => void): void {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    update(next)
  }

  async function act(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function deleteTrainer(id: string): void {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    void act(async () => {
      setTrainers(await window.api.deleteTrainer(id))
      refresh()
    })
  }

  function duplicateTrainer(id: string): void {
    void act(async () => {
      const copy = await window.api.duplicateTrainer(id)
      refresh()
      setEditingTrainer(copy)
    })
  }

  // ---- the boss order (classic only) ----
  function saveOrder(next: DraftStep[]): void {
    setSteps(next)
    void act(async () => setProgression(await window.api.setBossOrder(next)))
  }
  function updateStep(trainerId: string, patch: Partial<DraftStep>): void {
    saveOrder(steps.map((s) => (s.trainerId === trainerId ? { ...s, ...patch } : s)))
  }
  function moveStep(trainerId: string, dir: -1 | 1): void {
    const i = steps.findIndex((s) => s.trainerId === trainerId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    saveOrder(next)
  }
  function addStep(trainerId: string): void {
    const lastCap = steps.at(-1)?.levelCapAfterWin ?? levelCap
    saveOrder([...steps, { trainerId, requiredTrainerWins: 0, levelCapAfterWin: Math.min(100, lastCap + 5), unlocksLateItems: false }])
  }
  function applyLevelCap(): void {
    const n = Number(levelCapInput)
    if (!Number.isFinite(n) || levelCapInput.trim() === '') return
    void act(async () => setProgression(await window.api.setLevelCap(n)))
  }

  // ---- the row's summaries ----
  function teamSummary(t: Trainer): string {
    if (t.teamMode === 'random') return 'Random team'
    if (t.teamMode === 'monotype') return `Random ${t.monotype ?? '?'} team`
    const teams = usableTeams(t)
    if (teams.length === 0) return 'No premade teams'
    const fixed = teams.map((team) => team.requiredLevelCap).filter((cap) => cap > 1)
    const follows = teams.length - fixed.length
    const caps = fixed.length ? `cap ${Math.min(...fixed)}${Math.max(...fixed) > Math.min(...fixed) ? `–${Math.max(...fixed)}` : ''}` : ''
    const doubles = teams.filter((team) => team.isDoubleBattle).length
    return [
      `${teams.length} team${teams.length === 1 ? '' : 's'}`,
      caps,
      follows ? `${fixed.length ? `${follows} ` : ''}follow${follows === 1 && fixed.length ? 's' : ''} the cap` : '',
      doubles ? `${doubles} double${doubles === 1 ? '' : 's'}` : ''
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // The team shown on the row: the first one it can field now, else its first.
  function previewTeam(t: Trainer): PremadeTeamSummary | undefined {
    const teams = usableTeams(t)
    return teams.find((team) => team.requiredLevelCap <= levelCap) ?? teams[0]
  }

  // Each generation's bosses by class, for the coverage strip.
  const coverage = POKEMON_GENERATIONS.map((g) => {
    const ofGen = listed.filter((t) => t.rogueliteGeneration === g && passesOthers(t))
    const count = (c: RogueliteBossClass): number => ofGen.filter((t) => t.rogueliteClass === c).length
    const complete = ROGUELITE_BOSS_CLASSES.every((c) => count(c.id) >= CLASS_NEEDED[c.id])
    return { g, total: ofGen.length, count, complete }
  })
  const noGeneration = listed.filter((t) => !t.rogueliteGeneration && passesOthers(t)).length

  const categories: [Category, string][] = [
    ['all', 'All'],
    ['trainers', 'Trainers'],
    ['bosses', 'Bosses'],
    ['order', 'Boss order'],
    ['rocket', 'Team Rocket'],
    ['always', 'Always available']
  ]
  const sorts: [SortKey, string][] = [
    ['added', 'Added'],
    ['name', 'Name'],
    ['difficulty', 'Difficulty'],
    ['teams', 'Teams'],
    ['level', 'Level cap'],
    ...(roguelite ? ([['generation', 'Generation']] as [SortKey, string][]) : [])
  ]
  const filtersOn =
    !!needle || difficulties.size + teamModes.size + generations.size + classes.size > 0 || fitsCap || needsAttention

  function clearFilters(): void {
    setQuery('')
    setDifficulties(new Set())
    setTeamModes(new Set())
    setGenerations(new Set())
    setClasses(new Set())
    setFitsCap(false)
    setNeedsAttention(false)
  }

  function row(t: Trainer): React.JSX.Element {
    const index = orderIndex.get(t.id)
    const step = index !== undefined ? steps[index] : undefined
    const problems = problemsOf(t)
    const preview = t.teamMode === 'custom' ? previewTeam(t) : undefined
    const drops = t.drops.map((d) => ({ drop: d, item: itemOf(d.itemId) })).filter((d) => d.item)
    return (
      <div
        key={t.id}
        className={`trainer-list-row trainer-row${problems.length ? ' trainer-row-warn' : ''}`}
        onDoubleClick={() => setEditingTrainer(t)}
      >
        {category === 'order' && index !== undefined && (
          <span
            className={`trainer-order-number${defeated.has(t.id) ? ' trainer-order-beaten' : ''}${t.id === nextBossId ? ' trainer-order-next' : ''}`}
            title={defeated.has(t.id) ? 'Beaten on this save' : t.id === nextBossId ? 'The next boss on this save' : 'Not reached yet'}
          >
            {index + 1}
          </span>
        )}
        <img className="trainer-list-sprite" src={trainerSpriteUrl(t.spriteId)} alt="" />
        <div className="trainer-list-info">
          <div className="trainer-list-name">
            <span className="trainer-row-name">{t.name}</span>
            {t.isBoss && (
              <span className="trainer-boss-badge" title={index !== undefined ? `Fight ${index + 1} in the boss order` : 'Not in the boss order'}>
                {index !== undefined ? `BOSS #${index + 1}` : 'BOSS'}
              </span>
            )}
            {step && category !== 'order' && (
              <span className="trainer-pill" title={`Needs ${step.requiredTrainerWins} trainer wins first; beating it raises the cap to ${step.levelCapAfterWin}`}>
                Cap → {step.levelCapAfterWin}
              </span>
            )}
            {defeated.has(t.id) && <span className="trainer-pill trainer-beaten-pill" title="Beaten on this save">✓ Beaten</span>}
            {t.teamRocket && <span className="trainer-pill trainer-rocket-pill" title="Team Rocket member">R</span>}
            {t.rocketEvent && <span className="trainer-pill trainer-rocket-pill" title="Team Rocket event boss">Event</span>}
            {t.alwaysAvailable && <span className="trainer-pill" title="Always available - its cap-relative teams come up at any cap">Always</span>}
          </div>
          <div className="trainer-row-meta">
            <span className={`trainer-pill trainer-difficulty-${t.difficulty}`}>{DIFFICULTY_LABELS[t.difficulty]}</span>
            {roguelite && (
              <>
                <span className={`trainer-pill${t.rogueliteClass ? '' : ' trainer-pill-missing'}`}>
                  {t.rogueliteClass ? CLASS_LABELS[t.rogueliteClass] : 'No class'}
                </span>
                <span className={`trainer-pill${t.rogueliteGeneration ? '' : ' trainer-pill-missing'}`}>
                  {t.rogueliteGeneration ? `Gen ${t.rogueliteGeneration}` : 'No gen'}
                </span>
                {t.rogueliteRewardAbility && (
                  <span className="trainer-pill trainer-ability-pill" title="Beating it offers this ability">
                    ✦ {abilityNames.get(t.rogueliteRewardAbility) ?? t.rogueliteRewardAbility}
                  </span>
                )}
              </>
            )}
            <span className={`trainer-row-teams${t.teamMode === 'custom' && usableTeams(t).length === 0 ? ' trainer-text-warn' : ''}`}>
              {teamSummary(t)}
            </span>
            {drops.map(({ drop, item }, i) => (
              <span key={i} className="trainer-pill trainer-drop-pill" title={`Drops ${item!.name} (${drop.chance}%)`}>
                <ItemSprite spritenum={item!.spritenum} />
                {drop.chance}%
              </span>
            ))}
            {problems.length > 0 && (
              <span className="trainer-text-warn" title={problems.join(', ')}>
                ⚠ {problems.join(', ')}
              </span>
            )}
          </div>
          {step && category === 'order' && (
            <div className="trainer-row-step">
              Needs{' '}
              <input
                type="number"
                min={0}
                className="progression-inline-input"
                value={step.requiredTrainerWins}
                onChange={(e) => updateStep(t.id, { requiredTrainerWins: Math.max(0, Number(e.target.value)) })}
              />{' '}
              trainer wins · cap becomes{' '}
              <input
                type="number"
                min={1}
                max={100}
                className="progression-inline-input"
                value={step.levelCapAfterWin}
                onChange={(e) => updateStep(t.id, { levelCapAfterWin: Math.max(1, Math.min(100, Number(e.target.value))) })}
              />
              <label title="Exp. Candies and evolution items stay out of the Shop until this boss is beaten (drops aren't affected)">
                <input
                  type="checkbox"
                  checked={!!step.unlocksLateItems}
                  onChange={(e) => updateStep(t.id, { unlocksLateItems: e.target.checked })}
                />{' '}
                Unlocks late Shop items
              </label>
            </div>
          )}
        </div>
        {preview && (
          <span className="trainer-row-preview" title={`${preview.name}${usableTeams(t).length > 1 ? ` (+${usableTeams(t).length - 1} more)` : ''}`}>
            <TeamIcons team={preview} />
          </span>
        )}
        <div className="trainer-row-actions">
          {category === 'order' && index !== undefined ? (
            <>
              <button title="Earlier" disabled={busy || index === 0} onClick={() => moveStep(t.id, -1)}>
                ↑
              </button>
              <button title="Later" disabled={busy || index === steps.length - 1} onClick={() => moveStep(t.id, 1)}>
                ↓
              </button>
              <button
                title="Take it out of the boss order"
                disabled={busy}
                onClick={() => saveOrder(steps.filter((s) => s.trainerId !== t.id))}
              >
                ✕
              </button>
            </>
          ) : null}
          <button onClick={() => setEditingTrainer(t)}>Edit</button>
          <button disabled={busy} title="A copy with all its teams" onClick={() => duplicateTrainer(t.id)}>
            Copy
          </button>
          <button
            className={confirmDeleteId === t.id ? 'trainer-danger' : undefined}
            disabled={busy}
            onClick={() => deleteTrainer(t.id)}
            onBlur={() => setConfirmDeleteId((id) => (id === t.id ? null : id))}
          >
            {confirmDeleteId === t.id ? 'Sure?' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen trainer-screen">
      <div className="trainer-screen-header">
        <h1>{roguelite ? 'Roguelite Bosses' : 'Trainers'}</h1>
        <div className="trainer-screen-buttons">
          <button onClick={onBack}>Back</button>
          <button onClick={onPremadeTeams}>Premade Teams</button>
          <button onClick={() => setEditingTrainer('new')}>{roguelite ? 'Add Roguelite Boss' : 'Add Trainer'}</button>
        </div>
      </div>
      {error && <p className="editor-error">{error}</p>}

      {/* The classic game's progression at a glance (the old Progression screen). */}
      {!roguelite && progression && (
        <div className="trainer-progress-bar">
          <label className="trainer-progress-cap">
            Level cap
            <input
              type="number"
              min={1}
              max={100}
              value={levelCapInput}
              onChange={(e) => setLevelCapInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLevelCap()
              }}
            />
            <button disabled={busy || levelCapInput === String(progression.levelCap)} onClick={applyLevelCap}>
              Set
            </button>
          </label>
          <span>
            <b>{progression.bossesDefeated.filter((id) => orderIndex.has(id)).length}</b>/{progression.bossOrder.length} bosses beaten
          </span>
          <span>
            <b>{progression.trainerWinsSinceLastBoss}</b> trainer win{progression.trainerWinsSinceLastBoss === 1 ? '' : 's'} since the last
          </span>
          {nextBossId && (
            <span>
              Next:{' '}
              <button className="trainer-link" onClick={() => setEditingTrainer(listed.find((t) => t.id === nextBossId) ?? null)}>
                {listed.find((t) => t.id === nextBossId)?.name ?? '?'}
              </button>{' '}
              (needs {progression.bossOrder.find((s) => s.trainerId === nextBossId)?.requiredTrainerWins ?? 0})
            </span>
          )}
        </div>
      )}

      {/* The Roguelite bosses by generation: how close each is to a whole run's worth. */}
      {roguelite && (
        <div className="trainer-coverage">
          {coverage.map(({ g, total, count, complete }) => (
            <button
              key={g}
              className={`trainer-coverage-gen${generations.has(g) ? ' trainer-chip-on' : ''}${complete ? ' trainer-coverage-complete' : total ? ' trainer-coverage-partial' : ' trainer-coverage-empty'}`}
              title={`Generation ${g}: ${ROGUELITE_BOSS_CLASSES.map((c) => `${count(c.id)}/${CLASS_NEEDED[c.id]} ${c.label}`).join(', ')}${complete ? '' : ' - not enough for a whole run'}`}
              onClick={() => toggle(generations, g, setGenerations)}
            >
              <span className="trainer-coverage-title">Gen {g}</span>
              <span className="trainer-coverage-counts">
                {ROGUELITE_BOSS_CLASSES.map((c) => (
                  <span key={c.id} className={count(c.id) >= CLASS_NEEDED[c.id] ? 'trainer-coverage-ok' : undefined}>
                    {count(c.id)}
                  </span>
                ))}
              </span>
            </button>
          ))}
          {noGeneration > 0 && (
            <button
              className={`trainer-coverage-gen trainer-coverage-partial${generations.has('none') ? ' trainer-chip-on' : ''}`}
              title="Bosses with no generation set - a run set to a generation never meets them"
              onClick={() => toggle(generations, 'none', setGenerations)}
            >
              <span className="trainer-coverage-title">No gen</span>
              <span className="trainer-coverage-counts">{noGeneration}</span>
            </button>
          )}
          <span className="trainer-coverage-legend">Gym Leaders · Elite Four · Champion</span>
        </div>
      )}

      <div className="trainer-toolbar">
        <input
          className="trainer-search"
          type="search"
          value={query}
          placeholder="Search names, teams, Pokemon..."
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="trainer-chips">
          {(Object.keys(DIFFICULTY_LABELS) as AiDifficulty[]).map((d) => (
            <button
              key={d}
              className={`trainer-chip trainer-chip-${d}${difficulties.has(d) ? ' trainer-chip-on' : ''}`}
              onClick={() => toggle(difficulties, d, setDifficulties)}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="trainer-chips">
          {(Object.keys(TEAM_MODE_LABELS) as TeamMode[]).map((m) => (
            <button
              key={m}
              className={`trainer-chip${teamModes.has(m) ? ' trainer-chip-on' : ''}`}
              onClick={() => toggle(teamModes, m, setTeamModes)}
            >
              {TEAM_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        {roguelite && (
          <div className="trainer-chips">
            {ROGUELITE_BOSS_CLASSES.map((c) => (
              <button
                key={c.id}
                className={`trainer-chip${classes.has(c.id) ? ' trainer-chip-on' : ''}`}
                onClick={() => toggle(classes, c.id, setClasses)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="trainer-chips">
          {!roguelite && (
            <button
              className={`trainer-chip${fitsCap ? ' trainer-chip-on' : ''}`}
              title="Only trainers with a team for the current level cap"
              onClick={() => setFitsCap((v) => !v)}
            >
              Fits cap {levelCap}
            </button>
          )}
          <button
            className={`trainer-chip${needsAttention ? ' trainer-chip-on' : ''}`}
            title="Only trainers with something missing (no team, an empty team, no class...)"
            onClick={() => setNeedsAttention((v) => !v)}
          >
            ⚠ Needs work
          </button>
        </div>
        {category !== 'order' && (
          <div className="trainer-sort box-sort">
            <span className="box-sort-label">Sort</span>
            <span className="box-select-menu-wrap">
              <button className="box-select-button box-sort-button" onClick={() => setSortMenuOpen((v) => !v)}>
                {sorts.find(([key]) => key === sort)?.[1]} ▾
              </button>
              {sortMenuOpen && (
                <>
                  <div className="box-select-menu-backdrop" onMouseDown={() => setSortMenuOpen(false)} />
                  <div className="context-menu box-select-menu box-sort-menu">
                    {sorts.map(([key, label]) => (
                      <button
                        key={key}
                        className={`context-menu-item${key === sort ? ' box-sort-menu-current' : ''}`}
                        onClick={() => {
                          setSortMenuOpen(false)
                          setSort(key)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </span>
            <button
              className="box-sort-direction"
              title={descending ? 'Descending - click for ascending' : 'Ascending - click for descending'}
              onClick={() => setDescending((d) => !d)}
            >
              <svg className={`box-sort-arrow${descending ? '' : ' box-sort-arrow-up'}`} viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2.5v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {!roguelite && (
        <div className="trainer-tabs">
          {categories.map(([c, label]) => (
            <button
              key={c}
              className={`trainer-tab${category === c ? ' trainer-tab-on' : ''}`}
              onClick={() => setCategory(c)}
            >
              {label}
              <span className="trainer-tab-count">{listed.filter((t) => inCategory(t, c) && passesOthers(t)).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="trainer-list-status">
        {trainers && (
          <span>
            {filtersOn || category !== 'all' ? `${visible.length} of ${listed.length}` : listed.length}{' '}
            {roguelite ? 'bosses' : 'trainers'}
          </span>
        )}
        {filtersOn && (
          <button className="trainer-link" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span className="trainer-list-tip">Double-click a row to edit it</span>
      </div>

      <div className="trainer-list trainer-list-wide">
        {visible.slice(0, shown).map(row)}
        {visible.length > shown && (
          <button className="trainer-show-more" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, visible.length - shown)} more ({visible.length - shown} left)
          </button>
        )}
        {trainers && listed.length === 0 && (
          <p className="box-empty-hint">{roguelite ? 'No Roguelite bosses yet.' : 'No trainers yet.'}</p>
        )}
        {trainers && listed.length > 0 && visible.length === 0 && category !== 'order' && (
          <p className="box-empty-hint">No trainers match these filters.</p>
        )}
        {category === 'order' && (
          <>
            <h3 className="trainer-list-subheading">Bosses not in the order ({unordered.length})</h3>
            {unordered.map((t) => (
              <div key={t.id} className="trainer-list-row trainer-row trainer-row-unordered">
                <img className="trainer-list-sprite" src={trainerSpriteUrl(t.spriteId)} alt="" />
                <div className="trainer-list-info">
                  <div className="trainer-list-name">{t.name}</div>
                  <div className="trainer-row-meta">{teamSummary(t)}</div>
                </div>
                <div className="trainer-row-actions">
                  <button disabled={busy} onClick={() => addStep(t.id)}>
                    Add to the order
                  </button>
                  <button onClick={() => setEditingTrainer(t)}>Edit</button>
                </div>
              </div>
            ))}
            {unordered.length === 0 && <p className="box-empty-hint">Every boss is in the order.</p>}
          </>
        )}
      </div>

      {editingTrainer &&
        (roguelite ? (
          <RogueliteBossEditor
            key={editingTrainer === 'new' ? 'new' : editingTrainer.id}
            trainer={editingTrainer === 'new' ? null : editingTrainer}
            trainers={trainers ?? []}
            onClose={() => {
              setEditingTrainer(null)
              refresh()
            }}
            onSaved={refresh}
          />
        ) : (
          <TrainerEditor
            key={editingTrainer === 'new' ? 'new' : editingTrainer.id}
            trainer={editingTrainer === 'new' ? null : editingTrainer}
            trainers={trainers ?? []}
            onClose={() => {
              setEditingTrainer(null)
              refresh()
            }}
            onSaved={refresh}
          />
        ))}
    </div>
  )
}

export default TrainerList
