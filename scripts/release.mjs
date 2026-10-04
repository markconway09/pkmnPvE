// Publishes the build in dist/ as a GitHub Release, which the game's
// Options → Check for updates then offers to every copy of it.
//
//   npm version patch --no-git-tag-version     (bump the version first: 0.1.0 -> 0.1.1)
//   npm run release
//
// The release notes come from two hand-written files: release-notes/<version>.md, the full
// notes grouped by where players notice each change, and release-notes/<version>-short.txt,
// a few plain lines for the game's update box. The release holds the short version, then
// FULL_NOTES_MARKER, then the full one; the game shows only what's before the marker.
// Notes typed after `npm run release --` are used instead when there's no full file.
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
const notesFile = `release-notes/${version}.md`
const shortNotesFile = `release-notes/${version}-short.txt`
// Keep in step with FULL_NOTES_MARKER in src/main/updater.ts.
const FULL_NOTES_MARKER = '<!-- full notes -->'
// npm on Windows hands arguments over through cmd.exe, escaping every character
// with ^ on the way - undo that so the notes read as typed.
const typedNotes =
  process.argv
    .slice(2)
    .join(' ')
    .replace(/\^(.)/g, '$1')
    .replace(/\^$/, '')
    .trim()
const fullNotes = existsSync(notesFile) ? readFileSync(notesFile, 'utf8').trim() : typedNotes || `pkmnPvE ${version}`
if (!existsSync(notesFile)) console.warn(`No ${notesFile} - releasing with ${typedNotes ? 'the typed notes' : 'no notes'}`)
const shortNotes = existsSync(shortNotesFile) ? readFileSync(shortNotesFile, 'utf8').trim() : ''
if (!shortNotes) console.warn(`No ${shortNotesFile} - the game's update box will show the full notes`)
const notes = shortNotes ? `${shortNotes}

${FULL_NOTES_MARKER}

${fullNotes}` : fullNotes

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
