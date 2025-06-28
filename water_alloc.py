import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import time
from io import StringIO
from scipy.optimize import linprog, minimize
from scipy.sparse import csc_matrix
import warnings
warnings.filterwarnings('ignore')

# Page configuration
st.set_page_config(
    page_title="Water Resource Optimization System",
    page_icon="💧",
    layout="wide"
)

# Initialize session state
if 'data' not in st.session_state:
    # Sample data for demonstration
    st.session_state.data = pd.DataFrame([
        {
            'date': '2024-01-01',
            'location_id': 'LOC001',
            'priority': 0.9,
            'sector': 'Municipal',
            'demand_m3': 10000,
            'available_surface_water_m3': 8000,
            'groundwater_level_m': 45,
            'safe_groundwater_threshold_m': 40,
            'critical_groundwater_threshold_m': 30,
            'recharge_rate_m3_per_day': 500,
            'groundwater_extraction_limit_m3': 3000,
            'unmet_demand_penalty_cost_per_m3': 15,
            'long_term_depletion_cost_per_m3': 25,
            'is_drought': False
        },
        {
            'date': '2024-01-01',
            'location_id': 'LOC002',
            'priority': 0.7,
            'sector': 'Agricultural',
            'demand_m3': 15000,
            'available_surface_water_m3': 12000,
            'groundwater_level_m': 35,
            'safe_groundwater_threshold_m': 40,
            'critical_groundwater_threshold_m': 30,
            'recharge_rate_m3_per_day': 300,
            'groundwater_extraction_limit_m3': 2000,
            'unmet_demand_penalty_cost_per_m3': 8,
            'long_term_depletion_cost_per_m3': 20,
            'is_drought': True
        },
        {
            'date': '2024-01-01',
            'location_id': 'LOC003',
            'priority': 0.8,
            'sector': 'Industrial',
            'demand_m3': 8000,
            'available_surface_water_m3': 6000,
            'groundwater_level_m': 50,
            'safe_groundwater_threshold_m': 40,
            'critical_groundwater_threshold_m': 30,
            'recharge_rate_m3_per_day': 400,
            'groundwater_extraction_limit_m3': 2500,
            'unmet_demand_penalty_cost_per_m3': 12,
            'long_term_depletion_cost_per_m3': 18,
            'is_drought': False
        }
    ])

if 'optimization_results' not in st.session_state:
    st.session_state.optimization_results = None

if 'optimization_params' not in st.session_state:
    st.session_state.optimization_params = {
        'priority_weight': 1.0,
        'penalty_weight': 1000.0,  # Higher penalty weight for mathematical optimization
        'groundwater_depletion_weight': 500.0,
        'drought_multiplier': 2.0,
        'groundwater_safety_buffer': 0.1,  # 10% safety buffer above critical level
        'optimization_method': 'linear_programming'
    }

