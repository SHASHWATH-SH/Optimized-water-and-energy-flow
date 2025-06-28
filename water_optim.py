import streamlit as st
import pandas as pd
import numpy as np
from scipy.optimize import minimize, differential_evolution
from sklearn.preprocessing import StandardScaler
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import io

# Set page config
st.set_page_config(
    page_title="Advanced Groundwater Optimization",
    page_icon="💧",
    layout="wide"
)

st.title("💧 Advanced Groundwater Extraction Optimization System")
st.markdown("Multi-objective optimization with pumping costs and dynamic sectoral allocation")

# Sidebar for configuration
st.sidebar.header("Configuration")

# File upload
uploaded_file = st.sidebar.file_uploader("Upload CSV file", type=['csv'])

# Optimization parameters
st.sidebar.subheader("Optimization Parameters")
sustainability_weight = st.sidebar.slider("Sustainability Weight", 0.1, 2.0, 1.0, 0.1)
pumping_cost_base = st.sidebar.slider("Base Pumping Cost ($/m³)", 0.1, 2.0, 0.5, 0.1)
depth_cost_factor = st.sidebar.slider("Depth Cost Multiplier", 0.01, 0.1, 0.05, 0.01)
emergency_threshold = st.sidebar.slider("Emergency Extraction Multiplier", 1.0, 2.5, 1.5, 0.1)
safety_buffer = st.sidebar.slider("Safety Buffer (m)", 0.1, 2.0, 0.5, 0.1)

# Multi-objective settings
st.sidebar.subheader("Multi-Objective Settings")
use_pareto = st.sidebar.checkbox("Enable Pareto Front Analysis", False)
pareto_generations = st.sidebar.slider("Pareto Generations", 10, 100, 50, 10) if use_pareto else 50

# Sector priorities
st.sidebar.subheader("Sector Priorities")
st.sidebar.info("1 = Highest priority, 3 = Lowest priority")
municipal_priority = 1
industrial_priority = 2
agricultural_priority = 3

def load_sample_data():
    """Generate enhanced sample data with economic parameters"""
    np.random.seed(42)
    dates = pd.date_range('2024-01-01', periods=365, freq='D')
    locations = ['Location_A', 'Location_B', 'Location_C']
    sectors = ['Municipal', 'Industrial', 'Agricultural']
    priorities = [1, 2, 3]  # 1 = High, 2 = Medium, 3 = Low
    # Sector priorities
    sector_priorities = {
        'Municipal': 1,
        'Industrial': 2,
        'Agricultural': 3
    }
    
    data = []
    for i, date in enumerate(dates):
        for location in locations:
            for sector in sectors:
                # Simulate seasonal patterns
                seasonal_factor = 1 + 0.3 * np.sin(2 * np.pi * i / 365)
                drought_factor = 1.5 if np.random.random() < 0.1 else 1.0
                
                row = {
                    'date': date,
                    'location_id': location,
                    'priority': sector_priorities[sector],
                    'sector': sector,
                    'demand_m3': max(100, np.random.normal(800, 150) * seasonal_factor),
                    'available_surface_water_m3': max(0, np.random.normal(600, 200) / drought_factor),
                    'groundwater_level_m': np.random.normal(15, 2),
                    'safe_groundwater_threshold_m': 10,
                    'critical_groundwater_threshold_m': 5,
                    'recharge_rate_m3_per_day': np.random.normal(50, 10),
                    'groundwater_extraction_limit_m3': 500,
                    'unmet_demand_penalty_cost_per_m3': 10 + np.random.normal(0, 2),
                    'long_term_depletion_cost_per_m3': 5 + np.random.normal(0, 1),
                    'surface_level_m': 0,  # Ground surface level
                    'is_drought': drought_factor > 1.0
                }
                data.append(row)
    
    return pd.DataFrame(data)

