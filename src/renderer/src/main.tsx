import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { installMenuSounds } from './sfx'
import { startMusic } from './music'
import { installDragScroll } from './dragScroll'
import { installLongPress } from './longPress'

installMenuSounds()
startMusic()
installDragScroll()
installLongPress()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
