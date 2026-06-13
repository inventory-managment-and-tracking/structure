import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Users, RefreshCw } from 'lucide-react';
import { formatBirr } from '../utils/formatBirr';
import DatePickerFields from './DatePickerFields';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DailyStaffReport({ token }) {
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchDailyStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/sales/daily-staff?date=${dailyDate}`, {
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
      console.error('[DAILY STAFF REPORT ERR]', err);
    } finally {
      setLoading(false);
    }
  }, [token, dailyDate]);

  useEffect(() => {
    fetchDailyStaff();
  }, [fetchDailyStaff]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const staff = report?.staff || [];

  return (
    <div className="daily-staff-report bg-glass no-print">
      <div className="daily-staff-header">
        <div>
          <h3 className="daily-staff-title">
            <Users size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Daily Staff Activity
          </h3>
          <p className="daily-staff-subtitle">
            Showing sales &amp; returns for: {formatDisplayDate(dailyDate)}
          </p>
        </div>
        <div className="daily-staff-controls">
          <div className="daily-staff-date-field">
            <DatePickerFields
              label="Select Date"
              idPrefix="daily-staff-date"
              value={dailyDate}
              onChange={setDailyDate}
            />
          </div>
          <button
            onClick={fetchDailyStaff}
            className="btn-secondary"
            style={{ padding: '12px', borderRadius: '8px', alignSelf: 'flex-end' }}
            title="Reload daily staff report"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="daily-staff-empty">Loading daily staff activity...</div>
      ) : staff.length === 0 ? (
        <div className="daily-staff-empty">
          No sales or returns recorded on {formatDisplayDate(dailyDate)}.
        </div>
      ) : (
        <div className="daily-staff-list">
          {staff.map((person) => {
            const isOpen = expandedId === person.id;
            return (
              <div key={person.id} className="daily-staff-item">
                <button
                  type="button"
                  className="daily-staff-row"
                  onClick={() => toggleExpand(person.id)}
                  aria-expanded={isOpen}
                >
                  <span className="daily-staff-chevron">
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span className="daily-staff-name">{person.full_name}</span>
                  <span className="daily-staff-badges">
                    {person.sales_count > 0 && (
                      <span className="daily-staff-badge">
                        {person.sales_count} sale{person.sales_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {person.items_sold > 0 && (
                      <span className="daily-staff-badge">
                        {person.items_sold} item{person.items_sold !== 1 ? 's' : ''}
                      </span>
                    )}
                    {parseFloat(person.total_revenue) > 0 && (
                      <span className="daily-staff-badge daily-staff-badge-revenue">
                        {formatBirr(person.total_revenue)}
                      </span>
                    )}
                    {person.returns_count > 0 && (
                      <span className="daily-staff-badge daily-staff-badge-return">
                        {person.returns_count} return{person.returns_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="daily-staff-detail">
                    {person.sales.length > 0 && (
                      <div className="daily-staff-section">
                        <div className="daily-staff-section-label">Sales</div>
                        {person.sales.map((sale) => (
                          <div key={sale.sale_id} className="daily-staff-sale-group">
                            <div className="daily-staff-sale-header">
                              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {sale.sale_code}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                {formatTime(sale.created_at)}
                              </span>
                            </div>
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="daily-staff-line">
                                <span className="daily-staff-line-name">
                                  {item.product_name}
                                  <span className="daily-staff-line-sku">({item.product_sku})</span>
                                  {item.is_discounted && (
                                    <span className="discount-sale-badge" title="Sold below catalog price">
                                      ↓ Discounted
                                    </span>
                                  )}
                                </span>
                                <span className="daily-staff-line-qty">x{item.quantity}</span>
                                <span className="daily-staff-line-amount">{formatBirr(item.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="daily-staff-section">
                      <div className="daily-staff-section-label">Returns</div>
                      {person.returns.length === 0 ? (
                        <div className="daily-staff-line-muted">No returns</div>
                      ) : (
                        person.returns.map((ret, idx) => (
                          <div key={idx} className="daily-staff-line daily-staff-line-return">
                            <span className="daily-staff-line-name">
                              {ret.product_name}
                              <span className="daily-staff-line-sku">({ret.product_sku})</span>
                            </span>
                            <span className="daily-staff-line-qty">x{ret.quantity}</span>
                            <span className="daily-staff-line-amount">
                              {ret.refund_amount ? formatBirr(ret.refund_amount) : '—'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