def mathematical_optimization_linear(data, params):
    """
    Mathematical optimization using Linear Programming
    
    Decision Variables:
    - x_sw_i: Surface water allocation to location i
    - x_gw_i: Groundwater allocation to location i
    - u_i: Unmet demand at location i (slack variable)
    
    Objective Function:
    Maximize: Σ(priority_i * (x_sw_i + x_gw_i) * priority_weight) - 
              Σ(u_i * penalty_cost_i * penalty_weight) - 
              Σ(x_gw_i * depletion_cost_i * depletion_weight)
    """
    n = len(data)
    
    # Decision variables: [x_sw_1, x_gw_1, u_1, x_sw_2, x_gw_2, u_2, ..., x_sw_n, x_gw_n, u_n]
    # For each location i, we have 3 variables at positions [3*i, 3*i+1, 3*i+2]
    
    # Coefficients for objective function (we minimize negative of maximization problem)
    c = []
    for i, row in data.iterrows():
        drought_factor = params['drought_multiplier'] if row['is_drought'] else 1.0
        
        # Surface water coefficient (benefit)
        c.append(-row['priority'] * params['priority_weight'])
        
        # Groundwater coefficient (benefit - depletion cost)
        gw_coeff = -row['priority'] * params['priority_weight'] + \
                   row['long_term_depletion_cost_per_m3'] * params['groundwater_depletion_weight']
        c.append(gw_coeff)
        
        # Unmet demand coefficient (penalty)
        penalty_coeff = row['unmet_demand_penalty_cost_per_m3'] * params['penalty_weight'] * drought_factor
        c.append(penalty_coeff)
    
    c = np.array(c)
    
    # Inequality constraints (A_ub * x <= b_ub)
    A_ub = []
    b_ub = []
    
    for i, row in data.iterrows():
        # Surface water availability constraint: x_sw_i <= available_surface_water_i
        constraint_sw = np.zeros(3 * n)
        constraint_sw[3*i] = 1
        A_ub.append(constraint_sw)
        b_ub.append(row['available_surface_water_m3'])
        
        # Groundwater extraction limit: x_gw_i <= groundwater_extraction_limit_i
        constraint_gw = np.zeros(3 * n)
        constraint_gw[3*i + 1] = 1
        A_ub.append(constraint_gw)
        
        # Calculate safe groundwater limit based on current level and thresholds
        current_level = row['groundwater_level_m']
        critical_level = row['critical_groundwater_threshold_m']
        safe_level = row['safe_groundwater_threshold_m']
        
        # Safety factor: more conservative as we approach critical level
        if current_level <= critical_level:
            safety_factor = 0.0  # No extraction if at or below critical
        elif current_level <= safe_level:
            # Linear interpolation between critical and safe levels
            safety_factor = (current_level - critical_level) / (safe_level - critical_level)
            safety_factor *= (1 - params['groundwater_safety_buffer'])  # Apply safety buffer
        else:
            safety_factor = 1 - params['groundwater_safety_buffer']  # Always maintain some buffer
        
        safe_extraction_limit = row['groundwater_extraction_limit_m3'] * safety_factor
        b_ub.append(safe_extraction_limit)
    
    # Equality constraints (A_eq * x = b_eq)
    A_eq = []
    b_eq = []
    
    for i, row in data.iterrows():
        # Demand balance constraint: x_sw_i + x_gw_i + u_i = demand_i
        constraint_demand = np.zeros(3 * n)
        constraint_demand[3*i] = 1      # Surface water
        constraint_demand[3*i + 1] = 1  # Groundwater
        constraint_demand[3*i + 2] = 1  # Unmet demand
        A_eq.append(constraint_demand)
        b_eq.append(row['demand_m3'])
    
    # Bounds for variables (all non-negative)
    bounds = [(0, None)] * (3 * n)
    
    # Convert to numpy arrays
    A_ub = np.array(A_ub) if A_ub else None
    b_ub = np.array(b_ub) if b_ub else None
    A_eq = np.array(A_eq) if A_eq else None
    b_eq = np.array(b_eq) if b_eq else None
    
    # Solve the linear programming problem
    try:
        result = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, 
                        bounds=bounds, method='highs', options={'presolve': True})
        
        if result.success:
            # Extract results
            x = result.x
            results = []
            
            for i, row in data.iterrows():
                surface_water_allocated = x[3*i]
                groundwater_allocated = x[3*i + 1]
                unmet_demand = x[3*i + 2]
                total_allocated = surface_water_allocated + groundwater_allocated
                
                # Calculate additional metrics
                fulfillment_rate = (total_allocated / row['demand_m3']) * 100 if row['demand_m3'] > 0 else 0
                
                # Calculate new groundwater level based on extraction
                current_level = row['groundwater_level_m']
                critical_level = row['critical_groundwater_threshold_m']
                safe_level = row['safe_groundwater_threshold_m']
                
                # Calculate drawdown (simplified model: 1m drop per 1000m3 extracted)
                drawdown = (groundwater_allocated / 1000) if groundwater_allocated > 0 else 0
                new_groundwater_level = max(critical_level * 0.9, current_level - drawdown)  # Don't go below 90% of critical level
                
                # Calculate risk level
                if new_groundwater_level <= critical_level:
                    risk_level = 'Critical'
                elif new_groundwater_level <= safe_level:
                    risk_level = 'High'
                elif groundwater_allocated > 0.7 * row['groundwater_extraction_limit_m3']:
                    risk_level = 'Medium'
                else:
                    risk_level = 'Low'
                
                # Calculate objective components
                drought_factor = params['drought_multiplier'] if row['is_drought'] else 1.0
                priority_value = row['priority'] * total_allocated * params['priority_weight']
                penalty_cost = unmet_demand * row['unmet_demand_penalty_cost_per_m3'] * params['penalty_weight'] * drought_factor
                depletion_cost = groundwater_allocated * row['long_term_depletion_cost_per_m3'] * params['groundwater_depletion_weight']
                net_benefit = priority_value - penalty_cost - depletion_cost
                
                results.append({
                    **row.to_dict(),
                    'surface_water_allocated': surface_water_allocated,
                    'groundwater_allocated': groundwater_allocated,
                    'total_allocated': total_allocated,
                    'unmet_demand': unmet_demand,
                    'unmet_percentage': (unmet_demand / row['demand_m3'] * 100) if row['demand_m3'] > 0 else 0,
                    'fulfillment_rate': fulfillment_rate,
                    'risk_level': risk_level,
                    'groundwater_level': current_level,
                    'new_groundwater_level': new_groundwater_level,
                    'priority_value': priority_value,
                    'penalty_cost': penalty_cost,
                    'depletion_cost': depletion_cost,
                    'net_benefit': net_benefit,
                    'optimization_status': 'Optimal'
                })
            
            results_df = pd.DataFrame(results)
            
            # Calculate summary
            summary = {
                'total_objective_value': -result.fun,  # Convert back from minimization
                'optimization_status': 'Optimal' if result.success else 'Suboptimal',
                'solver_message': result.message,
                'iterations': getattr(result, 'nit', 'N/A'),
                'overall_fulfillment_rate': (results_df['total_allocated'].sum() / results_df['demand_m3'].sum()) * 100,
                'total_demand': results_df['demand_m3'].sum(),
                'total_allocated': results_df['total_allocated'].sum(),
                'total_unmet': results_df['unmet_demand'].sum(),
                'total_surface_water': results_df['surface_water_allocated'].sum(),
                'total_groundwater': results_df['groundwater_allocated'].sum(),
                'high_risk_locations': len(results_df[results_df['risk_level'].isin(['High', 'Critical'])]),
                'total_priority_value': results_df['priority_value'].sum(),
                'total_penalty_cost': results_df['penalty_cost'].sum(),
                'total_depletion_cost': results_df['depletion_cost'].sum()
            }
            
            return results_df, summary, True
            
        else:
            return None, {'error': result.message, 'optimization_status': 'Failed'}, False
            
    except Exception as e:
        return None, {'error': str(e), 'optimization_status': 'Error'}, False

