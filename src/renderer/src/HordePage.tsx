import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WILD_LOCATIONS } from "../../shared/battle-types";
import {
  HORDE_BASE_STATS,
  HORDE_DURATION_MS,
  HORDE_LINEUP_REROLL_COST,
  HORDE_UPGRADES,
  formatHordeTime,
  hordeUpgradeCost,
  type HordeOffer,
  type HordeRecord,
  type HordeReward,
  type HordeSave,
  type HordeSavedRun,
  type HordeSetup,
  type HordeUpgradeId,
  type HordeUpgrades,
} from "../../shared/horde";
import SpriteImage from "./SpriteImage";
import RarityCard, { RarityGlow } from "./RarityCard";
import ShinyIcon from "./ShinyIcon";
import Tooltip from "./Tooltip";
import BuyButton from "./BuyButton";
import HordeArena from "./HordeArena";
import { HordeHistoryModal, HordeMovesModal } from "./HordeInfoModals";
import {
  LOCATION_BUTTON_BACKDROP,
  backdropUrl,
  locationIconUrl,
} from "./battleScenery";
import { formatMoney } from "./money";
import { typeName, useT } from "./i18n";

interface Props {
  busy: boolean;
  // The Poke Dollars held (null while it loads), for the upgrade shop.
  money: number | null;
  onMoneyChange: (money: number) => void;
  // A cleared run's lead went into the box.
  onBoxChange: () => void;
}

// A base stat bar's colour: red when low, through yellow and green, to teal when high.
function statColor(value: number): string {
  return `hsl(${Math.round(Math.min(value, 150) * 1.2)}, 75%, 52%)`;
}

/**
 * The Horde page: what the mode is (its rules behind an info icon) and the best 3 runs so
 * far. Start rolls the area the run is in and deals 10 random Pokemon to pick from, in a
 * window; picking one opens the arena over the whole window (see HordeArena). Below, the
 * upgrade shop: lasting upgrades bought with Poke Dollars that every run starts with.
 */
