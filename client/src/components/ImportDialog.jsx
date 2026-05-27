import { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle, X } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import Button from './ui/Button'
import styles from './ImportDialog.module.css'

export default function ImportDialog({ projectId, isOpen, onClose, onSuccess }) {
  const api = useApi()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  // Detect Opera browser
  const isOpera = () => {
    return (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0
  }

  const isOperaBrowser = isOpera()

  const processFile = (selectedFile) => {
    if (!selectedFile) return

    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (!['csv', 'json'].includes(ext)) {
      setError('Only CSV and JSON files are supported')
      return
    }

    setFile(selectedFile)
    setFileType(ext)
    setError(null)
    setSuccess(null)
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]

    // Restore focus for Opera GX compatibility
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.blur()
      }
      document.body.focus()
    }, 100)

    processFile(selectedFile)
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer?.files?.[0]
    processFile(droppedFile)
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const fileContent = await file.text()
      console.log('Importing file:', fileType, 'Size:', fileContent.length)

      const res = await api.post('/import/dialogue', {
        project_id: projectId,
        file_content: fileContent,
        file_type: fileType,
      })

      console.log('Import response:', res.data)
      setSuccess(res.data)
      setFile(null)
      setFileType(null)

      // Auto-close and refresh after 2 seconds
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      console.error('Import error:', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setFileType(null)
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import dialogue</h2>
          <button className={styles.closeBtn} onClick={handleClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {isOperaBrowser && (
          <div className={styles.operaWarning}>
            <AlertCircle size={16} />
            <span>File import isn't fully supported in Opera GX yet. Please use Chrome or Firefox for the best experience.</span>
          </div>
        )}

        {success ? (
          <div className={styles.successContent}>
            <CheckCircle size={32} color="var(--success)" />
            <h3>Import successful!</h3>
            <p>{success.message}</p>
            <p className={styles.details}>
              {success.lines_imported} lines • {success.scenes_created} scenes • {success.characters_created} characters
            </p>
          </div>
        ) : (
          <>
            <div className={styles.body}>
            <div className={styles.formatInfo}>
              <h4>Supported formats</h4>
              <div className={styles.formatGuide}>
                <div>
                  <strong>CSV</strong>
                  <p>Columns: character, text, [scene], [emotion]</p>
                </div>
                <div>
                  <strong>JSON</strong>
                  <p>Array of objects with: character, text, [scene], [emotion]</p>
                </div>
              </div>
            </div>

            <div
              className={styles.uploadArea}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <label
                className={`${styles.uploadButton} ${isDragging ? styles.dragging : ''}`}
                htmlFor="file-input"
                onClick={() => {
                  // Ensure focus is on the input for Opera GX
                  setTimeout(() => {
                    fileInputRef.current?.focus()
                  }, 0)
                }}
              >
                <Upload size={20} />
                <div>
                  {file ? (
                    <>
                      <span className={styles.filename}>{file.name}</span>
                      <span className={styles.filesize}>
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Choose file or drag & drop</span>
                      <span className={styles.hint}>CSV or JSON</span>
                    </>
                  )}
                </div>
              </label>
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {error && (
              <div className={styles.alert}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.example}>
              <h4>Example CSV</h4>
              <pre>{`character,text,scene,emotion
Alice,"Hello there!",Opening,neutral
Bob,"Nice to meet you.",Opening,cheerful
Alice,"How are you?",Dialogue,neutral`}</pre>
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              loading={loading}
              disabled={!file || loading}
            >
              Import dialogue
            </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