def nonlinear_optimization(data, params):
    """
    Nonlinear optimization with more sophisticated objective function
    """
    n = len(data)
    
    def objective_function(x):
        total_objective = 0
        
        for i, row in data.iterrows():
            sw_alloc = x[3*i]
            gw_alloc = x[3*i + 1]
            unmet = x[3*i + 2]
            
            drought_factor = params['drought_multiplier'] if row['is_drought'] else 1.0
            
            # Utility function (diminishing returns)
            total_alloc = sw_alloc + gw_alloc
            utility = row['priority'] * (total_alloc - 0.5 * (total_alloc**2) / row['demand_m3']) * params['priority_weight']
            
            # Penalty for unmet demand (exponential penalty)
            penalty = (unmet**1.5) * row['unmet_demand_penalty_cost_per_m3'] * params['penalty_weight'] * drought_factor
            
            # Groundwater depletion cost (exponential cost as we extract more)
            max_safe_gw = row['groundwater_extraction_limit_m3'] * 0.8
            if gw_alloc > max_safe_gw:
                depletion_cost = ((gw_alloc - max_safe_gw)**2) * row['long_term_depletion_cost_per_m3'] * params['groundwater_depletion_weight']
            else:
                depletion_cost = gw_alloc * row['long_term_depletion_cost_per_m3'] * params['groundwater_depletion_weight'] * 0.1
            
            total_objective += utility - penalty - depletion_cost
        
        return -total_objective  # Minimize negative of maximization
    
    # Constraints
    constraints = []
    
    # Demand balance constraints
    for i, row in data.iterrows():
        constraints.append({
            'type': 'eq',
            'fun': lambda x, i=i, row=row: x[3*i] + x[3*i + 1] + x[3*i + 2] - row['demand_m3']
        })
    
    # Resource availability constraints
    for i, row in data.iterrows():
        # Surface water limit
        constraints.append({
            'type': 'ineq',
            'fun': lambda x, i=i, row=row: row['available_surface_water_m3'] - x[3*i]
        })
        
        # Groundwater limit
        current_level = row['groundwater_level_m']
        critical_level = row['critical_groundwater_threshold_m']
        safe_level = row['safe_groundwater_threshold_m']
        
        if current_level <= critical_level:
            gw_limit = 0
        elif current_level <= safe_level:
            safety_factor = (current_level - critical_level) / (safe_level - critical_level) * 0.8
            gw_limit = row['groundwater_extraction_limit_m3'] * safety_factor
        else:
            gw_limit = row['groundwater_extraction_limit_m3'] * 0.9
        
        constraints.append({
            'type': 'ineq',
            'fun': lambda x, i=i, gw_limit=gw_limit: gw_limit - x[3*i + 1]
        })
    
    # Bounds
    bounds = [(0, None)] * (3 * n)
    
    # Initial guess
    x0 = []
    for i, row in data.iterrows():
        x0.extend([
            min(row['demand_m3'] * 0.5, row['available_surface_water_m3']),  # Surface water
            min(row['demand_m3'] * 0.3, row['groundwater_extraction_limit_m3']),  # Groundwater
            max(0, row['demand_m3'] * 0.2)  # Unmet demand
        ])
    
    try:
        result = minimize(objective_function, x0, method='SLSQP', bounds=bounds, constraints=constraints)
        
        if result.success:
            x = result.x
            results = []
            
            for i, row in data.iterrows():
                surface_water_allocated = x[3*i]
                groundwater_allocated = x[3*i + 1]
                unmet_demand = x[3*i + 2]
                total_allocated = surface_water_allocated + groundwater_allocated
                
                fulfillment_rate = (total_allocated / row['demand_m3']) * 100 if row['demand_m3'] > 0 else 0
                
                # Risk assessment
                current_level = row['groundwater_level_m']
                critical_level = row['critical_groundwater_threshold_m']
                safe_level = row['safe_groundwater_threshold_m']
                
                if current_level <= critical_level:
                    risk_level = 'Critical'
                elif current_level <= safe_level:
                    risk_level = 'High'
                elif groundwater_allocated > 0.7 * row['groundwater_extraction_limit_m3']:
                    risk_level = 'Medium'
                else:
                    risk_level = 'Low'
                
                results.append({
                    **row.to_dict(),
                    'surface_water_allocated': surface_water_allocated,
                    'groundwater_allocated': groundwater_allocated,
                    'total_allocated': total_allocated,
                    'unmet_demand': unmet_demand,
                    'fulfillment_rate': fulfillment_rate,
                    'risk_level': risk_level,
                    'optimization_status': 'Optimal'
                })
            
            results_df = pd.DataFrame(results)
            
            summary = {
                'total_objective_value': -result.fun,
                'optimization_status': 'Optimal',
                'solver_message': result.message,
                'iterations': result.nit,
                'overall_fulfillment_rate': (results_df['total_allocated'].sum() / results_df['demand_m3'].sum()) * 100,
                'total_demand': results_df['demand_m3'].sum(),
                'total_allocated': results_df['total_allocated'].sum(),
                'total_unmet': results_df['unmet_demand'].sum(),
                'total_surface_water': results_df['surface_water_allocated'].sum(),
                'total_groundwater': results_df['groundwater_allocated'].sum(),
                'high_risk_locations': len(results_df[results_df['risk_level'].isin(['High', 'Critical'])])
            }
            
            return results_df, summary, True
        else:
            return None, {'error': result.message, 'optimization_status': 'Failed'}, False
            
    except Exception as e:
        return None, {'error': str(e), 'optimization_status': 'Error'}, False

