import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Users,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  Eye
} from 'lucide-react';

export default function PlatformDashboard() {
  const [workplaces, setWorkplaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWp, setSelectedWp] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);
      setError('');
      const [sumRes, wpRes] = await Promise.all([
        api.getPlatformDashboardSummary().catch(() => ({ summary: {} })),
        api.getPlatformAllWorkplaces({
          status: statusFilter || undefined,
          search: searchQuery || undefined
        })
      ]);

      if (sumRes.success) {
        setSummary(sumRes.summary);
      }
      if (wpRes.success) {
        setWorkplaces(wpRes.workplaces || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load platform administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPlatformData();
  };

  const handleReviewAction = async (workplaceId, newStatus) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await api.reviewPlatformWorkplace(workplaceId, newStatus, reviewNotes);
      if (res.success) {
        setSuccessMsg(`Workplace "${res.workplace?.name}" marked as ${newStatus.toUpperCase()}.`);
        setSelectedWp(null);
        setReviewNotes('');
        await fetchPlatformData();
      }
    } catch (err) {
      setError(err.message || `Failed to update workplace status.`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>Platform SuperAdmin</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Multi-Tenant Governance</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
            Workplace Management & Moderation
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            Review new workplace registrations, monitor active tenant organizations, and govern platform security.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchPlatformData}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Platform Aggregate Metrics */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Workplaces</span>
              <Building2 size={20} color="#2563eb" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '0.5rem' }}>
              {summary.totalWorkplaces || 0}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>Registered organizations</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>Pending Review</span>
              <Clock size={20} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '0.5rem' }}>
              {summary.pendingWorkplaces || 0}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.2rem' }}>Awaiting registration approval</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>Approved Active</span>
              <CheckCircle2 size={20} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '0.5rem' }}>
              {summary.approvedWorkplaces || 0}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.2rem' }}>Operational geofences</div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4338ca', textTransform: 'uppercase' }}>Total Users</span>
              <Users size={20} color="#6366f1" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5', marginTop: '0.5rem' }}>
              {summary.totalUsers || 0}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4338ca', marginTop: '0.2rem' }}>Platform accounts</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              placeholder="Search workplace, company or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter size={16} color="#64748b" />
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '150px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Verification Status</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved & Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {(statusFilter || searchQuery) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setStatusFilter('');
                  setSearchQuery('');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Workplace List / Moderation Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
          Registered Workplaces ({workplaces.length})
        </h3>

        {workplaces.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <Building2 size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <div style={{ fontWeight: 600 }}>No workplaces found</div>
            <div style={{ fontSize: '0.85rem' }}>Try adjusting your search criteria or filter status.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
                  <th style={{ padding: '0.75rem' }}>Workplace</th>
                  <th style={{ padding: '0.75rem' }}>Category & Location</th>
                  <th style={{ padding: '0.75rem' }}>Workplace Admin</th>
                  <th style={{ padding: '0.75rem' }}>Geofence</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workplaces.map((wp) => {
                  const isPending = wp.verificationStatus === 'pending';
                  const isApproved = wp.verificationStatus === 'approved';
                  const isSuspended = wp.verificationStatus === 'suspended';

                  return (
                    <tr key={wp._id || wp.workplaceId} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{wp.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          ID: <code style={{ color: '#2563eb' }}>{wp.workplaceId}</code>
                          {wp.organizationName && ` • ${wp.organizationName}`}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                          {wp.category || 'Office'}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <MapPin size={12} color="#64748b" />
                          <span>{wp.address?.city || 'Unknown'}, {wp.address?.state || wp.address?.country || 'India'}</span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {wp.adminDetails?.name || wp.adminEmployeeId || 'Assigned Admin'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {wp.adminDetails?.email || wp.contactEmail || ''}
                        </div>
                        {wp.contactPhone && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            📱 {wp.contactPhone}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                          <MapPin size={12} color="#2563eb" />
                          <span>Radius: <strong>{wp.geofence?.radius || 50}m</strong></span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                          [{Number(wp.geofence?.center?.latitude || 0).toFixed(4)}, {Number(wp.geofence?.center?.longitude || 0).toFixed(4)}]
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        {isPending && (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> Active
                          </span>
                        )}
                        {isSuspended && (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={12} /> Suspended
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Inspect details"
                            onClick={() => setSelectedWp(wp)}
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </button>

                          {isPending && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ background: '#10b981', borderColor: '#059669' }}
                                onClick={() => handleReviewAction(wp.workplaceId, 'approved')}
                                disabled={actionLoading}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleReviewAction(wp.workplaceId, 'suspended')}
                                disabled={actionLoading}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleReviewAction(wp.workplaceId, 'suspended')}
                              disabled={actionLoading}
                            >
                              Suspend
                            </button>
                          )}

                          {isSuspended && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#10b981', borderColor: '#059669' }}
                              onClick={() => handleReviewAction(wp.workplaceId, 'approved')}
                              disabled={actionLoading}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Workplace Detail & Review Modal */}
      {selectedWp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                  {selectedWp.category || 'General'}
                </span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0.3rem 0' }}>
                  {selectedWp.name}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  ID: <code style={{ color: '#2563eb' }}>{selectedWp.workplaceId}</code>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedWp(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Organization</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedWp.organizationName || 'N/A'}</div>
                <div style={{ color: '#64748b' }}>Registration: {selectedWp.registrationNumber || 'Not specified'}</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Shift Window</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedWp.shiftSchedule?.shiftStart || '09:00'} — {selectedWp.shiftSchedule?.shiftEnd || '18:00'}
                </div>
                <div style={{ color: '#64748b' }}>Timezone: {selectedWp.shiftSchedule?.timezone || 'Asia/Kolkata'}</div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Full Address</div>
                <div style={{ color: '#0f172a' }}>{selectedWp.address?.street || 'Site address'}</div>
                <div style={{ color: '#64748b' }}>
                  {selectedWp.address?.city}, {selectedWp.address?.state} {selectedWp.address?.postalCode}
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Workplace Admin</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {selectedWp.adminDetails?.name || selectedWp.adminEmployeeId}
                </div>
                <div style={{ color: '#64748b' }}>{selectedWp.adminDetails?.email || selectedWp.contactEmail}</div>
                {selectedWp.contactPhone && <div style={{ color: '#64748b' }}>📱 {selectedWp.contactPhone}</div>}
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: '0.25rem' }}>Geofence Boundaries</div>
              <div>Center: Latitude {selectedWp.geofence?.center?.latitude}, Longitude {selectedWp.geofence?.center?.longitude}</div>
              <div>Radius: <strong>{selectedWp.geofence?.radius || 50} metres</strong></div>
              <div>Location Name: {selectedWp.geofence?.locationName || 'Designated Office Site'}</div>
            </div>

            {/* Admin Decision Actions */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>Review / Decision Notes (Optional)</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Enter justification or remarks..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                style={{ marginBottom: '1rem' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {selectedWp.verificationStatus !== 'approved' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#10b981', borderColor: '#059669' }}
                    onClick={() => handleReviewAction(selectedWp.workplaceId, 'approved')}
                    disabled={actionLoading}
                  >
                    ✓ Approve Workplace
                  </button>
                )}

                {selectedWp.verificationStatus !== 'suspended' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleReviewAction(selectedWp.workplaceId, 'suspended')}
                    disabled={actionLoading}
                  >
                    ✕ Suspend Workplace
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
