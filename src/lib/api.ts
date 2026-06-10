const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"
const API_KEY = import.meta.env.VITE_API_KEY?.trim()

export const getApiUrl = (path: string) => `${API_BASE}${path}`

export const getApiHeaders = (
  headers: Record<string, string> = {}
): Record<string, string> => {
  const nextHeaders: Record<string, string> = { ...headers }

  if (API_KEY) {
    nextHeaders["x-api-key"] = API_KEY
  }

  return nextHeaders
}
