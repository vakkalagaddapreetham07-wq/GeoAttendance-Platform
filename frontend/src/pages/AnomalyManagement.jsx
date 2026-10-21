import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldAlert,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  Search
} from 'lucide-react';

export default function AnomalyManagement() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState('');
  const [filterReview, setFilterReview] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('reviewed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAnomalies = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterSource) params.detectionSource = filterSource;
      if (filterReview) params.reviewStatus = filterReview;
      if (filterEmployee) params.employeeId = filterEmployee;

      const res = await api.getAnomalyRecords(params);
      setAnomalies(res.anomalies || []);
    } catch (err) {
      setError(err.message || 'Failed to load anomaly records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [filterSource, filterReview]);

  const handleOpenReview = (record) => {
    setSelectedAnomaly(record);
    const curr = (record.anomaly?.reviewStatus || 'pending').toLowerCase();
    setReviewStatus(curr === 'pending' ? 'approved' : curr);
    setReviewNotes(record.anomaly?.reviewNotes || '');
    setReviewModalOpen(true);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!selectedAnomaly) return;
    setModalLoading(true);
    setError('');
    try {
      const res = await api.reviewAnomaly(selectedAnomaly._id, reviewStatus, reviewNotes);
      const normalized = reviewStatus.toLowerCase();

      // Immediately update local state so table badge updates without delay
      setAnomalies((prev) =>
        prev.map((item) =>
          item._id === selectedAnomaly._id
            ? {
                ...item,
                anomaly: {
                  ...item.anomaly,
                  reviewStatus: normalized,
                  reviewNotes: reviewNotes,
                  reviewedBy: res.record?.anomaly?.reviewedBy || item.anomaly?.reviewedBy
                }
              }
            : item
        )
      );

      setSuccessMsg(`Anomaly record for ${selectedAnomaly.employeeId} on ${selectedAnomaly.attendanceDate} marked as ${normalized.toUpperCase()}.`);
      setReviewModalOpen(false);
      setSelectedAnomaly(null);
      await fetchAnomalies();
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
            Attendance Anomaly Detection & Review
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Machine learning isolation forest predictions & deterministic hard-rule violations
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAnomalies}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
            <Sliders size={16} />
            <span>Filters:</span>
          </div>

          <select
            className="form-select"
            style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">All Detection Sources</option>
            <option value="both">Both (ML + Hard Rule)</option>
            <option value="ml_only">ML Isolation Forest Only</option>
            <option value="hard_rule_only">Hard Rule Only</option>
          </select>

          <select
            className="form-select"
            style={{ width: '160px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value)}
          >
            <option value="">All Review Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="resolved">Resolved</option>
            <option value="reviewed">Reviewed</option>
          </select>

          <input
            type="text"
            className="form-input"
            placeholder="Search Employee..."
            style={{ width: '160px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
          />

          <button className="btn btn-primary btn-sm" onClick={fetchAnomalies}>
            <Search size={14} />
            <span>Apply</span>
          </button>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <ShieldAlert size={18} color="#ef4444" />
            <span>Flagged Attendance Records ({anomalies.length})</span>
          </span>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Audit compliance: Model flags require HR verification before policy action.
          </span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Employee</th>
                <th>Check-In / Out</th>
                <th>Recorded Duration</th>
                <th>4-Feature Vector (Deviations, Duration, Dist)</th>
                <th>Detection Source</th>
                <th>ML Score</th>
                <th>Review Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No anomalies found matching current filters.
                  </td>
                </tr>
              ) : (
                anomalies.map((item) => {
                  const feat = item.anomaly?.features || {};
                  const isBoth = item.anomaly?.detectionSource === 'both';
                  const isMl = item.anomaly?.detectionSource === 'ml_only';
                  const isHard = item.anomaly?.detectionSource === 'hard_rule_only';

                  return (
                    <tr key={item._id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.employeeId}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{item.attendanceDate}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          In: {item.checkIn?.timestamp ? new Date(item.checkIn.timestamp).toLocaleTimeString() : '-'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          Out: {item.checkOut?.timestamp ? new Date(item.checkOut.timestamp).toLocaleTimeString() : '-'}
                        </div>
                      </td>
                      <td>
                        <strong>{item.durationMinutes} mins</strong>
                        <div style={{ fontSize: '0.75rem', color: item.durationMinutes < 30 ? '#ef4444' : '#64748b' }}>
                          {item.durationMinutes < 30 ? '⚠️ Under 30m rule' : `${(item.durationMinutes / 60).toFixed(1)}h`}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', background: '#f1f5f9', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                          InDev: {feat.checkInDeviation ?? 0}m | OutDev: {feat.checkOutDeviation ?? 0}m <br />
                          Dur: {feat.geofenceDuration ?? 0}m | Dist: {feat.distanceFromCenter ?? 0}m
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isBoth ? 'badge-danger' : isMl ? 'badge-info' : 'badge-warning'}`}>
                          {isBoth ? 'Both ML & Hard' : isMl ? 'ML Anomaly' : 'Hard Rule Only'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: item.anomaly?.score > 0.6 ? '#dc2626' : '#2563eb' }}>
                          {item.anomaly?.score ? item.anomaly.score.toFixed(3) : 'N/A'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          ['resolved', 'approved'].includes((item.anomaly?.reviewStatus || '').toLowerCase()) ? 'badge-success' :
                          ['rejected'].includes((item.anomaly?.reviewStatus || '').toLowerCase()) ? 'badge-danger' :
                          ['reviewed'].includes((item.anomaly?.reviewStatus || '').toLowerCase()) ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {(item.anomaly?.reviewStatus || 'pending').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenReview(item)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HR Review Modal Dialog */}
      {reviewModalOpen && selectedAnomaly && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.4rem', color: '#0f172a' }}>
              HR Anomaly Review & Adjudication
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
              Employee: <strong>{selectedAnomaly.employeeId}</strong> | Date: <strong>{selectedAnomaly.attendanceDate}</strong>
            </p>

            {/* Explanation box */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                System Assessment Details:
              </div>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
                {selectedAnomaly.anomaly?.explanation || 'Flagged by system.'}
              </div>
              {selectedAnomaly.anomaly?.hardRuleViolations?.length > 0 && (
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#991b1b' }}>
                  {selectedAnomaly.anomaly.hardRuleViolations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={handleSaveReview}>
              <div className="form-group">
                <label className="form-label">Review Decision Status</label>
                <select
                  className="form-select"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  required
                >
                  <option value="approved">APPROVED (Approved by HR / false alarm / justified exception)</option>
                  <option value="rejected">REJECTED (Confirmed fraud / unexcused violation)</option>
                  <option value="resolved">RESOLVED (Resolved / cleared)</option>
                  <option value="reviewed">REVIEWED (Flag acknowledged, pending inquiry)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">HR Investigation Notes / Justification</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter administrative notes, justification, or corrective audit explanation..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
