import { useState, useEffect, useRef } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import styles from './DashboardProjectExport.module.css'

export default function DashboardProjectExport({ projectId, projectName, audioCount }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
    { key: 'unity', label: 'Unity', endpoint: '/api/export/unity' },
    { key: 'unreal', label: 'Unreal Engine', endpoint: '/api/export/unreal' },
    { key: 'godot', label: 'Godot', endpoint: '/api/export/godot' },
    { key: 'audio', label: 'Audio Only', endpoint: '/api/export/audio' },
  ]

  const handleExport = async (engine) => {
    if (audioCount === 0) return

    setIsExporting(true)
    setIsOpen(false)

    try {
      const response = await fetch(`${engine.endpoint}/${projectId}`, { method: 'GET' })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()

      let filename
      if (engine.key === 'audio') {
        filename = `${projectName.replace(/\s+/g, '_')}_Audio.zip`
      } else {
        filename = `${projectName.replace(/\s+/g, '_')}_${engine.key.charAt(0).toUpperCase() + engine.key.slice(1)}_Export.zip`
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.btn}
        onClick={() => setIsOpen(!isOpen)}
        disabled={audioCount === 0 || isExporting}
        title={audioCount === 0 ? 'No audio to export' : 'Export project'}
      >
        <Download size={14} />
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className={styles.menu}>
          {engines.map(engine => (
            <button
              key={engine.key}
              className={styles.item}
              onClick={() => handleExport(engine)}
              disabled={isExporting}
            >
              {engine.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
