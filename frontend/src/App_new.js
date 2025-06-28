import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FaTint, FaExclamationTriangle, FaTools, FaPlay, FaSpinner, FaBug, FaWind, FaWater, FaCog, FaRedo } from 'react-icons/fa';
import * as THREE from 'three';
import Home from './components/Home';
import Models from './components/Models';
import Login from './components/Login';
import BuildingDashboard from './components/BuildingDashboard';
import AdminDashboard from './components/AdminDashboard';
import Navbar from './components/Navbar';
import Loader from './components/Loader';

function MainApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setAuthenticated(true);
    }
    
    const timer = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setAuthenticated(false);
  };

  if (loading) return <Loader />;

  // If not authenticated, show login
  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Route based on user type
  let defaultRoute = '/';
  if (user?.user_type === 'admin') {
    defaultRoute = '/admin-dashboard';
  } else if (user?.user_type === 'building' || user?.user_type === 'ngo') {
    defaultRoute = '/building-dashboard';
  }

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} />} />
        <Route path="/home" element={<Home />} />
        <Route path="/models" element={<Models />} />
        <Route path="/login" element={<Navigate to={defaultRoute} />} />
        <Route path="/building-dashboard" element={<BuildingDashboard user={user} />} />
        <Route path="/admin-dashboard" element={<AdminDashboard user={user} />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="*" element={<Navigate to={defaultRoute} />} />
      </Routes>
    </Router>
  );
}

export default MainApp; 