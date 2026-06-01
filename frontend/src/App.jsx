import React, { useState, useEffect } from 'react';
import './App.css';
import QRScanner from './components/QRScanner';
import POSCart from './components/POSCart';
import ProductList from './components/ProductList';
import ReportsView from './components/ReportsView';
import AlertsManager from './components/AlertsManager';

// Lucide Icons
import { 
  LayoutDashboard, ShoppingCart, Shirt, BarChart3, AlertCircle, LogOut, 
  User, RefreshCw, AlertTriangle, ShieldAlert, Award, TrendingUp, Search
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshAlerts, setRefreshAlerts] = useState(0);

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Cart POS state
  const [cart, setCart] = useState([]);
  const [skuSearchVal, setSkuSearchVal] = useState('');
  const [skuSearchError, setSkuSearchError] = useState('');
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  // Dashboard state variables
  const [dbSalesSummary, setDbSalesSummary] = useState(null);
  const [dbStockSummary, setDbStockSummary] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);

  // Fetch critical alerts count & summary dashboard statistics
  const fetchDashboardStats = async () => {
    if (!token) return;
    setDbLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [alertsRes, salesRes, stockRes] = await Promise.all([
        fetch('/api/alerts', { headers }),
        fetch('/api/reports/sales/summary', { headers }),
        fetch('/api/reports/stock/valuation', { headers })
      ]);

      const alertsData = await alertsRes.json();
      const salesData = await salesRes.json();
      const stockData = await stockRes.json();

      if (alertsData.success) {
        setActiveAlertsCount(alertsData.data.length);
      }
      if (salesData.success) setDbSalesSummary(salesData.data);
      if (stockData.success) setDbStockSummary(stockData.data.summary);

    } catch (e) {
      console.error('Error fetching dashboard statistics:', e);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardStats();
    }
  }, [token, refreshAlerts]);

  // Authenticate user via JWT
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      const { token: jwtToken, user: userProfile } = data.data;
      localStorage.setItem('token', jwtToken);
      localStorage.setItem('user', JSON.stringify(userProfile));

      setToken(jwtToken);
      setUser(userProfile);
    } catch (err) {
      console.error('[LOGIN ERR]', err);
      setLoginError(err.message || 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out cleanly
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setCart([]);
    setActiveTab('dashboard');
  };

  // POS Cart Management
  const addToCart = (product) => {
    setCart(prevCart => {
      const existing = prevCart.find(i => i.id === product.id);
      if (existing) {
        return prevCart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, change) => {
    setCart(prevCart => {
      return prevCart.map(i => {
        if (i.id === id) {
          const newQty = i.quantity + change;
          return newQty > 0 ? { ...i, quantity: newQty } : i;
        }
        return i;
      });
    });
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(i => i.id !== id));
  };

  // QR Scanning & SKU Lookups
  const handleBarcodeLookup = async (sku) => {
    if (!sku) return;
    setSkuSearchError('');
    try {
      const res = await fetch(`/api/products/sku/${sku}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Product SKU not found');
      }

      const product = data.data;
      if (product.quantity <= 0) {
        throw new Error(`Product "${product.name}" is out of stock!`);
      }

      addToCart(product);
      setSkuSearchVal('');
      
      // Trigger user friendly chime
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, context.currentTime);
      gain.gain.setValueAtTime(0.1, context.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
      osc.stop(context.currentTime + 0.15);
      
    } catch (err) {
      console.error('[SKU LOOKUP ERR]', err);
      setSkuSearchError(err.message || 'Failed to lookup product SKU');
    }
  };

  // Render Login Card if not authenticated
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card bg-glass animate-fade">
          <div className="auth-header">
            <div className="brand-logo">👕</div>
            <h2 className="auth-title">ClothTrack</h2>
            <p className="auth-subtitle">Sign in to inventory console & POS terminal</p>
          </div>

          {loginError && <div className="auth-error">{loginError}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                required
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="auth-btn" disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing in...' : 'Enter Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const role = user?.role || 'cashier';

  return (
    <div className="app-container">
      {/* 1. SIDEBAR (Desktop) */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">👕</div>
          <span className="brand-name">ClothTrack</span>
        </div>

        <nav className="nav-links">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>

          <button 
            onClick={() => setActiveTab('pos')} 
            className={`nav-item ${activeTab === 'pos' ? 'active' : ''}`}
          >
            <ShoppingCart size={18} /> POS Checkout
          </button>

          <button 
            onClick={() => setActiveTab('inventory')} 
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
          >
            <Shirt size={18} /> Inventory Catalog
          </button>

          {role !== 'cashier' && (
            <button 
              onClick={() => setActiveTab('reports')} 
              className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            >
              <BarChart3 size={18} /> Reports & Charts
            </button>
          )}

          <button 
            onClick={() => setActiveTab('alerts')} 
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={18} /> Low Stock Warnings
            </span>
            {activeAlertsCount > 0 && (
              <span style={{ background: 'var(--danger-color)', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px' }}>
                {activeAlertsCount}
              </span>
            )}
          </button>
        </nav>

        <div className="user-profile-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{ background: 'var(--surface-light)', padding: '6px', borderRadius: '50%', color: 'var(--primary-color)' }}>
              <User size={16} />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.full_name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn" title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 2. MOBILE NAVBAR (Tab bar) */}
      <nav className="mobile-nav">
        <button onClick={() => setActiveTab('dashboard')} className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>

        <button onClick={() => setActiveTab('pos')} className={`mobile-nav-item ${activeTab === 'pos' ? 'active' : ''}`}>
          <ShoppingCart size={20} />
          <span>Checkout</span>
        </button>

        <button onClick={() => setActiveTab('inventory')} className={`mobile-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}>
          <Shirt size={20} />
          <span>Catalog</span>
        </button>

        {role !== 'cashier' && (
          <button onClick={() => setActiveTab('reports')} className={`mobile-nav-item ${activeTab === 'reports' ? 'active' : ''}`}>
            <BarChart3 size={20} />
            <span>Reports</span>
          </button>
        )}

        <button onClick={() => setActiveTab('alerts')} className={`mobile-nav-item ${activeTab === 'alerts' ? 'active' : ''}`} style={{ position: 'relative' }}>
          <AlertCircle size={20} />
          <span>Alerts</span>
          {activeAlertsCount > 0 && (
            <span style={{ position: 'absolute', top: '4px', right: '16px', background: 'var(--danger-color)', color: '#fff', fontSize: '9px', fontWeight: 'bold', minWidth: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
              {activeAlertsCount}
            </span>
          )}
        </button>
      </nav>

      {/* 3. PRIMARY CONTENT AREA */}
      <main className="content-area">
        
        {/* Active Low Stock Alerts Warning Ticker Banner */}
        {activeAlertsCount > 0 && activeTab !== 'alerts' && (
          <div className="alerts-ticker">
            <div className="alerts-ticker-content">
              <AlertTriangle size={18} className="ticker-icon" />
              <span className="alerts-ticker-text">
                Attention! There are {activeAlertsCount} catalog items currently below warning stock thresholds!
              </span>
            </div>
            <span 
              onClick={() => setActiveTab('alerts')} 
              className="alerts-ticker-resolve-link"
            >
              Resolve Alerts →
            </span>
          </div>
        )}

        {/* Tab View 1: Dashboard overview */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade">
            <div className="page-header">
              <div className="page-title-section">
                <h2 className="page-title">Management Console</h2>
                <p className="page-description">Quick statistics and operational indexes overview</p>
              </div>
              <button 
                onClick={fetchDashboardStats} 
                className="btn-secondary" 
                style={{ padding: '12px' }}
                title="Refresh dashboard stats"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Dashboard widgets */}
            <div className="metrics-grid">
              <div className="metric-card bg-glass">
                <div className="metric-header">
                  <span className="metric-title">Gross Revenue</span>
                  <div className="metric-icon-wrapper" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="metric-value text-gold">${parseFloat(dbSalesSummary?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="metric-sub">Across {dbSalesSummary?.total_sales || 0} POS checkout tickets</div>
              </div>

              <div className="metric-card bg-glass">
                <div className="metric-header">
                  <span className="metric-title">Catalog Inventory Size</span>
                  <div className="metric-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    <Shirt size={18} />
                  </div>
                </div>
                <div className="metric-value">{dbStockSummary?.total_units || 0} units</div>
                <div className="metric-sub">Currently registered stock shelf assets</div>
              </div>

              <div className="metric-card bg-glass">
                <div className="metric-header">
                  <span className="metric-title">Warehouse Worth (Retail)</span>
                  <div className="metric-icon-wrapper" style={{ background: 'var(--success-glow)', color: 'var(--success-color)' }}>
                    <Award size={18} />
                  </div>
                </div>
                <div className="metric-value" style={{ color: 'var(--success-color)' }}>
                  ${parseFloat(dbStockSummary?.total_retail_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="metric-sub">Expected sales asset cash conversion</div>
              </div>

              <div className="metric-card bg-glass">
                <div className="metric-header">
                  <span className="metric-title">Active Alert Warnings</span>
                  <div className="metric-icon-wrapper" style={{ background: activeAlertsCount > 0 ? 'var(--danger-glow)' : 'var(--success-glow)', color: activeAlertsCount > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    <AlertCircle size={18} />
                  </div>
                </div>
                <div className="metric-value" style={{ color: activeAlertsCount > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                  {activeAlertsCount} Warning{activeAlertsCount !== 1 ? 's' : ''}
                </div>
                <div className="metric-sub">{activeAlertsCount > 0 ? 'Urgent catalog replenishment required' : 'Product shelf counts healthy'}</div>
              </div>
            </div>

            {/* Quick dashboard operations card info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap', marginTop: '24px' }}>
              <div className="bg-glass" style={{ padding: '24px', borderRadius: '14px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>🚀 Quick POS Checkout Launch</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Need to process a quick checkout or scan tags? Fire up the POS cashier terminal interface optimized for phone cameras.
                </p>
                <button onClick={() => setActiveTab('pos')} className="btn-primary" style={{ fontSize: '13px' }}>
                  Open POS terminal →
                </button>
              </div>

              <div className="bg-glass" style={{ padding: '24px', borderRadius: '14px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>📝 Default Staff Credentials</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  System seed user login parameters for testing other operations:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginTop: '12px' }}>
                  <div>• Role <strong>Owner / Manager</strong>: username <code>admin</code> / password <code>admin123</code></div>
                  <div>• Role <strong>Cashier</strong>: Add a custom cashier user in the database or via staff CRUD!</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab View 2: POS Cashier checkout with QR scanner support */}
        {activeTab === 'pos' && (
          <div className="animate-fade">
            <div className="page-header">
              <div className="page-title-section">
                <h2 className="page-title">POS Checkout Terminal</h2>
                <p className="page-description">Scan tags using your camera or enter SKUs manually to checkout customers</p>
              </div>
            </div>

            <div className="pos-layout">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. Real Camera QR Scanner Component */}
                <QRScanner 
                  onScanSuccess={handleBarcodeLookup}
                  onScanError={(err) => {}}
                />

                {/* 2. Manual Barcode/SKU Input Fallback */}
                <div className="bg-glass" style={{ padding: '24px', borderRadius: '14px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Manual SKU/Barcode Input</h4>
                  <div className="scanner-manual-fallback">
                    <div style={{ position: 'relative', flexGrow: 1 }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-dim)' }} />
                      <input 
                        type="text" 
                        placeholder="e.g. CLT-20260601-1234"
                        value={skuSearchVal}
                        onChange={(e) => setSkuSearchVal(e.target.value)}
                        style={{ paddingLeft: '36px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleBarcodeLookup(skuSearchVal);
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => handleBarcodeLookup(skuSearchVal)}
                      className="btn-primary"
                    >
                      Lookup SKU
                    </button>
                  </div>

                  {skuSearchError && (
                    <div style={{ color: 'var(--danger-color)', fontSize: '12px', background: 'var(--danger-glow)', padding: '10px 14px', borderRadius: '6px', marginTop: '12px' }}>
                      {skuSearchError}
                    </div>
                  )}

                  <div style={{ marginTop: '16px', background: 'var(--surface-light)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--surface-border)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    💡 <strong>Quick testing tips:</strong> Copy-paste any product SKU (e.g. from the inventory grid tab) into the manual input box and hit Enter to simulate scanning a physical QR label.
                  </div>
                </div>
              </div>

              {/* 3. POS Active Cart Checkout Sidebar panel */}
              <POSCart 
                cart={cart}
                updateQty={updateQty}
                removeFromCart={removeFromCart}
                token={token}
                onCheckoutSuccess={() => {
                  setCart([]);
                  setRefreshAlerts(prev => prev + 1);
                }}
              />
            </div>
          </div>
        )}

        {/* Tab View 3: Inventory catalog grid table */}
        {activeTab === 'inventory' && (
          <ProductList 
            token={token}
            userRole={role}
            addToCart={addToCart}
          />
        )}

        {/* Tab View 4: Reports charts and valuation dashboard */}
        {activeTab === 'reports' && (
          <ReportsView 
            token={token}
            userRole={role}
          />
        )}

        {/* Tab View 5: Alerts details center warning logs */}
        {activeTab === 'alerts' && (
          <AlertsManager 
            token={token}
            userRole={role}
            refreshTrigger={refreshAlerts}
          />
        )}

      </main>
    </div>
  );
}
