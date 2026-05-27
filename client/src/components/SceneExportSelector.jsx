import { useState, useEffect, useRef } from 'react'
import { Download, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react'
import Button from './ui/Button'
import styles from './SceneExportSelector.module.css'

export default function SceneExportSelector({ sceneId, sceneName, audioCount }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const engines = [
    { key: 'unity', label: 'Unity', endpoint: '/api/export/scene-unity' },
    { key: 'unreal', label: 'Unreal Engine', endpoint: '/api/export/scene-unreal' },
    { key: 'godot', label: 'Godot', endpoint: '/api/export/scene-godot' },
    { key: 'audio', label: 'Audio Only', endpoint: '/api/export/scene-audio' },
  ]

  const handleExport = async (engine) => {
    if (audioCount === 0) {
      setError('No audio files to export. Generate voice lines first.')
      return
    }

    setIsExporting(true)
    setError(null)
    setSuccess(null)
    setIsOpen(false)

    try {
      console.log(`Starting ${engine.label} export for scene:`, sceneId)

      const response = await fetch(`${engine.endpoint}/${sceneId}`, {
        method: 'GET',
      })

      console.log('Export response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()
      console.log('Downloaded blob size:', blob.size)

      let filename
      if (engine.key === 'audio') {
        filename = `${sceneName.replace(/\s+/g, '_')}_Audio.zip`
      } else {
        filename = `${sceneName.replace(/\s+/g, '_')}_${engine.key.charAt(0).toUpperCase() + engine.key.slice(1)}_Export.zip`
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess(engine.label)
      setTimeout(() => setSuccess(null), 3000)
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
    <div className={styles.container} ref={containerRef}>
      {success ? (
        <div className={styles.success}>
          <CheckCircle size={16} />
          <span>Export ready!</span>
        </div>
      ) : (
        <>
          <div className={styles.dropdownWrapper}>
            <button
              className={styles.dropdownBtn}
              onClick={() => setIsOpen(!isOpen)}
              disabled={isExporting}
            >
              <Download size={14} />
              <span>Export scene</span>
              <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
            </button>

            {isOpen && (
              <div className={styles.dropdownMenu}>
                {engines.map(engine => (
                  <button
                    key={engine.key}
                    className={styles.dropdownItem}
                    onClick={() => handleExport(engine)}
                    disabled={isExporting}
                  >
                    {engine.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
