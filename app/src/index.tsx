import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Routes, Route, BrowserRouter } from 'react-router-dom'
import App from './components/App.tsx'
import './styles/index.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route index element={<App />} />
                <Route path='/syntxt/' element={<App tab='guide' />} />
                <Route path='/syntxt/guide' element={<App tab='guide' />} />
                <Route path='/syntxt/sandbox' element={<App tab='sandbox' />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
)
