import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Send,
  ArrowRight,
  ShieldAlert,
  Users
} from 'lucide-react';

export default function WorkplaceSelection({ onNavigateToPortal }) {
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [workplaces, setWorkplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Request to join modal
  const [selectedWp, setSelectedWp] = useState(null);
  const [employeeBadgeId, setEmployeeBadgeId] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStatusAndWorkplaces = async () => {
    try {
      setLoading(true);
      setError('');
      const [statusRes, wpRes] = await Promise.all([
        api.getMyMembershipStatus().catch(() => ({ hasActiveWorkplace: false })),
        api.getPublicWorkplaces({
          search: searchQuery || undefined,
          category: categoryFilter || undefined
        })
      ]);

      setMembershipStatus(statusRes);
      if (wpRes.success) {
        setWorkplaces(wpRes.workplaces || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load workplaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndWorkplaces();
  }, [categoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStatusAndWorkplaces();
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWp) return;

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');
      const res = await api.requestMembership(selectedWp.workplaceId, joinNote);
      if (res.success) {
        setSuccessMsg(res.message || `Join request sent to ${selectedWp.name}.`);
        setSelectedWp(null);
        setJoinNote('');
        setEmployeeBadgeId('');
        await fetchStatusAndWorkplaces();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit join request.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasApprovedWorkplace = membershipStatus?.hasActiveWorkplace && membershipStatus?.membership?.status === 'approved';
  const hasPendingRequest = membershipStatus?.membership?.status === 'pending';
  const isRejected = membershipStatus?.membership?.status === 'rejected';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Workplace Membership & Organization Selection
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
          Connect your employee account to your assigned organization or branch to enable geofenced attendance.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SECTION: Current Membership Status Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Your Workplace Status
        </h3>

        {hasApprovedWorkplace ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={13} /> Active Workplace Member
                </span>
                <span style={{ fontSize: '0.8rem', color: '#166534' }}>
                  Approved on {new Date(membershipStatus.membership.approvedAt).toLocaleDateString()}
                </span>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0.4rem 0 0.2rem 0' }}>
                {membershipStatus.workplace?.name}
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>ID: <code style={{ color: '#2563eb' }}>{membershipStatus.workplace?.workplaceId}</code></span>
                <span>•</span>
                <span>{membershipStatus.workplace?.address?.city}, {membershipStatus.workplace?.address?.state}</span>
                <span>•</span>
                <span>Geofence Radius: <strong>{membershipStatus.workplace?.geofence?.radius || 50}m</strong></span>
              </div>
            </div>

            {onNavigateToPortal && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onNavigateToPortal}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>Go to GPS Check-In</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : hasPendingRequest ? (
          <div style={{ padding: '1.25rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={13} /> Request Under Review
              </span>
              <span style={{ fontSize: '0.8rem', color: '#92400e' }}>
                Submitted on {new Date(membershipStatus.membership.joinRequestedAt).toLocaleDateString()}
              </span>
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#78350f', margin: '0.25rem 0' }}>
              Applied to: {membershipStatus.workplace?.name || membershipStatus.membership.workplaceId}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#92400e', margin: '0.25rem 0 0 0' }}>
              Your membership application is currently in the workplace administrator's queue. You will be able to bind your phone and record attendance once approved.
            </p>
          </div>
        ) : isRejected ? (
          <div style={{ padding: '1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <XCircle size={13} /> Membership Request Declined
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#991b1b', margin: '0.25rem 0 0 0' }}>
              Your recent join request was declined by the workplace administrator. Please browse the directory below to apply to the correct workplace.
            </p>
          </div>
        ) : (
          <div style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
            <Building2 size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 700, color: '#1e293b' }}>No Workplace Assigned</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
              Search below for your company or institution and submit a membership request.
            </div>
          </div>
        )}
      </div>

      {/* SECTION: Workplace Directory Browser */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Available Approved Workplaces ({workplaces.length})
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
              Select your registered organization to request membership.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '9px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '1.8rem', fontSize: '0.85rem', width: '200px' }}
                placeholder="Search by name or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary btn-sm">
              Search
            </button>
          </form>
        </div>

        {/* Directory Grid */}
        {workplaces.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
            <Building2 size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <div>No approved workplaces found matching your query.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
            {workplaces.map((wp) => {
              const isCurrentWp = membershipStatus?.membership?.workplaceId === wp.workplaceId;

              return (
                <div
                  key={wp.workplaceId}
                  style={{
                    border: isCurrentWp ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                        {wp.category || 'Office'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                        {wp.workplaceId}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>
                      {wp.name}
                    </h4>

                    {wp.organizationName && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        {wp.organizationName}
                      </div>
                    )}

                    <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} color="#64748b" />
                      <span>{wp.address?.city || 'City'}, {wp.address?.state || 'State'}</span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} color="#64748b" />
                      <span>Shift: {wp.shiftSchedule?.shiftStart || '09:00'} - {wp.shiftSchedule?.shiftEnd || '18:00'}</span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                      Geofence Radius: <strong>{wp.geofence?.radius || 50} metres</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    {isCurrentWp ? (
                      <div style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: hasApprovedWorkplace ? '#166534' : '#b45309' }}>
                        {hasApprovedWorkplace ? '✓ Your Current Workplace' : '⏳ Application Pending'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => setSelectedWp(wp)}
                        disabled={hasPendingRequest}
                      >
                        <Send size={13} />
                        <span>Request to Join</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Join Request Modal */}
      {selectedWp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.3rem' }}>
              Request to Join {selectedWp.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Your application will be sent to the workplace administrator for verification.
            </p>

            <form onSubmit={handleJoinSubmit}>
              <div className="form-group">
                <label className="form-label">Note to Administrator (Optional)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Hi, I am joining as a Senior Developer in the Engineering team."
                  value={joinNote}
                  onChange={(e) => setJoinNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedWp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Send Join Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