class AdvancedGroundwaterOptimizer:
    def __init__(self, data, config):
        self.data = data.copy()
        self.config = config
        self.results = []
        self.pareto_solutions = []
    
    def calculate_pumping_energy(self, extraction, current_level, surface_level):
        """Calculate energy required for pumping based on depth"""
        if extraction <= 0:
            return 0
            
        # Energy is proportional to depth and volume
        depth = max(0.1, surface_level - current_level)  # Minimum depth to avoid division by zero
        energy_required = depth * extraction  # kWh/m³ * m³
        return energy_required
    
    def optimize_sectoral_allocation(self, total_demand, total_supply, sectors_data):
        """Dynamically allocate water between sectors based on priority"""
        if total_supply >= total_demand:
            # Sufficient supply - meet all demands
            return {row['sector']: row['demand_m3'] for _, row in sectors_data.iterrows()}
        
        # Insufficient supply - optimize allocation
        def allocation_objective(allocation):
            total_unmet = 0
            
            for i, (_, row) in enumerate(sectors_data.iterrows()):
                allocated = max(0, allocation[i])
                demand = row['demand_m3']
                priority = row['priority']
                
                # Penalty for unmet demand
                unmet = max(0, demand - allocated)
                priority_multiplier = 3 if priority == 1 else 1
                total_unmet += unmet * priority_multiplier
            
            return total_unmet
        
        # Constraints
        constraints = [
            # Total allocation cannot exceed supply
            {'type': 'ineq', 'fun': lambda x: total_supply - sum(x)},
            # Each allocation must be non-negative
            *[{'type': 'ineq', 'fun': lambda x, i=i: x[i]} for i in range(len(sectors_data))]
        ]
        
        # Bounds (0 to demand for each sector)
        bounds = [(0, row['demand_m3']) for _, row in sectors_data.iterrows()]
        
        # Initial guess - proportional allocation
        initial_guess = [min(row['demand_m3'], total_supply * row['demand_m3'] / total_demand) 
                        for _, row in sectors_data.iterrows()]
        
        try:
            result = minimize(allocation_objective, initial_guess, method='SLSQP',
                            bounds=bounds, constraints=constraints)
            allocations = result.x
        except:
            # Fallback: priority-based allocation
            allocations = []
            remaining_supply = total_supply
            
            # Sort by priority (Municipal first)
            sorted_sectors = sectors_data.sort_values('priority')
            
            for _, row in sorted_sectors.iterrows():
                allocation = min(row['demand_m3'], remaining_supply)
                allocations.append(allocation)
                remaining_supply -= allocation
        
        return {row['sector']: allocations[i] for i, (_, row) in enumerate(sectors_data.iterrows())}
    
    def multi_objective_function(self, extraction, row_group, objectives=['sustainability', 'supply']):
        """Multi-objective function for optimization"""
        total_extraction = max(0, extraction)
        
        # Group data by location and date
        first_row = row_group.iloc[0]
        current_level = first_row['groundwater_level_m']
        surface_level = first_row['surface_level_m']
        safe_threshold = first_row['safe_groundwater_threshold_m']
        total_demand = row_group['demand_m3'].sum()
        total_surface_water = first_row['available_surface_water_m3']
        
        # Calculate total supply
        total_supply = total_surface_water + total_extraction
        
        # Allocate water between sectors based on priority
        sector_allocations = self.optimize_sectoral_allocation(total_demand, total_supply, row_group)
        
        # Calculate objectives
        objectives_values = {}
        
        # 1. Supply objective (maximize supply ratio)
        total_allocated = sum(sector_allocations.values())
        supply_ratio = total_allocated / total_demand if total_demand > 0 else 1.0
        objectives_values['supply'] = -supply_ratio  # Negative because we minimize
        
        # 2. Sustainability objective (minimize groundwater depletion)
        level_after_extraction = current_level - (total_extraction / 1000)  # Rough approximation
        
        # Penalty for going below safe threshold
        sustainability_penalty = max(0, safe_threshold - level_after_extraction) ** 2 * 100
        
        # Consider recharge rate
        depletion_ratio = total_extraction / max(first_row['recharge_rate_m3_per_day'], 1)
        
        objectives_values['sustainability'] = sustainability_penalty + depletion_ratio
        
        return objectives_values
    
    def optimize_single_scenario(self, row_group):
        """Optimize extraction for a single scenario (location-date group)"""
        first_row = row_group.iloc[0]
        
        # Extract key parameters
        total_demand = row_group['demand_m3'].sum()
        surface_water = first_row['available_surface_water_m3']
        current_level = first_row['groundwater_level_m']
        safe_threshold = first_row['safe_groundwater_threshold_m']
        extraction_limit = first_row['groundwater_extraction_limit_m3']
        is_drought = first_row['is_drought']
        
        # Adjust extraction limit for emergencies
        effective_limit = extraction_limit
        if is_drought or any(row_group['priority'] == 1):
            effective_limit *= self.config['emergency_threshold']
        
        # Net demand after surface water
        net_demand = max(0, total_demand - surface_water)
        
        # Define combined objective function
        def combined_objective(extraction):
            extraction = max(0, extraction[0])
            
            objectives = self.multi_objective_function(extraction, row_group)
            
            # Weighted combination
            combined_cost = (objectives['cost'] * 1.0 + 
                           objectives['sustainability'] * self.config['sustainability_weight'])
            
            # Emergency penalty if extraction exceeds safe limits
            level_factor = max(0, (current_level - safe_threshold - self.config['safety_buffer']) / 
                             max(safe_threshold - first_row['critical_groundwater_threshold_m'], 1))
            safe_extraction = effective_limit * level_factor
            
            if extraction > safe_extraction and not (is_drought and any(row_group['priority'] == 1)):
                combined_cost += (extraction - safe_extraction) * 1000  # Heavy penalty
            
            return combined_cost
        
        # Constraints
        constraints = [
            {'type': 'ineq', 'fun': lambda x: effective_limit - x[0]},
            {'type': 'ineq', 'fun': lambda x: x[0]},
        ]
        
        # Optimize
        bounds = [(0, effective_limit)]
        initial_guess = [min(net_demand, effective_limit * 0.8)]
        
        try:
            result = minimize(combined_objective, initial_guess, method='SLSQP',
                            bounds=bounds, constraints=constraints)
            optimal_extraction = max(0, result.x[0])
        except:
            optimal_extraction = min(net_demand, effective_limit * 0.5)
        
        # Calculate final allocations and metrics
        total_supply = surface_water + optimal_extraction
        sector_allocations = self.optimize_sectoral_allocation(total_demand, total_supply, row_group)

        # Calculate metrics for each sector
        results = []
        for _, row in row_group.iterrows():
            sector = row['sector']
            allocated = sector_allocations.get(sector, 0)
            demand = row['demand_m3']

            # Calculate water sources
            surface_water_used = min(allocated, surface_water * allocated / total_supply) if total_supply > 0 else 0
            groundwater_share = allocated - surface_water_used

            # Calculate energy requirements
            energy_required = self.calculate_pumping_energy(
                groundwater_share,
                current_level,
                row['surface_level_m']
            )

            result = {
                'optimal_extraction_m3': groundwater_share,
                'surface_water_used_m3': surface_water_used,
                'total_allocated_m3': allocated,
                'unmet_demand_m3': max(0, demand - allocated),
                'supply_ratio': allocated / demand if demand > 0 else 1.0,
                'energy_required_kwh': energy_required,
                'projected_groundwater_level_m': current_level - (optimal_extraction / 1000),
                'is_safe': (current_level - (optimal_extraction / 1000)) >= safe_threshold,
                'sector_priority_met': allocated >= (demand * 0.8) if row['priority'] == 1 else True,
                'priority': row['priority']
            }

            # Add original row data
            result.update(row.to_dict())
            results.append(result)

        return results

    def collect_pareto_solutions(self, row_group):
        """Collect Pareto-optimal solutions for a scenario"""
        if not use_pareto:
            return []
            
        # Generate multiple solutions with different weights
        solutions = []
        for w in np.linspace(0, 1, 10):  # Vary weight from 0 to 1
            self.config['sustainability_weight'] = w
            result = self.optimize_single_scenario(row_group)
            if result:
                solutions.append({
                    'sustainability_weight': w,
                    'results': result,
                    'supply_ratio': np.mean([r['supply_ratio'] for r in result]),
                    'sustainability': 1.0 - np.mean([r['projected_groundwater_level_m'] / r['safe_groundwater_threshold_m'] for r in result])
                })
        return solutions

    def run_optimization(self):
        """Run optimization for all scenarios"""
        self.results = []
        self.pareto_solutions = []

        # Group by location and date for joint optimization
        grouped = self.data.groupby(['location_id', 'date'])
        total_groups = len(grouped)

        progress_bar = st.progress(0)

        for i, (group_key, group_data) in enumerate(grouped):
            if use_pareto:
                pareto_sols = self.collect_pareto_solutions(group_data)
                if pareto_sols:
                    # Select the solution with median weight for demonstration
                    median_idx = len(pareto_sols) // 2
                    group_results = pareto_sols[median_idx]['results']
                    self.pareto_solutions.extend(pareto_sols)
                else:
                    group_results = self.optimize_single_scenario(group_data)
            else:
                group_results = self.optimize_single_scenario(group_data)
                
            self.results.extend(group_results)
            progress_bar.progress((i + 1) / total_groups)

        return pd.DataFrame(self.results)

