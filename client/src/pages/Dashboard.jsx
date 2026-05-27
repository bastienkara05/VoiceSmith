import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Trash2, Mic, Clock } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../hooks/useToast'
import { useOnboarding, ONBOARDING_STEPS } from '../hooks/useOnboarding'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import DashboardProjectExport from '../components/DashboardProjectExport'
import OnboardingTutorial, { HelpTrigger } from '../components/OnboardingTutorial'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const api = useApi()
  const toast = useToast()
  const navigate = useNavigate()
  const onboarding = useOnboarding()
  const createBtnRef = useRef(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    console.log('[Dashboard] Onboarding:', onboarding.currentStep, 'isVisible:', onboarding.isVisible, 'isComplete:', onboarding.isComplete)
    fetchProjects()
  }, [onboarding.currentStep])

  async function fetchProjects() {
    try {
      const res = await api.get('/projects')
      setProjects(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function createProject() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/projects', { name: newName.trim() })
      setShowModal(false)
      setNewName('')
      // Auto-advance tutorial if on step 0
      if (onboarding.currentStep === 0) {
        onboarding.advanceOnAction()
      }
      navigate(`/project/${res.data.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function deleteProject(id) {
    try {
      await api.delete(`/projects/${id}`)
      setProjects(p => p.filter(x => x.id !== id))
      setDeleteId(null)
      toast.addToast('Project deleted', { type: 'success' })
    } catch (err) {
      console.error(err)
    }
  }

  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      Loading projects…
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.sub}>All your games and voice line projects</p>
        </div>
        <Button ref={createBtnRef} onClick={() => setShowModal(true)}>
          <Plus size={15} /> New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Mic size={32} color="var(--faint)" /></div>
          <h2 className={styles.emptyTitle}>No projects yet</h2>
          <p className={styles.emptySub}>Create your first project to start generating voice lines</p>
          <Button onClick={() => setShowModal(true)}>
            <Plus size={15} /> Create project
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardMain} onClick={() => navigate(`/project/${p.id}`)}>
                <div className={styles.cardIcon}><FolderOpen size={20} color="var(--accent2)" /></div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}>{p.name}</div>
                  <div className={styles.cardMeta}>
                    <span>{p.scene_count || 0} scenes</span>
                    <span>·</span>
                    <span>{p.line_count || 0} lines</span>
                  </div>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <div className={styles.cardDate}>
                  <Clock size={11} /> {formatDate(p.updated_at)}
                </div>
                <div className={styles.cardActions}>
                  <DashboardProjectExport
                    projectId={p.id}
                    projectName={p.name}
                    audioCount={p.line_count || 0}
                  />
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${p.id}`)}>
                    Open
                  </Button>
                  <button className={styles.deleteBtn} onClick={() => setDeleteId(p.id)} title="Delete project">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New project modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setNewName('') }} title="New project">
        <div className={styles.modalBody}>
          <label className={styles.label}>Project name</label>
          <input
            className={styles.input}
            placeholder="e.g. Epic Fantasy RPG"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createProject()}
            autoFocus
          />
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={createProject} loading={creating} disabled={!newName.trim()}>
              Create project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete project?">
        <div className={styles.modalBody}>
          <p style={{ color: 'var(--muted)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            This will permanently delete the project and all its scenes, characters, and voice lines. This cannot be undone.
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteProject(deleteId)}>Delete project</Button>
          </div>
        </div>
      </Modal>

      {/* Onboarding Tutorial */}
      {onboarding.currentStep === ONBOARDING_STEPS.DASHBOARD_CREATE_PROJECT && (
        <OnboardingTutorial
          currentStep={onboarding.currentStep}
          isVisible={onboarding.isVisible}
          onNext={onboarding.nextStep}
          onSkip={onboarding.skipTutorial}
          targetRef={createBtnRef}
          totalSteps={6}
        />
      )}

      {/* Help trigger button */}
      {onboarding.isComplete && (
        <HelpTrigger onRetrigger={() => onboarding.retriggerTutorial(ONBOARDING_STEPS.DASHBOARD_CREATE_PROJECT)} />
      )}
    </div>
  )
}
