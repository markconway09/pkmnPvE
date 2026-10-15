// Every area's English lines, joined into one table (en.ts adds the core ones).
import { battle } from './battle'
import { data } from './data'
import { menu } from './menu'
import { ui } from './ui'
import { box } from './box'
import { editor } from './editor'
import { collection } from './collection'
import { dex } from './dex'
import { items } from './items'
import { field } from './field'
import { tower } from './tower'
import { draft } from './draft'
import { corner } from './corner'
import { rewards } from './rewards'
import { social } from './social'
import { errors } from './errors'
import { game } from './game'

export const areas = {
  ...battle,
  ...data,
  ...menu,
  ...ui,
  ...box,
  ...editor,
  ...collection,
  ...dex,
  ...items,
  ...field,
  ...tower,
  ...draft,
  ...corner,
  ...rewards,
  ...social,
  ...errors,
  ...game
}
