import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WILD_LOCATIONS, type RarityTier } from "../../shared/battle-types";
import {
  HORDE_BONUS_STATS,
  HORDE_DUOS,
  HORDE_BOOST_COUNT,
  HORDE_CURSE_MAX_SLOW,
  HORDE_DURATION_MS,
  HORDE_EFFECT_BONUS_MOVES,
  HORDE_EFFECT_BY_MOVES,
  HORDE_EFFECT_MASTERY_MOVES,
  HORDE_HELD_IDS,
  HORDE_HELD_ITEMS,
  HORDE_ITEM_IDS,
  HORDE_ITEMS,
  HORDE_LUCK_POINTS,
  HORDE_MAX_MULTI,
  HORDE_MAX_TOMES,
  HORDE_MOVE_TYPES,
  HORDE_MOVE_UPGRADE,
  HORDE_MOVE_UPGRADE_FALLOFF,
  HORDE_MULTI_REPEAT_SHARE,
  HORDE_MULTI_TARGETS,
  HORDE_PIERCE_UPGRADE_SHARE,
  HORDE_RARITIES,
  HORDE_SHAPE_LIST,
  HORDE_SPREAD_UPGRADE_SHARE,
  HORDE_STATS,
  formatHordeTime,
  hordeBaseStatPercent,
  hordeBaseCount,
  hordeBonusPercent,
  hordeCurseGain,
  hordeMoveBoosts,
  hordeCountKind,
  hordeShownCount,
  hordeHasReach,
  hordeMoveCooldown,
  hordeMoveDef,
  hordeMoveCatalog,
  hordeMovePower,
  hordeMoveShape,
  type HordeBonusStat,
  type HordeHeldId,
  type HordeDuoId,
  type HordeHistoryEntry,
  type HordeMove,
  type HordeMoveBoost,
  type HordeMoveShape,
  type HordeStat,
  type HordeRunMove,
} from "../../shared/horde";
import type { MessageKey } from "../../shared/i18n";
import SpriteImage from "./SpriteImage";
import ShinyIcon from "./ShinyIcon";
import { formatMoney } from "./money";
import { itemName, moveName, numberLocale, typeName, useT, type Translate } from "./i18n";
import ItemSprite from "./ItemSprite";
import RarityCard from "./RarityCard";
import { heldBuffText, hordeItemDesc } from "./HordeChestOpen";
import TabStrip, { type TabStripTab } from "./TabStrip";
import { hordeBoostLabel, hordeTraitText } from "./hordeMoveText";

// Every move, type by type in the order the type chart lists them.
const ALL_MOVES: HordeMove[] = hordeMoveCatalog();
const MOVES_BY_ID = new Map(ALL_MOVES.map((m) => [m.id, m]));

