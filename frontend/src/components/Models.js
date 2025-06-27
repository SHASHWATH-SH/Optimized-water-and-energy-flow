import React from 'react';
import { Box, Typography, Grid, Card, CardMedia, CardContent, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';

const images = [
  {
    src: require('../assets/analysis1.jpg'),
    caption: 'Comprehensive Energy System Analysis',
  },
  {
    src: require('../assets/analysis2.jpg'),
    caption: 'Mathematical Optimization Costs',
  },
  {
    src: require('../assets/analysis3.jpg'),
    caption: 'Demand vs Supply Analysis & Reliability',
  },
];

const takeaways = [
  'AI-driven optimization significantly reduces unmet demand and operational costs.',
  'System reliability remains above 99% even during disruptions.',
  'Feature importance analysis highlights temperature and demand variability as key predictors.',
  'Visualization enables rapid assessment of supply, storage, and cost trade-offs.'
];

const Models = () => (
  <Box
    sx={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #181c23 0%, #232733 60%, #3399ff 100%)',
      py: { xs: 4, md: 8 },
      px: { xs: 0, md: 0 },
      overflowX: 'hidden',
    }}
  >
    <Box sx={{ maxWidth: '100vw', mx: 'auto', px: { xs: 2, md: 8 } }}>
      <Typography
        variant="h2"
        fontWeight={900}
        sx={{
          color: '#fff',
          letterSpacing: 1.5,
          mb: 2,
          textShadow: '0 4px 32px #3399ff44',
        }}
      >
        System Analysis & Model Insights
      </Typography>
      <Typography
        variant="h5"
        sx={{ color: '#b0bec5', mb: 5, fontWeight: 400, maxWidth: 900 }}
      >
        Explore key results and insights from CityResource AI's optimization and prediction models. Visualizations below highlight the impact of AI-driven resource management.
      </Typography>
      <Grid container spacing={5} sx={{ mb: 6 }}>
        {images.map((img, idx) => (
          <Grid item xs={12} md={4} key={idx}>
            <Card
              sx={{
                background: 'rgba(36, 44, 60, 0.98)',
                borderRadius: 6,
                boxShadow: '0 8px 32px #3399ff33',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: '0 16px 48px #3399ff55',
                },
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
              elevation={6}
            >
              <CardMedia
                component="img"
                height="320"
                image={img.src}
                alt={img.caption}
                sx={{
                  objectFit: 'cover',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  borderBottom: '2px solid #3399ff',
                  filter: 'brightness(0.98) drop-shadow(0 2px 16px #3399ff22)',
                }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography
                  variant="h6"
                  color="#90caf9"
                  fontWeight={700}
                  align="center"
                  sx={{ letterSpacing: 0.5 }}
                >
                  {img.caption}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ maxWidth: 900, mx: 'auto', background: 'rgba(36,44,60,0.92)', borderRadius: 5, p: { xs: 2, md: 4 }, boxShadow: '0 4px 32px #3399ff22' }}>
        <Typography variant="h4" color="#90caf9" fontWeight={800} gutterBottom sx={{ mb: 2 }}>
          Key Takeaways
        </Typography>
        <List>
          {takeaways.map((point, idx) => (
            <ListItem key={idx}>
              <ListItemIcon>
                <InsightsIcon sx={{ color: '#90caf9', fontSize: 32 }} />
              </ListItemIcon>
              <ListItemText
                primary={point}
                primaryTypographyProps={{ color: '#e3f2fd', fontSize: 20, fontWeight: 500 }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  </Box>
);

export default Models; 