def render_data_tab():
    st.header("📊 Data Management")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.subheader("Upload Data")
        uploaded_file = st.file_uploader("Choose a CSV file", type="csv")
        
        if uploaded_file is not None:
            try:
                df = pd.read_csv(uploaded_file)
                # Convert data types
                numeric_columns = [col for col in df.columns if '_m3' in col or '_m' in col or col == 'priority']
                for col in numeric_columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                
                if 'is_drought' in df.columns:
                    df['is_drought'] = df['is_drought'].astype(str).str.lower() == 'true'
                
                st.session_state.data = df
                st.session_state.optimization_results = None
                st.success(f"Uploaded {len(df)} records successfully!")
            except Exception as e:
                st.error(f"Error parsing CSV file: {str(e)}")
        
        st.subheader("Sample Data Template")
        template_data = {
            'date': '2024-01-01',
            'location_id': 'LOC001',
            'priority': 0.9,
            'sector': 'Municipal',
            'demand_m3': 10000,
            'available_surface_water_m3': 8000,
            'groundwater_level_m': 45,
            'safe_groundwater_threshold_m': 40,
            'critical_groundwater_threshold_m': 30,
            'recharge_rate_m3_per_day': 500,
            'groundwater_extraction_limit_m3': 3000,
            'unmet_demand_penalty_cost_per_m3': 15,
            'long_term_depletion_cost_per_m3': 25,
            'is_drought': False
        }
        
        template_df = pd.DataFrame([template_data])
        csv_template = template_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Template CSV",
            data=csv_template,
            file_name="water_optimization_template.csv",
            mime="text/csv"
        )
    
    with col2:
        st.subheader(f"Current Dataset ({len(st.session_state.data)} records)")
        
        # Display data summary
        display_data = st.session_state.data.copy()
        if 'is_drought' in display_data.columns:
            display_data['is_drought'] = display_data['is_drought'].map({True: 'Yes', False: 'No'})
        
        st.dataframe(
            display_data[['location_id', 'sector', 'priority', 'demand_m3', 
                         'available_surface_water_m3', 'groundwater_level_m', 'is_drought']],
            use_container_width=True
        )
        
        # Data validation
        st.subheader("Data Validation")
        validation_results = []
        
        for i, row in st.session_state.data.iterrows():
            issues = []
            if row['demand_m3'] <= 0:
                issues.append("Zero or negative demand")
            if row['groundwater_level_m'] <= row['critical_groundwater_threshold_m']:
                issues.append("Groundwater at critical level")
            if row['available_surface_water_m3'] < 0:
                issues.append("Negative surface water availability")
            if row['priority'] < 0 or row['priority'] > 1:
                issues.append("Priority out of range [0,1]")
            
            if issues:
                validation_results.append(f"Location {row['location_id']}: {', '.join(issues)}")
        
        if validation_results:
            st.warning("Data Validation Issues:")
            for issue in validation_results:
                st.write(f"⚠️ {issue}")
        else:
            st.success("✅ All data validation checks passed")

