import { t } from './i18n'

/** The shiny star (Scarlet and Violet's), sized to sit in a line of text. */
function ShinyIcon({ className }: { className?: string }): React.JSX.Element {
  return <img className={`shiny-icon${className ? ` ${className}` : ''}`} src="./icons/shiny.png" alt={t('common.shiny')} title={t('common.shiny')} />
}

export default ShinyIcon
