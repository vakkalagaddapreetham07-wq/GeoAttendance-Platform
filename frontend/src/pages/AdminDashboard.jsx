import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users,
  UserCheck,
  Clock,
  ShieldAlert,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const [workplace, setWorkplace] = useState(null);
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAnomaly, setFilterAnomaly] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, wpRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getMyWorkplace().catch(() => ({ workplace: null }))
      ]);
      setSummary(summaryRes.summary);
      if (wpRes.workplace) setWorkplace(wpRes.workplace);

      const params = { page, limit: 15 };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterDate) params.startDate = filterDate;
      if (filterAnomaly === 'anomalies') params.isAnomaly = 'true';
      if (filterAnomaly === 'normal') params.isAnomaly = 'false';

      const recordsRes = await api.getAttendanceRecords(params);
      setRecords(recordsRes.records || []);
      setTotalPages(recordsRes.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, filterAnomaly]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const resetFilters = () => {
    setFilterEmployee('');
    setFilterDate('');
    setFilterAnomaly('all');
    setPage(1);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          {workplace && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                🏢 {workplace.name}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                ID: <code style={{ color: '#2563eb' }}>{workplace.workplaceId}</code> • Radius: {workplace.geofence?.radius || 50}m
              </span>
            </div>
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Workplace Attendance Analytics
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Live enterprise attendance telemetry, punctuality tracking & anomaly detection
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>
          <RefreshCw size={14} />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Key Analytics Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Users size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.totalEmployees ?? '-'}</div>
            <div className="metric-lbl">Total Registered Employees</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.todayPresent ?? '-'}</div>
            <div className="metric-lbl">Present Today ({summary?.attendanceRateToday ?? 0}%)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.punctualityRate ?? '-'}%</div>
            <div className="metric-lbl">Punctuality Rate</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#fffbeb', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.averageDurationHours ?? '-'}h</div>
            <div className="metric-lbl">Avg Geofence Duration</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#fef2f2', color: '#ef4444' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.totalAnomalies ?? '-'}</div>
            <div className="metric-lbl">Total Flagged Anomalies</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div className="metric-val">{summary?.pendingLeaves ?? '-'}</div>
            <div className="metric-lbl">Pending Leave Requests</div>
          </div>
        </div>
      </div>

      {/* Detection Source Breakdown Banner */}
      <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={20} color="#2563eb" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
              Anomaly Detection Source Breakdown:
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="badge badge-info">
              🤖 ML Isolation Forest Only: <strong>{summary?.detectionSourceBreakdown?.mlOnly ?? 0}</strong>
            </span>
            <span className="badge badge-warning">
              ⚙️ Deterministic Hard Rule Only: <strong>{summary?.detectionSourceBreakdown?.hardRuleOnly ?? 0}</strong>
            </span>
            <span className="badge badge-danger">
              ⚠️ Dual Trigger (Both ML & Hard Rule): <strong>{summary?.detectionSourceBreakdown?.both ?? 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Records Table with Search & Filters */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <span className="card-title">
            <FileCheck size={18} color="#2563eb" />
            <span>Master Attendance Records</span>
          </span>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Filter by Employee ID..."
              style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            />
            <input
              type="date"
              className="form-input"
              style={{ width: '150px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: '140px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              value={filterAnomaly}
              onChange={(e) => setFilterAnomaly(e.target.value)}
            >
              <option value="all">All Records</option>
              <option value="anomalies">Anomalies Only</option>
              <option value="normal">Normal Only</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm">
              <Search size={14} />
              <span>Filter</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
              Reset
            </button>
          </form>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Recorded Duration</th>
                <th>Distance to Center</th>
                <th>Session Status</th>
                <th>Anomaly Status</th>
                <th>Detection Source</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No attendance records match the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isAnom = rec.anomaly?.isAnomaly;
                  return (
                    <tr key={rec._id} style={{ background: isAnom ? '#fffbfb' : 'inherit' }}>
                      <td><strong>{rec.attendanceDate}</strong></td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{rec.employeeId}</span>
                      </td>
                      <td>{rec.checkIn?.timestamp ? new Date(rec.checkIn.timestamp).toLocaleTimeString() : 'N/A'}</td>
                      <td>{rec.checkOut?.timestamp ? new Date(rec.checkOut.timestamp).toLocaleTimeString() : 'Active'}</td>
                      <td>
                        <strong>{rec.durationMinutes ? `${rec.durationMinutes} mins` : '-'}</strong>
                        {rec.durationMinutes ? ` (${(rec.durationMinutes / 60).toFixed(1)}h)` : ''}
                      </td>
                      <td>{rec.checkIn?.distanceToCenter ? `${rec.checkIn.distanceToCenter}m` : '-'}</td>
                      <td>
                        <span className={`badge ${rec.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        {isAnom ? (
                          <span className="badge badge-danger">
                            Anomaly Flagged
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            Normal
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          rec.anomaly?.detectionSource === 'both' ? 'badge-danger' :
                          rec.anomaly?.detectionSource === 'ml_only' ? 'badge-info' :
                          rec.anomaly?.detectionSource === 'hard_rule_only' ? 'badge-warning' : 'badge-neutral'
                        }`}>
                          {rec.anomaly?.detectionSource || 'none'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Page {page} of {totalPages}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
