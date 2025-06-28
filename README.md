# Smart City Water & Energy Flow Simulation

A comprehensive 3D simulation of water and energy distribution in a smart city environment, featuring real-time visualization, AI-powered analytics, user authentication, building management, and detailed building-by-building water distribution analysis.

## 🌟 Key Features

### 🔐 User Authentication & Management
- **Multi-User System**: Admin, Building Manager, and NGO/Committee user types
- **Secure Authentication**: JWT-based authentication with password hashing
- **Role-Based Access**: Different dashboards and permissions for each user type
- **User Registration**: Self-service signup for building managers and organizations

### 🏢 Building Management System
- **50 Default Buildings**: Pre-configured buildings with default water requirements
- **Individual Building Configuration**: Each building can set water requirements and source preferences
- **Flexible Source Allocation**: Buildings can use River only, Groundwater only, or both sources in any ratio
- **Priority System**: Buildings have priority levels (1-3) for water allocation
- **Real-Time Updates**: Buildings can update requirements during active simulations

### 📋 Water Request Management
- **Special Event Requests**: Buildings can request additional water for events
- **AI-Powered Recommendations**: Automatic analysis and recommendations for each request
- **Admin Approval System**: Admins can approve/reject requests with notes
- **Request Tracking**: Complete history of all water requests with status tracking

### 🎮 Interactive 3D Simulation
- **Realistic Environment**: Nature-inspired 3D cityscape with buildings, water sources, and infrastructure
- **Dynamic Water Flow**: Visual representation of water distribution from Kaveri River and groundwater sources
- **Smart Building Labels**: Real-time water amount and source information displayed above each building
- **Interactive Controls**: Adjust water amounts from each source and trigger system disruptions

### 📊 Advanced Analytics & Reporting
- **Dynamic Delivery Simulation**: Realistic delivery timing based on water amount (up to 10 seconds)
- **Comprehensive Analysis**: Detailed breakdown of water distribution, efficiency metrics, and performance indicators
- **Building Distribution Details**: Expandable dropdown showing individual building data including:
  - Water source allocation (River/Ground/Dual supply)
  - Apartment-level water distribution
  - Source ratios and efficiency metrics
  - Building type classification
- **Historical Comparison**: 5-day average comparison with performance ratings
- **Wastage Analysis**: Real-time tracking of water loss due to system disruptions

### 🤖 AI-Powered Recommendations
- **Professional Analysis**: Senior consultant-level recommendations with detailed technical solutions
- **Comprehensive Coverage**: 5 detailed recommendations covering:
  - Infrastructure optimization with specific technologies
  - Smart technology integration with ROI analysis
  - Source diversification strategies with risk mitigation
  - Predictive maintenance systems with technology stack
  - Sustainability programs with community engagement
- **Quantified Impact**: Specific metrics and timelines for each recommendation
- **Gemini API Integration**: Real AI suggestions with fallback to simulated recommendations

### 🎨 Modern UI/UX
- **Professional Design**: Clean, modern interface with intuitive navigation
- **Responsive Layout**: Optimized for different screen sizes
- **Loading States**: Smooth transitions and progress indicators
- **Error Handling**: Graceful fallbacks for WebGL and API issues
- **Accessibility**: Clear visual hierarchy and readable typography

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Python (v3.7 or higher)
- Modern web browser with WebGL support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Optimized-water-and-energy-flow
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd ../backend
pip install -r requirements.txt
```

4. **Set up Gemini API (Optional but Recommended)**
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Add it to the backend environment or update the API key in `app.py`
   - The system will work with simulated suggestions if no API key is provided

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
python app.py
```
   The Flask server will start on `http://localhost:5000` and automatically create the SQLite database with 50 default buildings.

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
npm start
```
   The React app will open on `http://localhost:3000`

## 🎯 How to Use

### User Authentication
1. **First Time Setup**: The system creates an admin user automatically:
   - Username: `admin`
   - Password: `admin123`
2. **Building Managers**: Sign up as "Building Manager" to manage individual buildings
3. **NGOs/Committees**: Sign up as "NGO/Committee" to request water for events

### Admin Workflow
1. **Login as Admin**: Use admin credentials to access the admin dashboard
2. **Start Simulation**: Click "Start Simulation" to allow buildings to update their requirements
3. **Review Requests**: Approve or reject water requests from buildings and organizations
4. **Run Simulation**: Set water amounts and run the complete simulation
5. **View Results**: Analyze delivery results and AI recommendations
6. **Reset if Needed**: Reset simulation to allow new updates

