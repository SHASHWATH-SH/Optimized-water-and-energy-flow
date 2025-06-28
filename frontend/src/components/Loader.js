import React, { useEffect, useState } from 'react';
import { Box, Typography, LinearProgress, Fade } from '@mui/material';
import OpacityIcon from '@mui/icons-material/Opacity';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';

const messages = [
  'Optimizing Urban Resources...',
  'Powering Smart Cities...',
  'Loading CityResource AI...'
];

const icons = [
  <OpacityIcon sx={{ fontSize: 80, color: '#3399ff', mb: 2, mr: 1 }} />, // water drop
  <AutoGraphIcon sx={{ fontSize: 80, color: '#43e97b', mb: 2, ml: 1 }} /> // AI/analytics
];

const Loader = () => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [iconIdx, setIconIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
      setIconIdx((i) => (i + 1) % icons.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000,
        background: 'linear-gradient(135deg, #3399ff 0%, #e6ffe6 100%)',
        minHeight: '100vh',
      }}
    >
      <Fade in timeout={600} key={`icon-${iconIdx}`}>
        <Box>{icons[iconIdx]}</Box>
      </Fade>
      <Fade in timeout={600} key={`msg-${msgIdx}`}>
        <Typography variant="h5" sx={{ color: '#3399ff', fontWeight: 700, mt: 2, mb: 2, letterSpacing: 1 }}>
          {messages[msgIdx]}
        </Typography>
      </Fade>
      <Box sx={{ width: 320, maxWidth: '80vw', mt: 2 }}>
        <LinearProgress sx={{ height: 8, borderRadius: 5, background: '#e3f2fd', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #3399ff 0%, #43e97b 100%)' } }} />
      </Box>
    </Box>
  );
};

export default Loader; 