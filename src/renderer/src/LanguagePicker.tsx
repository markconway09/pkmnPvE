import { LOCALES, LOCALE_NAMES } from '../../shared/i18n'
import TabStrip from './TabStrip'
import { setLocale, useLocale } from './i18n'

/** The language tabs, each named in its own language - in Options and on the login screen. */
function LanguagePicker({ className }: { className?: string }): React.JSX.Element {
  const locale = useLocale()
  return (
    <TabStrip
      className={className}
      tabs={LOCALES.map((id) => ({ id, label: LOCALE_NAMES[id] }))}
      current={locale}
      onSwitch={setLocale}
    />
  )
}

export default LanguagePicker
