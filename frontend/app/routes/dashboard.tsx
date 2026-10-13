import { useState, useEffect } from 'react'
import { Truck, Sun, Moon, AlertTriangle } from 'lucide-react'
import RoutePanel from '../components/RoutePanel'
import MapView from '../components/MapView'
import DetailsPanel from '../components/DetailsPanel'

export interface RouteData {
  route_id: string
  name: string
  geometry: any
  distance: number
  duration: number
  checkpoints: any[]
  risk_summary: any
  is_recommended: boolean
  departure_time?: string
}

export default function Dashboard() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      return JSON.parse(saved)
    }
    return false // Default to light mode
  })
  const [selectedRoute, setSelectedRoute] = useState<string>('route_0')
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Map layer toggle states
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true)
  const [showCheckpoints, setShowCheckpoints] = useState(true)
  const [showAlternatives, setShowAlternatives] = useState(true)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  // Geocode address using Mapbox Geocoding API if token is present
  const geocodeAddress = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
    if (!token) return null
    try {
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`
      )
      const data = await resp.json()
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center
        return { lat, lng }
      }
    } catch (err) {
      console.warn('Frontend geocode error:', err)
    }
    return null
  }

  const handleRouteSearch = async (
    origin: string,
    destination: string,
    departureTime: string,
    loadWeight?: number
  ) => {
    setLoading(true)
    setErrorMessage(null)
    try {
      // 1. Geocode origin & destination in frontend if possible
      const originCoords = await geocodeAddress(origin)
      const destCoords = await geocodeAddress(destination)

      // 2. Parse departure datetime to ISO string
      let isoDeparture: string
      try {
        isoDeparture = departureTime ? new Date(departureTime).toISOString() : new Date().toISOString()
      } catch {
        isoDeparture = new Date().toISOString()
      }

      const payload: Record<string, any> = {
        origin,
        destination,
        departure_time: isoDeparture,
        load_weight: loadWeight ?? null
      }

      if (originCoords) payload.origin_coords = originCoords
      if (destCoords) payload.destination_coords = destCoords

      const response = await fetch('/api/routes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const errorText = errData.error || errData.detail || 'Failed to generate routes. Please check your inputs.'
        setErrorMessage(errorText)
        return
      }

      const data = await response.json()
      if (data.routes && data.routes.length > 0) {
        setRoutes(data.routes)
        if (data.recommended_route_id) {
          setSelectedRoute(data.recommended_route_id)
        } else {
          setSelectedRoute(data.routes[0].route_id)
        }
      } else {
        setErrorMessage('No routes found between these locations.')
      }
    } catch (error: any) {
      console.error('Error fetching routes:', error)
      setErrorMessage(error?.message || 'Error contacting route service.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-search default route on initial load if no routes
  // useEffect(() => {
  //   if (routes.length === 0) {
  //     const now = new Date()
  //     now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  //     handleRouteSearch('Denver, CO, USA', 'Chicago, IL, USA', now.toISOString().slice(0, 16), 30000)
  //   }
  // }, [])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-spotter-dark-900">
      {/* Header */}
      <header className="bg-white dark:bg-spotter-dark-900 border-b border-gray-200 dark:border-spotter-dark-700 px-6 py-3.5 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-spotter-blue-50 dark:bg-spotter-blue-900/40 rounded-lg text-spotter-blue-600 flex-shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
              Spotter Truck Routing
            </h1>
            <p className="text-xs text-spotter-dark-500 dark:text-spotter-dark-400 truncate">
              Weather-Aware & Weight-Optimized Route Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {errorMessage && (
            <div className="flex items-center gap-2 min-w-0 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-spotter-dark-600 dark:text-spotter-dark-300 hover:bg-gray-100 dark:hover:bg-spotter-dark-800 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {/* <button
            className="p-2 rounded-lg text-spotter-dark-600 dark:text-spotter-dark-300 hover:bg-gray-100 dark:hover:bg-spotter-dark-800 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button> */}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 w-full max-w-full overflow-hidden min-w-0">
        {/* Left Panel - Route Planning */}
        <RoutePanel
          onRouteSearch={handleRouteSearch}
          loading={loading}
          selectedRoute={selectedRoute}
          onRouteSelect={setSelectedRoute}
          routes={routes}
          showWeatherOverlay={showWeatherOverlay}
          onToggleWeatherOverlay={setShowWeatherOverlay}
          showCheckpoints={showCheckpoints}
          onToggleCheckpoints={setShowCheckpoints}
          showAlternatives={showAlternatives}
          onToggleAlternatives={setShowAlternatives}
        />

        {/* Center - Interactive Map */}
        <div className="flex-1 min-w-0">
          <MapView
            routes={routes}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            darkMode={darkMode}
            showWeatherOverlay={showWeatherOverlay}
            showCheckpoints={showCheckpoints}
            showAlternatives={showAlternatives}
          />
        </div>

        {/* Right Panel - Route Details, Weather & Summary */}
        <DetailsPanel
          routes={routes}
          selectedRoute={selectedRoute}
        />
      </div>
    </div>
  )
}
