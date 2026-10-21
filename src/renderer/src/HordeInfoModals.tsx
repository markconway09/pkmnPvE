import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WILD_LOCATIONS } from "../../shared/battle-types";
import {
  HORDE_DURATION_MS,
  HORDE_HELD_IDS,
  HORDE_HELD_ITEMS,
  HORDE_MOVE_TYPES,
  formatHordeTime,
  hordeCountKind,
  hordeShownCount,
  hordeHasReach,
  hordeMoveCooldown,
  hordeMoveDef,
  hordeMoveCatalog,
  hordeMovePower,
  hordeMoveShape,
  type HordeHistoryEntry,
  type HordeMove,
  type HordeRunMove,
} from "../../shared/horde";
import type { MessageKey } from "../../shared/i18n";
import SpriteImage from "./SpriteImage";
import ShinyIcon from "./ShinyIcon";
import { formatMoney } from "./money";
import { itemName, moveName, numberLocale, typeName, useT } from "./i18n";
import ItemSprite from "./ItemSprite";
import RarityCard from "./RarityCard";
import { heldBuffText } from "./HordeChestOpen";
import { hordeTraitText } from "./hordeMoveText";

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

/** Every move a run can learn, by type: how it hits, and what its upgrades can raise and by how much. */
export function HordeMovesModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT();
  // Showing one type's moves, or every type's.
  const [type, setType] = useState<string | null>(null);
  const types = HORDE_MOVE_TYPES;
  const shown = type ? ALL_MOVES.filter((m) => m.type === type) : ALL_MOVES;
  return (
    <Modal className="horde-moves-modal" title={t("horde.movesTitle")} onClose={onClose}>
      <p className="horde-muted">{t("horde.movesNote")}</p>
      <div className="horde-moves-filter">
        <button
          className={`horde-moves-filter-all${type === null ? " active" : ""}`}
          onClick={() => setType(null)}
        >
          {t("horde.movesAll")}
        </button>
        {types.map((ty) => (
          <button
            key={ty}
            className={`type-badge type-${ty.toLowerCase()} horde-moves-filter-type${type === ty ? " active" : ""}`}
            onClick={() => setType(type === ty ? null : ty)}
          >
            {typeName(ty)}
          </button>
        ))}
      </div>
      <div className="horde-moves-list">
        {shown.map((move) => (
          // Just what tells moves apart at a glance: type, name, shape, power, cooldown and its twist.
          <div key={move.id} className="horde-moves-row">
            <span className="horde-moves-name">
              <span className={`type-badge type-${move.type.toLowerCase()}`}>{typeName(move.type)}</span>
              <b>{moveName(move.name)}</b>
            </span>
            <span className="horde-moves-shape">{t(`horde.shape.${hordeMoveShape(move)}` as MessageKey)}</span>
            <span className="horde-moves-stats">
              {t("horde.movesStats", {
                power: hordeMovePower(move),
                seconds: (hordeMoveCooldown(move) / 1000).toFixed(1),
              })}
            </span>
            <span className="horde-moves-trait">{hordeTraitText(t, move)}</span>
          </div>
        ))}
      </div>
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
