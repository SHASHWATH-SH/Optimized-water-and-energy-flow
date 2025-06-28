import React, { useState } from 'react';
import { FaUser, FaLock, FaBuilding, FaUserShield } from 'react-icons/fa';

function Login({ onLogin, onSwitchToSignup }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    userType: 'building',
    email: '',
    organization: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '32px',
            color: 'white'
          }}>
            {isLogin ? <FaUser /> : <FaUserShield />}
          </div>
          <h1 style={{
            color: '#333',
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0'
          }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p style={{
            color: '#666',
            fontSize: '16px',
            margin: '10px 0 0'
          }}>
            {isLogin ? 'Sign in to your account' : 'Join Smart City Water Management'}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <FaUser style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#999'
              }} />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter username"
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#333',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <FaLock style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#999'
              }} />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter password"
              />
            </div>
          </div>

          {!isLogin && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  User Type
                </label>
                <div style={{ position: 'relative' }}>
                  <FaBuilding style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999'
                  }} />
                  <select
                    name="userType"
                    value={formData.userType}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      border: '2px solid #e1e5e9',
                      borderRadius: '10px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.3s',
                      boxSizing: 'border-box',
                      background: 'white'
                    }}
                  >
                    <option value="building">🏢 Building Manager</option>
                    <option value="ngo">🏛️ NGO/Committee</option>
                    <option value="admin">👨‍💼 Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '10px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.3s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter email"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  Organization
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '10px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.3s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter organization name"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.3s'
            }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e1e5e9'
        }}>
          <p style={{ color: '#666', fontSize: '14px', margin: '0' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                textDecoration: 'underline'
              }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {isLogin && (
          <div style={{
            textAlign: 'center',
            marginTop: '15px',
            padding: '15px',
            background: '#f8f9fa',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#666'
          }}>
            <strong>Demo Credentials:</strong><br />
            Admin: admin / admin123<br />
            Building 1: building1 / 12345<br />
            Building 2: building2 / 12345<br />
            ... (building3 to building50)<br />
            <em>All buildings use password: 12345</em>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login; 