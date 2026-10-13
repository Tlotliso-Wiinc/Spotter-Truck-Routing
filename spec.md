- A Weather-Aware Truck Routing Application

- A React + TypeScript + Django web app that helps a truck driver choose the safest route based on weather,
load weight, and travel time.

# Requirements

- The user enters:
• Origin & destination
• Departure date/time
• Load weight

- The app should:
• Generate 3 route options using a routing API.
• Sample weather every 10 / 25 / 50 miles, using the truck's estimated arrival time at each
checkpoint.
• Calculate weather risk using the provided risk/load rules.
• Recommend the best route, balancing weather risk and travel time.
• Show all routes, checkpoints, risk levels, ETAs, and route summaries on a map.
• Show a weather heatmap along the trip corridor with a 0–48 hour forecast slider.
You may use third-party APIs for routing, geocoding, and weather. You do not need to build a routing
engine.


# Risk Rules
Use these thresholds to classify weather at each checkpoint:
Condition   Low         Moderate    High        Severe      No Travel
Wind    <25 mph         25–34       35–44       45–54       ≥55 mph
Rain    <0.10 in/hr     0.10–0.25   0.25–0.50   0.50–1.00   >1.00
Snow    <0.5 in/hr      0.5–1.0     1.0–2.0     2.0–3.0     >3.0


# Load rules:
• ≥55 mph → No Travel for any load
• 45–54 mph + >30,000 lb → No Travel
• 35–44 mph + >40,000 lb → Severe

# Route Recommendation
Prefer:
1. Fewest Severe miles
2. Fewest High miles
3. Lowest average risk
4. Shortest travel times


# Tech stack suggestions

- N.B: You can use Django REST Framework for request validation and JSON responses. The service modules themselves should be ordinary Python functions and classes

- You may use third-party APIs for routing, geocoding, and weather. You do not need to build a routing
engine.

- Use Mapbox for routing and geocoding, and Open-Meteo for the weather API

## Proposed Folder Structure
```
Spotter-Truck-Routing/
├── .env                          # Environment variables (gitignored)
├── .gitignore                    # Git ignore rules
├── .venv/                        # Python virtual environment (gitignored)
├── Procfile                      # Railway deployment configuration
├── manage.py                     # Django management script
├── requirements.txt              # Python dependencies
├── runtime.txt                   # Python version specification (3.12)
│
├── truck-routing/                          # Django project configuration
│   ├── __init__.py
│   ├── asgi.py                   # ASGI configuration
│   ├── settings.py               # Django settings
│   ├── urls.py                   # Project URL routing
│   └── wsgi.py                   # WSGI configuration
│
├── truckapp/                       # Main Django application
│   ├── __init__.py
│   ├── admin.py                  # Django admin configuration
│   ├── api/                      # REST API layer
│   │   ├── __init__.py
│   │   ├── serializers.py        # DRF serializers
│   │   ├── urls.py               # API URL routing
│   │   └── views.py              # API viewsets
│   ├── apps.py                   # App configuration
│   ├── migrations/               # Database migrations
│   ├── models/                   # Data models
│   │   ├── __init__.py
│   │   └── Trip.py               # Trip model
│   ├── services/                 # Business logic
│   │   ├── ELDLogEngine.py       # HOS calculation engine
│   ├── templates/                # Django templates (minimal)
│   ├── tests.py                  # Unit tests
│   ├── urls.py                   # App URL routing
│   └── views.py                  # Django views (SPA serving)
│
├── frontend/                     # React frontend application
│   ├── .env                      # Environment variables [containing GOOGLE_MAPS_API_KEY and MAPBOX_ACCESS_TOKEN] (gitignored)
│   ├── Dockerfile                # Docker configuration
│   ├── package.json              # Node.js dependencies
│   ├── tsconfig.json             # TypeScript configuration
│   ├── vite.config.ts            # Vite build configuration
│   ├── react-router.config.ts    # React Router configuration
│   ├── app/                      # React application source
│   │   ├── app.css               # Global styles
│   │   ├── components/           # Reusable components
│   │   │  
│   │   ├── routes/               # Route components
            ├── dashboard.tsx     # Dashboard layout
│   │   │  
│   │   ├── root.tsx              # Root component with layout
│   │   ├── routes.ts             # Route configuration
│   │   ├── services/             # API service layer
│   │   │   └── api.ts            # API client
│   │   └── utils/                # Utility functions
│   │       └── utils.ts          # Helper functions
│   ├── build/                    # Production build output (gitignored)
│   ├── node_modules/             # Node dependencies (gitignored)
│   └── public/                   # Static assets
│
└── staticfiles/                  # Collected static files (generated)
```

---
