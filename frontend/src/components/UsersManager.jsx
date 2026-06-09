import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, RefreshCw, X, KeyRound, UserX, UserCheck, Copy, Check } from 'lucide-react';

const ROLE_LABELS = {
  owner: 'Owner',
  cashier: 'Cashier',
  sales: 'Sales',
};

const ROLE_DESCRIPTIONS = {
  owner: 'Full access + staff management',
  cashier: 'Dashboard, reports, inventory management',
  sales: 'POS checkout, catalog lookup, alerts',
};

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function UsersManager({ token, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(null);
  const [showResetModal, setShowResetModal] = useState(null);

  const [createForm, setCreateForm] = useState({
    full_name: '',
    username: '',
    password: '',
    role: 'sales',
  });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [copiedField, setCopiedField] = useState('');

  const showToast = (message) => {
    setToast({ show: true, message });
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to fetch staff');

      setUsers(data.data);
    } catch (err) {
      console.error('[FETCH USERS ERR]', err);
      setError(err.message || 'Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.full_name.trim()) {
      setCreateError('Full name is required');
      return;
    }
    if (!createForm.username.trim()) {
      setCreateError('Username is required');
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: createForm.full_name.trim(),
          username: createForm.username.trim(),
          password: createForm.password,
          role: createForm.role,
        }),
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) {
        if (data.errors?.length) {
          throw new Error(data.errors.map((e) => e.msg).join(', '));
        }
        throw new Error(data.message || 'Failed to create user');
      }

      setShowCreateModal(false);
      setShowCredentialsModal({
        full_name: createForm.full_name.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
      });
      setCreateForm({ full_name: '', username: '', password: '', role: 'sales' });
      fetchUsers();
      showToast('Staff member created successfully');
    } catch (err) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');

    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(`/api/users/${showResetModal.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: resetPassword }),
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) {
        if (data.errors?.length) {
          throw new Error(data.errors.map((e) => e.msg).join(', '));
        }
        throw new Error(data.message || 'Failed to reset password');
      }

      setShowResetModal(null);
      setResetPassword('');
      showToast('Password updated — share the new password with the user');
    } catch (err) {
      setResetError(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate "${user.full_name}" (${user.username})? They will no longer be able to log in.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to deactivate user');

      fetchUsers();
      showToast(`${user.full_name} has been deactivated`);
    } catch (err) {
      showToast(err.message || 'Failed to deactivate user');
    }
  };

  const handleReactivate = async (user) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: true }),
      });

      if (res.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to reactivate user');

      fetchUsers();
      showToast(`${user.full_name} has been reactivated`);
    } catch (err) {
      showToast(err.message || 'Failed to reactivate user');
    }
  };

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      showToast('Could not copy to clipboard');
    }
  };

  return (
    <div className="animate-fade">
      <div className="page-header page-header-actions">
        <div className="page-title-section">
          <h2 className="page-title">Staff Management</h2>
          <p className="page-description">
            Create staff accounts, assign roles, and manage login credentials
          </p>
        </div>
        <div className="header-actions stack-on-mobile">
          <button onClick={fetchUsers} className="btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setShowCreateModal(true); setCreateError(''); }} className="btn-primary">
            <Plus size={16} /> Create User
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger-color)', fontSize: '13px', background: 'var(--danger-glow)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="premium-table-card user-table-desktop">
        <div className="premium-table-scroll">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading staff...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No staff members yet. Create your first user to get started.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={!u.is_active ? 'staff-row-inactive' : ''}>
                    <td>{u.full_name}</td>
                    <td><code>{u.username}</code></td>
                    <td>
                      <span className={`role-badge role-badge-${u.role}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                      <div className="role-badge-desc">{ROLE_DESCRIPTIONS[u.role]}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'status-active' : 'status-inactive'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {formatDate(u.last_login)}
                    </td>
                    <td>
                      <div className="staff-actions">
                        {u.is_active && (
                          <>
                            <button
                              className="staff-action-btn"
                              title="Reset password"
                              onClick={() => {
                                setShowResetModal(u);
                                setResetPassword('');
                                setResetError('');
                              }}
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              className="staff-action-btn staff-action-danger"
                              title={u.id === currentUserId ? 'Cannot deactivate your own account' : 'Deactivate user'}
                              disabled={u.id === currentUserId}
                              onClick={() => handleDeactivate(u)}
                            >
                              <UserX size={14} />
                            </button>
                          </>
                        )}
                        {!u.is_active && (
                          <button
                            className="staff-action-btn staff-action-success"
                            title="Reactivate user"
                            onClick={() => handleReactivate(u)}
                          >
                            <UserCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="user-card-list">
        {loading ? (
          <div className="inventory-card-empty">Loading staff...</div>
        ) : users.length === 0 ? (
          <div className="inventory-card-empty">No staff members yet. Create your first user to get started.</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className={`user-card bg-glass ${!u.is_active ? 'user-card-inactive' : ''}`}>
              <div className="user-card-header">
                <div>
                  <div className="user-card-name">{u.full_name}</div>
                  <div className="user-card-username"><code>{u.username}</code></div>
                </div>
                <span className={`status-badge ${u.is_active ? 'status-active' : 'status-inactive'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="user-card-role">
                <span className={`role-badge role-badge-${u.role}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                <span className="role-badge-desc">{ROLE_DESCRIPTIONS[u.role]}</span>
              </div>
              <div className="user-card-login">Last login: {formatDate(u.last_login)}</div>
              <div className="user-card-actions">
                {u.is_active && (
                  <>
                    <button
                      className="btn-secondary inventory-card-btn"
                      onClick={() => {
                        setShowResetModal(u);
                        setResetPassword('');
                        setResetError('');
                      }}
                    >
                      Reset Password
                    </button>
                    <button
                      className="btn-secondary inventory-card-btn inventory-card-btn-danger"
                      disabled={u.id === currentUserId}
                      onClick={() => handleDeactivate(u)}
                    >
                      Deactivate
                    </button>
                  </>
                )}
                {!u.is_active && (
                  <button
                    className="btn-secondary inventory-card-btn"
                    onClick={() => handleReactivate(u)}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Create Staff User</h3>
              <button onClick={() => { setShowCreateModal(false); setCreateError(''); }} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  placeholder="e.g. jsmith"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="text"
                  placeholder="Min. 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="owner">Owner — full access + staff management</option>
                  <option value="cashier">Cashier — dashboard, reports, inventory</option>
                  <option value="sales">Sales — POS checkout only</option>
                </select>
              </div>

              {createError && (
                <div style={{ color: 'var(--danger-color)', fontSize: '13px', background: 'var(--danger-glow)', padding: '10px 14px', borderRadius: '6px' }}>
                  {createError}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Credentials Success Modal */}
      {showCredentialsModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass credentials-panel">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>User Created — Save Credentials</h3>
              <button onClick={() => setShowCredentialsModal(null)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Share these login details with <strong>{showCredentialsModal.full_name}</strong>. The password will not be shown again.
            </p>

            <div className="credentials-fields">
              <div className="credential-row">
                <span className="credential-label">Full Name</span>
                <span className="credential-value">{showCredentialsModal.full_name}</span>
              </div>
              <div className="credential-row">
                <span className="credential-label">Username</span>
                <div className="credential-copy-group">
                  <code className="credential-value">{showCredentialsModal.username}</code>
                  <button
                    type="button"
                    className="credential-copy-btn"
                    onClick={() => copyToClipboard(showCredentialsModal.username, 'username')}
                  >
                    {copiedField === 'username' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="credential-row">
                <span className="credential-label">Password</span>
                <div className="credential-copy-group">
                  <code className="credential-value">{showCredentialsModal.password}</code>
                  <button
                    type="button"
                    className="credential-copy-btn"
                    onClick={() => copyToClipboard(showCredentialsModal.password, 'password')}
                  >
                    {copiedField === 'password' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <div className="credential-row">
                <span className="credential-label">Role</span>
                <span className={`role-badge role-badge-${showCredentialsModal.role}`}>
                  {ROLE_LABELS[showCredentialsModal.role]}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="submit-btn"
              style={{ marginTop: '20px' }}
              onClick={() => setShowCredentialsModal(null)}
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Password Modal */}
      {showResetModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content bg-glass">
            <div className="modal-header">
              <h3 style={{ fontSize: '18px' }}>Reset Password</h3>
              <button onClick={() => { setShowResetModal(null); setResetError(''); }} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Set a new password for <strong>{showResetModal.full_name}</strong> ({showResetModal.username})
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="text"
                  placeholder="Min. 6 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {resetError && (
                <div style={{ color: 'var(--danger-color)', fontSize: '13px', background: 'var(--danger-glow)', padding: '10px 14px', borderRadius: '6px' }}>
                  {resetError}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isResetting}>
                {isResetting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {toast.show && (
        <div className="custom-toast bg-glass animate-fade">
          <span className="toast-icon">✓</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
