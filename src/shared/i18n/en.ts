// Every line of the game's text in English, by key. The other languages (es.ts) give the
// same keys. Keys are grouped by where the line shows; "common." ones are used anywhere.

import { areas } from './en/all'

export type Message = string | { one: string; other: string }

export const en = {
  ...areas,

  'common.cancel': 'Cancel',
  'common.click': 'Click',
  'common.tap': 'Tap',
  'common.clickLc': 'click',
  'common.tapLc': 'tap',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.on': 'On',
  'common.off': 'Off',
  'common.muted': 'Muted',
  'common.open': 'Open ▸',
  'common.continue': 'Continue ▸',

  'about.fanNotice':
    'pkmnPvE is a free, non-commercial fan project and is not affiliated with Nintendo, Game Freak, Creatures or The Pokémon Company. Pokémon and its names are trademarks of their respective owners.',

  // The sidebar and the Home screen's tool buttons.
  'nav.home': 'Home',
  'nav.catch': 'Catch',
  'nav.box': 'Box',
  'nav.battles': 'Battles',
  'nav.tower': 'Battle Tower',
  'nav.draft': 'Draft',
  'nav.raid': 'Max Raid',
  'nav.corner': 'Game Corner',
  'nav.items': 'Items',
  'nav.pokedex': 'Pokédex',
  'nav.rewards': 'Rewards',
  'nav.achievements': 'Achievements',
  'nav.options': 'Options',
  'nav.locked': 'Finish the game in play first',

  'difficulty.easy': 'Easy',
  'difficulty.normal': 'Normal',
  'difficulty.hard': 'Hard',
  'difficulty.extreme': 'Extreme',

  'draftFormat.singles': 'Singles',
  'draftFormat.doubles': 'Doubles',
  'draftFormat.chaos': 'Chaos',

  // Home: the mode cards and the Continue banners.
  'home.draftPicking': 'drafting pick {round}/{rounds}',
  'home.draftModifier': 'choosing a modifier',
  'home.draftRecord': '{wins}W {losses}L',
  'home.draftRecordNext': '{wins}W {losses}L · next: {name}',
  'home.continueRun': 'Continue your run',
  'home.runLine': 'Floor {floor} · {count} Pokémon · next: {boss}',
  'home.continueDraft': 'Continue your draft',
  'home.levelCap': 'Level cap {cap}',
  'home.runInProgress': 'Run in progress · floor {floor}',
  'home.bestFloor': 'Best: floor {floor}',
  'home.bestFloorDifficulty': 'Best: floor {floor} ({difficulty})',
  'home.towerPitch': 'Climb floor by floor with one starter',
  'home.draftInProgress': 'Draft in progress · {progress}',
  'home.draftPitch': 'Build a team from random picks',
  'home.raidCrystals': { one: '{count} Raid Crystal', other: '{count} Raid Crystals' },
  'home.raidLocked': 'Beat {boss} to open',
  'home.moreBosses': 'more bosses',
  'home.coins': { one: '{count} coin', other: '{count} coins' },
  'home.dexNavHunting': 'DexNav: hunting {species}',
  'home.chain': 'Chain {chain}',
  'home.catchPitch': 'Find and catch wild Pokémon',
  'home.boxPitch': 'Your Pokémon and team',
  'home.boxCount': '{count} Pokémon',
  'home.missions': "Today's missions",

  'login.title': 'Log in',
  'login.hint': "Enter a username to load its save. A name that doesn't exist yet starts a new one.",
  'login.username': 'Username',
  'login.remember': 'Remember me on this computer',
  'login.existing': 'Loads the saved game for this name.',
  'login.new': 'New player - starts a fresh save.',
  'login.logIn': 'Log in',
  'login.create': 'Create & log in',
  'login.players': 'Players on this computer',

  'options.title': 'Options',
  'options.closeEsc': 'Close (Esc)',
  'options.language': 'Language',
  'options.languageHint': 'Pokémon, move and item names and the battle text are still in English for now.',

  'sound.title': 'Sound',
  'sound.menus': 'Menus',
  'sound.cries': 'Cries',
  'sound.music': 'Music',
  'sound.gameCorner': 'Game Corner',
  'sound.switch': '{name} sound',
  'sound.turnOn': 'Turn {name} on',
  'sound.turnOff': 'Turn {name} off',
  'sound.volume': '{name} volume',

  'music.tracks': { one: '{count} track', other: '{count} tracks' },
  'music.source.freetouse': 'Free To Use lofi',
  'music.source.links': 'My links',
  'music.source.folder': 'My folder',
  'music.freetouseHint': '{tracks} of free lofi from freetouse.com, streamed - so no music while offline.',
  'music.linksHint':
    "One link per line: direct audio files (.mp3, .ogg...) or internet radio streams, played in order. Pages like YouTube or Spotify won't work - the link has to be the audio itself.",
  'music.useLinks': 'Use these links',
  'music.folderHint': 'Plays the music files in a folder on this computer (and its subfolders), shuffled. Works offline.',
  'music.chooseFolder': 'Choose folder…',
  'music.lookAgain': 'Look again',
  'music.noFolder': 'No folder chosen yet.',
  'music.scanning': 'Looking through {folder}…',
  'music.noFiles': 'no music files found',

  'screen.title': 'Screen size',
  'screen.auto': 'Auto',
  'screen.mobile': 'Mobile',
  'screen.autoHint': 'Fits the game to this screen - {percent}% here.',
  'screen.mobileHint': 'The phone layout, in a phone-shaped window fitted to this screen. Switching reloads the game.',
  'screen.fixedHint': 'The game always draws at this size; the window is never bigger than the screen.',

  'anim.title': 'Move animations',
  'anim.normal': 'Normal',
  'anim.fast': 'Fast',
  'anim.off': 'Off',

  'sprites.title': 'Sprite style',
  'sprites.2d-static': '2D',
  'sprites.2d-animated': '2D Animated',
  'sprites.3d-static': '3D',
  'sprites.3d-animated': '3D Animated',

  'background.title': 'Background',
  'background.default': 'Default',
  'background.gallery': 'Choose from gallery…',
  'background.chooseImage': 'Choose image…',
  'background.reset': 'Reset to default',
  'background.cantOpen': "That picture couldn't be opened",

  'saves.title': 'Saves',
  'saves.hint': 'Move this save to another device, or back it up.',
  'saves.warning':
    "Your save lives only on this device. Export a save file now and then, and always before reinstalling the game or switching devices - it's the only way to get it back.",
  'saves.button': 'Saves…',

  'about.title': 'About',
  'about.showdown':
    "Battles run on Pokémon Showdown (MIT License, © Guangcong Luo and contributors). The full notices are in THIRD_PARTY_NOTICES.md on the game's GitHub page.",
  'about.guide': 'Welcome guide…',
  'about.credits': 'Sprite credits…',
  'about.bug': 'Found a bug? Report it on GitHub.',
  'about.bugWithLog': 'Found a bug? Report it on GitHub - and attach errors.log from the log folder, it shows what went wrong.',
  'about.reportBug': 'Report a bug',
  'about.openLogs': 'Open log folder',

  'account.title': 'Account',
  'account.loggedInAs': 'Logged in as {name}',
  'account.logOut': 'Log out',

  'updates.title': 'Updates',
  'updates.version':
    'Version {version} - your saves are kept when updating; trainers and other game data come from the new version.',
  'updates.checking': 'Checking…',
  'updates.check': 'Check for updates',
  'updates.upToDate': 'Up to date (latest is {version})',
  'updates.noReleases': 'No releases have been published yet',
  'updates.available': 'Version {version} is available ({size}).',
  'updates.download': 'Download update',
  'updates.downloadHint':
    "Your browser downloads the new version - open the file once it's done and tap Update to install it over this one.",
  'updates.updating': 'Updating…',
  'updates.now': 'Update now',
  'updates.browserCopy': 'This copy runs in a browser, not the phone app - install the new APK on a phone instead.',
  'updates.devCopy': 'This is the development copy - update it with git instead.',
  'updates.downloading': 'Downloading… {received} of {total}',
  'updates.unpacking': 'Unpacking…',
  'updates.restarting': 'Installing - the game will close and reopen in a moment…'
} satisfies Record<string, Message>
