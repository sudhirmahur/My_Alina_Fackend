import { Link } from 'react-router-dom'
import { Brain, ChevronRight, FileText, Image, ListChecks, LogOut, Settings } from '../components/icons'
import { Avatar, Button, Card, PageBody, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ITEMS = [
  { to: '/routine', label: 'Daily routine', hint: 'Tasks, reminders and a morning wake-up', icon: ListChecks },
  { to: '/files', label: 'Files', hint: 'Upload documents and ask questions', icon: FileText },
  { to: '/images', label: 'Images', hint: 'Your private photo library', icon: Image },
  { to: '/memory', label: 'Memory', hint: 'See, edit or delete what Alina remembers', icon: Brain },
  { to: '/settings', label: 'Settings', hint: 'Language, voice, privacy and account', icon: Settings },
]

export default function More() {
  const { user, logout } = useAuth()
  const toast = useToast()
  return (
    <>
      <PageHeader title="More" />
      <PageBody>
        <Card className="mb-5 flex items-center gap-4">
          <Avatar size={56} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{user?.display_name || 'You'}</p>
            <p className="truncate text-sm text-muted">{user?.email}</p>
          </div>
        </Card>
        <ul className="stagger space-y-2.5">
          {ITEMS.map(({ to, label, hint, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex min-h-[4.25rem] items-center gap-4 rounded-3xl border border-line bg-surface/80 px-4 transition active:scale-[.99] hover:border-accent/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <Button variant="soft" className="mt-6 w-full" icon={LogOut} onClick={async () => { await logout(); toast.info('Signed out') }}>Sign out</Button>
      </PageBody>
    </>
  )
}
