import { useState, type FormEvent, type ReactNode } from 'react'
import type { ProtectedArea } from '../../config/access-pin-config'

interface PinGuardProps {
  area: ProtectedArea
  isUnlocked: boolean
  isConfigured: boolean
  validatePin(pin: string): Promise<void>
  onUnlock(pin: string): void
  children: ReactNode
}

const labels: Readonly<Record<ProtectedArea, string>> = {
  operational: 'Operativa',
  administration: 'Administración',
}

/** Guard reutilizable: valida el PIN correspondiente sin persistirlo en el navegador. */
export function PinGuard({ area, isUnlocked, isConfigured, validatePin, onUnlock, children }: PinGuardProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isValidating) return

    setError(null)
    setIsValidating(true)
    try {
      await validatePin(pin)
      onUnlock(pin)
      setPin('')
    } catch (reason) {
      setPin('')
      setError(reason instanceof Error ? reason.message : 'El PIN no es correcto. Inténtalo de nuevo.')
    } finally {
      setIsValidating(false)
    }
  }

  if (isUnlocked) return <>{children}</>
  if (!isConfigured) return <section className="pin-guard" aria-labelledby={`${area}-pin-title`}><p className="eyebrow">Acceso protegido</p><h1 id={`${area}-pin-title`}>Desbloquear {labels[area]}</h1><p className="form-error" role="alert">El PIN de esta zona no está configurado.</p></section>

  return (
    <section className="pin-guard" aria-labelledby={`${area}-pin-title`}>
      <p className="eyebrow">Acceso protegido</p>
      <h1 id={`${area}-pin-title`}>Desbloquear {labels[area]}</h1>
      <p>Introduce el PIN para acceder a esta pantalla durante la sesión actual.</p>
      <form onSubmit={submit} className="pin-form">
        <label>
          PIN
          <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} disabled={isValidating} required />
        </label>
        <button type="submit" disabled={isValidating}>{isValidating ? 'Verificando…' : `Desbloquear ${labels[area]}`}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}