import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp, BarChart3, LineChart, PieChart as PieIcon, ShieldAlert, Award } from 'lucide-react';

export default function ReportsView({ token, userRole }) {
  const [salesSummary, setSalesSummary] = useState(null);
  const [stockValuation, setStockValuation] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [returnsSummary, setReturnsSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [summaryRes, valuationRes, topProductsRes, returnsRes] = await Promise.all([
        fetch('/api/reports/sales/summary', { headers }),
        fetch('/api/reports/stock/valuation', { headers }),
        fetch('/api/reports/sales/by-product?limit=7', { headers }),
        fetch('/api/reports/returns/summary', { headers })
      ]);

      if (
        summaryRes.status === 401 ||
        valuationRes.status === 401 ||
        topProductsRes.status === 401 ||
        returnsRes.status === 401
      ) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const summaryData = await summaryRes.json();
      const valuationData = await valuationRes.json();
      const topProductsData = await topProductsRes.json();
      const returnsData = await returnsRes.json();

      if (summaryData.success) setSalesSummary(summaryData.data);
      if (valuationData.success) setStockValuation(valuationData.data);
      if (topProductsData.success) setTopProducts(topProductsData.data);
      if (returnsData.success) setReturnsSummary(returnsData.data);

    } catch (err) {
      console.error('[REPORTS FETCH ERR]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const COLORS = ['#d4af37', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>
        Generating analytical reports & computing inventory valuation...
      </div>
    );
  }

  // Pre-process stock valuation charts
  const valuationChartData = stockValuation?.items?.slice(0, 8).map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    costValue: parseFloat(item.stock_cost_value || 0),
    retailValue: parseFloat(item.stock_retail_value || 0)
  })) || [];

  // Pre-process returns breakdown chart
  const returnsChartData = returnsSummary?.by_reason?.map((item, idx) => ({
    name: item.reason.replace('_', ' ').toUpperCase(),
    value: parseInt(item.count, 10)
  })) || [];

  return (
    <div className="animate-fade">
      <div className="page-header">
        <div className="page-title-section">
          <h2 className="page-title">Analytics & Valuation</h2>
          <p className="page-description">Real-time reports, financial asset valuations and customer behavior audits</p>
        </div>
      </div>

      {/* Sales Summary Widgets */}
      <div className="metrics-grid">
        <div className="metric-card bg-glass animate-fade">
          <div className="metric-header">
            <span className="metric-title">Gross Revenue</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="metric-value text-gold">${parseFloat(salesSummary?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-sub">Accumulated checkout sales value</div>
        </div>

        <div className="metric-card bg-glass animate-fade">
          <div className="metric-header">
            <span className="metric-title">Sales Count</span>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="metric-value">{salesSummary?.total_sales || 0}</div>
          <div className="metric-sub">Total custom checkout transactions</div>
        </div>

        <div className="metric-card bg-glass animate-fade">
          <div className="metric-header">
            <span className="metric-title">Valuation (Retail)</span>
            <div className="metric-icon-wrapper" style={{ background: 'var(--success-glow)', color: 'var(--success-color)' }}>
              <LineChart size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--success-color)' }}>
            ${parseFloat(stockValuation?.summary?.total_retail_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">Total stock retail listing worth</div>
        </div>

        <div className="metric-card bg-glass animate-fade">
          <div className="metric-header">
            <span className="metric-title">Valuation (Cost)</span>
            <div className="metric-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-color)' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--warning-color)' }}>
            ${parseFloat(stockValuation?.summary?.total_cost_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="metric-sub">Capital asset value of {stockValuation?.summary?.total_units || 0} items</div>
        </div>
      </div>

      {/* Charts Layout */}
      <div className="charts-grid">
        {/* 1. Bar Chart: Stock Valuation */}
        <div className="chart-card bg-glass animate-fade">
          <div className="chart-title-section">
            <h3 style={{ fontSize: '15px' }}>Stock Valuation (Cost vs Retail)</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Top 8 high value products</span>
          </div>
          <div className="chart-container-inner">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valuationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="costValue" name="Asset Cost Value ($)" fill="var(--warning-color)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="retailValue" name="Asset Retail Worth ($)" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Area Chart: Top Performing Products */}
        <div className="chart-card bg-glass animate-fade">
          <div className="chart-title-section">
            <h3 style={{ fontSize: '15px' }}>Top Selling Clothing Items</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Units sold leaderboard</span>
          </div>
          <div className="chart-container-inner">
            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', paddingTop: '100px', fontSize: '13px' }}>
                No checkout sale logs logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={topProducts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="sku" stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="total_sold" name="Quantity Sold" stroke="var(--success-color)" fill="var(--success-glow)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 3. Pie Chart: Returns reasons */}
        <div className="chart-card bg-glass animate-fade" style={{ height: '360px' }}>
          <div className="chart-title-section">
            <h3 style={{ fontSize: '15px' }}>Product Return Reasons</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Total returns logged: {returnsSummary?.summary?.total_returns || 0}</span>
          </div>
          <div className="chart-container-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {returnsChartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                No customer returns recorded.
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '60%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={returnsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {returnsChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  {returnsChartData.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: COLORS[index % COLORS.length] }} />
                      <span style={{ fontWeight: '500' }}>{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Mini list: Returns conditions breakdown */}
        <div className="chart-card bg-glass animate-fade" style={{ height: '360px' }}>
          <div className="chart-title-section">
            <h3 style={{ fontSize: '15px' }}>Stock Return Quality Audit</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Returned clothing quality logs</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', overflowY: 'auto' }}>
            {returnsSummary?.by_condition?.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', paddingTop: '60px', fontSize: '13px' }}>
                No return metrics yet.
              </div>
            ) : (
              returnsSummary?.by_condition?.map((item, idx) => {
                const isGood = item.condition === 'resellable';
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--surface-light)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isGood ? (
                        <div style={{ color: 'var(--success-color)', background: 'var(--success-glow)', padding: '6px', borderRadius: '50%' }}>
                          <Award size={16} />
                        </div>
                      ) : (
                        <div style={{ color: 'var(--danger-color)', background: 'var(--danger-glow)', padding: '6px', borderRadius: '50%' }}>
                          <ShieldAlert size={16} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'capitalize' }}>
                          {item.condition.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {isGood ? 'Auto-restocked to shelf inventory' : 'Logged only, stock discarded'}
                        </div>
                      </div>
                    </div>
                    <span className="mono" style={{ fontWeight: '800', fontSize: '16px' }}>{item.count} items</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
