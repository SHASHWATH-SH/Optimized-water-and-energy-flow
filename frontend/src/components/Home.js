import React from 'react';
import { Box, Typography, Grid, Card, CardMedia, CardContent, Paper, List, ListItem, ListItemIcon } from '@mui/material';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import PublicIcon from '@mui/icons-material/Public';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const analysisImages = [
  {
    src: require('../assets/analysis1.jpg'),
    caption: 'Energy System Optimization',
  },
  {
    src: require('../assets/analysis2.jpg'),
    caption: 'Optimization Cost Analysis',
  },
  {
    src: require('../assets/analysis3.jpg'),
    caption: 'Demand vs Supply Reliability',
  },
];

const features = [
  {
    icon: <AutoGraphIcon color="primary" sx={{ fontSize: 38 }} />,
    title: 'AI-Driven Optimization',
    desc: 'Leverages advanced machine learning to optimize urban energy and water flows in real time.',
    details: 'Our proprietary algorithms analyze vast datasets, predict demand spikes, and dynamically allocate resources to minimize waste and maximize efficiency. The system adapts to changing city conditions, ensuring optimal performance 24/7.',
    bullets: [
      'Predicts demand and supply with high accuracy',
      'Reduces operational costs and resource wastage',
      'Continuously learns and adapts to new data',
    ],
  },
  {
    icon: <InsightsIcon color="secondary" sx={{ fontSize: 38 }} />,
    title: 'Actionable Analytics',
    desc: 'Provides clear, actionable insights for city planners and utility managers.',
    details: 'Interactive dashboards and real-time alerts empower decision-makers to respond quickly to disruptions, track sustainability metrics, and plan for future growth with confidence. Visualizations make complex data easy to understand and act upon.',
    bullets: [
      'Real-time monitoring and alerts',
      'Customizable analytics dashboards',
      'Supports data-driven decision making',
    ],
  },
  {
    icon: <SecurityIcon sx={{ color: '#ffb300', fontSize: 38 }} />,
    title: 'Resilient Infrastructure',
    desc: 'Ensures reliability and resilience during disruptions, blackouts, and droughts.',
    details: 'CityResource AI automatically reroutes resources, prioritizes critical loads, and maintains service continuity even in the face of grid failures or water shortages. Built-in redundancy and smart failover keep essential services running.',
    bullets: [
      'Automatic resource rerouting during outages',
      'Prioritizes critical infrastructure and services',
      'Minimizes downtime and service interruptions',
    ],
  },
  {
    icon: <PublicIcon sx={{ color: '#7c4dff', fontSize: 38 }} />,
    title: 'Sustainable Cities',
    desc: 'Promotes sustainable growth and resource conservation for future-ready cities.',
    details: 'By monitoring groundwater, optimizing renewable integration, and minimizing environmental impact, our platform helps cities achieve their climate and sustainability goals. Designed for long-term ecological balance and urban well-being.',
    bullets: [
      'Optimizes renewable energy and water use',
      'Monitors and protects groundwater resources',
      'Supports climate action and sustainability targets',
    ],
  },
];

