import { useState } from 'react'
import { BellRing, Info } from './icons'
import { Button, Card } from './ui'
import { useToast } from '../context/ToastContext'
import { showSystemNotification } from '../hooks/useReminderWatcher'

/** Honest notification setup: permission + a test, and a clear statement of what is (not) possible. */
export default function NotificationCard({ compact = false }) {
  const toast = useToast()
  const supported = typeof Notification !== 'undefined'
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported')

  const enable = async () => {
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') { toast.success('Notifications enabled'); await showSystemNotification('Alina', 'Notifications are on. I’ll nudge you when a reminder is due.', 'welcome') }
  }
  const test = async () => {
    const ok = await showSystemNotification('Alina test', 'This is how your reminders will look.', 'test')
    if (!ok) toast.error('Could not show a notification. Check your browser settings.')
  }

  if (compact && perm === 'granted') return null
  return (
    <Card className="flex gap-3.5">
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-accent2/15 text-accent2"><BellRing className="size-5" /></span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p className="font-medium">Reminder notifications</p>
        {perm === 'unsupported' && <p className="mt-1 text-muted">This browser doesn’t support notifications. Reminders will still appear inside Alina while it’s open.</p>}
        {perm === 'default' && <><p className="mt-1 text-muted">Allow notifications so a reminder can pop up when it’s due.</p><Button size="sm" className="mt-3" onClick={enable}>Enable notifications</Button></>}
        {perm === 'granted' && <><p className="mt-1 text-muted">Notifications are on for this device.</p><Button size="sm" variant="soft" className="mt-3" onClick={test}>Send a test</Button></>}
        {perm === 'denied' && <p className="mt-1 text-muted">Notifications are blocked. Allow them in your browser’s site settings to get reminder alerts.</p>}
        <p className="mt-3 flex gap-1.5 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" />
          Alina can alert you while it’s open. Alerts when the app is closed need push notifications to be set up on the server — they are not the same as a native alarm clock.</p>
      </div>
    </Card>
  )
}