def create_advanced_visualizations(results_df, optimizer=None):
    """Create comprehensive visualizations for advanced optimization"""
    
    # Create tabs for different visualizations
    tab1, tab2 = st.tabs(["Performance Dashboard", "Pareto Analysis"]) if use_pareto else [None, None]
    
    # 1. Multi-objective performance dashboard
    with tab1 if tab1 else st.container():
        fig1 = make_subplots(
            rows=3, cols=2,
            subplot_titles=('Groundwater Levels & Safety', 'Supply Ratio by Priority',
                           'Energy Requirements vs Depth', 'Sectoral Allocation Efficiency',
                           'Supply Ratio by Priority', 'Sustainability Metrics'),
            specs=[[{"secondary_y": True}, {"type": "bar"}],
                   [{"type": "scatter"}, {"type": "bar"}],
                   [{"type": "bar"}, {"secondary_y": True}]]
        )

    # Groundwater levels with safety indicators
    fig1.add_trace(
        go.Scatter(x=results_df['date'], y=results_df['projected_groundwater_level_m'],
                  name='Projected Level', line=dict(color='blue')),
        row=1, col=1
    )
    fig1.add_trace(
        go.Scatter(x=results_df['date'], y=results_df['safe_groundwater_threshold_m'],
                  name='Safe Threshold', line=dict(color='orange', dash='dash')),
        row=1, col=1
    )

    # Supply ratio by priority
    priority_performance = results_df.groupby('priority')['supply_ratio'].mean().reset_index()
    priority_labels = {1: 'High', 2: 'Medium', 3: 'Low'}
    priority_performance['priority_label'] = priority_performance['priority'].map(priority_labels)

    fig1.add_trace(
        go.Bar(x=priority_performance['priority_label'], y=priority_performance['supply_ratio'] * 100,
               name='Supply Ratio %', marker_color='green'),
        row=1, col=2
    )

    # Energy requirements vs depth
    results_df['depth'] = results_df['surface_level_m'] - results_df['projected_groundwater_level_m']
    fig1.add_trace(
        go.Scatter(x=results_df['depth'], y=results_df['energy_required_kwh'],
                  mode='markers', name='Energy Requirements vs Depth',
                  marker=dict(color='red', size=4)),
        row=2, col=1
    )

    # Sectoral allocation efficiency
    sector_summary = results_df.groupby('sector').agg({
        'demand_m3': 'sum',
        'total_allocated_m3': 'sum'
    }).reset_index()

    fig1.add_trace(
        go.Bar(x=sector_summary['sector'], y=sector_summary['total_allocated_m3'] / sector_summary['demand_m3'],
               name='Allocation Efficiency', marker_color='purple'),
        row=2, col=2
    )

    # Supply ratio by priority
    fig1.add_trace(
        go.Bar(x=priority_performance['priority_label'], y=priority_performance['supply_ratio'] * 100,
               name='Supply Ratio %', marker_color='orange'),
        row=3, col=1
    )

    # Sustainability metrics
    sustainability_data = results_df.groupby('date').agg({
        'optimal_extraction_m3': 'sum',
        'projected_groundwater_level_m': 'mean',
        'is_safe': 'mean'
    }).reset_index()

    fig1.add_trace(
        go.Scatter(x=sustainability_data['date'], y=sustainability_data['optimal_extraction_m3'],
                  name='Daily Extraction', line=dict(color='brown')),
        row=3, col=2
    )
    fig1.add_trace(
        go.Scatter(x=sustainability_data['date'], y=sustainability_data['is_safe'] * 100,
                  name='Safety %', line=dict(color='green'), yaxis='y2'),
        row=3, col=2, secondary_y=True
    )

    fig1.update_layout(height=1000, title_text="Advanced Optimization Performance Dashboard")
    st.plotly_chart(fig1, use_container_width=True)

    # 2. Sectoral Performance Dashboard
    # 2. Sectoral Performance Dashboard
    with tab1 if tab1 else st.container():
        fig2 = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Sectoral Water Demand vs Allocation', 'Supply Ratio by Priority',
                           'Groundwater Level Trend', 'Allocation by Sector'),
            specs=[[{"type": "bar"}, {"type": "bar"}],
                  [{"type": "scatter"}, {"type": "pie"}]]
        )

    # Sectoral demand vs allocation
    sector_summary = results_df.groupby('sector').agg({
        'demand_m3': 'sum',
        'total_allocated_m3': 'sum'
    }).reset_index()

    fig2.add_trace(
        go.Bar(x=sector_summary['sector'], y=sector_summary['demand_m3'],
               name='Demand', marker_color='lightblue'),
        row=1, col=1
    )
    fig2.add_trace(
        go.Bar(x=sector_summary['sector'], y=sector_summary['total_allocated_m3'],
               name='Allocated', marker_color='darkblue'),
        row=1, col=1
    )

    # Supply ratio by priority
    priority_compliance = results_df.groupby('priority')['supply_ratio'].mean().reset_index()
    priority_compliance['priority_label'] = priority_compliance['priority'].map(priority_labels)

    fig2.add_trace(
        go.Bar(x=priority_compliance['priority_label'], y=priority_compliance['supply_ratio'] * 100,
               name='Supply Ratio %', marker_color='green'),
        row=1, col=2
    )

    # Groundwater level trend
    gw_levels = results_df.groupby('date')['projected_groundwater_level_m'].mean().reset_index()
    fig2.add_trace(
        go.Scatter(x=gw_levels['date'], y=gw_levels['projected_groundwater_level_m'],
                  name='Groundwater Level', line=dict(color='blue')),
        row=2, col=1
    )

    # Allocation pie chart
    allocation_pie = results_df.groupby('sector')['total_allocated_m3'].sum().reset_index()
    fig2.add_trace(
        go.Pie(labels=allocation_pie['sector'], values=allocation_pie['total_allocated_m3'],
               name="Allocation by Sector"),
        row=2, col=2
    )

    fig2.update_layout(height=800, title_text="Sectoral Performance Dashboard")
    st.plotly_chart(fig2, use_container_width=True)
    
    # 3. Pareto Front Analysis (if enabled)
    if use_pareto and optimizer and hasattr(optimizer, 'pareto_solutions') and optimizer.pareto_solutions:
        with tab2:
            st.subheader("Pareto Front Analysis")
            
            # Prepare data for Pareto front
            pareto_data = []
            for sol in optimizer.pareto_solutions:
                for r in sol['results']:
                    pareto_data.append({
                        'sustainability_weight': sol['sustainability_weight'],
                        'supply_ratio': r['supply_ratio'],
                        'sustainability': 1.0 - (r['projected_groundwater_level_m'] / r['safe_groundwater_threshold_m'])
                    })
            
            if pareto_data:
                df_pareto = pd.DataFrame(pareto_data)
                
                # Create Pareto front plot
                fig_pareto = px.scatter(
                    df_pareto,
                    x='supply_ratio',
                    y='sustainability',
                    color='sustainability_weight',
                    title='Pareto Front: Supply Ratio vs Sustainability',
                    labels={
                        'supply_ratio': 'Supply Ratio',
                        'sustainability': 'Sustainability (1 - Normalized Groundwater Level)',
                        'sustainability_weight': 'Sustainability Weight'
                    },
                    hover_data=['sustainability_weight']
                )
                fig_pareto.update_traces(
                    marker=dict(size=10, line=dict(width=1, color='DarkSlateGrey')),
                    selector=dict(mode='markers')
                )
                st.plotly_chart(fig_pareto, use_container_width=True)
                
                # Add explanation
                st.markdown("""
                **Understanding the Pareto Front:**
                - Each point represents a solution with different trade-offs between supply ratio and sustainability
                - Points on the top-right are optimal (high supply ratio and high sustainability)
                - The color indicates the weight given to sustainability in the optimization
                - The optimal solution depends on your priorities between water supply and groundwater sustainability
                """)

