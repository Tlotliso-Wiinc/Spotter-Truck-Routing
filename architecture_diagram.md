# Architecture

## Overview

This document describes the architecture of the Spotter Truck Routing system, which consists of three main components: a React + TypeScript frontend, a Django backend, and external APIs.

## System Components

### 1. React + TypeScript (Browser Dashboard)

The frontend provides an interactive dashboard for route planning and visualization.

- **Mapbox Search JS**
  - Handles origin & destination input
  - Provides geocoding and search functionality

- **Mapbox GL JS**
  - Displays the interactive map
  - Renders routes and route alternatives
  - Visualizes weather risk heatmap

### 2. Django Backend (Route Planning Pipeline)

The backend processes route requests and generates optimized route plans based on weather conditions.

- **Django REST API**
  - Receives coordinates (origin and destination) from the frontend
  - Manages API endpoints and request handling

- **Route Geometry**
  - Determines the path and duration of routes
  - Integrates with Mapbox Directions API

- **Checkpoint Generator**
  - Creates points along the route
  - Calculates estimated time of arrival (ETA) for each checkpoint

- **Weather Normalizer**
  - Standardizes forecast data from external weather APIs
  - Ensures consistent data format for processing

- **Weather Risk Engine**
  - Scores each checkpoint based on weather conditions
  - Evaluates risks such as precipitation, wind, visibility, etc.

- **Recommendation Engine**
  - Analyzes route options and weather risk scores
  - Recommends the best route based on safety and efficiency

- **Route Plan JSON**
  - Sends the final route plan response to the browser
  - Includes route geometry, checkpoints, weather data, and risk scores

### 3. External APIs

The system integrates with third-party APIs to provide essential data.

- **Directions API (Mapbox)**
  - Used by Route Geometry component
  - Provides route paths, distances, and durations

- **Forecast API (Open-Meteo)**
  - Used by Weather Normalizer component
  - Provides weather forecast data for route checkpoints

## Data Flow

1. **Input**: User enters origin and destination via Mapbox Search JS in the browser
2. **Request**: Coordinates are sent to the Django REST API
3. **Route Calculation**: 
   - Route Geometry queries Mapbox Directions API for route options
   - Checkpoint Generator creates waypoints along routes with ETAs
4. **Weather Analysis**:
   - Weather Normalizer fetches forecast data from Open-Meteo API for each checkpoint
   - Weather Risk Engine scores each checkpoint based on weather conditions
5. **Recommendation**: Recommendation Engine analyzes all data and selects the optimal route
6. **Response**: Route Plan JSON is sent back to the frontend
7. **Visualization**: Mapbox GL JS displays the recommended route, checkpoints, and weather risk heatmap

## Technology Stack

- **Frontend**: React, TypeScript, Mapbox GL JS, Mapbox Search JS
- **Backend**: Django, Django REST Framework
- **External APIs**: Mapbox Directions API, Open-Meteo Forecast API
