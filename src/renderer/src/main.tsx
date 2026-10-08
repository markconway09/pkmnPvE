import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { installMenuSounds } from './sfx'
import { startMusic } from './music'
import { installDragScroll } from './dragScroll'
import { installLongPress } from './longPress'
import { installTouchTitles } from './touchTitles'
import { IS_MOBILE } from './platform'

installMenuSounds()
startMusic()
installDragScroll()
installLongPress()
if (IS_MOBILE) installTouchTitles()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
