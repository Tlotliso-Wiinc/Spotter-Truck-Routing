import { useState } from 'react'
import { Truck, Settings, Sun, Moon } from 'lucide-react'
import RoutePanel from '../components/RoutePanel'
import MapView from '../components/MapView'
import DetailsPanel from '../components/DetailsPanel'

interface RouteData {
  route_id: string
  name: string
  geometry: any
  distance: number
  duration: number
  checkpoints: any[]
  risk_summary: any
  is_recommended: boolean
}

export default function Dashboard() {
  const [darkMode, setDarkMode] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string>('route_0')
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [loading, setLoading] = useState(false)

  const handleRouteSearch = async (origin: string, destination: string, loadWeight?: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/routes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          origin_coords: { lat: 39.7392, lng: -104.9903 }, // Default Denver
          destination_coords: { lat: 41.8781, lng: -87.6298 }, // Default Chicago
          departure_time: new Date().toISOString(),
          load_weight: loadWeight
        })
      })
      const data = await response.json()
      setRoutes(data.routes)
      if (data.recommended_route_id) {
        setSelectedRoute(data.recommended_route_id)
      }
    } catch (error) {
      console.error('Error fetching routes:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Weather-Aware Truck Routing</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Safer routes. Smarter decisions.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Route Planning */}
        <RoutePanel
          onRouteSearch={handleRouteSearch}
          loading={loading}
          selectedRoute={selectedRoute}
          onRouteSelect={setSelectedRoute}
          routes={routes}
        />

        {/* Center - Map */}
        <MapView
          routes={routes}
          selectedRoute={selectedRoute}
        />

        {/* Right Panel - Details */}
        <DetailsPanel
          routes={routes}
          selectedRoute={selectedRoute}
        />
      </div>
    </div>
  )
}