def render_optimization_tab():
    st.header("⚙️ Mathematical Optimization")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("Optimization Method")
        optimization_method = st.selectbox(
            "Choose optimization approach:",
            ['linear_programming', 'nonlinear_programming'],
            format_func=lambda x: 'Linear Programming (LP)' if x == 'linear_programming' else 'Nonlinear Programming (NLP)'
        )
        
        st.subheader("Optimization Parameters")
        
        priority_weight = st.number_input(
            "Priority Weight (α)",
            value=st.session_state.optimization_params['priority_weight'],
            min_value=0.1,
            step=0.1,
            format="%.1f",
            help="Weight for priority-based allocation benefit"
        )
        
        penalty_weight = st.number_input(
            "Unmet Demand Penalty Weight (β)",
            value=st.session_state.optimization_params['penalty_weight'],
            min_value=1.0,
            step=10.0,
            format="%.1f",
            help="Penalty coefficient for unmet demand"
        )
        
        groundwater_depletion_weight = st.number_input(
            "Groundwater Depletion Weight (γ)",
            value=st.session_state.optimization_params['groundwater_depletion_weight'],
            min_value=1.0,
            step=10.0,
            format="%.1f",
            help="Cost coefficient for groundwater depletion"
        )
        
        drought_multiplier = st.number_input(
            "Drought Penalty Multiplier (δ)",
            value=st.session_state.optimization_params['drought_multiplier'],
            min_value=1.0,
            step=0.1,
            format="%.1f",
            help="Multiplier for penalties during drought conditions"
        )
        
        groundwater_safety_buffer = st.slider(
            "Groundwater Safety Buffer",
            min_value=0.0,
            max_value=0.5,
            value=st.session_state.optimization_params['groundwater_safety_buffer'],
            step=0.05,
            help="Safety buffer to maintain above critical groundwater levels"
        )
        
        # Update session state
        st.session_state.optimization_params = {
            'priority_weight': priority_weight,
            'penalty_weight': penalty_weight,
            'groundwater_depletion_weight': groundwater_depletion_weight,
            'drought_multiplier': drought_multiplier,
            'groundwater_safety_buffer': groundwater_safety_buffer,
            'optimization_method': optimization_method
        }
    
    with col2:
        st.subheader("Mathematical Formulation")
        
        if optimization_method == 'linear_programming':
            st.latex(r'''
            \begin{align}
            \text{maximize} \quad & \sum_{i=1}^{n} \alpha \cdot p_i \cdot (x_{sw,i} + x_{gw,i}) \\
            & - \sum_{i=1}^{n} \beta \cdot \delta_i \cdot c_{penalty,i} \cdot u_i \\
            & - \sum_{i=1}^{n} \gamma \cdot c_{depletion,i} \cdot x_{gw,i}
            \end{align}
            ''')
            
            st.markdown("**Subject to:**")
            st.latex(r'''
            \begin{align}
            x_{sw,i} + x_{gw,i} + u_i &= d_i \quad \forall i \\
            x_{sw,i} &\leq SW_{avail,i} \quad \forall i \\
            x_{gw,i} &\leq GW_{safe,i} \quad \forall i \\
            x_{sw,i}, x_{gw,i}, u_i &\geq 0 \quad \forall i
            \end{align}
            ''')
        
        else:
            st.latex(r'''
            \begin{align}
            \text{maximize} \quad & \sum_{i=1}^{n} \alpha \cdot p_i \cdot \left(A_i - \frac{A_i^2}{2d_i}\right) \\
            & - \sum_{i=1}^{n} \beta \cdot \delta_i \cdot c_{penalty,i} \cdot u_i^{1.5} \\
            & - \sum_{i=1}^{n} \gamma \cdot c_{depletion,i} \cdot f(x_{gw,i})
            \end{align}
            ''')
        
        st.markdown("""
        **Where:**
        - $x_{sw,i}$: Surface water allocation to location $i$
        - $x_{gw,i}$: Groundwater allocation to location $i$  
        - $u_i$: Unmet demand at location $i$
        - $p_i$: Priority of location $i$
        - $d_i$: Demand at location $i$
        - $\delta_i$: Drought multiplier (1 or drought factor)
        - $SW_{avail,i}$: Available surface water at location $i$
        - $GW_{safe,i}$: Safe groundwater extraction limit at location $i$
        """)
        
        if st.button("🚀 Run Mathematical Optimization", type="primary", use_container_width=True):
            if len(st.session_state.data) > 0:
                with st.spinner("Running mathematical optimization..."):
                    if optimization_method == 'linear_programming':
                        results_df, summary, success = mathematical_optimization_linear(
                            st.session_state.data, 
                            st.session_state.optimization_params
                        )
                    else:
                        results_df, summary, success = nonlinear_optimization(
                            st.session_state.data, 
                            st.session_state.optimization_params
                        )
                    
                    if success:
                        st.session_state.optimization_results = {
                            'allocations': results_df,
                            'summary': summary,
                            'method': optimization_method
                        }
                        st.success(f"✅ Optimization completed successfully using {optimization_method.replace('_', ' ').title()}!")
                        st.balloons()
                    else:
                        st.error(f"❌ Optimization failed: {summary.get('error', 'Unknown error')}")
                        st.session_state.optimization_results = None
            else:
                st.error("No data available. Please upload data first.")

