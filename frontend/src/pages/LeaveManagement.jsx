import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  PlusCircle,
  History,
  FileText
} from 'lucide-react';

export default function LeaveManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Employee State
  const [leaveBalance, setLeaveBalance] = useState({ sick: 10, casual: 12, annual: 15 });
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Admin State
  const [pendingRequests, setPendingRequests] = useState([]);
  const [decisionNote, setDecisionNote] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const res = await api.getPendingLeaves();
        setPendingRequests(res.requests || []);
      } else {
        const res = await api.getMyLeaves();
        setMyLeaves(res.requests || []);
        if (res.leaveBalance) setLeaveBalance(res.leaveBalance);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch leave records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const res = await api.submitLeave({ leaveType, startDate, endDate, reason });
      setNotice(res.message);
      setStartDate('');
      setEndDate('');
      setReason('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessingId(id);
    setError('');
    try {
      const res = await api.approveLeave(id, decisionNote || 'Approved by HR Administrator.');
      setNotice(res.message);
      setDecisionNote('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to approve leave request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    setError('');
    try {
      const res = await api.rejectLeave(id, decisionNote || 'Declined due to operational constraints.');
      setNotice(res.message);
      setDecisionNote('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to reject leave request.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
          {isAdmin ? 'HR Leave Management & Approval' : 'Leave Requests & Balance'}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {isAdmin
            ? 'Review employee absence requests. Approved leave days are automatically excluded from anomaly detection.'
            : 'Submit formal leave requests and track administrative decision statuses.'}
        </p>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {!isAdmin ? (
        <>
          {/* Employee Leave Balance Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div className="metric-val">{leaveBalance.sick}</div>
                <div className="metric-lbl">Sick Leave Days</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div className="metric-val">{leaveBalance.casual}</div>
                <div className="metric-lbl">Casual Leave Days</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Calendar size={22} />
              </div>
              <div>
                <div className="metric-val">{leaveBalance.annual}</div>
                <div className="metric-lbl">Annual / Privilege Days</div>
              </div>
            </div>
          </div>

          {/* Employee Apply Form & My History */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {/* Form */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <PlusCircle size={18} color="#2563eb" />
                  <span>Submit Leave Request</span>
                </span>
              </div>

              <form onSubmit={handleApplyLeave}>
                <div className="form-group">
                  <label className="form-label">Leave Category</label>
                  <select
                    className="form-select"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    required
                  >
                    <option value="sick">Sick Leave ({leaveBalance.sick} days left)</option>
                    <option value="casual">Casual Leave ({leaveBalance.casual} days left)</option>
                    <option value="annual">Annual Leave ({leaveBalance.annual} days left)</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Absence</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide a clear reason for your leave request..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                  disabled={submitting}
                >
                  <Send size={16} />
                  <span>{submitting ? 'Submitting...' : 'Apply for Leave'}</span>
                </button>
              </form>
            </div>

            {/* My Requests List */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <History size={18} color="#64748b" />
                  <span>My Leave Applications</span>
                </span>
                <span className="badge badge-neutral">{myLeaves.length} Requests</span>
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {myLeaves.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                    No leave requests submitted yet.
                  </div>
                ) : (
                  myLeaves.map((item) => (
                    <div
                      key={item._id}
                      style={{
                        padding: '0.85rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        marginBottom: '0.75rem',
                        background: '#f8fafc'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.82rem', color: '#1e293b' }}>
                          {item.leaveType} Leave ({item.daysCount} days)
                        </span>
                        <span className={`badge ${
                          item.status === 'approved' ? 'badge-success' :
                          item.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.3rem' }}>
                        Period: {new Date(item.startDate).toLocaleDateString()} to {new Date(item.endDate).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                        Reason: {item.reason}
                      </div>
                      {item.decisionNote && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#0369a1', background: '#e0f2fe', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                          <strong>Admin Note:</strong> {item.decisionNote}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Admin Pending Approvals View */
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Calendar size={18} color="#2563eb" />
              <span>Pending Leave Applications ({pendingRequests.length})</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Approved leaves automatically exclude employee absence from anomaly flags.
            </span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type & Duration</th>
                  <th>Date Range</th>
                  <th>Reason</th>
                  <th>Current Balance</th>
                  <th>Decision Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      No pending leave requests awaiting approval. All clear!
                    </td>
                  </tr>
                ) : (
                  pendingRequests.map((req) => (
                    <tr key={req._id}>
                      <td>
                        <strong>{req.employee?.name || req.employeeId}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{req.employeeId} ({req.employee?.department || 'Operations'})</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{req.leaveType}</span>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>{req.daysCount} Day(s)</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        <div style={{ fontSize: '0.82rem', color: '#334155' }}>{req.reason}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                          Sick: {req.employee?.leaveBalance?.sick ?? '-'} | Cas: {req.employee?.leaveBalance?.casual ?? '-'} | Ann: {req.employee?.leaveBalance?.annual ?? '-'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-success btn-sm"
                            disabled={processingId === req._id}
                            onClick={() => handleApprove(req._id)}
                          >
                            <CheckCircle2 size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={processingId === req._id}
                            onClick={() => handleReject(req._id)}
                          >
                            <XCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
