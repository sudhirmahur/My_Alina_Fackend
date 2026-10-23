import { useEffect, useState } from 'react'
import NotificationCard from '../components/NotificationCard'
import { Brain, Cpu, Download, KeyRound, Languages, LogOut, Palette, RefreshCw, ShieldCheck, Smile, Trash2, User, Volume2, Clock, Bell } from '../components/icons'
import { Badge, Button, Card, ConfirmDialog, ErrorNote, Field, Input, PageBody, PageHeader, Segmented, Select, Sheet, Skeleton, Switch, Textarea } from '../components/ui'
import { PasswordRules } from './Auth'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import useSpeaker from '../hooks/useSpeaker'
import { cx } from '../lib/cx'
import { exportMyData } from '../lib/exportData'
import { friendly } from '../lib/errors'
import { browserTimezone, timezones } from '../lib/format'
import { ai, auth, health, voice } from '../services'
import { Link } from 'react-router-dom'

const PRESETS = [
  ['friendly', 'Friendly', 'Warm and easygoing'], ['playful', 'Playful', 'Light humour, upbeat'], ['calm', 'Calm', 'Gentle and unhurried'],
  ['mentor', 'Mentor', 'Encouraging, guides you'], ['professional', 'Professional', 'Clear and concise'],
]

function Section({ icon: Icon, title, children, hint }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted"><Icon className="size-4 text-accent" />{title}</h2>
      <Card className="space-y-1">{children}</Card>
      {hint && <p className="px-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </section>
  )
}

function ServiceRow({ name, state, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0"><p className="text-[0.95rem] font-medium">{name}</p>{detail && <p className="mt-0.5 break-words text-xs leading-snug text-muted">{detail}</p>}</div>
      <Badge tone={state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : 'danger'}>{state === 'ok' ? 'Working' : state === 'warn' ? 'Not set up' : 'Unavailable'}</Badge>
    </div>
  )
}

