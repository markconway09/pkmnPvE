// A Horde move's twist (see HordeTrait in shared/horde-moves.ts), in words.
import { HORDE_HURT_RECENT_MS, hordeMoveDef, type HordeLeadStat, type HordeMove } from '../../shared/horde'
import type { MessageKey } from '../../shared/i18n'
import { typeName, type Translate } from './i18n'

const STAT_KEYS: Record<HordeLeadStat, MessageKey> = { atk: 'horde.stat.atk', def: 'horde.stat.def', spe: 'horde.stat.spe' }

const pct = (share: number): number => Math.round(share * 100)
const secs = (ms: number): string => String(Math.round(ms / 100) / 10)

/** What a move does that no other does, in a sentence. */
export function hordeTraitText(t: Translate, move: HordeMove): string {
  const tr = hordeMoveDef(move).trait
  const stat = (s: HordeLeadStat): string => t(STAT_KEYS[s])
  const effect = (type: string): string => t(`horde.effect.${type}` as MessageKey)
  switch (tr.kind) {
    case 'momentum':
      return t('horde.trait.momentum', { n: tr.max })
    case 'dash':
      return t('horde.trait.dash', { n: tr.reach })
    case 'burrow':
      return t('horde.trait.burrow', { s: secs(tr.ms), n: tr.reach })
    case 'triAttack':
      return t('horde.trait.triAttack', { chance: tr.chance })
    case 'bounce':
      return t('horde.trait.bounce', { n: tr.jumps, share: pct(tr.share) })
    case 'boomerang':
      return t('horde.trait.boomerang', { share: pct(tr.share) })
    case 'split':
      return tr.upgrades > 0
        ? t('horde.trait.splitAt', { up: tr.upgrades, n: tr.shots, share: pct(tr.share) })
        : t('horde.trait.split', { n: tr.shots, share: pct(tr.share) })
    case 'multiHit':
      return tr.min === tr.max ? t('horde.trait.multiHitFixed', { min: tr.min }) : t('horde.trait.multiHit', { min: tr.min, max: tr.max })
    case 'everyNth':
      return t('horde.trait.everyNth', { n: tr.n, extra: tr.extra })
    case 'pierceGrow':
      return t('horde.trait.pierceGrow', { n: tr.per })
    case 'bigBlast':
      return t('horde.trait.bigBlast', { n: tr.bonus })
    case 'starStreams':
      return t('horde.trait.starStreams', { n: tr.count })
    case 'wideRing':
      return t('horde.trait.wideRing', { n: tr.bonus })
    case 'reach':
      return t('horde.trait.reach', { n: tr.bonus })
    case 'cleave':
      return t('horde.trait.cleave', { n: tr.extra })
    case 'gold':
      return t('horde.trait.gold', { n: tr.amount })
    case 'knockback':
      return t('horde.trait.knockback')
    case 'pull':
      return t('horde.trait.pull')
    case 'splash':
      return t(tr.boom ? 'horde.trait.splashBoom' : 'horde.trait.splash', { share: pct(tr.share) })
    case 'exhaust':
      return t('horde.trait.exhaust', { n: tr.slow, s: secs(tr.ms) })
    case 'typeCut':
      return t('horde.trait.typeCut', { s: secs(tr.ms), type: typeName(tr.type) })
    case 'echo':
      return t('horde.trait.echo', { n: tr.max, type: typeName(tr.type) })
    case 'typeBoost':
      return t('horde.trait.typeBoost', { n: tr.per, max: tr.max, type: typeName(tr.type) })
    case 'hurl':
      return t('horde.trait.hurl', { share: pct(tr.share) })
    case 'recoil':
      return t('horde.trait.recoil', { share: pct(tr.share) })
    case 'drain':
      return t('horde.trait.drain', { share: pct(tr.share) })
    case 'koHeal':
      return t('horde.trait.koHeal', { share: pct(tr.share) })
    case 'koStack':
      return t('horde.trait.koStack', { n: tr.per, max: tr.max })
    case 'charge':
      return t('horde.trait.charge', { s: secs(tr.ms) })
    case 'rampage':
      return t('horde.trait.rampage', { s: secs(tr.ms), every: secs(tr.everyMs) })
    case 'selfDrop':
      return t('horde.trait.selfDrop', { stat: stat(tr.stat), n: tr.percent, s: secs(tr.ms) })
    case 'selfHurt':
      return t('horde.trait.selfHurt', { n: tr.percent })
    case 'selfBurn':
      return t('horde.trait.selfBurn', { n: tr.percent, s: secs(tr.ms) })
    case 'selfBoost':
      return t('horde.trait.selfBoost', { chance: tr.chance, stats: tr.stats.map(stat).join(', '), n: tr.percent, s: secs(tr.ms) })
    case 'foeDrop':
      return t('horde.trait.foeDrop', { stat: stat(tr.stat), n: tr.percent, s: secs(tr.ms) })
    case 'scaleWith':
      return t(`horde.trait.scale.${tr.source}` as MessageKey, { n: tr.amount, s: secs(HORDE_HURT_RECENT_MS) })
    case 'escalate':
      return t('horde.trait.escalate', { n: tr.per, max: tr.max })
    case 'critUp':
      return t('horde.trait.critUp', { n: tr.chance })
    case 'alwaysCrit':
      return t('horde.trait.alwaysCrit')
    case 'bodyPress':
      return t('horde.trait.bodyPress')
    case 'vsBig':
      return t('horde.trait.vsBig', { n: tr.bonus })
    case 'vsStatus':
      return tr.type ? t('horde.trait.vsStatusType', { n: tr.bonus, effect: effect(tr.type) }) : t('horde.trait.vsStatus', { n: tr.bonus })
    case 'superVs':
      return t('horde.trait.superVs', { type: typeName(tr.type) })
    case 'firstStrike':
      return t('horde.trait.firstStrike', { n: tr.bonus })
    case 'far':
      return t('horde.trait.far', { n: tr.bonus })
    case 'counter':
      return t('horde.trait.counter', { n: tr.bonus })
    case 'armorPierce':
      return t('horde.trait.armorPierce', { n: pct(tr.share) })
    case 'flinch':
      return t(tr.slowed ? 'horde.trait.flinchSlowed' : 'horde.trait.flinch', { chance: tr.chance })
    case 'freeze':
      return t('horde.trait.freeze', { chance: tr.chance, s: secs(tr.ms) })
    case 'paralyze':
      return t('horde.trait.paralyze', { chance: tr.chance })
    case 'confuse':
      return t(tr.fullHp ? 'horde.trait.confuseFull' : 'horde.trait.confuse', { chance: tr.chance })
    case 'inflict':
      return tr.chance >= 100
        ? t('horde.trait.inflictSure', { effect: effect(tr.type) })
        : t('horde.trait.inflict', { chance: tr.chance, effect: effect(tr.type) })
    case 'chain':
      return t('horde.trait.chain', { n: tr.jumps, share: pct(tr.share) })
    case 'zone':
      return tr.drift ? t('horde.trait.zonePull', { s: secs(tr.ms) }) : t(tr.slow ? 'horde.trait.zoneSlow' : 'horde.trait.zone', { s: secs(tr.ms) })
    case 'trap':
      return t('horde.trait.trap', { s: secs(tr.ms) })
    case 'storm':
      return t('horde.trait.storm', { n: tr.count, share: pct(tr.share) })
    case 'aftershock':
      return t('horde.trait.aftershock', { share: pct(tr.share) })
    case 'delayed':
      return t('horde.trait.delayed', { s: secs(tr.ms) })
  }
}
