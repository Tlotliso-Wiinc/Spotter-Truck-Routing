import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapViewProps {
  routes: any[]
  selectedRoute: string
  onSelectRoute?: (routeId: string) => void
  darkMode: boolean
  showWeatherOverlay?: boolean
  showCheckpoints?: boolean
  showAlternatives?: boolean
}

export default function MapView({
  routes,
  selectedRoute,
  onSelectRoute,
  darkMode,
  showWeatherOverlay = true,
  showCheckpoints = true,
  showAlternatives = true
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() || ''
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: darkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    mapRef.current = map

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (popupRef.current) popupRef.current.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Handle Dark Mode Style Change
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const styleUrl = darkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'

    map.setStyle(styleUrl)
    // Once the style is reloaded, re-trigger layer updates
    const onStyleLoad = () => {
      renderMapContent()
    }
    map.once('style.load', onStyleLoad)

    return () => {
      map.off('style.load', onStyleLoad)
    }
  }, [darkMode])

  // Function to render routes, checkpoints, and markers
  const renderMapContent = () => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // 1. Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    // 2. Remove existing layers & sources safely
    const layersToRemove = [
      'checkpoints-label',
      'checkpoints-point',
      'weather-heatmap',
      'route-line-selected-casing',
      'route-line-selected',
      'route-line-alternatives',
      'routes-interactive'
    ]
    layersToRemove.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId)
      }
    })

    const sourcesToRemove = ['routes-source', 'checkpoints-source', 'heatmap-source']
    sourcesToRemove.forEach(sourceId => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId)
      }
    })

    if (!routes || routes.length === 0) return

    // Find selected route
    const activeRoute = routes.find(r => r.route_id === selectedRoute) || routes[0]

    // 3. Build GeoJSON for all routes
    const routeFeatures = routes.map((route) => {
      const isSelected = route.route_id === activeRoute.route_id
      return {
        type: 'Feature' as const,
        properties: {
          route_id: route.route_id,
          name: route.name,
          distance: route.distance,
          duration: route.duration,
          is_selected: isSelected,
          is_recommended: !!route.is_recommended
        },
        geometry: route.geometry
      }
    })

    map.addSource('routes-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: routeFeatures
      }
    })

    // Layer for alternative routes (if showAlternatives is enabled)
    if (showAlternatives) {
      map.addLayer({
        id: 'route-line-alternatives',
        type: 'line',
        source: 'routes-source',
        filter: ['!=', ['get', 'route_id'], activeRoute.route_id],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': darkMode ? '#94a3b8' : '#64748b',
          'line-width': 4,
          'line-opacity': 0.55
        }
      })
    }

    // Casing (outline) for selected route
    map.addLayer({
      id: 'route-line-selected-casing',
      type: 'line',
      source: 'routes-source',
      filter: ['==', ['get', 'route_id'], activeRoute.route_id],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': darkMode ? '#0f172a' : '#ffffff',
        'line-width': 9,
        'line-opacity': 0.95
      }
    })

    // Selected route main line
    map.addLayer({
      id: 'route-line-selected',
      type: 'line',
      source: 'routes-source',
      filter: ['==', ['get', 'route_id'], activeRoute.route_id],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#2563eb', // Spotter primary blue
        'line-width': 5.5,
        'line-opacity': 1.0
      }
    })

    // Invisible wider layer for clicking routes
    map.addLayer({
      id: 'routes-interactive',
      type: 'line',
      source: 'routes-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-width': 16,
        'line-opacity': 0
      }
    })

    // Click on a route to select it
    map.on('click', 'routes-interactive', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0] as any
        const clickedRouteId = feature?.properties?.route_id
        if (clickedRouteId && onSelectRoute) {
          onSelectRoute(clickedRouteId)
        }
      }
    })

    map.on('mouseenter', 'routes-interactive', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'routes-interactive', () => {
      map.getCanvas().style.cursor = ''
    })

    // 4. Build Checkpoints GeoJSON for the active route
    const checkpoints = activeRoute.checkpoints || []
    if (checkpoints.length > 0) {
      const riskScoreMap: Record<string, number> = {
        'Low': 1,
        'Moderate': 2,
        'High': 3,
        'Severe': 4,
        'No Travel': 5
      }

      const checkpointFeatures = checkpoints.map((cp: any, idx: number) => ({
        type: 'Feature' as const,
        properties: {
          id: idx,
          location: cp.location,
          distance_from_start: cp.distance_from_start,
          eta: cp.eta,
          risk_level: cp.risk_level || 'Low',
          risk_score: riskScoreMap[cp.risk_level] || 1,
          temperature: cp.weather?.temperature ?? 70,
          wind_speed: cp.weather?.wind_speed ?? 10,
          precipitation: cp.weather?.precipitation ?? 0
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [cp.coords.lng, cp.coords.lat]
        }
      }))

      map.addSource('checkpoints-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: checkpointFeatures
        }
      })

      // 5. Weather heatmap overlay along corridor
      if (showWeatherOverlay) {
        map.addLayer({
          id: 'weather-heatmap',
          type: 'heatmap',
          source: 'checkpoints-source',
          maxzoom: 12,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'risk_score'],
              1, 0.2,
              2, 0.5,
              3, 0.8,
              4, 1.2,
              5, 1.5
            ],
            'heatmap-intensity': 1,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(34, 197, 94, 0)',
              0.25, 'rgba(34, 197, 94, 0.4)',
              0.5, 'rgba(245, 158, 11, 0.6)',
              0.75, 'rgba(239, 68, 68, 0.7)',
              1, 'rgba(124, 58, 237, 0.85)'
            ],
            'heatmap-radius': 35,
            'heatmap-opacity': 0.65
          }
        }, 'route-line-alternatives')
      }

      // 6. Checkpoint circle markers
      if (showCheckpoints) {
        map.addLayer({
          id: 'checkpoints-point',
          type: 'circle',
          source: 'checkpoints-source',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'risk_level'], 'No Travel'], 9,
              ['==', ['get', 'risk_level'], 'Severe'], 8,
              ['==', ['get', 'risk_level'], 'High'], 7,
              6
            ],
            'circle-color': [
              'match',
              ['get', 'risk_level'],
              'Low', '#10b981',
              'Moderate', '#f59e0b',
              'High', '#ef4444',
              'Severe', '#8b5cf6',
              'No Travel', '#0f172a',
              '#10b981'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        })

        // Popup on click/hover for checkpoint
        map.on('click', 'checkpoints-point', (e) => {
          if (!e.features || !e.features[0]) return
          const feature = e.features[0] as any
          const props = feature.properties || {}
          const coordinates = (feature.geometry?.coordinates || []).slice()

          const etaFormatted = props.eta ? new Date(props.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'N/A'

          const riskBadgeStyle =
            props.risk_level === 'Low' ? 'background: #dcfce7; color: #166534;' :
            props.risk_level === 'Moderate' ? 'background: #fef3c7; color: #92400e;' :
            props.risk_level === 'High' ? 'background: #fee2e2; color: #991b1b;' :
            props.risk_level === 'Severe' ? 'background: #f3e8ff; color: #6b21a8;' :
            'background: #0f172a; color: #ffffff;'

          const popupContent = `
            <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4; min-width: 180px; padding: 2px;">
              <div style="font-weight: 700; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>${props.location}</span>
                <span style="font-size: 11px; padding: 2px 6px; border-radius: 9999px; ${riskBadgeStyle}">${props.risk_level}</span>
              </div>
              <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">ETA: ${etaFormatted}</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 6px; font-size: 12px;">
                <div>🌡️ ${Math.round(props.temperature)}°F</div>
                <div>💨 ${Math.round(props.wind_speed)} mph</div>
                <div>💧 ${Number(props.precipitation).toFixed(2)} in</div>
                <div>📍 ${props.distance_from_start} mi</div>
              </div>
            </div>
          `

          if (popupRef.current) popupRef.current.remove()
          popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: true })
            .setLngLat(coordinates as [number, number])
            .setHTML(popupContent)
            .addTo(map)
        })

        map.on('mouseenter', 'checkpoints-point', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'checkpoints-point', () => {
          map.getCanvas().style.cursor = ''
        })
      }

      // 7. Add Origin & Destination Pin Markers
      const firstCoord = checkpoints[0]?.coords
      const lastCoord = checkpoints[checkpoints.length - 1]?.coords

      if (firstCoord) {
        const originEl = document.createElement('div')
        originEl.className = 'origin-marker'
        originEl.style.width = '24px'
        originEl.style.height = '24px'
        originEl.style.borderRadius = '50%'
        originEl.style.backgroundColor = '#10b981'
        originEl.style.border = '3px solid #ffffff'
        originEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)'
        originEl.style.display = 'flex'
        originEl.style.alignItems = 'center'
        originEl.style.justifyContent = 'center'
        originEl.style.color = '#ffffff'
        originEl.style.fontWeight = 'bold'
        originEl.style.fontSize = '12px'
        originEl.innerHTML = 'A'

        const markerA = new mapboxgl.Marker({ element: originEl })
          .setLngLat([firstCoord.lng, firstCoord.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML('<strong>Origin</strong>'))
          .addTo(map)
        markersRef.current.push(markerA)
      }

      if (lastCoord) {
        const destEl = document.createElement('div')
        destEl.className = 'dest-marker'
        destEl.style.width = '24px'
        destEl.style.height = '24px'
        destEl.style.borderRadius = '50%'
        destEl.style.backgroundColor = '#ef4444'
        destEl.style.border = '3px solid #ffffff'
        destEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)'
        destEl.style.display = 'flex'
        destEl.style.alignItems = 'center'
        destEl.style.justifyContent = 'center'
        destEl.style.color = '#ffffff'
        destEl.style.fontWeight = 'bold'
        destEl.style.fontSize = '12px'
        destEl.innerHTML = 'B'

        const markerB = new mapboxgl.Marker({ element: destEl })
          .setLngLat([lastCoord.lng, lastCoord.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML('<strong>Destination</strong>'))
          .addTo(map)
        markersRef.current.push(markerB)
      }
    }

    // 8. Fit Bounds to active route or all routes
    if (activeRoute.geometry && activeRoute.geometry.coordinates) {
      const bounds = new mapboxgl.LngLatBounds()
      activeRoute.geometry.coordinates.forEach((coord: [number, number]) => {
        bounds.extend(coord)
      })
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1000 })
    }
  }

  // Trigger render when routes, selectedRoute, or layer toggles change
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    if (!map.isStyleLoaded()) {
      const onStyleLoad = () => renderMapContent()
      map.once('style.load', onStyleLoad)
      return () => {
        map.off('style.load', onStyleLoad)
      }
    } else {
      renderMapContent()
    }
  }, [routes, selectedRoute, showWeatherOverlay, showCheckpoints, showAlternatives])

  return (
    <div className="flex-1 relative h-full w-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Risk Level Legend */}
      <div className="absolute bottom-6 left-6 bg-white/95 dark:bg-spotter-dark-900/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/80 dark:border-spotter-dark-700 p-3.5 z-10">
        <h3 className="font-semibold text-[10px] text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wider">
          Weather Risk Legend
        </h3>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Low (&lt;25 mph, &lt;0.10&quot; rain)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Moderate (25-34 mph, 0.10-0.25&quot;)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-xs"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">High (35-44 mph, 0.25-0.50&quot;)</span>
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
    </div>
  )
}
