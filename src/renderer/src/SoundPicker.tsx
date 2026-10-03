import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TabStrip from './TabStrip'
import { SFX_LIBRARY } from './sfxLibrary'
import {
  DEFAULT_SFX_CHOICES,
  SFX_LABELS,
  SFX_NAMES,
  previewSfxFile,
  setSfxChoice,
  sfxChoices,
  type SfxName
} from './sfx'

interface Props {
  onClose: () => void
}

/** "switch_012" -> { group: "switch", number: 12 } - the packs number each kind of sound. */
function splitName(file: string): { group: string; number: number } {
  const match = /^(.*?)_?(\d+)$/.exec(file)
  return match ? { group: match[1], number: Number(match[2]) } : { group: file, number: 1 }
}

/**
 * Picks which Kenney sound plays for each menu sound: a tab per menu sound, every sound in
 * both packs below it, grouped by kind. Clicking one plays it and makes it the pick.
 */
function SoundPicker({ onClose }: Props): React.JSX.Element {
  const [current, setCurrent] = useState<SfxName>('click')
  const [choices, setChoices] = useState(sfxChoices)

  // Esc closes just this window, not Options behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const packs = useMemo(
    () =>
      SFX_LIBRARY.map((pack) => {
        const groups: { group: string; files: { file: string; number: number }[] }[] = []
        for (const name of pack.files) {
          const { group, number } = splitName(name)
          let entry = groups.find((g) => g.group === group)
          if (!entry) groups.push((entry = { group, files: [] }))
          entry.files.push({ file: `${pack.id}/${name}`, number })
        }
        return { ...pack, groups }
      }),
    []
  )

  const choose = (file: string): void => {
    setSfxChoice(current, file)
    setChoices(sfxChoices())
    if (file) previewSfxFile(file)
  }

  const picked = choices[current]
  const pickedLabel = picked ? picked.split('/')[1] : 'Off'

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel sound-picker" onMouseDown={(e) => e.stopPropagation()}>
        <TabStrip
          tabs={SFX_NAMES.map((name) => ({ id: name, label: SFX_LABELS[name].label }))}
          current={current}
          onSwitch={setCurrent}
          onClose={onClose}
        />
        <div className="sound-picker-bar">
          <span className="sound-picker-hint">
            {SFX_LABELS[current].hint} - <b>{pickedLabel}</b>
          </span>
          <button
            data-sfx="none"
            className={!picked ? 'sound-picker-active' : undefined}
            onClick={() => choose('')}
          >
            Off
          </button>
          <button
            data-sfx="none"
            disabled={picked === DEFAULT_SFX_CHOICES[current]}
            onClick={() => choose(DEFAULT_SFX_CHOICES[current])}
          >
            Default
          </button>
        </div>
        <div className="sound-picker-list" data-sfx="none">
          {packs.map((pack) => (
            <section key={pack.id} className="sound-picker-pack">
              <h3 className="sound-picker-pack-name">{pack.label}</h3>
              {pack.groups.map(({ group, files }) => (
                <div key={group} className="sound-picker-group">
                  <span className="sound-picker-group-name">{group}</span>
                  <div className="sound-picker-chips">
                    {files.map(({ file, number }) => (
                      <button
                        key={file}
                        className={`sound-picker-chip${file === picked ? ' sound-picker-active' : ''}`}
                        title={file.split('/')[1]}
                        onClick={() => choose(file)}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SoundPicker
