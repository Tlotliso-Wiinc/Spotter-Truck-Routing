import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

interface MapViewProps {
  routes: any[]
  selectedRoute: string
  darkMode: boolean
}

export default function MapView({ routes, selectedRoute, darkMode }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: darkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
      accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right')

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    map.setStyle(darkMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11')
  }, [darkMode])

  useEffect(() => {
    if (!mapRef.current || routes.length === 0) return

    const map = mapRef.current

    // Remove existing layers and sources
    if (map.getSource('routes')) {
      map.removeLayer('route-fill')
      map.removeLayer('route-line')
      map.removeSource('routes')
    }

    if (map.getSource('checkpoints')) {
      map.removeLayer('checkpoints')
      map.removeSource('checkpoints')
    }

    // Add route sources and layers
    const routeFeatures = routes.map((route, index) => ({
      type: 'Feature',
      properties: {
        route_id: route.route_id,
        name: route.name,
        color: index === 0 ? '#3b82f6' : index === 1 ? '#f97316' : '#22c55e'
      },
      geometry: route.geometry
    }))

    map.addSource('routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: routeFeatures
      }
    })

    // Add route lines
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'routes',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 4,
        'line-opacity': ['case', ['==', ['get', 'route_id'], selectedRoute], 1, 0.4]
      }
    })

    // Add checkpoints
    const selectedRouteData = routes.find(r => r.route_id === selectedRoute)
    if (selectedRouteData && selectedRouteData.checkpoints) {
      const checkpointFeatures = selectedRouteData.checkpoints.map((checkpoint: any) => ({
        type: 'Feature',
        properties: {
          location: checkpoint.location,
          risk_level: checkpoint.risk_level
        },
        geometry: {
          type: 'Point',
          coordinates: [checkpoint.coords.lng, checkpoint.coords.lat]
        }
      }))

      map.addSource('checkpoints', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: checkpointFeatures
        }
      })

      map.addLayer({
        id: 'checkpoints',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match',
            ['get', 'risk_level'],
            'Low', '#22c55e',
            'Moderate', '#f59e0b',
            'High', '#ef4444',
            'Severe', '#7c3aed',
            'No Travel', '#000000',
            '#22c55e'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }

    // Fit map to routes
    if (routeFeatures.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      routeFeatures.forEach((feature: any) => {
        if (feature.geometry && feature.geometry.coordinates) {
          feature.geometry.coordinates.forEach((coord: any) => {
            bounds.extend(coord)
          })
        }
      })
      map.fitBounds(bounds, { padding: 50 })
    }
  }, [routes, selectedRoute])

  return (
    <div className="flex-1 relative">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-spotter-dark-900 rounded-lg shadow-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Risk Levels</h3>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-spotter-green-500"></div>
            <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-spotter-yellow-500"></div>
            <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-spotter-dark-700 dark:text-spotter-dark-300">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-600"></div>
            <span className="text-spotter-dark-700 dark:text-spotter-dark-300">Severe</span>
          </div>
        </div>
      </div>
    </div>
  )
}
