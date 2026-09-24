// Publishes the build in dist/ as a GitHub Release, which the game's
// Options → Check for updates then offers to every copy of it.
//
//   npm version patch --no-git-tag-version     (bump the version first: 0.1.0 -> 0.1.1)
//   npm run release -- "What changed in this version"
//
// `npm run release` builds the game (npm run dist) and then runs this, which uploads
// dist/pkmnPvE-<version>-win.zip to the repo in package.json's "updateRepo" as release
// v<version>, using the GitHub CLI (gh) you're logged into.

import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
const repo = pkg.updateRepo
const zip = `dist/pkmnPvE-${version}-win.zip`
const notes = process.argv.slice(2).join(' ').trim() || `pkmnPvE ${version}`

if (!repo) throw new Error('Set "updateRepo" in package.json first')
if (!existsSync(zip)) throw new Error(`${zip} not found - run npm run dist first`)

const existing = execFileSync('gh', ['release', 'list', '--repo', repo, '--json', 'tagName', '--jq', '.[].tagName'], {
  encoding: 'utf8'
})
if (existing.split('\n').includes(`v${version}`)) {
  throw new Error(`v${version} is already released - bump the version (npm version patch --no-git-tag-version)`)
}

execFileSync('gh', ['release', 'create', `v${version}`, zip, '--repo', repo, '--title', `v${version}`, '--notes', notes], {
  stdio: 'inherit'
})
console.log(`Released v${version} to https://github.com/${repo}/releases`)
