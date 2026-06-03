import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function AlertsManager({ token, userRole, refreshTrigger }) {
  const [alerts, setAlerts] = useState([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const endpoint = showResolved ? '/api/alerts/all' : '/api/alerts';
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (data.success) {
        setAlerts(data.data);
      }
    } catch (err) {
      console.error('[ALERTS FETCH ERR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [showResolved, refreshTrigger, token]);

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Resolve failed');
      fetchAlerts();
    } catch (err) {
      alert(err.message);
    }
  };

  const isRestricted = userRole === 'cashier';

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-title-section">
          <h2 className="page-title">Low Stock Alert Center</h2>
          <p className="page-description">Real-time alerts triggered when shelf catalog inventory levels drop at or below configured thresholds</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowResolved(!showResolved)} 
            className="btn-secondary"
          >
            {showResolved ? (
              <>
                <EyeOff size={16} /> Hide Resolved
              </>
            ) : (
              <>
                <Eye size={16} /> Show Resolved Logs
              </>
            )}
          </button>
          <button 
            onClick={fetchAlerts} 
            className="btn-secondary" 
            style={{ padding: '12px' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
            Checking inventory warning logs...
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)', background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '14px' }}>
            <CheckCircle2 size={40} className="text-gold" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
            <h4 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>Shelf Catalog Clear</h4>
            <p style={{ fontSize: '13px' }}>All active product inventory levels are healthy and above warning thresholds.</p>
          </div>
        ) : (
          alerts.map(alertItem => {
            const isRes = alertItem.is_resolved;
            return (
              <div 
                key={alertItem.id} 
                className="animate-fade"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px',
                  background: isRes ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                  border: `1px solid ${isRes ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.18)'}`,
                  borderRadius: '12px',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
                  {isRes ? (
                    <div style={{ color: 'var(--success-color)', background: 'var(--success-glow)', padding: '8px', borderRadius: '50%' }}>
                      <CheckCircle2 size={20} />
                    </div>
                  ) : (
                    <div className="ticker-icon" style={{ color: 'var(--danger-color)', background: 'var(--danger-glow)', padding: '8px', borderRadius: '50%' }}>
                      <AlertCircle size={20} />
                    </div>
                  )}
                  
                  <div>
                    <h4 style={{ fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {alertItem.product_name}
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>[{alertItem.product_sku}]</span>
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>Alert Quantity: <strong className="mono" style={{ color: 'var(--danger-color)' }}>{alertItem.quantity_at_alert}</strong></span>
                      <span>Warning Threshold: <strong className="mono">{alertItem.threshold}</strong></span>
                      <span>Current Inventory: <strong className="mono" style={{ color: isRes ? 'var(--success-color)' : 'var(--danger-color)' }}>{alertItem.current_quantity ?? alertItem.quantity_at_alert}</strong></span>
                    </div>

                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>
                      Triggered: {new Date(alertItem.alerted_at).toLocaleString()}
                      {isRes && alertItem.resolved_at && ` | Resolved: ${new Date(alertItem.resolved_at).toLocaleString()}`}
                    </div>
                  </div>
                </div>

                {!isRes && (
                  <div>
                    {!isRestricted ? (
                      <button
                        onClick={() => handleResolve(alertItem.id)}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '12px', background: 'var(--success-color)', boxShadow: '0 4px 12px var(--success-glow)' }}
                      >
                        Mark Resolved
                      </button>
                    ) : (
                      <span className="badge-ui red" style={{ fontSize: '10px' }}>Manager Action Required</span>
                    )}
                  </div>
                )}
                {isRes && (
                  <span className="badge-ui green" style={{ fontSize: '10px' }}>Resolved</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
