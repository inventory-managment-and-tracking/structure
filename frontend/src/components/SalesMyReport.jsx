import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Calendar, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { formatBirr } from '../utils/formatBirr';

function DiscountBadge() {
  return (
    <span className="discount-sale-badge" title="Sold below catalog price">
      ↓ Discounted
    </span>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDisplayRange(from, to) {
  if (!from || !to) return '';
  const fromLabel = new Date(`${from}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const toLabel = new Date(`${to}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return from === to ? fromLabel : `${fromLabel} — ${toLabel}`;
}

function toDateInput(date) {
  return date.toISOString().split('T')[0];
}

export default function SalesMyReport({ token, user }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [preset, setPreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return toDateInput(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toDateInput(new Date()));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFrom) query.append('date_from', dateFrom);
      if (dateTo) query.append('date_to', dateTo);

      const res = await fetch(`/api/reports/sales/my-report?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
        setExpandedId(null);
      }
    } catch (err) {
      console.error('[MY REPORT ERR]', err);
    } finally {
      setLoading(false);
    }
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePresetChange = (selected) => {
    setPreset(selected);
    const end = new Date();
    const start = new Date();

    if (selected === 'today') {
      setDateFrom(toDateInput(end));
      setDateTo(toDateInput(end));
      return;
    }
    if (selected === 'last_7') {
      start.setDate(end.getDate() - 6);
      setDateFrom(toDateInput(start));
      setDateTo(toDateInput(end));
      return;
    }
    if (selected === 'this_month') {
      setDateFrom(toDateInput(new Date(end.getFullYear(), end.getMonth(), 1)));
      setDateTo(toDateInput(end));
      return;
    }
    if (selected === 'last_month') {
      setDateFrom(toDateInput(new Date(end.getFullYear(), end.getMonth() - 1, 1)));
      setDateTo(toDateInput(new Date(end.getFullYear(), end.getMonth(), 0)));
      return;
    }
  };

  const quickBuckets = [
    {
      key: 'today',
      title: 'Today',
      data: report?.today,
      accent: 'metric-accent-indigo',
      iconClass: 'metric-icon-indigo',
    },
    {
      key: 'this_month',
      title: 'This Month',
      data: report?.this_month,
      accent: 'metric-accent-green',
      iconClass: 'metric-icon-green',
    },
    {
      key: 'last_month',
      title: 'Last Month',
      data: report?.last_month,
      accent: 'metric-accent-blue',
      iconClass: 'metric-icon-blue',
    },
  ];

  const rangeLabel = formatDisplayRange(dateFrom, dateTo);

  return (
    <div className="animate-fade sales-my-report">
      <div className="page-header page-header-actions">
        <div className="page-title-section">
          <h2 className="page-title">My Sales</h2>
          <p className="page-description">
            Your personal sales performance — only your checkout tickets are shown here.
          </p>
        </div>
        <button
          onClick={fetchReport}
          className="btn-secondary"
          style={{ padding: '12px', borderRadius: '8px' }}
          title="Refresh my sales"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="sales-my-welcome bg-glass">
        <div>
          <h3 className="sales-my-greeting">Hello, {user?.full_name?.split(' ')[0] || 'Sales'}</h3>
          <p className="sales-my-subtitle">Pick a day or date range below to see how many sales you made.</p>
        </div>
        <Calendar size={28} style={{ color: 'var(--primary-color)', opacity: 0.7 }} />
      </div>

      <div className="inventory-filters-panel reports-filter-grid bg-glass sales-my-filters">
        <div className="reports-filter-field">
          <label className="form-label" style={{ margin: 0 }}>Quick Range</label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            style={{ background: 'var(--surface-color)' }}
          >
            <option value="today">Today</option>
            <option value="last_7">Last 7 Days</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div className="reports-filter-field">
          <label className="form-label" style={{ margin: 0 }}>From Date</label>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPreset('custom');
            }}
            style={{ background: 'var(--surface-color)' }}
          />
        </div>

        <div className="reports-filter-field">
          <label className="form-label" style={{ margin: 0 }}>To Date</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPreset('custom');
            }}
            style={{ background: 'var(--surface-color)' }}
          />
        </div>
      </div>

      {loading && !report ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
          Loading your sales report...
        </div>
      ) : (
        <>
          <div className="metrics-grid sales-my-metrics">
            {quickBuckets.map((bucket) => (
              <div key={bucket.key} className={`metric-card bg-glass metric-card-enhanced ${bucket.accent}`}>
                <div className="metric-header">
                  <span className="metric-title">{bucket.title}</span>
                  <div className={`metric-icon-wrapper metric-icon-square ${bucket.iconClass}`}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div className="metric-value text-gold">{formatBirr(bucket.data?.total_revenue || 0)}</div>
                <div className="metric-sub">
                  {bucket.data?.sales_count || 0} sale{(bucket.data?.sales_count || 0) !== 1 ? 's' : ''}
                  {' · '}
                  {bucket.data?.items_sold || 0} item{(bucket.data?.items_sold || 0) !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="metric-card bg-glass metric-card-enhanced metric-accent-gold sales-my-range-card">
            <div className="metric-header">
              <span className="metric-title">Selected Period</span>
              <div className="metric-icon-wrapper metric-icon-square metric-icon-gold">
                <Calendar size={18} />
              </div>
            </div>
            <div className="metric-value text-gold">{formatBirr(report?.range_summary?.total_revenue || 0)}</div>
            <div className="metric-sub">
              {rangeLabel || 'Select dates above'}
              {' · '}
              {report?.range_summary?.sales_count || 0} sale{(report?.range_summary?.sales_count || 0) !== 1 ? 's' : ''}
              {' · '}
              {report?.range_summary?.items_sold || 0} item{(report?.range_summary?.items_sold || 0) !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="bg-glass sales-my-history">
            <h3 className="sales-my-history-title">
              Sales History
              {rangeLabel && (
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)', marginLeft: '8px' }}>
                  ({rangeLabel})
                </span>
              )}
            </h3>
            {!report?.recent_sales?.length ? (
              <p className="sales-my-empty">
                No sales recorded for this period. Try a different date range or complete a checkout.
              </p>
            ) : (
              <div className="sales-my-list">
                {report.recent_sales.map((sale) => {
                  const isOpen = expandedId === sale.sale_id;
                  return (
                    <div key={sale.sale_id} className="sales-my-item">
                      <button
                        type="button"
                        className="sales-my-row"
                        onClick={() => setExpandedId(isOpen ? null : sale.sale_id)}
                        aria-expanded={isOpen}
                      >
                        <span className="daily-staff-chevron">
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </span>
                        <div className="sales-my-row-main">
                          <span className="mono" style={{ fontSize: '12px' }}>{sale.sale_code}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {formatDate(sale.created_at)} · {formatTime(sale.created_at)}
                          </span>
                        </div>
                        <span className="sales-my-row-total">{formatBirr(sale.total_amount)}</span>
                      </button>

                      {isOpen && (
                        <div className="sales-my-detail">
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="daily-staff-line">
                              <span className="daily-staff-line-name">
                                {item.product_name}
                                <span className="daily-staff-line-sku">({item.product_sku})</span>
                                {item.is_discounted && <DiscountBadge />}
                              </span>
                              <span className="daily-staff-line-qty">x{item.quantity}</span>
                              <span className="daily-staff-line-amount">{formatBirr(item.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
