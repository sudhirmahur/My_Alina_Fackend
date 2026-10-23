import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Eye, EyeOff, Lock, Mail, User } from '../components/icons'
import { Avatar, Button, Card, ErrorNote, Field, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fieldErrors, friendly } from '../lib/errors'
import { browserTimezone } from '../lib/format'
import { auth } from '../services'
import { cx } from '../lib/cx'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10 pt-safe pb-safe">
      <div className="rise mb-7 flex flex-col items-center text-center">
        <div className="float"><Avatar size={112} glow /></div>
        <h1 className="mt-6 font-display text-[2rem] font-semibold leading-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      </div>
      <Card className="rise p-5" style={{ animationDelay: '.08s' }}>{children}</Card>
      <div className="rise mt-5 text-center text-sm text-muted" style={{ animationDelay: '.16s' }}>{footer}</div>
    </div>
  )
}

function PasswordInput({ value, onChange, autoComplete, invalid, placeholder = '••••••••••' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} invalid={invalid}
        placeholder={placeholder} className="pr-12" required />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink">
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

export function PasswordRules({ password }) {
  const rules = useMemo(() => [
    ['At least 10 characters', password.length >= 10],
    ['A lowercase letter', /[a-z]/.test(password)],
    ['An uppercase letter', /[A-Z]/.test(password)],
    ['A number', /\d/.test(password)],
  ], [password])
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
      {rules.map(([label, ok]) => (
        <li key={label} className={cx('flex items-center gap-1.5 text-xs transition', ok ? 'text-ok' : 'text-muted')}>
          <Check className={cx('size-3.5', !ok && 'opacity-30')} />{label}
        </li>
      ))}
    </ul>
  )
}

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try { await login({ email: email.trim(), password }); nav(loc.state?.from || '/', { replace: true }) }
    catch (err) { setError(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Welcome back" subtitle="Your voice. Your world. Your AI."
      footer={<>New here? <Link to="/register" className="font-medium text-accent">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></Field>
        <Field label="Password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={Lock}>Sign in</Button>
        <p className="text-center text-sm"><Link to="/forgot-password" className="text-muted hover:text-ink">Forgot your password?</Link></p>
      </form>
    </AuthLayout>
  )
}

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ display_name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null); setFields({})
    try {
      await register({ email: form.email.trim(), password: form.password, display_name: form.display_name.trim() || undefined, timezone: browserTimezone() })
      nav('/', { replace: true })
    } catch (err) {
      setFields(fieldErrors(err)); setError(Object.keys(fieldErrors(err)).length ? null : friendly(err))
    } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Meet Alina" subtitle="A private companion that listens, remembers only what you allow, and never pretends."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-accent">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name" error={fields.display_name}><Input value={form.display_name} onChange={set('display_name')} autoComplete="name" placeholder="What should Alina call you?" maxLength={80} /></Field>
        <Field label="Email" error={fields.email}><Input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required invalid={!!fields.email} /></Field>
        <Field label="Password" error={fields.password}>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" invalid={!!fields.password} placeholder="Create a password" />
          <PasswordRules password={form.password} />
        </Field>
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={User}>Create account</Button>
        <p className="text-center text-xs leading-relaxed text-muted">Your timezone ({browserTimezone()}) is saved so reminders ring at the right time. You can change it in Settings.</p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try { setDone(await auth.forgot(email.trim())) } catch (err) { setError(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Reset password" subtitle="We’ll email you a link if the account exists."
      footer={<Link to="/login" className="font-medium text-accent">Back to sign in</Link>}>
      {done ? (
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="flex items-start gap-2"><Mail className="mt-0.5 size-5 shrink-0 text-accent" />{done.message}</p>
          {!done.email_delivery_configured && (
            <p className="rounded-2xl border border-warn/30 bg-warn/10 p-3 text-warn">
              This server has no email service configured, so no email will actually be sent. Ask the person running Alina to reset it, or set up SMTP.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></Field>
          <ErrorNote error={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy} icon={Mail}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const mismatch = confirm && password !== confirm

  const submit = async (e) => {
    e.preventDefault()
    if (password !== confirm) return
    setBusy(true); setError(null)
    try { await auth.reset(token, password); toast.success('Password updated. Please sign in.'); nav('/login', { replace: true }) }
    catch (err) { setError(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Choose a new password" subtitle="Reset links work once and expire quickly."
      footer={<Link to="/login" className="font-medium text-accent">Back to sign in</Link>}>
      {!token ? <ErrorNote error="This reset link is missing its token. Open the link from your email again." /> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="New password" /><PasswordRules password={password} /></Field>
          <Field label="Confirm password" error={mismatch ? 'Passwords do not match' : undefined}><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" invalid={!!mismatch} placeholder="Repeat password" /></Field>
          <ErrorNote error={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!!mismatch} icon={Lock}>Update password</Button>
        </form>
      )}
    </AuthLayout>
  )
}
