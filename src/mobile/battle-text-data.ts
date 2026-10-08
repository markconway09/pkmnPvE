import source from '../../resources/showdown/battle-text-en.cjs?raw'

// The mobile build's stand-in for src/main/showdown/vendor/battle-text-data.ts:
// the same Showdown client battle text, bundled into the page instead of read
// from the app folder at runtime. The file is CommonJS (exports.BattleText...),
// so it is run against a stand-in `exports` object.

const exports: { BattleText?: typeof globalThis.BattleText } = {}
new Function('exports', source)(exports)
if (!exports.BattleText) throw new Error('battle-text-en.cjs did not define BattleText')
globalThis.BattleText = exports.BattleText

export {}
