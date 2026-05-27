import { useState, useEffect } from 'react'

const ONBOARDING_KEY = 'voicesmith_onboarding_complete'
const ONBOARDING_STEP_KEY = 'voicesmith_onboarding_step'

export const ONBOARDING_STEPS = {
  DASHBOARD_CREATE_PROJECT: 0,
  PROJECT_CREATE_SCENE: 1,
  PROJECT_CREATE_CHARACTER: 2,
  LINE_CHOOSE_EMOTION: 3,
  LINE_TYPE: 4,
  LINE_GENERATE: 5,
}

export const STEP_TOOLTIPS = {
  [ONBOARDING_STEPS.DASHBOARD_CREATE_PROJECT]: {
    title: 'Create a Project',
    text: 'Click here to create your first voice project.',
  },
  [ONBOARDING_STEPS.PROJECT_CREATE_SCENE]: {
    title: 'Create a Scene',
    text: 'Add a scene to organize your voice lines.',
  },
  [ONBOARDING_STEPS.PROJECT_CREATE_CHARACTER]: {
    title: 'Add a Character',
    text: 'Create a character to generate voice lines for.',
  },
  [ONBOARDING_STEPS.LINE_CHOOSE_EMOTION]: {
    title: 'Set Emotion',
    text: 'Pick an emotion to add expression to the line.',
  },
  [ONBOARDING_STEPS.LINE_TYPE]: {
    title: 'Type Your Line',
    text: 'Type your desired line you wish to generate.',
  },
  [ONBOARDING_STEPS.LINE_GENERATE]: {
    title: 'Generate Voice Line',
    text: 'Click to generate the voice line with AI.',
  },
}

export function useOnboarding() {
  const [currentStep, setCurrentStep] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [actionCompleted, setActionCompleted] = useState(false)
  const [lastRetriggerTime, setLastRetriggerTime] = useState(0)

  // Initialize from localStorage
  useEffect(() => {
    const complete = localStorage.getItem(ONBOARDING_KEY)
    const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY)

    console.log('[Onboarding] Initializing - complete:', complete, 'savedStep:', savedStep)

    if (complete) {
      console.log('[Onboarding] Tutorial already completed')
      setIsComplete(true)
      setCurrentStep(null)
      setIsVisible(false)
    } else if (savedStep !== null) {
      const step = parseInt(savedStep)
      console.log('[Onboarding] Resuming tutorial at step:', step)
      setCurrentStep(step)
      setIsVisible(true)
    } else {
      // First time user - start tutorial
      console.log('[Onboarding] Starting tutorial for first time user')
      setCurrentStep(0)
      setIsVisible(true)
      localStorage.setItem(ONBOARDING_STEP_KEY, '0')
    }
  }, [])

  const nextStep = () => {
    if (currentStep !== null) {
      const nextStepNum = currentStep + 1
      if (nextStepNum < Object.keys(ONBOARDING_STEPS).length) {
        setCurrentStep(nextStepNum)
        localStorage.setItem(ONBOARDING_STEP_KEY, nextStepNum.toString())
      } else {
        completeTutorial()
      }
    }
  }

  const skipTutorial = () => {
    completeTutorial()
  }

  const completeTutorial = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    localStorage.removeItem(ONBOARDING_STEP_KEY)
    setIsComplete(true)
    setCurrentStep(null)
    setIsVisible(false)
  }

  const retriggerTutorial = (startStep = 0) => {
    setCurrentStep(startStep)
    setIsVisible(true)
    setIsComplete(false)
    setLastRetriggerTime(Date.now())
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.setItem(ONBOARDING_STEP_KEY, startStep.toString())
  }

  const advanceOnAction = () => {
    if (!isComplete && currentStep !== null) {
      nextStep()
    }
  }

  return {
    currentStep,
    isComplete,
    isVisible,
    setIsVisible,
    nextStep,
    skipTutorial,
    completeTutorial,
    retriggerTutorial,
    advanceOnAction,
    actionCompleted,
    setActionCompleted,
    lastRetriggerTime,
  }
}