def plot_water_allocation(allocations):
    """Create a stacked bar chart of water allocations by source and location"""
    # Prepare data for plotting
    plot_df = allocations.melt(id_vars=['location_id', 'sector'], 
                             value_vars=['surface_water_allocated', 'groundwater_allocated'],
                             var_name='source', value_name='volume_m3')
    
    # Clean up source names for display
    plot_df['source'] = plot_df['source'].str.replace('_', ' ').str.title()
    
    # Create the plot
    fig = px.bar(plot_df, 
                 x='location_id', 
                 y='volume_m3',
                 color='source',
                 title='Water Allocation by Location and Source',
                 labels={'volume_m3': 'Volume (m³)', 'location_id': 'Location ID'},
                 color_discrete_map={
                     'Surface Water Allocated': '#1f77b4',
                     'Groundwater Allocated': '#ff7f0e'
                 })
    
    fig.update_layout(
        barmode='stack',
        xaxis_title='Location',
        yaxis_title='Volume (m³)',
        legend_title='Water Source',
        hovermode='x unified'
    )
    
    return fig

def plot_demand_vs_allocation(allocations):
    """Create a grouped bar chart comparing demand vs allocated water"""
    fig = go.Figure()
    
    # Add demand bars
    fig.add_trace(go.Bar(
        x=allocations['location_id'],
        y=allocations['demand_m3'],
        name='Demand',
        marker_color='#2ca02c',
        opacity=0.7
    ))
    
    # Add allocated water bars
    fig.add_trace(go.Bar(
        x=allocations['location_id'],
        y=allocations['total_allocated'],
        name='Allocated',
        marker_color='#17becf',
        opacity=0.7
    ))
    
    # Add unmet demand as line
    fig.add_trace(go.Scatter(
        x=allocations['location_id'],
        y=allocations['unmet_demand'],
        name='Unmet Demand',
        mode='lines+markers',
        line=dict(color='#d62728', width=3),
        yaxis='y2'
    ))
    
    fig.update_layout(
        title='Demand vs Allocated Water by Location',
        xaxis_title='Location',
        yaxis_title='Volume (m³)',
        yaxis2=dict(
            title='Unmet Demand (m³)',
            overlaying='y',
            side='right',
            showgrid=False
        ),
        barmode='group',
        legend=dict(orientation='h', y=1.1, yanchor='bottom')
    )
    
    return fig