const Home = () => (
  <Box sx={{ width: '100vw', minHeight: '100vh', fontFamily: 'inherit', background: 'linear-gradient(120deg, #f5f7fa 0%, #e3f2fd 100%)', overflowX: 'hidden' }}>
    {/* Hero Section */}
    <Box sx={{ width: '100%', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pt: 10, pb: 6, background: 'linear-gradient(120deg, #2563eb 0%, #43e97b 100%)', boxShadow: '0 8px 32px #2563eb22' }}>
      <Typography variant="h1" fontWeight={900} sx={{ color: '#fff', letterSpacing: 2, fontSize: { xs: 38, md: 64 }, textShadow: '0 4px 32px #2563eb55', mb: 2, fontFamily: 'inherit' }}>
        CityResource AI
      </Typography>
      <Typography variant="h5" sx={{ color: '#e3f2fd', fontWeight: 400, maxWidth: 700, textAlign: 'center', mb: 3, fontFamily: 'inherit' }}>
        Smarter, sustainable urban energy & water management powered by artificial intelligence.
      </Typography>
    </Box>
    {/* Features Section - now dark and more detailed */}
    <Box sx={{ width: '100%', py: 8, background: 'linear-gradient(120deg, #232733 0%, #181c23 100%)', mb: 0 }}>
      <Typography variant="h3" fontWeight={800} sx={{ color: '#fff', mb: 5, textAlign: 'center', fontFamily: 'inherit', letterSpacing: 1 }}>
        Why CityResource AI?
      </Typography>
      <Grid container spacing={5} justifyContent="center" sx={{ px: { xs: 2, md: 8 } }}>
        {features.map((f, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Paper elevation={6} sx={{ background: 'linear-gradient(135deg, #232733 60%, #2563eb 100%)', color: '#fff', borderRadius: 5, p: 4, minHeight: 370, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 32px #2563eb33', height: '100%' }}>
              {f.icon}
              <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', mt: 2, mb: 1, fontFamily: 'inherit', letterSpacing: 0.5, textAlign: 'center' }}>{f.title}</Typography>
              <Typography variant="subtitle2" sx={{ color: '#b0bec5', mb: 1, fontFamily: 'inherit', textAlign: 'center' }}>{f.desc}</Typography>
              <Typography variant="body2" sx={{ color: '#e3f2fd', fontFamily: 'inherit', textAlign: 'center', fontSize: 16, mt: 1, mb: 1 }}>{f.details}</Typography>
              <List dense sx={{ color: '#fff', fontFamily: 'inherit', pl: 2, pt: 0, pb: 0 }}>
                {f.bullets.map((b, i) => (
                  <ListItem key={i} sx={{ py: 0.2 }}>
                    <ListItemIcon sx={{ minWidth: 28, color: '#43e97b' }}><CheckCircleIcon fontSize="small" /></ListItemIcon>
                    <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'inherit' }}>{b}</Typography>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
    {/* Analysis Images Section */}
    <Box sx={{ width: '100%', py: 8, background: 'linear-gradient(120deg, #f5f7fa 0%, #e3f2fd 100%)' }}>
      <Typography variant="h3" fontWeight={800} sx={{ color: 'primary.main', mb: 5, textAlign: 'center', fontFamily: 'inherit', letterSpacing: 1 }}>
        System Insights & Results
      </Typography>
      <Grid container spacing={5} justifyContent="center" sx={{ px: { xs: 2, md: 8 } }}>
        {analysisImages.map((img, idx) => (
          <Grid item xs={12} md={4} key={idx}>
            <Card sx={{ borderRadius: 6, boxShadow: '0 8px 32px #2563eb22', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'scale(1.03)', boxShadow: '0 16px 48px #2563eb55' }, height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
              <CardMedia
                component="img"
                height="260"
                image={img.src}
                alt={img.caption}
                sx={{ objectFit: 'cover', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottom: '2px solid #2563eb', filter: 'brightness(0.98) drop-shadow(0 2px 16px #2563eb22)' }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" color="primary" fontWeight={700} align="center" sx={{ letterSpacing: 0.5, fontFamily: 'inherit' }}>
                  {img.caption}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
    {/* Call to Action or Footer */}
    <Box sx={{ width: '100%', py: 6, background: 'linear-gradient(90deg, #2563eb 0%, #43e97b 100%)', textAlign: 'center' }}>
      <Typography variant="h4" fontWeight={800} sx={{ color: '#fff', mb: 2, fontFamily: 'inherit', letterSpacing: 1 }}>
        Ready to build smarter, more resilient cities?
      </Typography>
      <Typography variant="h6" sx={{ color: '#e3f2fd', fontWeight: 400, fontFamily: 'inherit' }}>
        Explore our simulation and models to see CityResource AI in action.
      </Typography>
    </Box>
  </Box>
);

export default Home; 