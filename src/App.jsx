import { Component } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { PublicOnly, RequireAuth } from './components/Guards'
import { Button } from './components/ui'
import { ForgotPassword, Login, Register, ResetPassword } from './pages/Auth'
import { ChatEmpty, ChatLayout } from './pages/ChatLayout'
import Conversation from './pages/Conversation'
import Files from './pages/Files'
import Home from './pages/Home'
import Images from './pages/Images'
import Memory from './pages/Memory'
import More from './pages/More'
import NotFound from './pages/NotFound'
import Routine from './pages/Routine'
import Settings from './pages/Settings'
import Voice from './pages/Voice'

class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('UI error', error) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-xs space-y-4">
          <h1 className="font-display text-2xl font-semibold">Something broke</h1>
          <p className="text-sm text-muted">Alina hit an unexpected problem. Your data is safe — reload to continue.</p>
          <Button onClick={() => location.reload()}>Reload</Button>
        </div>
      </div>
    )
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="chat" element={<ChatLayout />}>
              <Route index element={<ChatEmpty />} />
              <Route path=":chatId" element={<Conversation />} />
            </Route>
            <Route path="voice" element={<Voice />} />
            <Route path="routine" element={<Routine />} />
            <Route path="files" element={<Files />} />
            <Route path="images" element={<Images />} />
            <Route path="memory" element={<Memory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="more" element={<More />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  )
}
