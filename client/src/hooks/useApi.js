import { useAuth0 } from '@auth0/auth0-react'
import axios from 'axios'
import { useMemo } from 'react'
import { useToast } from './useToast'

export function useApi() {
  const { getAccessTokenSilently } = useAuth0()
  const toast = useToast()

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: '/api',
      timeout: 10000 // 10 second timeout for requests
    })

    instance.interceptors.request.use(async (config) => {
      const token = await getAccessTokenSilently()
      config.headers.Authorization = `Bearer ${token}`
      return config
    })

    // Response interceptor for error handling
    instance.interceptors.response.use(
      response => response,
      error => {
        const message = getErrorMessage(error)
        const code = error.response?.data?.code

        // Show error toast
        toast.addToast(message, {
          type: 'error',
          duration: 5000,
          action: code === 'LIMIT_REACHED' ? {
            label: 'Upgrade',
            onClick: () => window.location.href = '/settings'
          } : null
        })

        // Pass error through for caller to handle
        return Promise.reject(error)
      }
    )

    return instance
  }, [getAccessTokenSilently, toast])

  return api
}

function getErrorMessage(error) {
  // Network error (no response from server)
  if (!error.response) {
    // Timeout error
    if (error.code === 'ECONNABORTED') {
      return 'Request took too long. Your internet connection might be slow or down.'
    }
    // Network errors
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'Can\'t reach the server. Please check your internet connection.'
    }
    // Generic connection error
    return 'Connection failed. Please check your internet and try again.'
  }

  // Specific error codes
  const { status, data } = error.response

  switch (data?.code) {
    case 'LIMIT_REACHED':
      return `Generation limit reached. Upgrade your plan to continue.`
    case 'AUTH_REQUIRED':
      return 'Please log in again.'
    case 'FORBIDDEN':
      return 'You don\'t have permission to perform this action.'
    default:
      break
  }

  // HTTP status codes
  switch (status) {
    case 400:
      return data?.error || 'Invalid request. Please check your input.'
    case 401:
      return 'Please log in again.'
    case 403:
      return 'You don\'t have permission to perform this action.'
    case 404:
      return 'Not found.'
    case 429:
      return 'Too many requests. Please wait before trying again.'
    case 500:
      return 'Server error. Please try again later.'
    case 503:
      return 'Service unavailable. Please try again later.'
    default:
      return data?.error || 'Something went wrong. Please try again.'
  }
}
