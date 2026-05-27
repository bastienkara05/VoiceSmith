import { useState } from 'react'
import { Download, CheckCircle, AlertCircle } from 'lucide-react'
import Button from './ui/Button'
import styles from './UnityExport.module.css'

export default function GodotExport({ projectId, projectName, audioCount }) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleExport = async () => {
    if (audioCount === 0) {
      setError('No audio files to export. Generate voice lines first.')
      return
    }

    setIsExporting(true)
    setError(null)
    setSuccess(false)

    try {
      console.log('Starting Godot export for project:', projectId)

      const response = await fetch(`/api/export/godot/${projectId}`, {
        method: 'GET',
      })

      console.log('Export response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()
      console.log('Downloaded blob size:', blob.size)

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectName.replace(/\s+/g, '_')}_Godot_Export.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Export error:', err)
      setError(err.message)
    } finally {
      setIsExporting(false)
    }
  }

  if (audioCount === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.disabled}>
          <AlertCircle size={16} />
          <span>Generate voice lines to export</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {success ? (
        <div className={styles.success}>
          <CheckCircle size={16} />
          <span>Export ready!</span>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            onClick={handleExport}
            loading={isExporting}
            disabled={isExporting}
            style={{ width: '100%' }}
          >
            <Download size={14} />
            Export for Godot
          </Button>
          {error && (
            <div className={styles.error}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
