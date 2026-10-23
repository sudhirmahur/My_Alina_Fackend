import { Link } from 'react-router-dom'
import { Avatar, Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex max-w-xs flex-col items-center gap-4">
        <Avatar size={88} glow />
        <h1 className="font-display text-2xl font-semibold">Lost your way?</h1>
        <p className="text-sm text-muted">That page doesn’t exist. Let’s get you back home.</p>
        <Link to="/"><Button>Go home</Button></Link>
      </div>
    </div>
  )
}