function Modal({
  className,
  title,
  onClose,
  children,
}: {
  className: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const t = useT();
  // Esc closes it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className={`modal-panel horde-info-modal ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="horde-info-modal-head">
          <h3 className="horde-info-modal-title">{title}</h3>
          <button className="horde-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <div className="horde-info-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

type GuideTab = "moves" | "abilities" | "upgrades" | "items";

// The stat each ability raises (Curse has its own label).
const ABILITY_STAT_KEYS: Record<Exclude<HordeStat, "curse">, MessageKey> = {
  hp: "horde.stat.hp",
  atk: "horde.stat.atk",
  def: "horde.stat.def",
  spe: "horde.stat.spe",
  area: "horde.stat.area",
  reach: "horde.stat.reach",
  haste: "horde.stat.haste",
  pickup: "horde.stat.pickup",
  critChance: "horde.stat.critChance",
  critDamage: "horde.stat.critDamage",
  exp: "horde.stat.exp",
  resist: "horde.stat.resist",
  regen: "horde.stat.regen",
  goldGain: "horde.stat.goldGain",
  luck: "horde.stat.luck",
};

const isBonusStat = (stat: HordeStat): stat is HordeBonusStat =>
  (HORDE_BONUS_STATS as HordeStat[]).includes(stat);

// What a first pick of an ability adds at a rarity.
function abilityAmount(stat: HordeStat, rarity: RarityTier): string {
  if (stat === "luck") return `+${HORDE_LUCK_POINTS[rarity]}`;
  if (stat === "curse") {
    const { up, down } = hordeCurseGain(rarity);
    return `+${up}% / -${down}`;
  }
  if (isBonusStat(stat)) return `+${hordeBonusPercent(stat, rarity)}%`;
  // Speed picks add flat Speed points rather than a percent.
  if (stat === "spe") return `+${hordeBaseStatPercent(stat, rarity)}`;
  return `+${hordeBaseStatPercent(stat, rarity)}%`;
}

// Held items, the commonest first (in the order they're listed within a rarity).
const HELD_BY_RARITY: HordeHeldId[] = [...HORDE_HELD_IDS].sort(
  (a, b) =>
    HORDE_RARITIES.indexOf(HORDE_HELD_ITEMS[a].rarity) - HORDE_RARITIES.indexOf(HORDE_HELD_ITEMS[b].rarity),
);

// One value per rarity, common to legendary, each in its rarity's colour.
function RarityValues({ value }: { value: (rarity: RarityTier) => string }): React.JSX.Element {
  return (
    <span className="horde-guide-rarities">
      {HORDE_RARITIES.map((r) => (
        <b key={r} className={`horde-moves-rarity-${r}`}>
          {value(r)}
        </b>
      ))}
    </span>
  );
}

// Only the shapes some move has, in the usual order.
const SHAPES: HordeMoveShape[] = HORDE_SHAPE_LIST.filter((s) => ALL_MOVES.some((m) => hordeMoveShape(m) === s));

/** Every move a run can learn: its type and shape (both filterable), power, cooldown, what its upgrades raise, and its twist. */
function GuideMoves(): React.JSX.Element {
  const t = useT();
  // Showing one type's moves, or every type's - and likewise one shape's.
  const [type, setType] = useState<string | null>(null);
  const [shape, setShape] = useState<HordeMoveShape | null>(null);
  const shown = ALL_MOVES.filter((m) => (!type || m.type === type) && (!shape || hordeMoveShape(m) === shape));
  const shapeNote = (move: HordeMove): string =>
    t(`horde.shapeNote.${hordeMoveShape(move)}` as MessageKey, { n: hordeBaseCount(move) });
  return (
    <>
      <p className="horde-muted">{t("horde.movesNote")}</p>
      <div className="horde-guide-filters">
        <span className="horde-guide-filter-label">{t("horde.movesType")}</span>
        <div className="horde-guide-filter">
          <button className={`horde-guide-chip${type === null ? " active" : ""}`} onClick={() => setType(null)}>
            {t("horde.movesAll")}
          </button>
          {HORDE_MOVE_TYPES.map((ty) => (
            <button
              key={ty}
              className={`type-badge type-${ty.toLowerCase()} horde-guide-type${type === ty ? " active" : ""}${type && type !== ty ? " faded" : ""}`}
              onClick={() => setType(type === ty ? null : ty)}
            >
              {typeName(ty)}
            </button>
          ))}
        </div>
        <span className="horde-guide-filter-label">{t("horde.movesShape")}</span>
        <div className="horde-guide-filter">
          <button className={`horde-guide-chip${shape === null ? " active" : ""}`} onClick={() => setShape(null)}>
            {t("horde.movesAll")}
          </button>
          {SHAPES.map((s) => (
            <button
              key={s}
              className={`horde-guide-chip${shape === s ? " active" : ""}`}
              onClick={() => setShape(shape === s ? null : s)}
            >
              {t(`horde.shape.${s}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="horde-muted">{t("horde.movesNone")}</p>}
      <div className="horde-moves-list">
        {shown.map((move) => (
          <div key={move.id} className="horde-moves-row">
            <span className="horde-moves-name">
              <span className={`type-badge type-${move.type.toLowerCase()}`}>{typeName(move.type)}</span>
              <span className="horde-shape-badge" title={shapeNote(move)}>
                {t(`horde.shape.${hordeMoveShape(move)}` as MessageKey)}
              </span>
            </span>
            <b className="horde-moves-title">{moveName(move.name)}</b>
            <span className="horde-moves-stats">
              {t("horde.movesStats", {
                power: hordeMovePower(move),
                seconds: (hordeMoveCooldown(move) / 1000).toFixed(1),
              })}
            </span>
            <span className="horde-moves-trait">{hordeTraitText(t, move)}</span>
            <span className="horde-moves-boosts">
              <span className="horde-muted">{t("horde.movesUpgrades")}</span>
              {hordeMoveBoosts(move).map((b) => (
                <span key={b} className="horde-moves-boost">
                  {hordeBoostLabel(t, move, b)}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Every ability a level-up can offer: the stat it raises, what a first pick adds at each rarity, and what it does. */
function GuideAbilities(): React.JSX.Element {
  const t = useT();
  const note = (stat: HordeStat): string =>
    stat === "atk" || stat === "def" || stat === "spe"
      ? t(`horde.guide.${stat}Note` as MessageKey)
      : t(`horde.${stat}Note` as MessageKey, { most: HORDE_CURSE_MAX_SLOW });
  return (
    <>
      <p className="horde-muted">{t("horde.guide.abilitiesNote", { max: HORDE_MAX_TOMES })}</p>
      <div className="horde-moves-list">
        {HORDE_STATS.map((stat) => (
          <div key={stat} className="horde-moves-row">
            <span className="horde-moves-name">
              <b>{t((stat === "hp" ? "horde.stat.hp" : `horde.ability.${stat}`) as MessageKey)}</b>
            </span>
            <span className="horde-moves-shape">
              {stat === "curse" ? t("horde.guide.curseStats") : t(ABILITY_STAT_KEYS[stat])}
            </span>
            <RarityValues value={(r) => abilityAmount(stat, r)} />
            <span className="horde-moves-trait">{note(stat)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** What each rarity of move upgrade card adds, and the other cards a level-up can offer. */
function GuideUpgrades(): React.JSX.Element {
  const t = useT();
  const columns: { key: string; label: string; value: (r: RarityTier) => string }[] = [
    { key: "power", label: t("horde.change.power"), value: (r) => `+${HORDE_MOVE_UPGRADE[r].power}%` },
    { key: "cooldown", label: t("horde.change.cooldown"), value: (r) => `-${HORDE_MOVE_UPGRADE[r].cooldown}%` },
    { key: "range", label: t("horde.guide.colReach"), value: (r) => `+${HORDE_MOVE_UPGRADE[r].range}%` },
    { key: "count", label: t("horde.guide.colCount"), value: (r) => `+${HORDE_MOVE_UPGRADE[r].count}` },
    { key: "crit", label: t("horde.change.crit"), value: (r) => `+${HORDE_MOVE_UPGRADE[r].crit}%` },
  ];
  return (
    <>
      <p className="horde-muted">{t("horde.guide.upgradesNote")}</p>
      <div className="horde-guide-table">
        <span className="horde-guide-th">{t("horde.guide.rarity")}</span>
        <span className="horde-guide-th">{t("horde.guide.raises")}</span>
        {columns.map((c) => (
          <span key={c.key} className="horde-guide-th">
            {c.label}
          </span>
        ))}
        {HORDE_RARITIES.map((r) => (
          <Fragment key={r}>
            <b className={`horde-moves-rarity-${r}`}>{t(`rarity.${r}` as MessageKey)}</b>
            <span>{t("horde.guide.raisesCount", { n: HORDE_BOOST_COUNT[r] })}</span>
            {columns.map((c) => (
              <span key={c.key} className={`horde-moves-rarity-${r}`}>
                {c.value(r)}
              </span>
            ))}
          </Fragment>
        ))}
      </div>
      <p className="horde-muted">
        {t("horde.guide.upgradesShare", {
          spread: Math.round(HORDE_SPREAD_UPGRADE_SHARE * 100),
          pierce: Math.round(HORDE_PIERCE_UPGRADE_SHARE * 100),
          falloff: Math.round(HORDE_MOVE_UPGRADE_FALLOFF * 100),
        })}
      </p>
      <div className="horde-card-label">{t("horde.guide.otherCards")}</div>
      <div className="horde-moves-list">
        <div className="horde-moves-row">
          <span className="horde-moves-name">
            <b>{t("horde.multi")}</b>
          </span>
          <span className="horde-moves-stats">
            {t("horde.guide.multiStats", { n: HORDE_MULTI_TARGETS, max: HORDE_MAX_MULTI })}
          </span>
          <span className="horde-moves-trait">{t("horde.multiNote", { share: Math.round(HORDE_MULTI_REPEAT_SHARE * 100) })}</span>
        </div>
      </div>
      <TypeSynergies />
      <DuoSynergies />
    </>
  );
}

/** Every duo synergy: the two types whose exact 2 + 2 split makes it, and what it does. */
function DuoSynergies(): React.JSX.Element {
  const t = useT();
  // The duos had on in a finished run, each ticked (Master of Elements wants them all).
  const [had, setHad] = useState<HordeDuoId[]>([]);
  useEffect(() => {
    window.api
      .getHordeDuos()
      .then(setHad)
      .catch(() => setHad([]));
  }, []);
  return (
    <>
      <div className="horde-card-label">
        {t("horde.guide.duos")} <span className="horde-muted">{t("horde.duosHadCount", { n: had.length, max: HORDE_DUOS.length })}</span>
      </div>
      <p className="horde-muted">{t("horde.duoNote")}</p>
      <div className="horde-moves-list">
        {HORDE_DUOS.map((duo) => (
          <div key={duo.id} className="horde-moves-row horde-guide-synergy">
            <span className="horde-moves-name">
              {duo.types.map((type) => (
                <span key={type} className={`type-badge type-${type.toLowerCase()}`}>{typeName(type)}</span>
              ))}
              <b>{t(`horde.duo.${duo.id}` as MessageKey)}</b>
              {had.includes(duo.id) && (
                <span className="horde-duo-tick" title={t("horde.duoHad")}>
                  ✓
                </span>
              )}
            </span>
            <span className="horde-guide-synergy-part">{t(`horde.duoDesc.${duo.id}` as MessageKey)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// A sentence's first letter in capitals (the bonus and mastery texts start lower-case).
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Every type's effect, how it grows with more moves of the type, and the bonus and mastery it unlocks. */
function TypeSynergies(): React.JSX.Element {
  const t = useT();
  const counts = Array.from({ length: HORDE_EFFECT_MASTERY_MOVES }, (_, i) => i + 1);
  return (
    <>
      <div className="horde-card-label">{t("horde.guide.synergies")}</div>
      <p className="horde-muted">{t("horde.ruleEffects")}</p>
      <div className="horde-guide-levels">
        {counts.map((count) => (
          <span key={count} className="horde-moves-boost">
            {t("horde.effectLevel", {
              count,
              max: HORDE_EFFECT_MASTERY_MOVES,
              chance: HORDE_EFFECT_BY_MOVES[count].chance,
              potency: HORDE_EFFECT_BY_MOVES[count].potency,
            })}
          </span>
        ))}
      </div>
      <p className="horde-muted">{t("horde.effectOtherNote")}</p>
      <div className="horde-moves-list">
        {HORDE_MOVE_TYPES.map((type) => (
          <div key={type} className="horde-moves-row horde-guide-synergy">
            <span className="horde-moves-name">
              <span className={`type-badge type-${type.toLowerCase()}`}>{typeName(type)}</span>
              <b>{t(`horde.effect.${type}` as MessageKey)}</b>
            </span>
            {/* Its effect, then its bonus and mastery, each a part of its own. */}
            <span className="horde-guide-synergy-part">
              <span className="horde-guide-synergy-tag">{t("horde.guide.synergyEffect")}</span>
              {t(`horde.effectDesc.${type}` as MessageKey)}
            </span>
            <span className="horde-guide-synergy-part">
              <span className="horde-guide-synergy-tag">{t("horde.guide.synergyBonus", { max: HORDE_EFFECT_BONUS_MOVES })}</span>
              {capital(t(`horde.effectBonus.${type}` as MessageKey))}
            </span>
            <span className="horde-guide-synergy-part horde-guide-mastery">
              <span className="horde-guide-synergy-tag">{t("horde.guide.synergyMastery", { max: HORDE_EFFECT_MASTERY_MOVES })}</span>
              {capital(t(`horde.effectMastery.${type}` as MessageKey))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** The items foes drop on the field, and every held item a chest can hold. */
function GuideItems(): React.JSX.Element {
  const t = useT();
  return (
    <>
      <div className="horde-card-label">{t("horde.guide.fieldItems")}</div>
      <p className="horde-muted">{t("horde.guide.fieldNote")}</p>
      <div className="horde-moves-list">
        {HORDE_ITEM_IDS.map((item) => (
          <div key={item} className="horde-moves-row">
            <span className="horde-moves-name">
              <ItemSprite spritenum={HORDE_ITEMS[item].spritenum} />
              <b>{t(`horde.item.${item}` as MessageKey)}</b>
            </span>
            <span className="horde-moves-stats">{hordeItemDesc(t, item)}</span>
          </div>
        ))}
      </div>
      <div className="horde-card-label">{t("horde.guide.heldItems")}</div>
      <p className="horde-muted">{t("horde.guide.heldNote")}</p>
      <div className="horde-moves-list">
        {HELD_BY_RARITY.map((id) => {
          const def = HORDE_HELD_ITEMS[id];
          return (
            <RarityCard key={id} tier={def.rarity} className="horde-guide-held">
              <span className="horde-moves-name">
                <ItemSprite spritenum={def.spritenum} />
                <b>{itemName(def.name)}</b>
              </span>
              <span className={`horde-moves-rarity-${def.rarity}`}>
                {t(`rarity.${def.rarity}` as MessageKey)}
                {def.unique && ` · ${t("horde.guide.oncePerRun")}`}
              </span>
              <span className="horde-moves-stats">{heldBuffText(t, id, 1)}</span>
            </RarityCard>
          );
        })}
      </div>
    </>
  );
}

/** Everything a run can offer: its moves, abilities, upgrade cards and items, a tab each. */
export function HordeGuideModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT();
  const [tab, setTab] = useState<GuideTab>("moves");
  const tabs: TabStripTab<GuideTab>[] = [
    { id: "moves", label: t("horde.guide.moves") },
    { id: "abilities", label: t("horde.guide.abilities") },
    { id: "upgrades", label: t("horde.guide.upgrades") },
    { id: "items", label: t("horde.guide.items") },
  ];
  return (
    <Modal className="horde-moves-modal" title={t("horde.movesTitle")} onClose={onClose}>
      {/* The tabs stay at the top while the list scrolls under them. */}
      <div className="horde-guide-tabbar">
        <TabStrip tabs={tabs} current={tab} onSwitch={setTab} className="horde-guide-tabs" />
      </div>
      {tab === "moves" && <GuideMoves />}
      {tab === "abilities" && <GuideAbilities />}
      {tab === "upgrades" && <GuideUpgrades />}
      {tab === "items" && <GuideItems />}
    </Modal>
  );
}

// A move as it stood at the end of a run: its power and cooldown with upgrades, and its reach or shots.
function RunMove({ known }: { known: HordeRunMove }): React.JSX.Element | null {
  const t = useT();
  const move = MOVES_BY_ID.get(known.id);
  if (!move) return null;
  const kind = hordeCountKind(move);
  const extra = kind !== "hits" && hordeHasReach(move)
    ? known.range > 0 && t("horde.boost.range", { n: known.range })
    : hordeMoveDef(move).critBoost
      ? !!known.crit && t("horde.boost.crit", { n: known.crit })
      : t(kind === "bounces" ? "horde.historyBounces" : kind === "hits" ? "horde.historyHits" : "horde.historyShots", { n: hordeShownCount(move, known.count) });
  return (
    <li className="horde-history-move">
      <span className={`type-badge type-${move.type.toLowerCase()}`}>{typeName(move.type)}</span>
      <b>{moveName(move.name)}</b>
      <span className="horde-muted">
        {t("horde.movesStats", {
          power: hordeMovePower(move, known.power),
          seconds: (hordeMoveCooldown(move, known.cut) / 1000).toFixed(1),
        })}
        {extra && ` · ${extra}`}
        {" · "}
        {t("horde.historyUpgrades", { n: known.upgrades })}
      </span>
    </li>
  );
}

// The damage each move dealt in a run, the most first, as the end-of-run screen shows it.
function RunDamage({ damage }: { damage: Record<string, number> }): React.JSX.Element {
  const t = useT();
  const list = Object.entries(damage)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!list.length) return <p className="horde-muted">{t("horde.historyNoDamage")}</p>;
  const total = list.reduce((sum, [, d]) => sum + d, 0);
  return (
    <div className="horde-damage horde-history-damage">
      <div className="horde-damage-title">
        {t("horde.damageDealt")} · {total.toLocaleString(numberLocale())}
      </div>
      {list.map(([name, dmg]) => (
        <div className="horde-damage-row" key={name}>
          {/* '' holds the type effects' own damage. */}
          <span className="horde-damage-name">{name === "" ? t("horde.damageEffects") : moveName(name)}</span>
          <span className="horde-damage-bar">
            <span style={{ width: `${(dmg / list[0][1]) * 100}%` }} />
          </span>
          <b>{dmg.toLocaleString(numberLocale())}</b>
          <span className="horde-damage-share">{Math.round((dmg / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** Every finished run, newest first; picking one shows how it went. */
export function HordeHistoryModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT();
  const [history, setHistory] = useState<HordeHistoryEntry[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  // Whether the open run shows its damage stats.
  const [showDamage, setShowDamage] = useState(false);
  useEffect(() => {
    window.api
      .getHordeHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);
  const time = (run: HordeHistoryEntry): string =>
    run.won
      ? t("horde.clearedPlus", { time: formatHordeTime(run.survivedMs - HORDE_DURATION_MS) })
      : formatHordeTime(run.survivedMs);
  return (
    <Modal className="horde-history-modal" title={t("horde.historyTitle")} onClose={onClose}>
      {history === null ? null : history.length === 0 ? (
        <p className="horde-muted">{t("horde.noBest")}</p>
      ) : (
        <ol className="horde-history">
          {history.map((run, i) => {
            const area = WILD_LOCATIONS.find((l) => l.id === run.location)?.label;
            const isOpen = open === i;
            return (
              <li key={run.at + ":" + i} className={`horde-history-run${run.won ? " won" : ""}${isOpen ? " open" : ""}`}>
                <button className="horde-history-head" onClick={() => {
                    setOpen(isOpen ? null : i);
                    setShowDamage(false);
                  }}>
                  <SpriteImage
                    style="3d-static"
                    spriteId={run.spriteId}
                    shiny={run.shiny}
                    className="horde-top-sprite"
                    alt={run.species}
                  />
                  <span className="horde-top-info">
                    <b className="horde-top-name">
                      {run.species}
                      {run.shiny && <ShinyIcon />}
                    </b>
                    <span className="horde-muted">
                      {new Date(run.at).toLocaleString(numberLocale(), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {area && ` · ${area}`}
                    </span>
                  </span>
                  <span className="horde-history-sum">
                    <span className="horde-top-time">{time(run)}</span>
                    <span>
                      {t("horde.lv", { level: run.level })} · {t("horde.kos", { kos: run.kos })}
                    </span>
                    <span className="horde-history-money">{formatMoney(run.money)}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="horde-history-details">
                    <div className="horde-history-facts">
                      <span>
                        {t("horde.historyLead", {
                          from: run.starter,
                          to: run.species,
                        })}
                      </span>
                      <span>{run.won ? t("horde.historyWon") : t("horde.historyLost")}</span>
                      {run.megaEvolved && <span>{t("horde.historyMega")}</span>}
                      {run.bigNuggets > 0 && (
                        <span>{t("horde.historyNuggets", { n: run.bigNuggets })}</span>
                      )}
                    </div>
                    <div className="horde-card-label">{t("horde.historyMoves")}</div>
                    {run.moves.length ? (
                      <ul className="horde-history-moves">
                        {run.moves.map((m) => (
                          <RunMove key={m.id} known={m} />
                        ))}
                      </ul>
                    ) : (
                      <p className="horde-muted">{t("horde.historyNoMoves")}</p>
                    )}
                    {/* The tomes it held, and the held items from the chests it opened (runs from before them have none). */}
                    {!!run.tomes?.length && (
                      <>
                        <div className="horde-card-label">{t("horde.historyTomes")}</div>
                        <div className="horde-tomes">
                          {run.tomes.map((tm) => (
                            <span key={tm.stat} className="horde-tome">
                              <span className="horde-tome-name">{t((tm.stat === 'hp' ? 'horde.stat.hp' : `horde.ability.${tm.stat}`) as MessageKey)}</span>
                              <b className="horde-tome-rank">{tm.ranks}</b>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    {run.held && HORDE_HELD_IDS.some((id) => run.held?.[id]) && (
                      <>
                        <div className="horde-card-label">
                          {t("horde.heldItems", { chests: run.chests ?? 0 })}
                        </div>
                        <div className="horde-held">
                          {HORDE_HELD_IDS.filter((id) => run.held?.[id]).map((id) => {
                            const copies = run.held?.[id] ?? 0;
                            const def = HORDE_HELD_ITEMS[id];
                            return (
                              <RarityCard key={id} tier={def.rarity} className="horde-held-item">
                                <span title={`${itemName(def.name)}: ${heldBuffText(t, id, copies)}`}>
                                  <ItemSprite spritenum={def.spritenum} />
                                </span>
                                {copies > 1 && <span className="horde-held-count">×{copies}</span>}
                              </RarityCard>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {run.damage && (
                      <>
                        <button
                          className="horde-btn horde-history-damage-toggle"
                          onClick={() => setShowDamage(!showDamage)}
                        >
                          {showDamage ? t("horde.historyHideDamage") : t("horde.historyDamage")}
                        </button>
                        {showDamage && <RunDamage damage={run.damage} />}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
