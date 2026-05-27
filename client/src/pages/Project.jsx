import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Play, Pause, RefreshCw, Trash2, Download, ChevronLeft, Loader, Upload, X, Edit2 } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import { useOnboarding, ONBOARDING_STEPS } from '../hooks/useOnboarding'
import { VOICE_PRESETS, EMOTIONS } from '../lib/presets'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ImportDialog from '../components/ImportDialog'
import VoiceAssignment from '../components/VoiceAssignment'
import BatchGenerator from '../components/BatchGenerator'
import EngineExportSelector from '../components/EngineExportSelector'
import SceneExportSelector from '../components/SceneExportSelector'
import OnboardingTutorial, { HelpTrigger } from '../components/OnboardingTutorial'
import styles from './Project.module.css'

export default function Project() {
  const { id } = useParams()
  const api = useApi()
  const toast = useToast()
  const navigate = useNavigate()
  const onboarding = useOnboarding()

  // Onboarding refs
  const addSceneBtnRef = useRef(null)
  const addCharBtnRef = useRef(null)
  const presetSelectRef = useRef(null)
  const emotionSelectRef = useRef(null)
  const lineInputRef = useRef(null)
  const generateBtnRef = useRef(null)

  const [project, setProject] = useState(null)
  const [scenes, setScenes] = useState([])
  const [characters, setCharacters] = useState([])
  const [lines, setLines] = useState([])
  const [selectedScene, setSelectedScene] = useState(null)
  const [loading, setLoading] = useState(true)

  // Generate panel state
  const [text, setText] = useState('') // Will be auto-filled during onboarding
  const [selectedChar, setSelectedChar] = useState(null)
  const [selectedEmotion, setSelectedEmotion] = useState('neutral')
  const [generating, setGenerating] = useState(null) // line id or 'new'

  // Modals
  const [showAddScene, setShowAddScene] = useState(false)
  const [showAddChar, setShowAddChar] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sceneName, setSceneName] = useState('')
  const [charName, setCharName] = useState('')
  const [charPreset, setCharPreset] = useState('warrior')

  // Audio
  const [playingId, setPlayingId] = useState(null)
  const [playingScene, setPlayingScene] = useState(false)
  const audioRef = useRef(null)

  // Drag and drop
  const [draggedLineId, setDraggedLineId] = useState(null)
  const [dragOverLineId, setDragOverLineId] = useState(null)

  // Character dropdown
  const [charDropdownOpen, setCharDropdownOpen] = useState(false)
  const charDropdownRef = useRef(null)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { charId, charName, lineCount, sceneCount }
  const [deletingCharId, setDeletingCharId] = useState(null)

  // Edit character
  const [editingChar, setEditingChar] = useState(null)
  const [editCharName, setEditCharName] = useState('')
  const [editCharPreset, setEditCharPreset] = useState('warrior')
  const [savingCharId, setSavingCharId] = useState(null)
  const [regeneratingLines, setRegeneratingLines] = useState(new Set())

  // Edit line
  const [editingLine, setEditingLine] = useState(null)
  const [editLineText, setEditLineText] = useState('')
  const [editLineEmotion, setEditLineEmotion] = useState('neutral')

  // Edit scene
  const [editingScene, setEditingScene] = useState(null)
  const [editSceneName, setEditSceneName] = useState('')
  const [savingScene, setSavingScene] = useState(false)

  useEffect(() => {
    console.log('[Project] Onboarding:', onboarding.currentStep, 'isVisible:', onboarding.isVisible, 'isComplete:', onboarding.isComplete)
    fetchProject()
  }, [id, onboarding.currentStep])

  // Auto-advance tutorial when actions are completed
  useEffect(() => {
    if (!onboarding.isVisible || onboarding.isComplete) return

    // Don't auto-advance immediately after retriggering (2 second grace period)
    const timeSinceRetrigger = Date.now() - onboarding.lastRetriggerTime
    if (timeSinceRetrigger < 2000) return

    // Step 1: Scene created - auto-advance when selectedScene changes and scenes exist
    if (onboarding.currentStep === 1 && selectedScene && scenes.length > 0) {
      setTimeout(() => onboarding.advanceOnAction(), 300)
    }
    // Step 2: Character added - auto-advance when selectedChar is set
    else if (onboarding.currentStep === 2 && selectedChar && characters.length > 0) {
      setTimeout(() => onboarding.advanceOnAction(), 300)
    }
    // Step 3: Emotion chosen - auto-advance when emotion is selected (not neutral)
    else if (onboarding.currentStep === 3 && selectedEmotion && selectedEmotion !== 'neutral') {
      setTimeout(() => onboarding.advanceOnAction(), 300)
    }
    // Step 4: Line typed - auto-advance when user types in the text field
    else if (onboarding.currentStep === 4 && text.trim().length > 0) {
      setTimeout(() => onboarding.advanceOnAction(), 300)
    }
    // Step 5: Line generated - auto-complete tutorial when a NEW line with audio is created
    // Skip auto-complete if tutorial was just retriggered (user should click Done manually)
    else if (onboarding.currentStep === 5 && timeSinceRetrigger >= 5000 && lines.length > 0 && generating === null) {
      const sceneLines = lines.filter(l => l.scene_id === selectedScene)
      const hasAudio = sceneLines.some(l => l.audio_url)
      if (hasAudio) {
        setTimeout(() => onboarding.completeTutorial(), 500)
      }
    }
  }, [onboarding, onboarding.lastRetriggerTime, selectedScene, selectedChar, selectedEmotion, scenes, characters, lines, generating, text])

  useEffect(() => {
    if (!charDropdownOpen) return

    function handleClickOutside(event) {
      if (charDropdownRef.current && !charDropdownRef.current.contains(event.target)) {
        setCharDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [charDropdownOpen])

  async function fetchProject() {
    try {
      const res = await api.get(`/projects/${id}`)
      setProject(res.data)
      setScenes(res.data.scenes || [])
      setCharacters(res.data.characters || [])
      // Initialize order field if not present
      const linesWithOrder = (res.data.lines || []).map((line, idx) => ({
        ...line,
        order: line.order ?? idx
      }))
      setLines(linesWithOrder)
      if (res.data.scenes?.length > 0) setSelectedScene(res.data.scenes[0].id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sceneLines = lines
    .filter(l => l.scene_id === selectedScene)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  async function addScene() {
    if (!sceneName.trim()) return
    setShowAddScene(false) // Close modal immediately
    try {
      const res = await api.post('/scenes', { project_id: id, name: sceneName.trim() })
      setScenes(s => [...s, res.data])
      setSelectedScene(res.data.id)
      setSceneName('')
      toast.addToast(`Scene "${res.data.name}" created`, { type: 'success' })
    } catch (err) {
      console.error(err)
      setShowAddScene(true) // Reopen modal on error
    }
  }

  async function deleteScene(sceneId) {
    try {
      await api.delete(`/scenes/${sceneId}`)
      setScenes(s => s.filter(x => x.id !== sceneId))
      setLines(l => l.filter(x => x.scene_id !== sceneId))
      if (selectedScene === sceneId) setSelectedScene(scenes.find(s => s.id !== sceneId)?.id || null)
    } catch (err) { console.error(err) }
  }

  async function saveSceneName() {
    if (!editSceneName.trim() || !editingScene) return
    setSavingScene(true)
    try {
      const res = await api.patch(`/scenes/${editingScene}`, { name: editSceneName.trim() })
      setScenes(s => s.map(x => x.id === editingScene ? { ...x, name: res.data.name } : x))
      setEditingScene(null)
      setEditSceneName('')
    } catch (err) {
      console.error(err)
      alert('Failed to save scene name')
    } finally {
      setSavingScene(false)
    }
  }

  async function addCharacter() {
    if (!charName.trim()) return
    setShowAddChar(false) // Close modal immediately for responsiveness
    try {
      const res = await api.post('/voice/characters', {
        project_id: id,
        name: charName.trim(),
        preset_key: charPreset,
      })
      const newChar = { ...res.data, order: 0 }
      setCharacters(c => [...c, newChar])
      setSelectedChar(newChar.id)
      setCharName('')
      setCharPreset('warrior')
      toast.addToast(`Character "${res.data.name}" created`, { type: 'success' })
    } catch (err) {
      console.error(err)
      setShowAddChar(true) // Reopen on error
    }
  }

  function deleteCharacter(charId) {
    const char = getChar(charId)
    const charLines = lines.filter(l => l.character_id === charId)

    if (charLines.length > 0) {
      const sceneCount = new Set(charLines.map(l => l.scene_id)).size
      setDeleteConfirm({
        charId,
        charName: char.name,
        lineCount: charLines.length,
        sceneCount,
      })
    } else {
      confirmDeleteCharacter(charId)
    }
  }

  async function confirmDeleteCharacter(charId) {
    setDeletingCharId(charId)
    setDeleteConfirm(null) // Close modal immediately for responsiveness
    // Optimistically update UI
    setCharacters(c => c.filter(x => x.id !== charId))
    setLines(l => l.filter(x => x.character_id !== charId))
    if (selectedChar === charId) {
      setSelectedChar(null)
    }
    setCharDropdownOpen(false)

    try {
      await api.delete(`/voice/characters/${charId}`)
    } catch (err) {
      console.error(err)
      // Revert on error
      fetchProject()
    } finally {
      setDeletingCharId(null)
    }
  }

  function openEditChar(charId) {
    const char = getChar(charId)
    setEditingChar(charId)
    setEditCharName(char.name)
    setEditCharPreset(char.preset_key)
  }

  async function saveEditChar() {
    if (!editCharName.trim()) return
    const editingCharId = editingChar

    // Show loading state immediately
    setSavingCharId(editingCharId)

    // Get character's lines and show loading state IMMEDIATELY
    const charLinesToRegen = lines.filter(l => l.character_id === editingCharId)
    setRegeneratingLines(new Set(charLinesToRegen.map(l => l.id)))

    // Optimistically close modal
    setEditingChar(null)

    try {
      await api.patch(`/voice/characters/${editingCharId}`, {
        name: editCharName.trim(),
        preset_key: editCharPreset,
      })

      // Refresh project to get updated character data
      await fetchProject()

      // Regenerate all lines for this character with new voice in parallel
      charLinesToRegen.forEach(async (line) => {
        try {
          const genRes = await api.post('/voice/generate', {
            line_id: line.id,
            character_id: line.character_id,
            text: line.text,
            emotion: line.emotion,
          })
          setLines(l => l.map(x => x.id === line.id ? { ...x, audio_url: genRes.data.audio } : x))
        } catch (err) {
          console.error(err)
        } finally {
          // Remove from regenerating set when done
          setRegeneratingLines(prev => {
            const next = new Set(prev)
            next.delete(line.id)
            return next
          })
        }
      })
    } catch (err) {
      console.error(err)
      setRegeneratingLines(new Set())
      setSavingCharId(null)
      await fetchProject()
    } finally {
      // Clear saving state after a brief delay to ensure UI updates smoothly
      setTimeout(() => {
        if (regeneratingLines.size === 0) {
          setSavingCharId(null)
        }
      }, 100)
    }
  }

  async function generateLine() {
    if (!text.trim() || !selectedChar || !selectedScene) return
    setGenerating('new')
    try {
      // Save the line first
      const lineRes = await api.post('/voice/lines', {
        scene_id: selectedScene,
        character_id: selectedChar,
        text: text.trim(),
        emotion: selectedEmotion,
      })
      const newLine = lineRes.data
      setLines(l => [...l, { ...newLine, order: newLine.order ?? l.filter(x => x.scene_id === selectedScene).length }])

      // Generate audio
      const genRes = await api.post('/voice/generate', {
        line_id: newLine.id,
        character_id: selectedChar,
        text: text.trim(),
        emotion: selectedEmotion,
      })

      // Update line with audio
      setLines(l => l.map(x => x.id === newLine.id ? { ...x, audio_url: genRes.data.audio } : x))
      setText('')
      toast.addToast('Voice line generated successfully', { type: 'success' })
    } catch (err) {
      console.error(err)
      // Toast is already shown by API error interceptor
    } finally {
      setGenerating(null)
    }
  }

  async function regenerateLine(line) {
    setGenerating(line.id)
    try {
      const genRes = await api.post('/voice/generate', {
        line_id: line.id,
        character_id: line.character_id,
        text: line.text,
        emotion: line.emotion,
      })
      setLines(l => l.map(x => x.id === line.id ? { ...x, audio_url: genRes.data.audio } : x))
    } catch (err) { console.error(err) }
    finally { setGenerating(null) }
  }

  async function deleteLine(lineId) {
    try {
      await api.delete(`/voice/lines/${lineId}`)
      setLines(l => l.filter(x => x.id !== lineId))
    } catch (err) { console.error(err) }
  }

  function openEditLine(lineId) {
    const line = lines.find(l => l.id === lineId)
    if (line) {
      setEditingLine(lineId)
      setEditLineText(line.text)
      setEditLineEmotion(line.emotion)
    }
  }

  async function saveEditLine() {
    if (!editLineText.trim()) return
    const lineId = editingLine
    setEditingLine(null)

    try {
      // Update line in database
      await api.patch(`/voice/lines/${lineId}`, {
        text: editLineText.trim(),
        emotion: editLineEmotion,
      })

      // Update local state
      setLines(l => l.map(x => x.id === lineId ? { ...x, text: editLineText.trim(), emotion: editLineEmotion } : x))

      // Regenerate the line with new text
      const line = lines.find(l => l.id === lineId)
      if (line) {
        regenerateLine({ ...line, text: editLineText.trim(), emotion: editLineEmotion })
      }
    } catch (err) {
      console.error(err)
    }
  }

  function handleDragStart(e, line) {
    setDraggedLineId(line.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, line) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLineId(line.id)
  }

  function handleDragLeave() {
    setDragOverLineId(null)
  }

  async function handleDrop(e, targetLine) {
    e.preventDefault()
    setDragOverLineId(null)

    if (!draggedLineId || draggedLineId === targetLine.id) {
      setDraggedLineId(null)
      return
    }

    const draggedLine = lines.find(l => l.id === draggedLineId)
    if (!draggedLine) {
      setDraggedLineId(null)
      return
    }

    // Determine if dropping before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect()
    const dropPosition = e.clientY - rect.top
    const isDropAfter = dropPosition > rect.height / 2

    // Create new ordered array (only for current scene)
    const newSceneLines = sceneLines.filter(l => l.id !== draggedLineId)
    const targetIndex = newSceneLines.findIndex(l => l.id === targetLine.id)

    if (targetIndex === -1) {
      setDraggedLineId(null)
      return
    }

    const insertIndex = isDropAfter ? targetIndex + 1 : targetIndex
    newSceneLines.splice(insertIndex, 0, draggedLine)

    // Update only lines in current scene with new order
    const updatedLines = lines.map(l => {
      if (l.scene_id === selectedScene) {
        const newIndex = newSceneLines.findIndex(nl => nl.id === l.id)
        if (newIndex !== -1) {
          return { ...l, order: newIndex }
        }
      }
      return l
    })
    setLines(updatedLines)

    setDraggedLineId(null)
  }

  function playAudio(line) {
    if (!line.audio_url) return
    const el = audioRef.current
    if (!el) return

    if (playingId === line.id) {
      el.pause()
      setPlayingId(null)
      return
    }

    // Cleanly tear down any in-flight playback before swapping src, otherwise
    // the previous buffer can leak a fraction of a second into the new track.
    el.pause()
    el.onended = null
    el.currentTime = 0
    el.src = line.audio_url
    el.load()
    el.onended = () => setPlayingId(null)
    setPlayingId(line.id)
    el.play().catch((err) => {
      console.error('Audio playback failed:', err)
      setPlayingId(null)
    })
  }

  function downloadLine(line, char) {
    const a = document.createElement('a')
    a.href = line.audio_url
    a.download = `${char?.name || 'line'}_${line.text.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}.mp3`
    a.click()
  }

  async function playScene() {
    const linesWithAudio = sceneLines.filter(l => l.audio_url)
    if (linesWithAudio.length === 0) return

    setPlayingScene(true)
    let currentIndex = 0

    const playNext = () => {
      if (currentIndex >= linesWithAudio.length) {
        setPlayingScene(false)
        setPlayingId(null)
        return
      }

      const line = linesWithAudio[currentIndex]
      setPlayingId(line.id)
      currentIndex++

      const el = audioRef.current
      if (el) {
        el.pause()
        el.onended = null
        el.currentTime = 0
        el.src = line.audio_url
        el.load()
        el.onended = playNext
        el.play().catch((err) => {
          console.error('Audio playback failed:', err)
          setPlayingScene(false)
          setPlayingId(null)
        })
      }
    }

    playNext()
  }

  function stopScene() {
    setPlayingScene(false)
    setPlayingId(null)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  async function exportScene() {
    try {
      const sceneName = scenes.find(s => s.id === selectedScene)?.name || 'scene'

      const response = await fetch(`/api/voice/export/scene/${selectedScene}`)

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Export error:', response.status, errorData)
        alert(`Export failed: ${response.statusText}`)
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sceneName}-export.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
      alert('Export failed: ' + err.message)
    }
  }

  function getChar(id) { return characters.find(c => c.id === id) }
  function getPreset(char) { return VOICE_PRESETS[char?.preset_key] || {} }

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /> Loading project…</div>
  )
  if (!project) return <div className={styles.loading}>Project not found</div>

  return (
    <div className={styles.page}>
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={16} /> Dashboard
        </button>
        <h1 className={styles.projectName}>{project.name}</h1>
        <div className={styles.topbarRight}>
          <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={13} /> Import
          </Button>
          <div style={{ minWidth: '180px' }}>
            <EngineExportSelector
              projectId={id}
              projectName={project.name}
              audioCount={lines.filter(l => l.audio_url).length}
            />
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left: scenes + characters */}
        <aside className={styles.sidebar}>
          <div className={styles.sideSection}>
            <div className={styles.sideSectionHeader}>
              <span className={styles.sideSectionLabel}>Scenes</span>
              <button
                ref={addSceneBtnRef}
                className={styles.addBtn}
                onClick={() => setShowAddScene(true)}
              >
                <Plus size={13} />
              </button>
            </div>
            {scenes.length === 0
              ? <p className={styles.sideEmpty}>No scenes yet</p>
              : scenes.map(s => (
                <div
                  key={s.id}
                  className={`${styles.sceneItem} ${selectedScene === s.id ? styles.sceneActive : ''}`}
                  onClick={() => setSelectedScene(s.id)}
                >
                  {editingScene === s.id ? (
                    <input
                      type="text"
                      className={styles.sceneEditInput}
                      value={editSceneName}
                      onChange={e => setEditSceneName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveSceneName()
                        if (e.key === 'Escape') { setEditingScene(null); setEditSceneName('') }
                      }}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.sceneItemName}>{s.name}</span>
                  )}
                  <div className={styles.sceneActions}>
                    {editingScene !== s.id && (
                      <button
                        className={styles.sceneDeleteBtn}
                        onClick={e => {
                          e.stopPropagation()
                          setEditingScene(s.id)
                          setEditSceneName(s.name)
                        }}
                        title="Edit scene"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    {editingScene === s.id && (
                      <>
                        <button
                          className={styles.sceneDeleteBtn}
                          onClick={e => { e.stopPropagation(); saveSceneName() }}
                          disabled={savingScene}
                          title="Save"
                        >
                          {savingScene ? <Loader size={11} className={styles.spinnerIcon} /> : '✓'}
                        </button>
                        <button
                          className={styles.sceneDeleteBtn}
                          onClick={e => { e.stopPropagation(); setEditingScene(null); setEditSceneName('') }}
                          disabled={savingScene}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </>
                    )}
                    <button className={styles.sceneDeleteBtn} onClick={e => { e.stopPropagation(); deleteScene(s.id) }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>

          {selectedScene && (
            <div style={{ margin: '0 0.5rem auto 0.5rem', padding: '0 4px' }}>
              <SceneExportSelector
                sceneId={selectedScene}
                sceneName={scenes.find(s => s.id === selectedScene)?.name || 'scene'}
                audioCount={sceneLines.filter(l => l.audio_url).length}
              />
            </div>
          )}
        </aside>

        {/* Centre: lines */}
        <div className={styles.main}>
          {!selectedScene ? (
            <div className={styles.empty}>
              <Plus size={28} color="var(--faint)" />
              <p>Create a scene to get started</p>
              <Button onClick={() => setShowAddScene(true)}>Add scene</Button>
            </div>
          ) : (
            <>
              <div className={styles.sceneHeader}>
                <h2 className={styles.sceneName}>{scenes.find(s => s.id === selectedScene)?.name}</h2>
                <span className={styles.lineCount}>{sceneLines.length} lines</span>
                {sceneLines.some(l => l.audio_url) && (
                  <button
                    className={styles.playSceneBtn}
                    onClick={playingScene ? stopScene : playScene}
                    title={playingScene ? 'Stop scene' : 'Play entire scene'}
                  >
                    {playingScene ? '⏹ Stop' : '▶ Play scene'}
                  </button>
                )}
              </div>

              {sceneLines.length === 0
                ? <div className={styles.empty}><p style={{ color: 'var(--faint)' }}>No lines yet — add one below</p></div>
                : (
                  <div className={styles.linesList}>
                    {sceneLines.map(line => {
                      const char = getChar(line.character_id)
                      const preset = getPreset(char)
                      const isPlaying = playingId === line.id
                      const isGenerating = generating === line.id || regeneratingLines.has(line.id)
                      return (
                        <div
                          key={line.id}
                          className={`${styles.lineItem} ${draggedLineId === line.id ? styles.lineDragging : ''} ${dragOverLineId === line.id ? styles.lineDragOver : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, line)}
                          onDragOver={(e) => handleDragOver(e, line)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, line)}
                        >
                          <div className={styles.lineAvatar} style={{ background: `${preset.color}22`, color: preset.color }}>
                            {preset.emoji}
                          </div>
                          <div className={styles.lineBody}>
                            <div className={styles.lineMeta}>
                              <span className={styles.lineChar} style={{ color: preset.color }}>{char?.name}</span>
                              <span className={styles.lineEmotion}>{line.emotion}</span>
                            </div>
                            <p className={styles.lineText}>{line.text}</p>
                          </div>
                          <div className={styles.lineActions}>
                            {isGenerating
                              ? <Loader size={14} color="var(--accent)" className={styles.spinnerIcon} />
                              : line.audio_url
                              ? <>
                                  <button className={styles.actionBtn} onClick={() => playAudio(line)} title={isPlaying ? 'Pause' : 'Play'}>
                                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                  </button>
                                  <button className={styles.actionBtn} onClick={() => downloadLine(line, char)} title="Download">
                                    <Download size={14} />
                                  </button>
                                </>
                              : null
                            }
                            {!isGenerating && (
                              <>
                                <button className={styles.actionBtn} onClick={() => openEditLine(line.id)} title="Edit">
                                  <Edit2 size={14} />
                                </button>
                                <button className={styles.actionBtn} onClick={() => regenerateLine(line)} title="Regenerate">
                                  <RefreshCw size={14} />
                                </button>
                              </>
                            )}
                            <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => deleteLine(line.id)} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </>
          )}
        </div>

        {/* Right: generate panel */}
        <aside className={styles.genPanel}>
          <div className={styles.genPanelTitle}>Generate line</div>

          <div className={styles.genField}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.genLabel}>Character</label>
              <button
                ref={addCharBtnRef}
                className={styles.addCharLink}
                onClick={() => setShowAddChar(true)}
              >
                + Add
              </button>
            </div>
            {characters.length === 0
              ? <p style={{ color: 'var(--faint)', fontSize: '0.9rem' }}>No characters yet. Click Add to create one.</p>
              : (
                <div style={{ position: 'relative' }} ref={charDropdownRef}>
                  <button
                    className={styles.charDropdownBtn}
                    onClick={() => setCharDropdownOpen(!charDropdownOpen)}
                  >
                    {selectedChar
                      ? (() => {
                          const c = getChar(selectedChar)
                          const preset = getPreset(c)
                          return `${preset.emoji} ${c.name}`
                        })()
                      : 'Select character...'}
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>▼</span>
                  </button>
                  {charDropdownOpen && (
                    <div className={styles.charDropdownMenu}>
                      {characters.map(c => {
                        const preset = getPreset(c)
                        return (
                          <div
                            key={c.id}
                            className={`${styles.charDropdownItem} ${selectedChar === c.id ? styles.charDropdownItemActive : ''}`}
                            style={{ '--pc': preset.color }}
                          >
                            <button
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
                              onClick={() => {
                                setSelectedChar(c.id)
                                setCharDropdownOpen(false)
                              }}
                            >
                              <span>{preset.emoji}</span>
                              <span>{c.name}</span>
                            </button>
                            <button
                              className={styles.charDeleteBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteCharacter(c.id)
                              }}
                              title="Delete character"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
          </div>

          {selectedChar && (
            <div ref={presetSelectRef} className={styles.genField}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <label className={styles.genLabel}>Voice</label>
                {(savingCharId === selectedChar || Array.from(regeneratingLines).some(lineId => {
                  const line = lines.find(l => l.id === lineId)
                  return line && line.character_id === selectedChar
                })) && (
                  <Loader size={14} color="var(--accent)" className={styles.spinnerIcon} style={{ marginLeft: 'auto', marginRight: '8px' }} />
                )}
                <button
                  className={styles.addCharLink}
                  onClick={() => openEditChar(selectedChar)}
                  style={{ marginLeft: (savingCharId === selectedChar || Array.from(regeneratingLines).some(lineId => {
                    const line = lines.find(l => l.id === lineId)
                    return line && line.character_id === selectedChar
                  })) ? '0' : 'auto' }}
                >
                  Edit
                </button>
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.95rem',
                  color: 'var(--text)',
                }}
              >
                {getPreset(getChar(selectedChar))?.emoji} {getPreset(getChar(selectedChar))?.name || 'Unknown'}
              </div>
            </div>
          )}

          <div className={styles.genField}>
            <label className={styles.genLabel}>Emotion</label>
            <div ref={emotionSelectRef} className={styles.emotionRow}>
              {EMOTIONS.map(e => (
                <button
                  key={e.key}
                  className={`${styles.emotionBtn} ${selectedEmotion === e.key ? styles.emotionActive : ''}`}
                  onClick={() => setSelectedEmotion(e.key)}
                >
                  {e.icon} {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.genField}>
            <label className={styles.genLabel}>Line text</label>
            <textarea
              ref={lineInputRef}
              className={styles.lineInput}
              placeholder={`"${selectedChar ? getPreset(getChar(selectedChar)).name || 'Character' : 'Character'} speaks…"`}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              maxLength={5000}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generateLine() }}
            />
            <div className={styles.charCountRow}>
              <span>{text.length} / 5000</span>
              <span>Ctrl+Enter to generate</span>
            </div>
          </div>

          <Button
            ref={generateBtnRef}
            onClick={generateLine}
            loading={generating === 'new'}
            disabled={!onboarding.isVisible && (!text.trim() || !selectedChar || !selectedScene || !!generating)}
            style={{ width: '100%' }}
          >
            ⚡ Generate voice line
          </Button>

          {selectedScene && sceneLines.length > 0 && (
            <>
              <BatchGenerator
                sceneId={selectedScene}
                projectId={id}
                sceneLineCount={sceneLines.filter(l => !l.audio_url).length}
                onComplete={fetchProject}
              />

            </>
          )}

          {!selectedScene && (
            <p className={styles.genHint}>Create a scene first to generate lines</p>
          )}
        </aside>
      </div>

      {/* Add scene modal */}
      <Modal open={showAddScene} onClose={() => { setShowAddScene(false); setSceneName('') }} title="Add scene">
        <div className={styles.modalBody}>
          <label className={styles.label}>Scene name</label>
          <input className={styles.input} placeholder="e.g. Scene 1: The Ambush" value={sceneName}
            onChange={e => setSceneName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addScene()} autoFocus />
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowAddScene(false)}>Cancel</Button>
            <Button onClick={addScene} disabled={!sceneName.trim()}>Add scene</Button>
          </div>
        </div>
      </Modal>

      {/* Add character modal */}
      <Modal open={showAddChar} onClose={() => { setShowAddChar(false); setCharName('') }} title="Add character">
        <div className={styles.modalBody}>
          <label className={styles.label}>Character name</label>
          <input className={styles.input} placeholder="e.g. The Warrior King" value={charName}
            onChange={e => setCharName(e.target.value)} autoFocus />
          <label className={styles.label} style={{ marginTop: '0.75rem' }}>Voice preset</label>
          <div className={styles.presetGrid}>
            {Object.entries(VOICE_PRESETS).map(([key, p]) => (
              <button key={key}
                className={`${styles.presetOption} ${charPreset === key ? styles.presetSelected : ''}`}
                style={{ '--pc': p.color }}
                onClick={() => setCharPreset(key)}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowAddChar(false)}>Cancel</Button>
            <Button onClick={addCharacter} disabled={!charName.trim()}>Add character</Button>
          </div>
        </div>
      </Modal>

      {/* Import dialogue modal */}
      <ImportDialog
        projectId={id}
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={fetchProject}
      />

      {/* Delete character confirmation modal */}
      <Modal open={!!deleteConfirm} onClose={() => !deletingCharId && setDeleteConfirm(null)} title="Delete character">
        <div className={styles.modalBody}>
          {deleteConfirm && (
            <>
              <p style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>
                <strong>{deleteConfirm.charName}</strong> currently has <strong>{deleteConfirm.lineCount} line(s)</strong> in <strong>{deleteConfirm.sceneCount} scene(s)</strong>.
              </p>
              <p style={{ color: 'var(--faint)', fontSize: '0.9rem' }}>
                Are you sure you want to delete this character and all their lines?
              </p>
            </>
          )}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={!!deletingCharId}>Cancel</Button>
            <Button
              onClick={() => deleteConfirm && confirmDeleteCharacter(deleteConfirm.charId)}
              style={{ background: 'var(--error)', color: 'white' }}
              disabled={!!deletingCharId}
              loading={!!deletingCharId}
            >
              {deletingCharId ? 'Deleting...' : 'Delete character'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit character modal */}
      <Modal open={!!editingChar} onClose={() => setEditingChar(null)} title="Edit character">
        <div className={styles.modalBody}>
          <label className={styles.label}>Character name</label>
          <input className={styles.input} placeholder="e.g. The Warrior King" value={editCharName}
            onChange={e => setEditCharName(e.target.value)} autoFocus />
          <label className={styles.label} style={{ marginTop: '0.75rem' }}>Voice preset</label>
          <div className={styles.presetGrid}>
            {Object.entries(VOICE_PRESETS).map(([key, p]) => (
              <button key={key}
                className={`${styles.presetOption} ${editCharPreset === key ? styles.presetSelected : ''}`}
                style={{ '--pc': p.color }}
                onClick={() => setEditCharPreset(key)}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setEditingChar(null)}>Cancel</Button>
            <Button onClick={saveEditChar} disabled={!editCharName.trim()}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Edit line modal */}
      <Modal open={!!editingLine} onClose={() => setEditingLine(null)} title="Edit line">
        <div className={styles.modalBody}>
          <label className={styles.label}>Line text</label>
          <textarea className={styles.lineInput} placeholder="Enter line text..." value={editLineText}
            onChange={e => setEditLineText(e.target.value)} rows={4} maxLength={5000} autoFocus />
          <div className={styles.charCountRow}>
            <span>{editLineText.length} / 5000</span>
          </div>
          <label className={styles.label} style={{ marginTop: '0.75rem' }}>Emotion</label>
          <div className={styles.emotionRow}>
            {EMOTIONS.map(e => (
              <button
                key={e.key}
                className={`${styles.emotionBtn} ${editLineEmotion === e.key ? styles.emotionActive : ''}`}
                onClick={() => setEditLineEmotion(e.key)}
              >
                {e.icon} {e.label}
              </button>
            ))}
          </div>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setEditingLine(null)}>Cancel</Button>
            <Button onClick={saveEditLine} disabled={!editLineText.trim()}>Save & regenerate</Button>
          </div>
        </div>
      </Modal>

      {/* Onboarding Tutorial */}
      {onboarding.currentStep === ONBOARDING_STEPS.PROJECT_CREATE_SCENE && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={addSceneBtnRef}
          totalSteps={6}
        />
      )}

      {onboarding.currentStep === ONBOARDING_STEPS.PROJECT_CREATE_CHARACTER && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={addCharBtnRef}
          totalSteps={6}
        />
      )}

      {onboarding.currentStep === ONBOARDING_STEPS.LINE_CHOOSE_EMOTION && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={emotionSelectRef}
          totalSteps={6}
        />
      )}

      {onboarding.currentStep === ONBOARDING_STEPS.LINE_TYPE && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={lineInputRef}
          totalSteps={6}
        />
      )}

      {onboarding.currentStep === ONBOARDING_STEPS.LINE_GENERATE && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={generateBtnRef}
          totalSteps={6}
        />
      )}

      {/* Help trigger button */}
      {onboarding.isComplete && (
        <HelpTrigger onRetrigger={() => onboarding.retriggerTutorial(ONBOARDING_STEPS.PROJECT_CREATE_SCENE)} />
      )}
    </div>
  )
}
