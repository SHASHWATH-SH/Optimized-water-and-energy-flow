import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, Menu, MenuItem } from '@mui/material';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';

const MODELS_URL = 'https://example.com/models'; // TODO: Replace with your actual models URL

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    onLogout();
    handleClose();
    navigate('/');
  };

  const handleHome = () => {
    navigate('/');
  };

  return (
    <AppBar position="static" sx={{ background: 'linear-gradient(90deg, #2563eb 0%, #43e97b 100%)', boxShadow: '0 4px 24px #2563eb22' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: 1, color: 'common.white', fontFamily: 'inherit' }}>
          CityResource AI
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Always show Home button */}
          <Button
            onClick={handleHome}
            sx={{ 
              color: '#fff', 
              fontWeight: 600, 
              borderRadius: 2, 
              fontSize: 16, 
              fontFamily: 'inherit',
              '&:hover': {
                background: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            🏠 Home
          </Button>

          {/* Show navigation based on user type */}
          {user && (
            <>
              {user.user_type === 'admin' && (
                <Button
                  component={NavLink}
                  to="/simulation"
                  sx={({ isActive, theme }) => ({ 
                    color: isActive ? theme.palette.secondary.main : '#fff', 
                    fontWeight: isActive ? 800 : 600, 
                    borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', 
                    borderRadius: 0, 
                    fontSize: 17, 
                    fontFamily: 'inherit' 
                  })}
                >
                  🎮 Simulation
                </Button>
              )}
              
              {(user.user_type === 'building' || user.user_type === 'ngo') && (
                <Button
                  component={NavLink}
                  to="/building-dashboard"
                  sx={({ isActive, theme }) => ({ 
                    color: isActive ? theme.palette.secondary.main : '#fff', 
                    fontWeight: isActive ? 800 : 600, 
                    borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', 
                    borderRadius: 0, 
                    fontSize: 17, 
                    fontFamily: 'inherit' 
                  })}
                >
                  📊 Dashboard
                </Button>
              )}
            </>
          )}

          <Button
            component={NavLink}
            to="/models"
            sx={({ isActive, theme }) => ({ 
              color: isActive ? theme.palette.secondary.main : '#fff', 
              fontWeight: isActive ? 800 : 600, 
              borderBottom: isActive ? `2.5px solid ${theme.palette.secondary.main}` : 'none', 
              borderRadius: 0, 
              fontSize: 17, 
              fontFamily: 'inherit' 
            })}
          >
            📈 Models
          </Button>

          {/* User authentication section */}
          {user ? (
            <>
              <Button
                onClick={handleMenu}
                sx={{ 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  px: 2,
                  '&:hover': {
                    background: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                <Avatar sx={{ width: 24, height: 24, bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <FaUser size={12} />
                </Avatar>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                  {user.username}
                </Typography>
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    borderRadius: 2
                  }
                }}
              >
                <MenuItem onClick={handleClose} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FaUser size={14} />
                  <Typography variant="body2">
                    {user.user_type === 'admin' ? '👨‍💼 Administrator' : 
                     user.user_type === 'building' ? '🏢 Building Manager' : 
                     user.user_type === 'ngo' ? '🏛️ NGO/Committee' : '👤 User'}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#d32f2f' }}>
                  <FaSignOutAlt size={14} />
                  <Typography variant="body2">Logout</Typography>
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              component={NavLink}
              to="/login"
              sx={{ 
                color: '#fff', 
                fontWeight: 600, 
                borderRadius: 2, 
                fontSize: 16, 
                fontFamily: 'inherit',
                background: 'rgba(255,255,255,0.1)',
                px: 3,
                '&:hover': {
                  background: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              🔐 Sign In
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 