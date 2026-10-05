import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { installMenuSounds } from './sfx'
import { startMusic } from './music'
import { installDragScroll } from './dragScroll'

installMenuSounds()
startMusic()
installDragScroll()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
