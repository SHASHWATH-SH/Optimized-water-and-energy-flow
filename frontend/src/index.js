import React from 'react';
import ReactDOM from 'react-dom/client';
import MainApp from './App';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <MainApp />
  </ThemeProvider>
); 