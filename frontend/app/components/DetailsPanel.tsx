import { useState } from 'react'
import { Wind, Droplets, Thermometer } from 'lucide-react'

interface DetailsPanelProps {
  routes: any[]
  selectedRoute: string
}

export default function DetailsPanel({ routes, selectedRoute }: DetailsPanelProps) {
  const [activeTab, setActiveTab] = useState('details')
  const [forecastTime, setForecastTime] = useState('now')

  const selectedRouteData = routes.find(r => r.route_id === selectedRoute)

  if (!selectedRouteData) {
    return (
      <div className="w-96 bg-white dark:bg-spotter-dark-900 border-l border-spotter-teal dark:border-spotter-dark-700 p-6">
        <p className="text-spotter-dark-500 dark:text-spotter-dark-400">Select a route to view details</p>
      </div>
    )
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'text-spotter-green-600 bg-spotter-green-100'
      case 'Moderate': return 'text-spotter-yellow-600 bg-spotter-yellow-100'
      case 'High': return 'text-red-600 bg-red-100'
      case 'Severe': return 'text-purple-600 bg-purple-100'
      case 'No Travel': return 'text-spotter-dark-900 bg-spotter-dark-300'
      default: return 'text-spotter-dark-600 bg-spotter-dark-100'
    }
  }

  return (
    <div className="w-96 bg-white dark:bg-spotter-dark-900 border-l border-spotter-teal dark:border-spotter-dark-700 flex flex-col overflow-y-auto">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-spotter-dark-700">
        {['details', 'weather', 'summary'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-spotter-blue-600 border-b-2 border-spotter-blue-600'
                : 'text-spotter-dark-600 dark:text-spotter-dark-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {activeTab === 'details' && (
          <>
            {/* Route Header */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedRouteData.name}
                {selectedRouteData.is_recommended && (
                  <span className="ml-2 text-sm font-normal text-spotter-blue-600">(Recommended)</span>
                )}
              </h2>
              <p className="text-spotter-dark-600 dark:text-spotter-dark-400 mt-1">
                This route has the best balance of safety and efficiency based on current weather conditions.
              </p>
            </div>

            {/* Route Overview */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Route Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-spotter-blue-50 dark:bg-spotter-dark-700 rounded-lg p-3">
                  <div className="text-sm text-spotter-dark-600 dark:text-spotter-dark-400">Distance</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {Math.round(selectedRouteData.distance)} miles
                  </div>
                </div>
                <div className="bg-spotter-blue-50 dark:bg-spotter-dark-700 rounded-lg p-3">
                  <div className="text-sm text-spotter-dark-600 dark:text-spotter-dark-400">Duration</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(selectedRouteData.duration)}
                  </div>
                </div>
              </div>
            </div>

            {/* Checkpoint Weather */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Checkpoint Weather & ETA</h3>
              
              {/* Forecast Time Selector */}
              <div className="flex gap-2">
                {['Now', '+12h', '+24h'].map((time) => (
                  <button
                    key={time}
                    onClick={() => setForecastTime(time.toLowerCase())}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      forecastTime === time.toLowerCase()
                        ? 'bg-spotter-blue-600 text-white'
                        : 'bg-spotter-blue-100 dark:bg-spotter-dark-700 text-spotter-dark-700 dark:text-spotter-dark-300'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              {/* Checkpoints List */}
              <div className="space-y-2">
                {selectedRouteData.checkpoints?.map((checkpoint: any, index: number) => (
                  <div
                    key={index}
                    className="bg-spotter-blue-50 dark:bg-spotter-dark-700 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {checkpoint.location}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(checkpoint.risk_level)}`}>
                        {checkpoint.risk_level}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-1 text-spotter-dark-600 dark:text-spotter-dark-400">
                        <Thermometer className="w-4 h-4" />
                        {Math.round(checkpoint.weather.temperature)}°F
                      </div>
                      <div className="flex items-center gap-1 text-spotter-dark-600 dark:text-spotter-dark-400">
                        <Wind className="w-4 h-4" />
                        {Math.round(checkpoint.weather.wind_speed)} mph
                      </div>
                      <div className="flex items-center gap-1 text-spotter-dark-600 dark:text-spotter-dark-400">
                        <Droplets className="w-4 h-4" />
                        {checkpoint.weather.precipitation.toFixed(2)} in
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Risk Summary</h3>
              <div className="bg-spotter-blue-50 dark:bg-spotter-dark-700 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-spotter-dark-600 dark:text-spotter-dark-400">Weather Risk</span>
                  <span className={`font-medium ${getRiskColor(selectedRouteData.risk_summary?.weather_risk || 'Low').split(' ')[0]}`}>
                    {selectedRouteData.risk_summary?.weather_risk || 'Low'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-spotter-dark-600 dark:text-spotter-dark-400">Load Risk</span>
                  <span className={`font-medium ${getRiskColor(selectedRouteData.risk_summary?.load_risk || 'Low').split(' ')[0]}`}>
                    {selectedRouteData.risk_summary?.load_risk || 'Low'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-spotter-dark-600 pt-2">
                  <span className="font-semibold text-gray-900 dark:text-white">Overall Risk</span>
                  <span className={`font-semibold ${getRiskColor(selectedRouteData.risk_summary?.overall_risk || 'Low').split(' ')[0]}`}>
                    {selectedRouteData.risk_summary?.overall_risk || 'Low'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'weather' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weather Forecast</h2>
            <p className="text-spotter-dark-600 dark:text-spotter-dark-400">
              Detailed weather information along the route will be displayed here.
            </p>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Route Summary</h2>
            <p className="text-spotter-dark-600 dark:text-spotter-dark-400">
              Complete route analysis and recommendations will be displayed here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
