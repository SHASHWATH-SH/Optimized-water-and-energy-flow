import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { NavLink } from 'react-router-dom';

const MODELS_URL = 'https://example.com/models'; // TODO: Replace with your actual models URL

const Navbar = () => (
  <AppBar position="static" sx={{ background: 'linear-gradient(90deg, #2563eb 0%, #43e97b 100%)', boxShadow: '0 4px 24px #2563eb22' }}>
    <Toolbar>
      <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: 1, color: 'common.white', fontFamily: 'inherit' }}>
        CityResource AI
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          component={NavLink}
          to="/"
          exact="true"
          sx={({ isActive, theme }) => ({ color: isActive ? theme.palette.secondary.main : '#fff', fontWeight: isActive ? 800 : 600, borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', borderRadius: 0, fontSize: 17, fontFamily: 'inherit' })}
        >
          Home
        </Button>
        <Button
          component={NavLink}
          to="/simulation"
          sx={({ isActive, theme }) => ({ color: isActive ? theme.palette.secondary.main : '#fff', fontWeight: isActive ? 800 : 600, borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', borderRadius: 0, fontSize: 17, fontFamily: 'inherit' })}
        >
          Simulation
        </Button>
        <Button
          component={NavLink}
          to="/models"
          sx={({ isActive, theme }) => ({ color: isActive ? theme.palette.secondary.main : '#fff', fontWeight: isActive ? 800 : 600, borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', borderRadius: 0, fontSize: 17, fontFamily: 'inherit' })}
        >
          Models
        </Button>
      </Box>
    </Toolbar>
  </AppBar>
);

export default Navbar; 