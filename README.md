# Optimized-water-and-energy-flow

This project demonstrates energy and water optimization in urban cities using machine learning, with a 3D simulation frontend built using React and Three.js.

## Project Structure

```
SDG-13/
  Optimized-water-and-energy-flow/
    backend/
      app.py
      requirements.txt
      models/
      data/
    frontend/
      public/
      src/
        App.js
        index.js
        components/
        assets/
      package.json
    README.md
```

## Backend (Flask + ML)

### Setup
```sh
cd Optimized-water-and-energy-flow/backend
pip install -r requirements.txt
```

### Run
```sh
python app.py
```

The backend will start on `http://localhost:5000` and expose an `/api/optimize` endpoint for water flow optimization.

## Frontend (React + Three.js)

### Setup
```sh
cd Optimized-water-and-energy-flow/frontend
npx create-react-app . # Only if not already initialized
npm install three axios
```

### Run
```sh
npm start
```

The frontend will start on `http://localhost:3000` and connect to the backend for optimization.

## Features
- 3D city simulation (buildings, garden, water source)
- Animated water flow from source to garden
- Optimization button to call backend ML API
- Displays estimated savings after optimization

## Extending
- Add more city features (roads, more gardens, etc.)
- Improve ML model in backend
- Visualize disruptions and optimizations