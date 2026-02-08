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
                <Route path='/synthtext/' element={<App tab='guide' />} />
                <Route path='/synthtext/guide' element={<App tab='guide' />} />
                <Route path='/synthtext/sandbox' element={<App tab='sandbox' />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
)
