# Parashakthi - Safe Route Navigation Platform

Production-grade community-powered safety navigation system. **100% free** - no paid APIs.

## Tech Stack

| Component | Technology |
|----------|------------|
| Map | Leaflet.js + OpenStreetMap |
| Routing | OSRM (free public API) |
| Geocoding | Nominatim (free) |
| Safe Zones | Overpass API (OpenStreetMap) |
| Heatmap | Leaflet.heat |
| UI | TailwindCSS |
| Database | Firebase Firestore (optional, localStorage fallback) |

## Features

- **Interactive Map** - Chennai default, smooth zoom/pan, mobile responsive
- **OSRM Routing** - Free route calculation, distance, ETA
- **AI Safety Scoring** - Incidents + time + ratings + safe zones
- **Incident Reporting** - Click map, report (harassment, poor lighting, theft, etc.)
- **Heatmap** - Crime density visualization (green → yellow → red)
- **Safe Zones** - Police, hospitals, metro, bus via Overpass API
- **Live Location Sharing** - Shareable link, real-time tracking
- **Area Ratings** - 1-5 star community ratings
- **Night Safety Mode** - Auto-highlight after 8 PM
- **Emergency SOS** - Copy location alert

## Quick Start

```bash
# Option 1: npm
npm start

# Option 2: Python
python -m http.server 3000

# Option 3: npx serve
npx serve -l 3000
```

Open http://localhost:3000

## Firebase Setup (Optional)

1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore
3. Update `firebase/firebaseConfig.js` with your credentials
4. Create Firestore index for `incidents` collection (timestamp desc) - Firebase will prompt when needed

Without Firebase, data uses localStorage.

## Project Structure

```
Parashakthi/
├── index.html
├── dashboard.html
├── css/styles.css
├── js/
│   ├── map.js          # Leaflet map
│   ├── routing.js      # OSRM + Nominatim
│   ├── heatmap.js      # Leaflet.heat
│   ├── incidents.js    # Reporting + markers
│   ├── safetyScore.js  # AI scoring algorithm
│   ├── safezones.js    # Overpass API
│   ├── shareLocation.js
│   ├── app.js          # Main controller
│   └── dashboard.js    # Analytics
└── firebase/
    ├── firebaseConfig.js
    └── firestore.js
```

## Safety Score Formula

```
safetyScore = 5 - (
  incidentWeight * incidentCount +
  nightRiskWeight * timeFactor +
  ratingWeight * areaRating -
  safezoneWeight * safezoneCount
)
```

Routes colored: **Green** (4-5) = Safe, **Yellow** (3-4) = Moderate, **Red** (<3) = Risky

## API Endpoints Used

- **OSRM**: `https://router.project-osrm.org/route/v1/driving/{lon},{lat};{lon},{lat}`
- **Nominatim**: `https://nominatim.openstreetmap.org/search`
- **Overpass**: `https://overpass-api.de/api/interpreter`

All free, no API keys required.