export default function Settings() {
  const { user, setUser, logout } = useAuth()
  const { settings: st, loaded, update } = useSettings()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const speaker = useSpeaker()
  const [name, setName] = useState(user?.display_name || '')
  const [custom, setCustom] = useState('')
  const [speed, setSpeed] = useState(1)
  const [pw, setPw] = useState(null) // { current, next }
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [exporting, setExporting] = useState('')
  const [del, setDel] = useState(null) // { password, text }
  const [delBusy, setDelBusy] = useState(false)
  const [delError, setDelError] = useState(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const voices = useResource(() => voice.voices(), [])
  const aiStatus = useResource(() => ai.status(), [])
  const aiModels = useResource(() => ai.models(), [])
  const vStatus = useResource(() => voice.status(), [])
  const storage = useResource(() => health.storage(), [])

  useEffect(() => { setCustom(st.personality?.custom_instructions || '') }, [st.personality?.custom_instructions])
  useEffect(() => { setSpeed(st.voice?.speed || 1) }, [st.voice?.speed])
  useEffect(() => { setName(user?.display_name || '') }, [user?.display_name])

  const save = async (patch, ok = 'Saved') => {
    try { await update(patch); toast.success(ok, 1800) } catch (e) { toast.error(friendly(e)) }
  }

  const saveName = async () => {
    try { setUser(await auth.updateProfile({ display_name: name.trim() })); toast.success('Name updated') } catch (e) { toast.error(friendly(e)) }
  }
  const changePassword = async () => {
    setPwBusy(true); setPwError(null)
    try {
      await auth.updateProfile({ current_password: pw.current, new_password: pw.next })
      toast.success('Password changed. Please sign in again.')
      setPw(null); await logout()
    } catch (e) { setPwError(friendly(e)) } finally { setPwBusy(false) }
  }
  const doExport = async () => {
    try {
      const r = await exportMyData(user, setExporting)
      toast.success(`Exported ${r.chats} chats, ${r.memories} memories, ${r.tasks} tasks, ${r.reminders} reminders`)
    } catch (e) { toast.error(friendly(e)) } finally { setExporting('') }
  }
  const deleteAccount = async () => {
    setDelBusy(true); setDelError(null)
    try { await auth.deleteAccount(del.password); await logout(); toast.success('Your account and data were deleted') }
    catch (e) { setDelError(friendly(e)) } finally { setDelBusy(false) }
  }

  const tzList = Array.from(new Set([st.timezone, browserTimezone(), ...timezones()].filter(Boolean)))
  const deviceTz = browserTimezone()
  const ttsOn = voices.data?.tts_configured
  const aiOk = aiStatus.data?.available

  return (
    <>
      <PageHeader title="Settings" back="/more" />
      <PageBody className="space-y-7">
        {!loaded && <Skeleton className="h-40" />}

        <Section icon={User} title="Profile">
          <Field label="Name"><div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="What should Alina call you?" />
            <Button variant="soft" disabled={!name.trim() || name.trim() === user?.display_name} onClick={saveName}>Save</Button></div></Field>
          <Field label="Email" className="pt-3"><Input value={user?.email || ''} readOnly className="opacity-70" /></Field>
          <div className="pt-3"><Button variant="soft" icon={KeyRound} onClick={() => { setPw({ current: '', next: '' }); setPwError(null) }}>Change password</Button></div>
        </Section>

        <Section icon={Languages} title="Language & time zone">
          <Field label="Alina replies in">
            <Select value={st.language} onChange={(e) => save({ language: e.target.value }, 'Language updated')}>
              <option value="auto">Match my message</option><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option><option value="hinglish">Hinglish</option>
            </Select>
          </Field>
          <Field label="Time zone" className="pt-3" hint="Used for reminders, quiet hours and “today”.">
            <Select value={st.timezone} onChange={(e) => save({ timezone: e.target.value }, 'Time zone updated')}>{tzList.map((z) => <option key={z} value={z}>{z}</option>)}</Select>
          </Field>
          {st.timezone !== deviceTz && <Button size="sm" variant="soft" className="mt-3" onClick={() => save({ timezone: deviceTz }, 'Using device time zone')}>Use this device’s ({deviceTz})</Button>}
        </Section>

        <Section icon={Smile} title="Personality">
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map(([v, label, hint]) => (
              <button key={v} onClick={() => save({ personality: { preset: v } }, 'Personality updated')} aria-pressed={st.personality?.preset === v}
                className={cx('rounded-2xl border p-3 text-left transition active:scale-[.98]', st.personality?.preset === v ? 'border-accent bg-accent/12' : 'border-line bg-raised/50 hover:border-accent/40')}>
                <span className="block text-[0.95rem] font-medium">{label}</span><span className="text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
          <Field label="Your own instructions (optional)" className="pt-3" hint={`${custom.length}/500 · e.g. “Call me Boss and keep answers short.”`}>
            <Textarea value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={500} rows={3} />
          </Field>
          <Button size="sm" variant="soft" className="mt-2" disabled={custom.trim() === (st.personality?.custom_instructions || '')} onClick={() => save({ personality: { custom_instructions: custom.trim() } }, 'Instructions saved')}>Save instructions</Button>
        </Section>

        <Section icon={Volume2} title="Voice" hint={ttsOn === false ? 'The server has no text-to-speech engine, so Alina uses your device’s own voice.' : undefined}>
          {ttsOn && (
            <Field label="Voice"><Select value={st.voice?.voice_id || ''} onChange={(e) => save({ voice: { voice_id: e.target.value || null } }, 'Voice updated')}>
              <option value="">Default</option>{voices.data.voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
          )}
          <Field label={`Speaking speed · ${speed.toFixed(1)}×`} className="pt-2">
            <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
              onPointerUp={() => save({ voice: { speed } }, 'Speed updated')} onKeyUp={() => save({ voice: { speed } }, 'Speed updated')} className="h-11 w-full accent-[var(--accent)]" />
          </Field>
          <Switch checked={!!st.voice?.auto_speak} onChange={(v) => save({ voice: { auto_speak: v } })} label="Read replies aloud automatically" />
          <Button size="sm" variant="soft" icon={Volume2} onClick={() => (speaker.speakingId ? speaker.stop() : speaker.speak('Hi, I’m Alina. This is how I sound.', 'test'))}>{speaker.speakingId ? 'Stop' : 'Hear a sample'}</Button>
        </Section>

        <Section icon={Clock} title="Quiet hours" hint="During quiet hours Alina won’t pop up reminder alerts; the server also holds push notifications.">
          <Switch checked={!!st.quiet_hours?.enabled} onChange={(v) => save({ quiet_hours: { enabled: v } })} label="Enable quiet hours" />
          {st.quiet_hours?.enabled && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="From"><Input type="time" value={st.quiet_hours.start} onChange={(e) => e.target.value && save({ quiet_hours: { start: e.target.value } })} /></Field>
              <Field label="Until"><Input type="time" value={st.quiet_hours.end} onChange={(e) => e.target.value && save({ quiet_hours: { end: e.target.value } })} /></Field>
            </div>
          )}
        </Section>

        <Section icon={Bell} title="Notifications"><NotificationCard /></Section>

        <Section icon={ShieldCheck} title="Privacy & memory">
          <Switch checked={!!st.privacy?.memory_consent} onChange={(v) => save({ privacy: { memory_consent: v } }, v ? 'Memory is on' : 'Memory is off')} label="Allow Alina to keep memories" description="Off by default. Memories are only saved when you choose." />
          <Switch checked={!!st.privacy?.use_memory_in_chat} onChange={(v) => save({ privacy: { use_memory_in_chat: v } })} label="Use memories in my chats" />
          <Switch checked={!!st.privacy?.allow_sensitive_memory} onChange={(v) => save({ privacy: { allow_sensitive_memory: v } })} label="Allow sensitive memories" description="Health, finances and other private details — still needs your OK each time." />
          <Switch checked={false} disabled onChange={() => {}} label="Keep voice recordings" description="Never. Audio is processed and discarded." />
          <Link to="/memory" className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"><Brain className="size-4" />Manage memories</Link>
        </Section>

        <Section icon={Cpu} title="Alina’s services" hint="Everything runs on the server you connect to. Anything not set up is clearly marked — nothing is faked.">
          {aiStatus.loading ? <Skeleton className="h-12" /> : <ServiceRow name={`AI model${aiStatus.data?.configured_model ? ` · ${aiStatus.data.configured_model}` : ''}`}
            state={aiOk ? 'ok' : 'bad'} detail={aiOk ? (aiStatus.data.latency_ms ? `Responded in ${aiStatus.data.latency_ms} ms` : aiStatus.data.detail) : aiStatus.data?.detail || friendly(aiStatus.error)} />}
          {aiModels.data?.models?.length > 0 && <p className="pb-1 text-xs text-muted">Installed: {aiModels.data.models.map((m) => m.name).join(', ')}</p>}
          {vStatus.data && <>
            <ServiceRow name="Speech to text" state={vStatus.data.stt.available ? 'ok' : vStatus.data.stt.configured ? 'bad' : 'warn'} detail={vStatus.data.stt.detail} />
            <ServiceRow name="Text to speech" state={vStatus.data.tts.available ? 'ok' : vStatus.data.tts.configured ? 'bad' : 'warn'} detail={vStatus.data.tts.detail} />
          </>}
          {storage.data && (() => {
            const d = storage.data.details || {}
            const state = !d.images_configured ? 'warn' : d.images_healthy ? 'ok' : 'bad'
            const detail = !d.images_configured ? 'Cloudinary keys are not set on the server.' : d.images_healthy ? 'Connected.' : 'Cloudinary is not responding.'
            return <ServiceRow name="Image storage" state={state} detail={detail} />
          })()}
          {storage.data && <ServiceRow name="Document storage" state={storage.data.details?.documents_healthy ? 'ok' : 'bad'} detail={storage.data.details?.documents_healthy ? 'Private folder is writable.' : 'The server cannot write uploaded documents.'} />}
          <Button size="sm" variant="soft" icon={RefreshCw} className="mt-2" onClick={() => { aiStatus.reload(); aiModels.reload(); vStatus.reload(); storage.reload() }}>Check again</Button>
        </Section>

        <Section icon={Palette} title="Appearance">
          <Segmented value={theme} onChange={setTheme} label="Theme" options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }]} />
        </Section>

        <Section icon={Download} title="Your data" hint="Downloads your chats, memories, tasks, reminders and settings as one JSON file. File and image contents are not included.">
          <Button variant="soft" icon={Download} loading={!!exporting} onClick={doExport}>{exporting || 'Export my data'}</Button>
        </Section>

        <Section icon={LogOut} title="Account">
          <div className="flex flex-col gap-2">
            <Button variant="soft" icon={LogOut} onClick={() => logout()}>Sign out</Button>
            <Button variant="soft" icon={LogOut} onClick={() => setConfirmAll(true)}>Sign out on all devices</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setDel({ password: '', text: '' }); setDelError(null) }}>Delete my account</Button>
          </div>
        </Section>
        <p className="pb-2 text-center text-xs text-muted">Alina · your voice, your world, your AI</p>
      </PageBody>

      <Sheet open={!!pw} onClose={() => setPw(null)} title="Change password"
        footer={<Button className="w-full" size="lg" loading={pwBusy} disabled={!pw?.current || !pw?.next} onClick={changePassword}>Change password</Button>}>
        {pw && <div className="space-y-4">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><PasswordRules password={pw.next} /></Field>
          <p className="text-xs text-muted">For your safety, changing your password signs you out everywhere.</p>
          <ErrorNote error={pwError} />
        </div>}
      </Sheet>

      <ConfirmDialog open={confirmAll} onClose={() => setConfirmAll(false)} confirmLabel="Sign out everywhere" title="Sign out on all devices?" text="Every device, including this one, will need to sign in again." onConfirm={() => logout(true)} />

      <Sheet open={!!del} onClose={() => !delBusy && setDel(null)} title="Delete your account"
        footer={<div className="flex gap-3"><Button variant="soft" className="flex-1" onClick={() => setDel(null)} disabled={delBusy}>Cancel</Button>
          <Button variant="solidDanger" className="flex-1" loading={delBusy} disabled={!del?.password || del?.text !== 'DELETE MY ACCOUNT'} onClick={deleteAccount}>Delete forever</Button></div>}>
        {del && <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">This permanently deletes your chats, memories, files, images, tasks, reminders and settings. It cannot be undone. Backups the server keeps may hold copies until they expire.</p>
          <Field label="Your password"><Input type="password" autoComplete="current-password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
          <Field label="Type DELETE MY ACCOUNT to confirm"><Input value={del.text} onChange={(e) => setDel({ ...del, text: e.target.value })} autoCapitalize="characters" autoComplete="off" /></Field>
          <ErrorNote error={delError} />
        </div>}
      </Sheet>
    </>
  )
}