def plot_groundwater_impact(allocations):
    """Create a visualization showing groundwater level impact"""
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    
    # Add groundwater level bars
    fig.add_trace(
        go.Bar(
            x=allocations['location_id'],
            y=allocations['groundwater_allocated'],
            name='Groundwater Allocated',
            marker_color='#ff7f0e',
            opacity=0.7
        ),
        secondary_y=False
    )
    
    # Add groundwater level line
    fig.add_trace(
        go.Scatter(
            x=allocations['location_id'],
            y=allocations['new_groundwater_level'],
            name='New Groundwater Level (m)',
            mode='lines+markers',
            line=dict(color='#1f77b4', width=3)
        ),
        secondary_y=True
    )
    
    # Add critical level line
    fig.add_hline(
        y=allocations['critical_groundwater_threshold_m'].iloc[0],
        line_dash="dash",
        line_color="red",
        annotation_text="Critical Level",
        annotation_position="bottom right"
    )
    
    # Add safe level line
    fig.add_hline(
        y=allocations['safe_groundwater_threshold_m'].iloc[0],
        line_dash="dash",
        line_color="orange",
        annotation_text="Safe Level",
        annotation_position="top right"
    )
    
    fig.update_layout(
        title='Groundwater Allocation and Impact',
        xaxis_title='Location',
        yaxis_title='Groundwater Allocated (m³)',
        yaxis2=dict(
            title='Groundwater Level (m)',
            overlaying='y',
            side='right',
            showgrid=False
        ),
        showlegend=True
    )
    
    return fig

