import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Элемент #root не найден в index.html')

/**
 * База приложения: `/` при прямой работе модуля и `/diagrams-module/`, когда
 * модуль встроен в общее приложение реестра (nginx проксирует префикс).
 * Значение приходит из сборки (vite base → import.meta.env.BASE_URL).
 */
const basename = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/'

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
