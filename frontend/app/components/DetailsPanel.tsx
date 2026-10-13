import { useState } from 'react'
import { Wind, Droplets, Thermometer, Clock, CheckCircle, AlertTriangle, Truck } from 'lucide-react'

interface DetailsPanelProps {
  routes: any[]
  selectedRoute: string
}

export default function DetailsPanel({ routes, selectedRoute }: DetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'weather' | 'summary'>('details')

  const selectedRouteData = routes.find(r => r.route_id === selectedRoute)

  if (!selectedRouteData) {
    return (
      <div className="w-96 bg-white dark:bg-spotter-dark-900 border-l border-spotter-teal dark:border-spotter-dark-700 p-6 flex items-center justify-center text-center">
        <p className="text-sm text-spotter-dark-500 dark:text-spotter-dark-400">
          Search for a route or select an option to view details
        </p>
      </div>
    )
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const formatETA = (isoString?: string) => {
    if (!isoString) return 'N/A'
    try {
      return new Date(isoString).toLocaleTimeString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoString
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low':
        return 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
      case 'Moderate':
        return 'text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300'
      case 'High':
        return 'text-rose-700 bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300'
      case 'Severe':
        return 'text-purple-800 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300'
      case 'No Travel':
        return 'text-white bg-slate-900 dark:bg-black dark:text-rose-400'
      default:
        return 'text-gray-700 bg-gray-100 dark:bg-spotter-dark-700 dark:text-gray-300'
    }
  }

  // Weather stats calculations
  const checkpoints = selectedRouteData.checkpoints || []
  const maxWind = checkpoints.reduce((max: number, cp: any) => Math.max(max, cp.weather?.wind_speed || 0), 0)
  const maxPrecip = checkpoints.reduce((max: number, cp: any) => Math.max(max, cp.weather?.precipitation || 0), 0)
  const temps = checkpoints.map((cp: any) => cp.weather?.temperature).filter((t: any) => typeof t === 'number')
  const minTemp = temps.length ? Math.min(...temps) : 70
  const maxTemp = temps.length ? Math.max(...temps) : 70

  const riskCounts = selectedRouteData.risk_summary?.risk_counts || {}

  return (
    <div className="w-96 bg-white dark:bg-spotter-dark-900 border-l border-spotter-teal dark:border-spotter-dark-700 flex flex-col overflow-y-auto">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-spotter-dark-700">
        {(['details', 'weather', 'summary'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-spotter-blue-600 border-b-2 border-spotter-blue-600 bg-spotter-blue-50/40 dark:bg-spotter-blue-950/20'
                : 'text-spotter-dark-600 dark:text-spotter-dark-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-6">
        {/* DETAILS TAB */}
        {activeTab === 'details' && (
          <>
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedRouteData.name}
                </h2>
                {selectedRouteData.is_recommended && (
                  <span className="text-xs bg-spotter-blue-600 text-white font-medium px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-spotter-dark-500 dark:text-spotter-dark-400 mt-1">
                {selectedRouteData.is_recommended
                  ? 'Optimal balance of safety, road weather, and driving time.'
                  : 'Alternative route for contingency planning.'}
              </p>
            </div>

            {/* Route Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-spotter-blue-50/60 dark:bg-spotter-dark-800 rounded-lg p-3 border border-spotter-blue-100 dark:border-spotter-dark-700">
                <div className="text-xs font-medium text-spotter-dark-500 dark:text-spotter-dark-400">Total Distance</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {Math.round(selectedRouteData.distance)} mi
                </div>
              </div>
              <div className="bg-spotter-blue-50/60 dark:bg-spotter-dark-800 rounded-lg p-3 border border-spotter-blue-100 dark:border-spotter-dark-700">
                <div className="text-xs font-medium text-spotter-dark-500 dark:text-spotter-dark-400">Drive Time</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatDuration(selectedRouteData.duration)}
                </div>
              </div>
            </div>

            {/* Departure & Arrival Info */}
            {checkpoints.length > 0 && (
              <div className="bg-gray-50 dark:bg-spotter-dark-800 p-3 rounded-lg border border-gray-200 dark:border-spotter-dark-700 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-spotter-dark-500 dark:text-spotter-dark-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-spotter-blue-500" /> Departure:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatETA(checkpoints[0]?.eta)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 dark:border-spotter-dark-700">
                  <span className="text-spotter-dark-500 dark:text-spotter-dark-400 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Est. Arrival:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatETA(checkpoints[checkpoints.length - 1]?.eta)}
                  </span>
                </div>
              </div>
            )}

            {/* Risk Summary */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Risk Assessment Summary
              </h3>
              <div className="bg-spotter-blue-50/50 dark:bg-spotter-dark-800 rounded-lg p-3.5 space-y-2 border border-gray-200 dark:border-spotter-dark-700 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-spotter-dark-600 dark:text-spotter-dark-400">Weather Risk</span>
                  <span className={`px-2 py-0.5 font-semibold rounded ${getRiskColor(selectedRouteData.risk_summary?.weather_risk || 'Low')}`}>
                    {selectedRouteData.risk_summary?.weather_risk || 'Low'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-spotter-dark-600 dark:text-spotter-dark-400">Load Risk (Weight)</span>
                  <span className={`px-2 py-0.5 font-semibold rounded ${getRiskColor(selectedRouteData.risk_summary?.load_risk || 'Low')}`}>
                    {selectedRouteData.risk_summary?.load_risk || 'Low'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-spotter-dark-600 font-bold">
                  <span className="text-gray-900 dark:text-white">Overall Safety Status</span>
                  <span className={`px-2 py-0.5 rounded ${getRiskColor(selectedRouteData.risk_summary?.overall_risk || 'Low')}`}>
                    {selectedRouteData.risk_summary?.overall_risk || 'Low'}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkpoint Timeline */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Checkpoints & ETAs ({checkpoints.length})
                </h3>
                <span className="text-[11px] text-spotter-dark-400">Every ~25 miles</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {checkpoints.map((checkpoint: any, index: number) => (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-spotter-dark-800 rounded-lg p-2.5 space-y-1.5 border border-gray-200 dark:border-spotter-dark-700 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {checkpoint.location}
                        </div>
                        <div className="text-[11px] text-spotter-dark-500 dark:text-spotter-dark-400">
                          ETA: {formatETA(checkpoint.eta)}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${getRiskColor(checkpoint.risk_level)}`}>
                        {checkpoint.risk_level}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1 text-[11px] text-spotter-dark-600 dark:text-spotter-dark-400 border-t border-gray-200/60 dark:border-spotter-dark-700">
                      <div className="flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                        {Math.round(checkpoint.weather?.temperature ?? 70)}°F
                      </div>
                      <div className="flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5 text-sky-500" />
                        {Math.round(checkpoint.weather?.wind_speed ?? 10)} mph
                      </div>
                      <div className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {(checkpoint.weather?.precipitation ?? 0).toFixed(2)} in
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* WEATHER TAB */}
        {activeTab === 'weather' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Corridor Weather Analysis
              </h2>
              <p className="text-xs text-spotter-dark-500 dark:text-spotter-dark-400 mt-1">
                Forecasted atmospheric metrics along the trip trajectory.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sky-50 dark:bg-spotter-dark-800 p-2.5 rounded-lg border border-sky-100 dark:border-spotter-dark-700 text-center">
                <Wind className="w-4 h-4 mx-auto text-sky-600 mb-1" />
                <div className="text-[10px] text-spotter-dark-500">Max Wind</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {Math.round(maxWind)} mph
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-spotter-dark-800 p-2.5 rounded-lg border border-blue-100 dark:border-spotter-dark-700 text-center">
                <Droplets className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                <div className="text-[10px] text-spotter-dark-500">Max Rain</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {maxPrecip.toFixed(2)} in/hr
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-spotter-dark-800 p-2.5 rounded-lg border border-amber-100 dark:border-spotter-dark-700 text-center">
                <Thermometer className="w-4 h-4 mx-auto text-amber-600 mb-1" />
                <div className="text-[10px] text-spotter-dark-500">Temp Range</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {Math.round(minTemp)}° - {Math.round(maxTemp)}°F
                </div>
              </div>
            </div>

            {/* Severe Weather Warnings */}
            {maxWind >= 45 || maxPrecip >= 0.5 ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" /> Weather Advisory
                </div>
                <p className="text-rose-600 dark:text-rose-300">
                  Elevated winds or precipitation detected. Review checkpoints with Severe / High ratings before departing.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Good Road Conditions
                </div>
                <p className="text-emerald-600 dark:text-emerald-300">
                  Winds and precipitation remain within standard operational tolerances along this route.
                </p>
              </div>
            )}

            {/* Checkpoint Weather Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Weather by Checkpoint
              </h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {checkpoints.map((cp: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-gray-50 dark:bg-spotter-dark-800 rounded">
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                      {cp.location}
                    </span>
                    <span className="text-spotter-dark-500">
                      {Math.round(cp.weather?.wind_speed || 0)} mph • {(cp.weather?.precipitation || 0).toFixed(2)} in
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getRiskColor(cp.risk_level)}`}>
                      {cp.risk_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Dispatch & Compliance Summary
              </h2>
              <p className="text-xs text-spotter-dark-500 dark:text-spotter-dark-400 mt-1">
                Safety scoring based on load rules & weather thresholds.
              </p>
            </div>

            {/* Risk Checkpoint Breakdown */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Checkpoint Risk Distribution
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300">Low Risk</div>
                  <div className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                    {riskCounts['Low'] || 0} checkpoints
                  </div>
                </div>
                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <div className="text-[11px] text-amber-800 dark:text-amber-300">Moderate Risk</div>
                  <div className="text-base font-bold text-amber-900 dark:text-amber-200">
                    {riskCounts['Moderate'] || 0} checkpoints
                  </div>
                </div>
                <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                  <div className="text-[11px] text-rose-800 dark:text-rose-300">High Risk</div>
                  <div className="text-base font-bold text-rose-900 dark:text-rose-200">
                    {riskCounts['High'] || 0} checkpoints
                  </div>
                </div>
                <div className="p-2.5 rounded bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                  <div className="text-[11px] text-purple-800 dark:text-purple-300">Severe / No Travel</div>
                  <div className="text-base font-bold text-purple-900 dark:text-purple-200">
                    {(riskCounts['Severe'] || 0) + (riskCounts['No Travel'] || 0)} checkpoints
                  </div>
                </div>
              </div>
            </div>

            {/* Load Rules Compliance */}
            <div className="bg-gray-50 dark:bg-spotter-dark-800 p-3.5 rounded-lg border border-gray-200 dark:border-spotter-dark-700 space-y-2 text-xs">
              <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-spotter-blue-500" /> Load Rule Checks
              </div>
              <ul className="space-y-1.5 text-spotter-dark-600 dark:text-spotter-dark-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-spotter-blue-500"></span>
                  &ge;55 mph: No Travel for any load
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-spotter-blue-500"></span>
                  45–54 mph + &gt;30,000 lbs: No Travel
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-spotter-blue-500"></span>
                  35–44 mph + &gt;40,000 lbs: Severe risk
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
