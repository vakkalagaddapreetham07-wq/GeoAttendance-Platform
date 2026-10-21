import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  Phone,
  Mail,
  ShieldAlert
} from 'lucide-react';

export default function MembershipRequests() {
  const [activeTab, setActiveTab] = useState('pending'); // pending or roster
  const [pendingList, setPendingList] = useState([]);
  const [rosterList, setRosterList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Review modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [assignedEmpId, setAssignedEmpId] = useState('');

  const fetchMemberships = async () => {
    try {
      setLoading(true);
      setError('');
      const [pendingRes, membersRes] = await Promise.all([
        api.getPendingMemberships(),
        api.getWorkplaceMembers()
      ]);

      if (pendingRes.success) {
        setPendingList(pendingRes.pending || []);
      }
      if (membersRes.success) {
        setRosterList(membersRes.members || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load membership requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await api.approveMembership(id, decisionNotes, assignedEmpId);
      if (res.success) {
        setSuccessMsg(res.message || 'Employee join request approved.');
        setSelectedReq(null);
        setDecisionNotes('');
        setAssignedEmpId('');
        await fetchMemberships();
      }
    } catch (err) {
      setError(err.message || 'Failed to approve membership.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await api.rejectMembership(id, decisionNotes);
      if (res.success) {
        setSuccessMsg(res.message || 'Employee join request rejected.');
        setSelectedReq(null);
        setDecisionNotes('');
        await fetchMemberships();
      }
    } catch (err) {
      setError(err.message || 'Failed to reject membership.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await api.updateMemberStatus(id, status);
      if (res.success) {
        setSuccessMsg(`Member status updated to ${status}.`);
        await fetchMemberships();
      }
    } catch (err) {
      setError(err.message || 'Failed to update member status.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Workplace Employee Membership Management
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Verify employee identity, approve incoming joining requests, and manage active workplace personnel.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchMemberships}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`nav-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: activeTab === 'pending' ? '2px solid #2563eb' : 'none', marginBottom: '-2px' }}
        >
          <Clock size={16} />
          <span>Pending Join Requests</span>
          {pendingList.length > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`nav-btn ${activeTab === 'roster' ? 'active' : ''}`}
          onClick={() => setActiveTab('roster')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: activeTab === 'roster' ? '2px solid #2563eb' : 'none', marginBottom: '-2px' }}
        >
          <Users size={16} />
          <span>Approved Roster ({rosterList.length})</span>
        </button>
      </div>

      {/* TAB 1: Pending Join Requests */}
      {activeTab === 'pending' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
            Pending Verification Requests ({pendingList.length})
          </h3>

          {pendingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <UserCheck size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>No pending employee join requests</div>
              <div style={{ fontSize: '0.85rem' }}>New employee applications to your workplace will appear here.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Employee</th>
                    <th style={{ padding: '0.75rem' }}>Contact & Mobile</th>
                    <th style={{ padding: '0.75rem' }}>Requested On</th>
                    <th style={{ padding: '0.75rem' }}>Application Note</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((req) => (
                    <tr key={req._id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{req.employee?.name || 'Applicant'}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          ID: <code style={{ color: '#2563eb' }}>{req.employeeId}</code>
                          {req.employee?.department && ` • ${req.employee.department}`}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                          <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {req.employee?.email || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                          <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {req.employee?.mobileNumber || 'Not provided'}
                          {req.employee?.isMobileVerified && (
                            <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>
                              OTP Verified
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                        {new Date(req.joinRequestedAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#475569' }}>
                        {req.requestNote || <em style={{ color: '#94a3b8' }}>No note provided</em>}
                      </td>

                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#10b981', borderColor: '#059669' }}
                            onClick={() => handleApprove(req._id)}
                            disabled={actionLoading}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(req._id)}
                            disabled={actionLoading}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Approved Roster */}
      {activeTab === 'roster' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
            Workplace Personnel Directory ({rosterList.length})
          </h3>

          {rosterList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Users size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <div>No approved personnel currently enrolled in this workplace.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontSize: '0.8rem', color: '#64748b' }}>
                    <th style={{ padding: '0.75rem' }}>Member Name</th>
                    <th style={{ padding: '0.75rem' }}>Employee ID</th>
                    <th style={{ padding: '0.75rem' }}>Contact Email & Phone</th>
                    <th style={{ padding: '0.75rem' }}>Approved Date</th>
                    <th style={{ padding: '0.75rem' }}>Membership Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterList.map((mem) => {
                    const isSuspended = mem.status === 'suspended';

                    return (
                      <tr key={mem._id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{mem.employee?.name || 'Member'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{mem.employee?.department || 'Staff'}</div>
                        </td>

                        <td style={{ padding: '0.75rem' }}>
                          <code style={{ color: '#2563eb', fontWeight: 600 }}>{mem.employeeId}</code>
                        </td>

                        <td style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#475569' }}>
                          <div>{mem.employee?.email || 'N/A'}</div>
                          {mem.employee?.mobileNumber && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📱 {mem.employee.mobileNumber}</div>
                          )}
                        </td>

                        <td style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                          {mem.approvedAt ? new Date(mem.approvedAt).toLocaleDateString() : 'N/A'}
                        </td>

                        <td style={{ padding: '0.75rem' }}>
                          {isSuspended ? (
                            <span className="badge badge-danger">Suspended</span>
                          ) : (
                            <span className="badge badge-success">Active Member</span>
                          )}
                        </td>

                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                          {isSuspended ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatusChange(mem._id, 'approved')}
                              disabled={actionLoading}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#ef4444' }}
                              onClick={() => handleStatusChange(mem._id, 'suspended')}
                              disabled={actionLoading}
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