function HordePage({ busy, money, onMoneyChange, onBoxChange }: Props): React.JSX.Element {
  const t = useT();
  const [top, setTop] = useState<HordeRecord[]>([]);
  // Where the last run placed among the best, to pick it out.
  const [lastPlace, setLastPlace] = useState<number | null>(null);
  const [offer, setOffer] = useState<HordeOffer | null>(null);
  const [setup, setSetup] = useState<HordeSetup | null>(null);
  // The saved run to carry on (if any), the one being carried on, and whether it's being given up.
  const [saved, setSaved] = useState<HordeSavedRun | null>(null);
  const [resume, setResume] = useState<Omit<HordeSave, "setup"> | null>(null);
  const [givingUp, setGivingUp] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReward, setLastReward] = useState<HordeReward | null>(null);
  const [upgrades, setUpgrades] = useState<HordeUpgrades | null>(null);
  const [buying, setBuying] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  // The run history or the move list, when open.
  const [infoModal, setInfoModal] = useState<"history" | "moves" | null>(null);

  useEffect(() => {
    window.api
      .getHordeTop()
      .then(setTop)
      .catch(() => setTop([]));
    window.api
      .getHordeUpgrades()
      .then(setUpgrades)
      .catch(() => setUpgrades(null));
    loadSaved();
  }, []);

  function loadSaved(): void {
    window.api
      .getHordeSaved()
      .then(setSaved)
      .catch(() => setSaved(null));
  }

  // A run's been paid for: its place among the best, and the Poke Dollars.
  const showReward = (reward: HordeReward): void => {
    setLastReward(reward);
    setTop(reward.top);
    setLastPlace(reward.place);
    onMoneyChange(reward.moneyTotal);
    if (reward.caught) onBoxChange();
  };

  const buy = async (id: HordeUpgradeId): Promise<void> => {
    setBuying(true);
    setShopError(null);
    try {
      const result = await window.api.buyHordeUpgrade(id);
      setUpgrades(result.upgrades);
      onMoneyChange(result.moneyTotal);
    } catch (e) {
      setShopError((e as Error).message);
    } finally {
      setBuying(false);
    }
  };

  const run = async (action: () => Promise<void>): Promise<void> => {
    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const deal = (): Promise<void> =>
    run(async () => setOffer(await window.api.offerHorde()));
  // A new lot to pick from, for Poke Dollars.
  const reroll = (): Promise<void> =>
    run(async () => {
      const result = await window.api.rerollHordeOffer();
      setOffer(result.offer);
      onMoneyChange(result.moneyTotal);
    });
  // Carrying on the saved run - or giving it up, which opens it already ended, on its
  // results, paid for as it stood.
  const carryOn = (giveUp: boolean): Promise<void> =>
    run(async () => {
      const save = await window.api.resumeHorde();
      setResume({ game: save.game, choices: save.choices });
      setGivingUp(giveUp);
      setSetup(save.setup);
      setSaved(null);
    });
  const area = offer
    ? WILD_LOCATIONS.find((l) => l.id === offer.location)
    : undefined;

  return (
    <div className="horde-page">
      <div className="horde-card horde-intro">
        <div className="horde-title-row">
          <h2 className="horde-title">{t("nav.horde")}</h2>
          {/* How it plays, on hover (or a tap). */}
          <Tooltip
            className="game-corner-info"
            placement="below"
            content={
              <div className="tooltip-panel game-corner-info-panel horde-info-panel">
                <ul className="horde-rules">
                  <li>{t("horde.rule1")}</li>
                  <li>{t("horde.rule2")}</li>
                  <li>{t("horde.rule3")}</li>
                  <li>{t("horde.ruleEffects")}</li>
                  <li>{t("horde.ruleDrops")}</li>
                  <li>{t("horde.rule4")}</li>
                </ul>
              </div>
            }
          >
            <span
              className="game-corner-info-icon"
              aria-label={t("horde.howToPlay")}
            >
              i
            </span>
          </Tooltip>
        </div>
        <p className="horde-pitch">{t("horde.pitch")}</p>
        {saved ? (
          // A saved run: carry it on, or give it up.
          <div className="horde-saved">
            <SpriteImage
              style="3d-static"
              spriteId={saved.spriteId}
              shiny={saved.shiny}
              className="horde-top-sprite"
              alt={saved.species}
            />
            <span className="horde-top-info">
              <span className="horde-card-label">{t("horde.savedRun")}</span>
              <b className="horde-top-name">
                {saved.species}
                {saved.shiny && <ShinyIcon />}
              </b>
              <span className="horde-top-time">
                {WILD_LOCATIONS.find((l) => l.id === saved.location)?.label} ·{" "}
                {t("horde.savedInfo", {
                  level: saved.level,
                  time: formatHordeTime(saved.survivedMs),
                  kos: saved.kos,
                })}
              </span>
            </span>
            <span className="horde-saved-actions">
              <button
                className="horde-btn horde-btn-primary"
                disabled={busy || working}
                onClick={() => void carryOn(false)}
              >
                {t("horde.continue")}
              </button>
              <button
                className="horde-btn"
                disabled={busy || working}
                onClick={() => void carryOn(true)}
              >
                {t("horde.giveUp")}
              </button>
            </span>
          </div>
        ) : (
          <button
            className="horde-btn horde-btn-primary horde-start"
            disabled={busy || working}
            onClick={() => void deal()}
          >
            {t("horde.start")}
          </button>
        )}
        {error && !offer && <p className="horde-error">{error}</p>}
      </div>

      <div className="horde-card horde-best">
        <div className="horde-card-label">{t("horde.bestRuns")}</div>
        {top.length ? (
          <ol className="horde-top">
            {top.map((record, i) => (
              <li
                key={i}
                className={`horde-top-run${i === lastPlace ? " horde-top-new" : ""}`}
              >
                <span className="horde-top-place">{i + 1}</span>
                <SpriteImage
                  style="3d-static"
                  spriteId={record.spriteId}
                  shiny={record.shiny}
                  className="horde-top-sprite"
                  alt={record.species}
                />
                <span className="horde-top-info">
                  <b className="horde-top-name">
                    {record.species}
                    {record.shiny && <ShinyIcon />}
                  </b>
                  <span className="horde-top-time">
                    {record.won
                      ? t("horde.clearedPlus", {
                          time: formatHordeTime(
                            record.survivedMs - HORDE_DURATION_MS,
                          ),
                        })
                      : formatHordeTime(record.survivedMs)}
                  </span>
                  <span className="horde-top-kos">
                    {t("horde.kos", { kos: record.kos })}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="horde-muted">{t("horde.noBest")}</p>
        )}
        {lastReward && (
          <p className="horde-last">
            {t("horde.lastEarned", { money: formatMoney(lastReward.money) })}
          </p>
        )}
      </div>

      {/* The run history and the list of every move. */}
      <div className="horde-info-buttons">
        <button
          className="horde-info-button"
          onClick={() => setInfoModal("history")}
        >
          <span className="horde-info-button-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <span className="horde-info-button-text">
            <span className="horde-info-button-label">
              {t("horde.historyButton")}
            </span>
            <span className="horde-info-button-sub">
              {t("horde.historyButtonSub")}
            </span>
          </span>
          <span className="horde-info-button-arrow" aria-hidden="true">
            ›
          </span>
        </button>
        <button
          className="horde-info-button"
          onClick={() => setInfoModal("moves")}
        >
          <span className="horde-info-button-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
          </span>
          <span className="horde-info-button-text">
            <span className="horde-info-button-label">
              {t("horde.movesButton")}
            </span>
            <span className="horde-info-button-sub">
              {t("horde.movesButtonSub")}
            </span>
          </span>
          <span className="horde-info-button-arrow" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
      {infoModal === "history" && (
        <HordeHistoryModal onClose={() => setInfoModal(null)} />
      )}
      {infoModal === "moves" && (
        <HordeMovesModal onClose={() => setInfoModal(null)} />
      )}

      {/* The upgrade shop: each upgrade's ranks, what they add so far, and the next one's price. */}
      <div className="horde-card horde-shop">
        <div className="horde-shop-head">
          <div className="horde-card-label" title={t("horde.upgradesNote")}>
            {t("horde.shopTitle")}
          </div>
          {money !== null && (
            <span className="horde-shop-money">{formatMoney(money)}</span>
          )}
        </div>
        {upgrades && (
          <div className="horde-shop-grid">
            {HORDE_UPGRADES.map((def) => {
              const rank = upgrades[def.id];
              const cost = hordeUpgradeCost(def, rank);
              return (
                <div
                  key={def.id}
                  className={`horde-upgrade${cost === null ? " horde-upgrade-maxed" : ""}`}
                  title={t(`horde.upgrade.${def.id}.desc`, { n: def.per })}
                >
                  <span className="horde-upgrade-head">
                    <span className="horde-upgrade-name">
                      {t(`horde.upgrade.${def.id}`)}
                    </span>
                    <span className="horde-upgrade-rank">
                      {rank}/{def.max}
                    </span>
                  </span>
                  {/* What it gives now, big, and what the next rank would make it. */}
                  <span className="horde-upgrade-values">
                    <span
                      className={`horde-upgrade-now${rank === 0 ? " horde-upgrade-now-none" : ""}`}
                    >
                      {rank > 0
                        ? t(`horde.upgrade.${def.id}.now`, {
                            n: def.per * rank,
                          })
                        : t("horde.upgradeNone")}
                    </span>
                    {cost !== null && (
                      <span className="horde-upgrade-next">
                        {t("horde.upgradeNext", {
                          value: t(`horde.upgrade.${def.id}.now`, {
                            n: def.per * (rank + 1),
                          }),
                        })}
                      </span>
                    )}
                  </span>
                  <span className="horde-upgrade-foot">
                    {/* One pip per rank: bought ones lit, the next one outlined (none once maxed). */}
                    {cost !== null && (
                      <span
                        className="horde-upgrade-pips"
                        title={t("horde.upgradeRank", { rank, max: def.max })}
                      >
                        {Array.from({ length: def.max }, (_, i) => (
                          <span
                            key={i}
                            className={`horde-upgrade-pip${i < rank ? " horde-upgrade-pip-on" : i === rank ? " horde-upgrade-pip-next" : ""}`}
                          />
                        ))}
                      </span>
                    )}
                    {cost === null ? (
                      <span className="horde-upgrade-max">
                        {t("horde.upgradeMax")}
                      </span>
                    ) : (
                      <BuyButton
                        price={cost}
                        currency="money"
                        held={money}
                        busy={buying || working}
                        onBuy={() => void buy(def.id)}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {shopError && <p className="horde-error">{shopError}</p>}
      </div>

      {offer &&
        createPortal(
          <div
            className="modal-overlay"
            onMouseDown={() => !working && setOffer(null)}
          >
            <div
              className="modal-panel horde-pick-modal"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* The area the run is in: its backdrop, its name and the types found there,
                  with the window's title above. */}
              <div
                className="horde-area"
                style={{
                  backgroundImage: `url(${backdropUrl(LOCATION_BUTTON_BACKDROP[offer.location])})`,
                }}
              >
                <span className="horde-area-title">
                  {working ? t("horde.starting") : t("horde.pickOne")}
                </span>
                <span className="horde-area-row">
                  <span className="horde-area-name">
                    <img
                      className="horde-area-icon"
                      src={locationIconUrl(offer.location)}
                      alt=""
                    />
                    {area?.label}
                  </span>
                  {area?.types && (
                    <span className="horde-area-types">
                      {area.types.map((type) => (
                        <span
                          key={type}
                          className={`type-badge type-${type.toLowerCase()}`}
                        >
                          {typeName(type)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </div>
              {/* Clearing the run keeps the pick; the lot only changes after a run that counts. */}
              <div className="horde-pick-reward">
                <b>{t("horde.pickReward")}</b>
                <span>{t("horde.pickKept")}</span>
              </div>
              <div className="horde-pick-grid">
                {offer.starters.map((s) => {
                  // The card shows what it ends up as (its Mega if it has one).
                  const top = s.mega ?? s.finalForm ?? s;
                  return (
                    <button
                      key={s.species}
                      className={`horde-pick${s.shiny ? " horde-pick-shiny" : ""}`}
                      disabled={working}
                      onClick={() =>
                        void run(async () => {
                          setSetup(await window.api.startHorde(s.species));
                          setOffer(null);
                        })
                      }
                    >
                      <RarityCard
                        tier={s.rarityTier}
                        lift={!working}
                        className="horde-pick-card"
                      >
                        {s.mega && (
                          <Tooltip
                            className="horde-pick-mega-corner"
                            content={t("horde.pickMega", {
                              name: s.mega.species,
                            })}
                          >
                            <span className="horde-pick-mega-tag">MEGA</span>
                          </Tooltip>
                        )}
                        {/* A shiny one shines: a golden halo behind it and sparkles around it. */}
                        <span className="horde-pick-stage">
                          {s.shiny && (
                            <>
                              <span
                                className="horde-pick-shine"
                                aria-hidden="true"
                              />
                              <span
                                className="horde-pick-sparkles"
                                aria-hidden="true"
                              >
                                <i />
                                <i />
                                <i />
                                <i />
                              </span>
                            </>
                          )}
                          <RarityGlow size={92} stand>
                            <SpriteImage
                              style="3d-static"
                              spriteId={top.spriteId}
                              shiny={s.shiny}
                              className="horde-pick-sprite"
                              alt={top.species}
                            />
                          </RarityGlow>
                        </span>
                        <span className="horde-pick-name">
                          {top.species}
                          {s.shiny && <ShinyIcon />}
                        </span>
                        <span className="horde-pick-types">
                          {(s.finalForm?.types ?? s.types).map((type) => (
                            <span
                              key={type}
                              className={`type-badge type-${type.toLowerCase()}`}
                            >
                              {typeName(type)}
                            </span>
                          ))}
                        </span>
                        {/* Its base stats as bars, full at 150. */}
                        <span className="horde-pick-stats">
                          {HORDE_BASE_STATS.map((stat) => {
                            const value = s.baseStats[stat];
                            return (
                              <span key={stat} className="horde-pick-stat">
                                <span className="horde-pick-stat-label">
                                  {t(`horde.pickStat.${stat}`)}
                                </span>
                                <span className="horde-pick-stat-bar">
                                  <span
                                    className="horde-pick-stat-fill"
                                    style={{
                                      width: `${Math.min(100, (value / 150) * 100)}%`,
                                      background: statColor(value),
                                    }}
                                  />
                                </span>
                                <span className="horde-pick-stat-value">
                                  {value}
                                </span>
                              </span>
                            );
                          })}
                        </span>
                      </RarityCard>
                    </button>
                  );
                })}
              </div>
              {error && <p className="horde-error">{error}</p>}
              <div className="horde-pick-actions">
                <span className="horde-pick-reroll">
                  {t("horde.rerollLineup")}
                  <BuyButton
                    price={HORDE_LINEUP_REROLL_COST}
                    currency="money"
                    held={money}
                    busy={working}
                    title={t("horde.rerollLineupTip")}
                    onBuy={() => void reroll()}
                  />
                </span>
                <button
                  className="horde-btn"
                  disabled={working}
                  onClick={() => setOffer(null)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {setup && (
        <HordeArena
          setup={setup}
          resume={resume}
          giveUp={givingUp}
          onExit={(reward) => {
            setSetup(null);
            setResume(null);
            setGivingUp(false);
            if (reward) showReward(reward);
            // Saved and quit - it's shown to carry on.
            loadSaved();
          }}
        />
      )}
    </div>
  );
}

export default HordePage;
