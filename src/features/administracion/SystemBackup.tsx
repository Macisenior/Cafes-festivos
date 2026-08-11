import { useState, type ChangeEvent } from 'react'
import type { Firestore } from 'firebase/firestore'
import { FirestoreV4BackupService } from '../../infrastructure/firestore/firestore-v4-backup-service'
import { FirestoreV4GroupReadService } from '../../infrastructure/firestore/firestore-v4-group-read-service'
import { parseV4Backup, summarizeV4Backup, type V4Backup } from './v4-backup'

interface SystemBackupProps { firestore: Firestore }

function backupFilename(date = new Date()): string {
  return `gastos-grupo-v4-backup-${date.toISOString().slice(0, 10)}.json`
}

/** La copia sigue siendo solo lectura. La restauración queda bloqueada hasta migrarla a una Function administrativa segura. */
export function SystemBackup({ firestore }: SystemBackupProps) {
  const [backup, setBackup] = useState<V4Backup | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reader = () => new FirestoreV4BackupService(new FirestoreV4GroupReadService(firestore), {
    replaceAll: async () => { throw new Error('La restauración requiere una Function administrativa segura.') },
  })

  async function createBackup() {
    setError(null); setMessage(null)
    try {
      const data = await reader().createBackup(new Date().toISOString())
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = backupFilename(); link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage('Copia de seguridad V4 creada.')
    } catch (reason) {
      setError(reason instanceof Error ? `No se ha podido crear la copia: ${reason.message}` : 'No se ha podido crear la copia.')
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setBackup(null); setSelectedFileName(null); setMessage(null); setError(null)
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setBackup(parseV4Backup(await file.text()))
      setSelectedFileName(file.name)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'El archivo no es válido.')
    }
  }

  const summary = backup ? summarizeV4Backup(backup) : null
  return <section className="system-backup" aria-labelledby="system-backup-title">
    <div className="section-heading"><div><p className="eyebrow">Sistema</p><h2 id="system-backup-title">Copias y Restauración</h2></div></div>
    <div className="system-backup-grid">
      <article><h3>📦 Crear copia de seguridad</h3><p>Descarga todos los datos de Gastos del Grupo V4.</p><button type="button" onClick={() => void createBackup()}>Crear copia</button></article>
      <article><h3>♻️ Restaurar copia</h3><p>Valida una copia antes de restaurarla mediante una futura Function administrativa segura.</p><div className="file-picker-wrap"><label className="file-picker">Seleccionar archivo<input type="file" accept="application/json,.json" onChange={(event) => void selectFile(event)} /></label>{selectedFileName && <span className="selected-file-name">{selectedFileName}</span>}</div></article>
    </div>
    {summary && <div className="backup-summary"><strong>Copia válida encontrada</strong><span>{summary.groups} grupos · {summary.people} personas · {summary.contributions} aportaciones · {summary.expenses} gastos</span><p>La restauración completa de V4 está pendiente de una Function administrativa segura. Esta pantalla no escribe datos.</p></div>}
    {message && <p className="operation-message">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
