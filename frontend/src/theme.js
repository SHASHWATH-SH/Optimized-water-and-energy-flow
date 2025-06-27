import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // modern blue
      contrastText: '#fff',
    },
    secondary: {
      main: '#43e97b', // accent green
      contrastText: '#fff',
    },
    background: {
      default: '#f5f7fa', // light gray
      paper: '#fff',
    },
    text: {
      primary: '#181c23', // deep gray
      secondary: '#64748b', // muted blue-gray
    },
  },
  typography: {
    fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    h1: { fontWeight: 900, letterSpacing: 2 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme; 