def render_results_tab():
    st.header("📈 Results & Analytics")
    
    if st.session_state.optimization_results is None:
        st.info("No optimization results yet. Please run optimization first.")
        return
    
    results = st.session_state.optimization_results
    allocations = results['allocations']
    
    # Calculate summary statistics
    total_demand = allocations['demand_m3'].sum()
    total_allocated = allocations['total_allocated'].sum()
    total_unmet = allocations['unmet_demand'].sum()
    unmet_percentage = (total_unmet / total_demand * 100) if total_demand > 0 else 0
    groundwater_ratio = (allocations['groundwater_allocated'].sum() / total_allocated * 100) if total_allocated > 0 else 0
    
    # Display summary metrics
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Demand", f"{total_demand:,.0f} m³")
    with col2:
        st.metric("Total Allocated", f"{total_allocated:,.0f} m³")
    with col3:
        st.metric("Unmet Demand", f"{total_unmet:,.0f} m³ ({unmet_percentage:.1f}%)", 
                 delta_color="inverse" if total_unmet > 0 else "normal")
    with col4:
        st.metric("Groundwater Usage", f"{groundwater_ratio:.1f}% of total")
    
    # Tabs for different visualizations
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 Allocation Overview", 
        "📉 Demand vs Allocation", 
        "🌊 Groundwater Impact",
        "📋 Detailed Results"
    ])
    
    with tab1:
        st.plotly_chart(plot_water_allocation(allocations), use_container_width=True)
    
    with tab2:
        st.plotly_chart(plot_demand_vs_allocation(allocations), use_container_width=True)
    
    with tab3:
        st.plotly_chart(plot_groundwater_impact(allocations), use_container_width=True)
    
    with tab4:
        # Display detailed results table
        st.subheader("Detailed Allocation Results")
        
        # Format the display columns
        display_cols = [
            'location_id', 'sector', 'priority', 'demand_m3',
            'surface_water_allocated', 'groundwater_allocated',
            'total_allocated', 'unmet_demand', 'unmet_percentage',
            'groundwater_level', 'new_groundwater_level'
        ]
        
        # Create a copy with formatted column names for display
        display_df = allocations[display_cols].copy()
        display_df.columns = [col.replace('_', ' ').title() for col in display_cols]
        
        # Display the table with formatting
        st.dataframe(
            display_df.style.format({
                'Demand M3': '{:,.0f}',
                'Surface Water Allocated': '{:,.0f}',
                'Groundwater Allocated': '{:,.0f}',
                'Total Allocated': '{:,.0f}',
                'Unmet Demand': '{:,.0f}',
                'Unmet Percentage': '{:.1f}%',
                'Groundwater Level': '{:.1f}',
                'New Groundwater Level': '{:.1f}'
            }),
            use_container_width=True,
            height=400
        )
        
        # Add download button
        csv = allocations.to_csv(index=False).encode('utf-8')
        st.download_button(
            label="📥 Download Results as CSV",
            data=csv,
            file_name="water_allocation_results.csv",
            mime="text/csv"
        )
    
    # Display optimization metrics if available
    if 'metrics' in results:
        st.subheader("Optimization Metrics")
        metrics = results['metrics']
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Cost", f"${metrics.get('total_cost', 0):,.2f}")
        with col2:
            st.metric("Penalty Cost", f"${metrics.get('penalty_cost', 0):,.2f}")
        with col3:
            st.metric("Depletion Cost", f"${metrics.get('depletion_cost', 0):,.2f}")
        
        st.caption(f"Optimization completed in {metrics.get('solve_time', 0):.2f} seconds")

def main():
    """Main function to run the Streamlit app"""
    st.title("💧 Water Resource Optimization System")
    st.markdown("""
    This application helps optimize water allocation across different locations and sectors 
    while considering priorities, resource constraints, and environmental impacts.
    """)
    
    # Create tabs
    tab1, tab2, tab3 = st.tabs(["📊 Data Management", "⚙️ Optimization", "📈 Results"])
    
    with tab1:
        render_data_tab()
    
    with tab2:
        render_optimization_tab()
    
    with tab3:
        render_results_tab()

if __name__ == "__main__":
    main()