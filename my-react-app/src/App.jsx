import { useEffect, useState } from 'react'
import { DialogProvider } from './Dialog.jsx'
import Home from './pages/Home.jsx'
import RecordList from './pages/RecordList.jsx'
import RecordDetail from './pages/RecordDetail.jsx'
import AddRecord from './pages/AddRecord.jsx'
import './App.css'

// 簡易 hash 路由:#/ 、#/records 、#/records/:id 、#/add
const parseHash = () => window.location.hash.replace(/^#/, '') || '/'

export default function App() {
  const [path, setPath] = useState(parseHash)

  useEffect(() => {
    const onChange = () => setPath(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  let page
  const detail = path.match(/^\/records\/(\d+)$/)
  if (detail) page = <RecordDetail key={detail[1]} id={Number(detail[1])} />
  else if (path === '/records') page = <RecordList />
  else if (path === '/add') page = <AddRecord />
  else page = <Home />

  return (
    <DialogProvider>
      <header className="topbar">
        <a href="#/" className="logo" title="回首頁">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>我的解題記錄</span>
        </a>
      </header>
      <main className="container">{page}</main>
    </DialogProvider>
  )
}
