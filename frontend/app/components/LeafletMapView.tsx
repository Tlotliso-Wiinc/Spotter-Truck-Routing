import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Play, Pause, RotateCcw, Clock } from 'lucide-react'

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface LeafletMapViewProps {
  routes: any[]
  selectedRoute: string
  onSelectRoute?: (routeId: string) => void
  darkMode: boolean
  showWeatherOverlay?: boolean
  showCheckpoints?: boolean
  showAlternatives?: boolean
}

export default function LeafletMapView({
  routes,
  selectedRoute,
  onSelectRoute,
  darkMode,
  showWeatherOverlay = true,
  showCheckpoints = true,
  showAlternatives = true
}: LeafletMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const routeLayersRef = useRef<L.Layer[]>([])
  const checkpointLayersRef = useRef<L.Layer[]>([])
  
  const [forecastHour, setForecastHour] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = L.map(mapContainer.current, {
      center: [39.8283, -98.5795], // Center of US
      zoom: 4,
      zoomControl: true
    })

    // Use OpenStreetMap tiles (free, no API key required)
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    })

    tileLayer.addTo(map)
    mapRef.current = map

    return () => {
      routeLayersRef.current.forEach(layer => map.removeLayer(layer))
      routeLayersRef.current = []
      checkpointLayersRef.current.forEach(layer => map.removeLayer(layer))
      checkpointLayersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Helper to extract weather and risk data for a checkpoint at a given hour
  const getCheckpointWeatherAtHour = (cp: any, hour: number | null) => {
    if (hour === null || !cp.hourly_forecast || !cp.hourly_forecast[hour]) {
      return {
        risk_level: cp.risk_level || 'Low',
        temperature: cp.weather?.temperature ?? 70,
        wind_speed: cp.weather?.wind_speed ?? 10,
        precipitation: cp.weather?.precipitation ?? 0,
        time: cp.eta,
        isEtaMode: true
      }
    }
    const hData = cp.hourly_forecast[hour]
    return {
      risk_level: hData.risk_level || 'Low',
      temperature: hData.temperature ?? 70,
      wind_speed: hData.wind_speed ?? 10,
      precipitation: hData.precipitation ?? 0,
      time: hData.time,
      isEtaMode: false
    }
  }

  // Get risk color
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return '#10b981'
      case 'Moderate': return '#f59e0b'
      case 'High': return '#ef4444'
      case 'Severe': return '#8b5cf6'
      case 'No Travel': return '#0f172a'
      default: return '#10b981'
    }
  }

  // Render routes and checkpoints
  const renderMapContent = () => {
    const map = mapRef.current
    if (!map) return

    // Clear existing layers
    routeLayersRef.current.forEach(layer => map.removeLayer(layer))
    routeLayersRef.current = []
    checkpointLayersRef.current.forEach(layer => map.removeLayer(layer))
    checkpointLayersRef.current = []

    if (!routes || routes.length === 0) return

    const activeRoute = routes.find(r => r.route_id === selectedRoute) || routes[0]

    // Render routes
    routes.forEach((route) => {
      const isSelected = route.route_id === activeRoute.route_id

      if (route.geometry && route.geometry.coordinates) {
        // Convert GeoJSON coordinates to Leaflet format (lat, lng)
        const latLngs = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])

        const color = isSelected ? '#2563eb' : (darkMode ? '#06b6d4' : '#0891b2')
        const weight = isSelected ? 5.5 : 4
        const opacity = isSelected ? 1.0 : 0.55

        const polyline = L.polyline(latLngs, {
          color,
          weight,
          opacity,
          lineCap: 'round',
          lineJoin: 'round'
        })

        if (isSelected) {
          // Add casing for selected route
          const casing = L.polyline(latLngs, {
            color: darkMode ? '#0f172a' : '#ffffff',
            weight: 9,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          })
          casing.addTo(map)
          routeLayersRef.current.push(casing)
        }

        polyline.addTo(map)
        routeLayersRef.current.push(polyline)

        // Make route clickable
        polyline.on('click', () => {
          if (onSelectRoute) {
            onSelectRoute(route.route_id)
          }
        })

        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: weight + 2 })
          map.getContainer().style.cursor = 'pointer'
        })

        polyline.on('mouseout', () => {
          polyline.setStyle({ weight })
          map.getContainer().style.cursor = ''
        })
      }
    })

    // Render checkpoints
    const checkpoints = activeRoute.checkpoints || []
    
    // Render checkpoint circle markers (if enabled)
    if (checkpoints.length > 0 && showCheckpoints) {
      checkpoints.forEach((cp: any) => {
        const data = getCheckpointWeatherAtHour(cp, forecastHour)
        const riskColor = getRiskColor(data.risk_level)
        const radius = data.risk_level === 'No Travel' ? 9 :
                      data.risk_level === 'Severe' ? 8 :
                      data.risk_level === 'High' ? 7 : 6

        const circle = L.circleMarker([cp.coords.lat, cp.coords.lng], {
          radius,
          fillColor: riskColor,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 1
        })

        // Popup content
        const timeFormatted = data.isEtaMode
          ? (data.time ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'N/A')
          : (data.time ? new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'N/A')

        const modeLabel = data.isEtaMode ? 'Arrival ETA' : 'Forecast Time'

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; min-width: 180px; padding: 2px;">
            <div style="font-weight: 700; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
              <span>${cp.location}</span>
              <span style="font-size: 11px; padding: 2px 6px; border-radius: 9999px; background: ${riskColor}; color: white;">${data.risk_level}</span>
            </div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">${modeLabel}: ${timeFormatted}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; font-size: 12px;">
              <div>🌡️ ${Math.round(data.temperature)}°F</div>
              <div>💨 ${Math.round(data.wind_speed)} mph</div>
              <div>💧 ${Number(data.precipitation).toFixed(2)} in</div>
              <div>📍 ${cp.distance_from_start} mi</div>
            </div>
          </div>
        `

        circle.bindPopup(popupContent)
        circle.addTo(map)
        checkpointLayersRef.current.push(circle)

        // Weather heatmap circles (simplified for Leaflet)
        if (showWeatherOverlay) {
          const heatCircle = L.circleMarker([cp.coords.lat, cp.coords.lng], {
            radius: 35,
            fillColor: riskColor,
            color: 'transparent',
            weight: 0,
            fillOpacity: 0.3
          })
          heatCircle.addTo(map)
          checkpointLayersRef.current.push(heatCircle)
        }
      })
    }

    // Add Origin & Destination markers (always show regardless of showCheckpoints)
    if (checkpoints.length > 0) {
      const firstCoord = checkpoints[0]?.coords
      const lastCoord = checkpoints[checkpoints.length - 1]?.coords

      if (firstCoord) {
        const originIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 12px;">A</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })

        const markerA = L.marker([firstCoord.lat, firstCoord.lng], { icon: originIcon })
          .bindPopup('<strong>Origin</strong>')
          .addTo(map)
        checkpointLayersRef.current.push(markerA)
      }

      if (lastCoord) {
        const destIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width: 24px; height: 24px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 12px;">B</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })

        const markerB = L.marker([lastCoord.lat, lastCoord.lng], { icon: destIcon })
          .bindPopup('<strong>Destination</strong>')
          .addTo(map)
        checkpointLayersRef.current.push(markerB)
      }

      // Fit bounds to active route
      if (activeRoute.geometry && activeRoute.geometry.coordinates) {
        const latLngs = activeRoute.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])
        const bounds = L.latLngBounds(latLngs)
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
      }
    }
  }

  // Play/Pause auto-scrubbing animation
  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setForecastHour(prev => {
        if (prev === null) return 0
        if (prev >= 47) return 0
        return prev + 1
      })
    }, 650)

    return () => clearInterval(timer)
  }, [isPlaying])

  // Render map content when dependencies change
  useEffect(() => {
    renderMapContent()
  }, [routes, selectedRoute, showWeatherOverlay, showCheckpoints, showAlternatives, forecastHour, darkMode])

  // Helper to format slider timestamp
  const getTimelineDateLabel = () => {
    if (forecastHour === null) {
      return 'Dynamic Truck Arrival ETAs'
    }
    const date = new Date()
    date.setHours(date.getHours() + forecastHour)
    return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (+${forecastHour}h)`
  }

  return (
    <div className="flex-1 relative h-full w-full">
      <div ref={mapContainer} className="w-full h-full" style={{ background: darkMode ? '#1a1a1a' : '#e5e7eb' }} />

      {/* 0-48 Hour Forecast Corridor Slider */}
      {routes.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-spotter-dark-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 dark:border-spotter-dark-700 px-5 py-3.5 z-10 w-[460px] max-w-[92vw]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-spotter-blue-600" />
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                0–48h Weather Forecast Slider
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForecastHour(null)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                  forecastHour === null
                    ? 'bg-spotter-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-spotter-dark-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
                title="Reset to dynamic arrival ETAs along route"
              >
                Route ETAs
              </button>
              {forecastHour !== null && (
                <button
                  onClick={() => setForecastHour(null)}
                  className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                  title="Reset to ETA"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Timestamp readout */}
          <div className="text-[11px] font-medium text-spotter-dark-600 dark:text-spotter-dark-300 mb-2 flex items-center justify-between">
            <span className="truncate">{getTimelineDateLabel()}</span>
            {forecastHour !== null && (
              <span className="text-spotter-blue-600 font-semibold text-[11px] flex-shrink-0">
                +{forecastHour} hrs
              </span>
            )}
          </div>

          {/* Slider and Play/Pause Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (forecastHour === null) setForecastHour(0)
                setIsPlaying(!isPlaying)
              }}
              className="p-2 rounded-lg bg-spotter-blue-600 hover:bg-spotter-blue-700 text-white shadow-xs transition-colors flex-shrink-0"
              title={isPlaying ? 'Pause timeline' : 'Play 48h timeline'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <input
                type="range"
                min="0"
                max="47"
                step="1"
                value={forecastHour ?? 0}
                onChange={(e) => {
                  setIsPlaying(false)
                  setForecastHour(parseInt(e.target.value))
                }}
                className="w-full h-1.5 bg-gray-200 dark:bg-spotter-dark-700 rounded-lg appearance-none cursor-pointer accent-spotter-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400 mt-1 font-medium">
                <span>0h (Now)</span>
                <span>+12h</span>
                <span>+24h</span>
                <span>+36h</span>
                <span>+48h</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Level Legend */}
      <div className="absolute top-4 left-6 bg-white/95 dark:bg-spotter-dark-900/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/80 dark:border-spotter-dark-700 p-3.5 z-10">
        <h3 className="font-semibold text-[10px] text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wider">
          Weather Risk Legend
        </h3>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Low (&lt;25 mph, &lt;0.10" rain)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Moderate (25-34 mph, 0.10-0.25")</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">High (35-44 mph, 0.25-0.50")</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-purple-600 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Severe (45-54 mph / heavy load)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-slate-900 dark:bg-slate-700 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">No Travel (&ge;55 mph)</span>
          </div>
        </div>
      </div>

      {/* Fallback Notice */}
      <div className="absolute top-4 right-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 z-10">
        <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
          Using Leaflet fallback (WebGL unavailable)
        </p>
      </div>
    </div>
  )
}