def main():
    # Load data
    if uploaded_file is not None:
        df = pd.read_csv(uploaded_file)
        # Add priority if not present
        if 'priority' not in df.columns:
            sector_priorities = {
                'Municipal': 1,
                'Industrial': 2,
                'Agricultural': 3
            }
            df['priority'] = df['sector'].map(sector_priorities)
        if 'surface_level_m' not in df.columns:
            df['surface_level_m'] = 0
        st.success(f"Loaded {len(df)} records from uploaded file")
    else:
        st.info("Using sample data for demonstration. Upload your CSV file to analyze real data.")
        df = load_sample_data()

        # Convert date column to datetime and ensure timezone-naive
        df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)  # Remove timezone info
        df['date'] = df['date'].dt.normalize()  # Normalize to remove time component
        
        # Ensure date column is in datetime format
        df['date'] = pd.to_datetime(df['date'])

    # Configuration
    config = {
        'sustainability_weight': sustainability_weight,
        'emergency_threshold': emergency_threshold,
        'safety_buffer': safety_buffer
    }

    # Display data preview
    st.subheader("Data Preview")
    st.dataframe(df.head(), use_container_width=True)

    # Enhanced data summary
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("Total Records", len(df))
    with col2:
        st.metric("Locations", df['location_id'].nunique())
    with col3:
        st.metric("Sectors", df['sector'].nunique())
    with col4:
        st.metric("Drought Scenarios", df['is_drought'].sum())
    with col5:
        st.metric("Average Groundwater Level", f"{df['groundwater_level_m'].mean():.2f} m")

    # Run optimization
    if st.button("Run Optimization", type="primary"):
        st.subheader("Optimization Results")

        optimizer = AdvancedGroundwaterOptimizer(df, config)
        results_df = optimizer.run_optimization()

        st.success("Optimization completed successfully!")

        # Enhanced results summary
        st.subheader("Performance Summary")
        
        col1, col2, col3, col4, col5, col6 = st.columns(6)

        with col1:
            avg_supply_ratio = results_df['supply_ratio'].mean()
            st.metric("Average Supply Ratio", f"{avg_supply_ratio:.2%}")
        
        with col2:
            safety_compliance = results_df['is_safe'].mean()
            st.metric("Safety Compliance", f"{safety_compliance:.1%}")

        with col3:
            total_allocated = results_df['total_allocated_m3'].sum()
            st.metric("Total Allocated", f"{total_allocated:,.0f} m³")

        with col4:
            total_demand = results_df['demand_m3'].sum()
            allocation_ratio = total_allocated / total_demand if total_demand > 0 else 0
            st.metric("Allocation Ratio", f"{allocation_ratio:.1%}")

        with col5:
            priority_compliance = results_df[results_df['priority'] == 1]['sector_priority_met'].mean()
            st.metric("High Priority Compliance", f"{priority_compliance:.1%}")

        with col6:
            safety_compliance = results_df['is_safe'].mean()
            st.metric("Safety Compliance", f"{safety_compliance:.1%}")

        # Create advanced visualizations
        st.subheader("Performance Visualizations")
        create_advanced_visualizations(results_df, optimizer)

        # Sectoral performance analysis
        st.subheader("Sectoral Performance Analysis")
        sector_analysis = results_df.groupby('sector').agg({
            'demand_m3': 'sum',
            'total_allocated_m3': 'sum',
            'unmet_demand_m3': 'sum',
            'supply_ratio': 'mean',
            'is_safe': 'mean'
        }).reset_index()

        sector_analysis['allocation_rate'] = sector_analysis['total_allocated_m3'] / sector_analysis['demand_m3']

        # Format for display
        display_columns = {
            'sector': 'Sector',
            'demand_m3': 'Total Demand (m³)',
            'total_allocated_m3': 'Total Allocated (m³)',
            'unmet_demand_m3': 'Unmet Demand (m³)',
            'allocation_rate': 'Allocation Rate',
            'supply_ratio': 'Average Supply Ratio',
            'is_safe': 'Safety Compliance'
        }

        display_df = sector_analysis.rename(columns=display_columns)
        display_columns_order = list(display_columns.values())

        st.dataframe(
            display_df[display_columns_order].round(2),
            use_container_width=True,
            column_config={
                'Allocation Rate': st.column_config.NumberColumn(format="%.2f"),
                'Average Supply Ratio': st.column_config.NumberColumn(format="%.2f"),
                'Safety Compliance': st.column_config.NumberColumn(format="%.1%")
            }
        )

        # Recommendations
        st.subheader("Recommendations")

        # Calculate key insights
        critical_periods = results_df[results_df['is_safe'] == False]['date'].unique()

        col1, col2 = st.columns(2)

        with col1:
            st.write("**Water Allocation Summary:**")
            total_demand = results_df['demand_m3'].sum()
            total_allocated = results_df['total_allocated_m3'].sum()
            st.write(f"• Total Demand: {total_demand:,.0f} m³")
            st.write(f"• Total Allocated: {total_allocated:,.0f} m³")
            st.write(f"• Allocation Rate: {(total_allocated/total_demand*100):.1f}%")

            st.write("\n**Critical Safety Periods:**")
            if len(critical_periods) > 0:
                st.write(f"• {len(critical_periods)} days with unsafe groundwater levels")
                st.write("• Consider reducing extraction during these periods")
            else:
                st.write("• All periods maintain safe groundwater levels ")

        with col2:
            st.write("**Sectoral Performance:**")
            sector_summary = results_df.groupby('sector').agg({
                'demand_m3': 'sum',
                'total_allocated_m3': 'sum'
            }).reset_index()

            for _, sector in sector_summary.iterrows():
                allocation_rate = (sector['total_allocated_m3'] / sector['demand_m3']) * 100
                st.write(f"• {sector['sector']}: {allocation_rate:.1f}% allocated")

            sustainability_score = results_df['is_safe'].mean() * 100
            st.write(f"\n**Sustainability Score:** {sustainability_score:.1f}%")

        # Downloadable results
        st.subheader("Download Results")
        
        # Create summary report
        summary_report = {
            'Total Allocated': f"{results_df['total_allocated_m3'].sum():,.0f} m³",
            'Total Demand': f"{results_df['demand_m3'].sum():,.0f} m³",
            'Allocation Ratio': f"{(results_df['total_allocated_m3'].sum() / results_df['demand_m3'].sum()):.1%}",
            'Average Supply Ratio': f"{results_df['supply_ratio'].mean():.2%}",
            'Safety Compliance Rate': f"{results_df['is_safe'].mean():.2%}",
            'High Priority Compliance': f"{results_df[results_df['priority'] == 1]['sector_priority_met'].mean():.2%}",
            'Total Unmet Demand': f"{results_df['unmet_demand_m3'].sum():,.0f} m³"
        }

        summary_df = pd.DataFrame(list(summary_report.items()), columns=['Metric', 'Value'])

        col1, col2 = st.columns(2)
        with col1:
            csv_results = results_df.to_csv(index=False)
            st.download_button(
                label="Download Full Results (CSV)",
                data=csv_results,
                file_name="advanced_groundwater_optimization_results.csv",
                mime="text/csv"
            )

        with col2:
            csv_summary = summary_df.to_csv(index=False)
            st.download_button(
                label="Download Summary Report (CSV)",
                data=csv_summary,
                file_name="optimization_summary_report.csv",
                mime="text/csv"
            )

        # Advanced insights
        st.subheader("Advanced Insights")

        # Seasonal analysis
        results_df['month'] = pd.to_datetime(results_df['date']).dt.month
        seasonal_analysis = results_df.groupby('month').agg({
            'optimal_extraction_m3': 'mean',
            'supply_ratio': 'mean',
            'energy_required_kwh': 'mean',
            'is_safe': 'mean'
        }).reset_index()

        fig_seasonal = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Monthly Extraction Patterns', 'Monthly Supply Ratios',
                           'Monthly Energy Requirements', 'Monthly Safety Compliance'),
            specs=[[{"secondary_y": False}, {"secondary_y": False}],
                   [{"secondary_y": False}, {"secondary_y": False}]]
        )

        fig_seasonal.add_trace(
            go.Scatter(x=seasonal_analysis['month'], y=seasonal_analysis['optimal_extraction_m3'],
                      mode='lines+markers', name='Average Extraction', line=dict(color='blue')),
            row=1, col=1
        )

        fig_seasonal.add_trace(
            go.Scatter(x=seasonal_analysis['month'], y=seasonal_analysis['supply_ratio'],
                      mode='lines+markers', name='Supply Ratio', line=dict(color='green')),
            row=1, col=2
        )

        fig_seasonal.add_trace(
            go.Scatter(x=seasonal_analysis['month'], y=seasonal_analysis['energy_required_kwh'],
                      mode='lines+markers', name='Energy Requirements', line=dict(color='red')),
            row=2, col=1
        )

        fig_seasonal.add_trace(
            go.Scatter(x=seasonal_analysis['month'], y=seasonal_analysis['is_safe'] * 100,
                      mode='lines+markers', name='Safety %', line=dict(color='orange')),
            row=2, col=2
        )

        fig_seasonal.update_layout(height=600, title_text="Seasonal Performance Analysis")
        fig_seasonal.update_xaxes(title_text="Month")
        fig_seasonal.update_yaxes(title_text="Extraction (m³)", row=1, col=1)
        fig_seasonal.update_yaxes(title_text="Supply Ratio", row=1, col=2)
        fig_seasonal.update_yaxes(title_text="Energy Requirements (kWh)", row=2, col=1)
        fig_seasonal.update_yaxes(title_text="Safety %", row=2, col=2)

        st.plotly_chart(fig_seasonal, use_container_width=True)

        # Correlation analysis
        st.subheader("")

        correlation_vars = ['optimal_extraction_m3', 'energy_required_kwh', 'supply_ratio',
                           'projected_groundwater_level_m', 'depth', 'total_allocated_m3']

        if all(var in results_df.columns for var in correlation_vars):
            corr_matrix = results_df[correlation_vars].corr()

            fig_corr = px.imshow(
                corr_matrix,
                text_auto=True,
                aspect="auto",
                title="Correlation Matrix of Key Variables",
                color_continuous_scale='RdBu'
            )
            st.plotly_chart(fig_corr, use_container_width=True)
        
        # Detailed results table
        with st.expander(""):
            # Add filters for detailed view
            st.write("### Filter Results")
            col1, col2, col3 = st.columns(3)
            
            with col1:
                selected_locations = st.multiselect(
                    "Select Locations",
                    options=results_df['location_id'].unique(),
                    default=results_df['location_id'].unique()
                )
            
            with col2:
                selected_sectors = st.multiselect(
                    "Select Sectors",
                    options=results_df['sector'].unique(),
                    default=results_df['sector'].unique()
                )
            
            with col3:
                # Convert dates to datetime.date objects for the date_input widget
                min_date = pd.to_datetime(results_df['date'].min()).date()
                max_date = pd.to_datetime(results_df['date'].max()).date()
                date_range = st.date_input(
                    "Select Date Range",
                    value=(min_date, max_date),
                    min_value=min_date,
                    max_value=max_date
                )
            
                # Filter data based on selections
                try:
                    # Ensure we have valid date range
                    if len(date_range) == 2 and date_range[0] is not None and date_range[1] is not None:
                        start_date = pd.to_datetime(date_range[0])
                        end_date = pd.to_datetime(date_range[1])
                                
                        filtered_results = results_df[
                            (results_df['location_id'].isin(selected_locations)) &
                            (results_df['sector'].isin(selected_sectors)) &
                            (results_df['date'] >= start_date) &
                            (results_df['date'] <= end_date)
                        ]
                    else:
                        # If date range is not properly selected, show all data
                        filtered_results = results_df[
                            (results_df['location_id'].isin(selected_locations)) &
                            (results_df['sector'].isin(selected_sectors))
                        ]
                except Exception as e:
                    st.error(f"Error filtering data: {str(e)}")
                    filtered_results = results_df  # Fallback to showing all data
                
                # Define display columns
                display_columns = [
                    'date', 'location_id', 'sector', 'demand_m3', 'total_allocated_m3',
                    'optimal_extraction_m3', 'supply_ratio', 'energy_required_kwh', 
                    'projected_groundwater_level_m', 'is_safe'
                ]
                
                # Display the filtered results
                st.dataframe(
                    filtered_results[display_columns].round(2),
                    use_container_width=True,
                    height=400
                )
            
            # Summary of filtered data
            if len(filtered_results) > 0:
                st.write("**Filtered Data Summary:**")
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric("", len(filtered_results))
                with col2:
                    st.metric("", f"{filtered_results['supply_ratio'].mean():.2%}")
                with col3:
                    st.metric("", f"{filtered_results['total_allocated_m3'].sum():,.0f} m³")
                with col4:
                    st.metric("", f"{filtered_results['is_safe'].mean():.1%}")

if __name__ == "__main__":
    main()