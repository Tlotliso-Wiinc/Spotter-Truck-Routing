import { useState } from 'react'
import { MapPin, Truck, Layers } from 'lucide-react'

interface RoutePanelProps {
  onRouteSearch: (origin: string, destination: string, loadWeight?: number) => void
  loading: boolean
  selectedRoute: string
  onRouteSelect: (routeId: string) => void
  routes: any[]
}

export default function RoutePanel({ onRouteSearch, loading, selectedRoute, onRouteSelect, routes }: RoutePanelProps) {
  const [origin, setOrigin] = useState('Denver, CO, USA')
  const [destination, setDestination] = useState('Chicago, IL, USA')
  const [loadWeight, setLoadWeight] = useState('30000')
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true)
  const [showCheckpoints, setShowCheckpoints] = useState(true)
  const [showAlternatives, setShowAlternatives] = useState(true)

  const handleSearch = () => {
    onRouteSearch(origin, destination, parseInt(loadWeight))
  }

  return (
    <div className="w-80 bg-white dark:bg-spotter-dark-900 border-r border-gray-200 dark:border-spotter-dark-700 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Plan Your Route */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plan Your Route</h2>
          
          <div className="space-y-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotter-dark-400" />
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Origin"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotter-dark-400" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white"
              />
            </div>
            
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotter-dark-400" />
              <select
                value={loadWeight}
                onChange={(e) => setLoadWeight(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white"
              >
                <option value="">Select Load Weight</option>
                <option value="20000">20,000 - 30,000 lbs</option>
                <option value="30000">30,000 - 40,000 lbs</option>
                <option value="40000">40,000 - 50,000 lbs</option>
                <option value="50000">50,000 - 60,000 lbs</option>
              </select>
            </div>
            
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-spotter-blue-600 hover:bg-spotter-blue-700 disabled:bg-spotter-dark-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Finding Routes...' : 'Find Safer Routes'}
            </button>
          </div>
        </div>

        {/* Route Options */}
        {routes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Route Options</h2>
            <div className="space-y-2">
              {routes.map((route) => (
                <label
                  key={route.route_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRoute === route.route_id
                      ? 'border-spotter-blue-500 bg-spotter-blue-50 dark:bg-spotter-blue-900/20'
                      : 'border-gray-200 dark:border-spotter-dark-600 hover:bg-spotter-blue-50 dark:hover:bg-spotter-dark-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="route"
                    checked={selectedRoute === route.route_id}
                    onChange={() => onRouteSelect(route.route_id)}
                    className="w-4 h-4 text-spotter-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {route.name}
                      {route.is_recommended && (
                        <span className="ml-2 text-xs bg-spotter-blue-100 text-spotter-blue-800 px-2 py-0.5 rounded-full">Recommended</span>
                      )}
                    </div>
                    <div className="text-sm text-spotter-dark-600 dark:text-spotter-dark-400">
                      {Math.round(route.distance)} miles • {Math.round(route.duration * 60)} min
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Map Layers */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Map Layers
          </h2>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showWeatherOverlay}
                onChange={() => setShowWeatherOverlay(!showWeatherOverlay)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Weather Overlay</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showCheckpoints}
                onChange={() => setShowCheckpoints(!showCheckpoints)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Checkpoint Markers</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showAlternatives}
                onChange={() => setShowAlternatives(!showAlternatives)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Route Alternatives</span>
            </label>
          </div>
        </div>

        {/* Attribution */}
        <div className="text-xs text-spotter-dark-500 dark:text-spotter-dark-400 space-y-1">
          <p>Mapbox provides maps, routing, and geocoding.</p>
          <p>Open-Meteo provides weather forecasts.</p>
        </div>
      </div>
    </div>
  )
}
