# Weather-Aware Truck Routing

A React + TypeScript + Django web application that helps truck drivers choose the safest route based on weather conditions, load weight, and travel time.

## Features

- **Route Planning**: Generate multiple route options between origin and destination
- **Weather Integration**: Real-time weather forecasts at checkpoints along the route
- **Risk Assessment**: Weather risk scoring based on wind, rain, and snow thresholds
- **Load-Aware Recommendations**: Route recommendations that consider truck load weight
- **Interactive Map**: Mapbox-powered map with route visualization and weather overlays
- **Dashboard UI**: Modern, responsive interface with dark mode support

## Architecture

### Backend (Django)
- **Django REST Framework**: API endpoints for route planning
- **Route Service**: Integration with Mapbox Directions API
- **Weather Service**: Integration with Open-Meteo Forecast API (primary) with Visual Crossing Weather API fallback
- **Risk Engine**: Weather risk assessment based on spec thresholds
- **Recommendation Engine**: Route recommendation logic

### Frontend (React + TypeScript)
- **Vite**: Fast build tool and dev server
- **Mapbox GL JS**: Interactive map rendering
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Icon library

## Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+
- Mapbox Access Token (free at [mapbox.com](https://www.mapbox.com/))
- Visual Crossing API Key (optional, free at [visualcrossing.com](https://www.visualcrossing.com/)) - used as fallback when Open-Meteo fails

### Backend Setup

1. **Create a virtual environment**:
```bash
python -m venv .venv
.venv\Scripts\activate  # On Windows
source .venv/bin/activate  # On Mac/Linux
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment variables**:
```bash
cp .env.example .env
```

Edit `.env` and add your Mapbox Access Token (and optionally Visual Crossing API key):
```
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
VISUAL_CROSSING_API_KEY=your_visual_crossing_api_key_here  # Optional
```

4. **Run migrations**:
```bash
python manage.py migrate
```

5. **Start Django server**:
```bash
python manage.py runserver
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
```bash
cd frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment variables**:
```bash
cp .env.example .env
```

Edit `.env` and add your Mapbox Access Token:
```
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
```

4. **Start Vite dev server**:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

1. Open `http://localhost:5173` in your browser
2. Enter origin and destination locations
3. Optionally select truck load weight
4. Click "Find Safer Routes"
5. View route options, weather conditions, and risk assessments
6. Select different routes to compare details

## Risk Thresholds

The application uses the following risk thresholds (from spec):

### Wind
- Low: <25 mph
- Moderate: 25-34 mph
- High: 35-44 mph
- Severe: 45-54 mph
- No Travel: ≥55 mph

### Rain
- Low: <0.10 in/hr
- Moderate: 0.10-0.25 in/hr
- High: 0.25-0.50 in/hr
- Severe: 0.50-1.00 in/hr
- No Travel: >1.00 in/hr

### Snow
- Low: <0.5 in/hr
- Moderate: 0.5-1.0 in/hr
- High: 1.0-2.0 in/hr
- Severe: 2.0-3.0 in/hr
- No Travel: >3.0 in/hr

### Load Rules
- ≥55 mph → No Travel for any load
- 45-54 mph + >30,000 lb → No Travel
- 35-44 mph + >40,000 lb → Severe

## Weather API Fallback

The application uses a multi-tier weather API strategy for reliability and performance:

### Batch Request Fallback Chain (for prefetching multiple locations)
1. **Open-Meteo Batch API** (primary)
   - Supports up to 1000 locations per request
   - Free, no API key required
   - Used by default for efficient bulk weather fetching

2. **Visual Crossing Batch API** (secondary)
   - Supports multiple locations via `/timelinemulti` endpoint
   - Free tier: 1,000 records/day
   - Automatically used when Open-Meteo batch fails after retries
   - Requires `VISUAL_CROSSING_API_KEY` in `.env` file

3. **Individual API Requests** (tertiary)
   - If both batch APIs fail, falls back to individual requests
   - Tries Open-Meteo individual, then Visual Crossing individual
   - Slower but more reliable as a last resort

### Individual Request Fallback Chain (for single location)
1. **Open-Meteo Individual API** (primary)
2. **Visual Crossing Individual API** (fallback)
3. **Default values** (final fallback) - 70°F, 10 mph wind, 0 precipitation

The weather service tracks API usage in `weather_stats`:
- `api_calls`: Total number of API calls made
- `cache_hits`: Number of requests served from cache
- `fallback_locations`: Number of locations using default weather data
- `visual_crossing_calls`: Number of calls to Visual Crossing API

## Route Recommendation

Routes are recommended based on:
1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel times

## API Endpoints

### POST /api/routes/
Request body:
```json
{
  "origin": "Denver, CO, USA",
  "destination": "Chicago, IL, USA",
  "origin_coords": {"lat": 39.7392, "lng": -104.9903},
  "destination_coords": {"lat": 41.8781, "lng": -87.6298},
  "departure_time": "2024-01-01T08:00:00Z",
  "load_weight": 30000
}
```

Response:
```json
{
  "routes": [
    {
      "route_id": "route_0",
      "name": "Fastest",
      "geometry": {...},
      "distance": 944.5,
      "duration": 14.5,
      "checkpoints": [...],
      "risk_summary": {...},
      "is_recommended": true
    }
  ],
  "recommended_route_id": "route_0"
}
```

## Deployment

This application is configured for deployment on Railway using the included Dockerfile.

### Deploying on Railway

The Dockerfile builds the React frontend, then installs the Django app and runs `collectstatic`, so Django serves the built bundle at `/` and `/assets/*`. Set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_MAPBOX_ACCESS_TOKEN` as Railway service variables. These are build-time values that Vite inlines into the bundle, so redeploy after changing them.

## License

MIT
