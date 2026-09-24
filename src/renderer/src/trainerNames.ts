export const NPC_TRAINER_NAMES: string[] = [
  'Aidan', 'Alina', 'Barrett', 'Briar', 'Callum', 'Cora', 'Dashiell', 'Delphine',
  'Emeric', 'Fenna', 'Garrick', 'Hollis', 'Idris', 'Jorah', 'Kestrel', 'Lior',
  'Maren', 'Niall', 'Orin', 'Perrin', 'Quill', 'Rasmus', 'Sable', 'Talon',
  'Ursa', 'Vesper', 'Wren', 'Xander', 'Yara', 'Zephyrine', 'Ada', 'Bram',
  'Clover', 'Dorian', 'Elowen', 'Falkor', 'Greta', 'Haldor', 'Ilsa', 'Jasper',
  'Kaida', 'Lachlan', 'Moss', 'Nova', 'Osric', 'Piper', 'Quentin', 'Rowan',
  'Sorrel', 'Thane', 'Una', 'Vale', 'Wilder', 'Yorick', 'Zinnia', 'Ember',
  'Flint', 'Gale', 'Harlow', 'Indigo', 'Juniper', 'Knox', 'Larkin', 'Marigold',
  'Nash', 'Ondine', 'Percival', 'Reyna', 'Sylas', 'Tavish', 'Vireo', 'Winslow'
]

export function randomTrainerName(): string {
  return NPC_TRAINER_NAMES[Math.floor(Math.random() * NPC_TRAINER_NAMES.length)]
}
