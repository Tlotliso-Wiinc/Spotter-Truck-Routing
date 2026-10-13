import { useState } from 'react'
import { MapPin, Truck, Layers, Loader2, Calendar } from 'lucide-react'

interface RoutePanelProps {
  onRouteSearch: (origin: string, destination: string, departureTime: string, loadWeight?: number) => void
  loading: boolean
  selectedRoute: string
  onRouteSelect: (routeId: string) => void
  routes: any[]
  showWeatherOverlay?: boolean
  onToggleWeatherOverlay?: (val: boolean) => void
  showCheckpoints?: boolean
  onToggleCheckpoints?: (val: boolean) => void
  showAlternatives?: boolean
  onToggleAlternatives?: (val: boolean) => void
}

export default function RoutePanel({
  onRouteSearch,
  loading,
  selectedRoute,
  onRouteSelect,
  routes,
  showWeatherOverlay = true,
  onToggleWeatherOverlay,
  showCheckpoints = true,
  onToggleCheckpoints,
  showAlternatives = true,
  onToggleAlternatives
}: RoutePanelProps) {
  const [origin, setOrigin] = useState('Denver, CO, USA')
  const [destination, setDestination] = useState('Chicago, IL, USA')
  
  // Format current local datetime to YYYY-MM-DDTHH:mm
  const getInitialDeparture = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const [departureTime, setDepartureTime] = useState(getInitialDeparture())
  const [loadWeight, setLoadWeight] = useState<string>('30000')

  const handleSearch = () => {
    const numericWeight = loadWeight !== '' ? Number(loadWeight) : undefined
    onRouteSearch(origin, destination, departureTime, numericWeight)
  }

  return (
    <div className="w-80 bg-white dark:bg-spotter-dark-900 border-r border-spotter-teal dark:border-spotter-dark-700 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Plan Your Route */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plan Your Route</h2>
          
          <div className="space-y-3">
            {/* Origin */}
            <div>
              <label className="block text-xs font-semibold text-spotter-dark-600 dark:text-spotter-dark-400 mb-1 uppercase tracking-wider">
                Origin
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Enter origin location"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-spotter-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            {/* Destination */}
            <div>
              <label className="block text-xs font-semibold text-spotter-dark-600 dark:text-spotter-dark-400 mb-1 uppercase tracking-wider">
                Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination location"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-spotter-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Departure Date/Time */}
            <div>
              <label className="block text-xs font-semibold text-spotter-dark-600 dark:text-spotter-dark-400 mb-1 uppercase tracking-wider">
                Departure Date & Time
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotter-blue-500" />
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-spotter-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            {/* Load Weight (lbs) */}
            <div>
              <label className="block text-xs font-semibold text-spotter-dark-600 dark:text-spotter-dark-400 mb-1 uppercase tracking-wider">
                Load Weight (lbs)
              </label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-spotter-dark-400" />
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={loadWeight}
                  onChange={(e) => setLoadWeight(e.target.value)}
                  placeholder="Enter weight in lbs (e.g. 35000)"
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 dark:border-spotter-dark-600 rounded-lg bg-white dark:bg-spotter-dark-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-spotter-blue-500 focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-spotter-dark-400 pointer-events-none">
                  lbs
                </span>
              </div>
            </div>
            
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-spotter-blue-600 hover:bg-spotter-blue-700 disabled:bg-spotter-dark-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculating Routes...
                </>
              ) : (
                'Find Safe Routes'
              )}
            </button>
          </div>
        </div>

        {/* Route Options */}
        {routes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Route Options</h2>
            <div className="space-y-2">
              {routes.map((route) => {
                const isSelected = selectedRoute === route.route_id
                const overallRisk = route.risk_summary?.overall_risk || 'Low'
                const riskBadgeColor =
                  overallRisk === 'Low' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  overallRisk === 'Moderate' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                  overallRisk === 'High' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                  overallRisk === 'Severe' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' :
                  'bg-gray-900 text-white dark:bg-gray-800'

                return (
                  <label
                    key={route.route_id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-spotter-blue-500 bg-spotter-blue-50/80 dark:bg-spotter-blue-900/30 ring-1 ring-spotter-blue-500 shadow-sm'
                        : 'border-gray-200 dark:border-spotter-dark-600 hover:bg-spotter-blue-50/50 dark:hover:bg-spotter-dark-700/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="route"
                      checked={isSelected}
                      onChange={() => onRouteSelect(route.route_id)}
                      className="mt-1 w-4 h-4 text-spotter-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {route.name}
                        </span>
                        {route.is_recommended && (
                          <span className="text-[11px] font-medium bg-spotter-blue-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-spotter-dark-600 dark:text-spotter-dark-400">
                        <span>{Math.round(route.distance)} mi</span>
                        <span>•</span>
                        <span>{Math.round(route.duration * 60)} min</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBadgeColor}`}>
                          {overallRisk}
                        </span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Map Layers */}
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-spotter-dark-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-spotter-blue-500" />
            Map Layers
          </h2>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showWeatherOverlay}
                onChange={(e) => onToggleWeatherOverlay?.(e.target.checked)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Weather Risk Overlay</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showCheckpoints}
                onChange={(e) => onToggleCheckpoints?.(e.target.checked)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Checkpoint Markers</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showAlternatives}
                onChange={(e) => onToggleAlternatives?.(e.target.checked)}
                className="w-4 h-4 text-spotter-blue-600 rounded"
              />
              <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Route Alternatives</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