### Building Manager Workflow
1. **Login/Signup**: Create account as building manager
2. **View Buildings**: See all buildings and their current water requirements
3. **Update Requirements**: Modify water requirements during active simulation
4. **Submit Requests**: Request additional water for special events
5. **Track Requests**: Monitor request status and admin responses

### Simulation Controls
1. **Set Water Amounts**: Use the input fields to specify water from River and Groundwater sources
2. **Start Simulation**: Click "Start Simulation" to begin the 3D water flow visualization
3. **Trigger Disruptions**: Use the disruption buttons to simulate real-world problems:
   - Pipe Leak: Reduces river water delivery
   - Well Dry: Reduces groundwater delivery
   - River Pollution: Affects water quality and delivery
   - Pump Failure: Reduces overall system efficiency

### Delivery Analysis
1. **Run Delivery Simulation**: Click "Start Delivery" to simulate the complete water delivery process
2. **View Results**: Comprehensive popup showing:
   - Water distribution analysis
   - Building-by-building breakdown
   - Efficiency metrics
   - Historical comparison
   - AI recommendations

### Building Distribution Details
- **Expandable View**: Click "View Individual Building Details" to see:
  - Individual building water allocation
  - Source ratios (River/Ground/Dual supply)
  - Apartment counts and average water per apartment
  - Building type classification
  - Real-time efficiency metrics

## 🔧 Technical Features

### Frontend Technologies
- **React**: Modern UI framework with hooks and functional components
- **Three.js**: 3D graphics and WebGL rendering
- **React Router**: Client-side routing with authentication
- **CSS Grid/Flexbox**: Responsive layout design
- **Fetch API**: Backend communication with JWT authentication

### Backend Technologies
- **Flask**: Python web framework with RESTful API
- **SQLite**: Lightweight database for user and building data
- **JWT**: JSON Web Tokens for secure authentication
- **Google Gemini API**: AI-powered recommendations
- **SQLAlchemy**: Database ORM for data management

### Database Schema
- **Users**: Authentication and user management
- **Buildings**: Building configuration and water requirements
- **Water Requests**: Special event requests and approvals
- **Daily Distribution**: Simulation results and historical data
- **Building Allocation**: Daily water allocation per building

### 3D Visualization
- **Realistic Buildings**: Detailed 3D models with proper lighting and materials
- **Water Sources**: Kaveri River and groundwater wells with visual effects
- **Pipe Network**: Dynamic pipe connections showing water flow paths
- **Interactive Labels**: Real-time data display above buildings

## 📈 Analytics & Insights

### Performance Metrics
- **Delivery Efficiency**: Percentage of water successfully delivered
- **Wastage Rate**: Water lost due to system disruptions
- **Source Balance**: Distribution between river and groundwater sources
- **Building Coverage**: Number of buildings served by each source

### AI Recommendations
The system provides 5 comprehensive recommendations:
1. **Infrastructure Optimization**: Technical solutions for efficiency improvements
2. **Smart Technology Integration**: AI and IoT implementation strategies
3. **Source Diversification**: Resilience and balance improvements
4. **Predictive Maintenance**: Proactive system maintenance approaches
5. **Sustainability & Conservation**: Environmental and community initiatives

## 🛠️ Customization

### Adding New Buildings
- Modify the building creation logic in `init_db()` function
- Update the building management UI components
- Add new building types and characteristics

### Customizing Water Sources
- Add new water sources (lakes, reservoirs, etc.)
- Modify source characteristics and capacities
- Implement new distribution algorithms

### Enhancing AI Suggestions
- Update the Gemini API prompt for different focus areas
- Add new recommendation categories
- Customize the analysis parameters

### User Management
- Add new user types and roles
- Implement additional authentication methods
- Customize user permissions and access levels

## 🐛 Troubleshooting

### WebGL Issues
- The application includes fallback options for devices without WebGL support
- Check browser compatibility and update graphics drivers
- Use the 2D fallback mode if 3D rendering fails

### API Issues
- If Gemini API is unavailable, the system uses simulated suggestions
- Check API key configuration and network connectivity
- Review the backend logs for detailed error information

### Database Issues
- The SQLite database is created automatically on first run
- Check file permissions for database creation
- Backup the database file for data preservation

### Performance Issues
- Reduce the number of buildings for better performance
- Adjust the 3D scene complexity
- Use the simplified view mode for older devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Three.js community for 3D graphics support
- Google Gemini API for AI-powered insights
- React and Flask communities for excellent documentation
- SQLite for lightweight database solution