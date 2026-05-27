import { useState } from 'react'
import { Zap, Check, AlertCircle } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import Button from './ui/Button'
import styles from './BatchGenerator.module.css'

export default function BatchGenerator({ sceneId, projectId, sceneLineCount, onComplete }) {
  const api = useApi()
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleBatchGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const endpoint = sceneId
        ? `/batch/generate-scene/${sceneId}`
        : `/batch/generate-project/${projectId}`

      const res = await api.post(endpoint)
      setResult(res.data)
      onComplete?.()
    } catch (err) {
      if (err.response?.data?.code === 'LIMIT_REACHED') {
        setError('Generation limit reached. Upgrade your plan to continue.')
      } else {
        setError(err.response?.data?.error || err.message)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  if (result) {
    return (
      <div className={styles.result}>
        <div className={styles.resultIcon}>
          {result.failed > 0 ? (
            <AlertCircle size={24} color="var(--error)" />
          ) : (
            <Check size={24} color="var(--success)" />
          )}
        </div>
        <div className={styles.resultText}>
          <h4>{result.message}</h4>
          {result.errors?.length > 0 && (
            <div className={styles.errors}>
              <p className={styles.errorLabel}>Errors:</p>
              {result.errors.slice(0, 3).map((err, i) => (
                <p key={i} className={styles.errorItem}>{err}</p>
              ))}
              {result.errors.length > 3 && (
                <p className={styles.errorItem}>+{result.errors.length - 3} more errors</p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setResult(null)}
        >
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        <p className={styles.label}>
          Ready to generate {sceneLineCount} {sceneLineCount === 1 ? 'line' : 'lines'}?
        </p>
        <p className={styles.hint}>
          Batch generation will create audio for all lines without audio files.
        </p>
      </div>
      <Button
        onClick={handleBatchGenerate}
        loading={isGenerating}
        disabled={isGenerating || sceneLineCount === 0}
        style={{ width: '100%' }}
      >
        <Zap size={14} />
        Generate all
      </Button>
      {error && (
        <div className={styles.alertError}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
