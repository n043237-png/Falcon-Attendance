import React, { useEffect, useState, useMemo } from 'react';
import { Spinner, Row, Col, Badge } from 'react-bootstrap';
import axios from 'axios';
import {
  CalendarDays,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  Search,
  PartyPopper,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HolidayItem {
  id: number;
  holidayDate: string; // YYYY-MM-DD
  name: string;
  description?: string | null;
  day: string;
  isActive: boolean;
  isPast: boolean;
  isToday: boolean;
  isUpcoming: boolean;
  daysAway: number;
}

export default function HolidayList() {
  const { token } = useAuth();
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHolidays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/holidays?year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setHolidays(response.data.data || []);
      } else {
        setError('Failed to fetch company holidays.');
      }
    } catch (err: any) {
      console.error('Holiday fetch error:', err);
      setError('Network error while loading company holidays.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchHolidays();
    }
  }, [token, selectedYear]);

  // Derived metrics
  const upcomingCount = holidays.filter((h) => h.isUpcoming).length;
  const pastCount = holidays.filter((h) => h.isPast).length;
  const nextHoliday = holidays.find((h) => h.isUpcoming);

  // Filtered list
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      // Tab filter
      if (tabFilter === 'UPCOMING' && !h.isUpcoming) return false;
      if (tabFilter === 'PAST' && !h.isPast) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = h.name.toLowerCase().includes(q);
        const matchDesc = h.description?.toLowerCase().includes(q);
        const matchDay = h.day.toLowerCase().includes(q);
        const matchDate = h.holidayDate.includes(q);
        if (!matchName && !matchDesc && !matchDay && !matchDate) return false;
      }

      return true;
    });
  }, [holidays, tabFilter, searchQuery]);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthAbbr = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00+05:30');
      return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();
    } catch {
      return '';
    }
  };

  const getDayNumber = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return parts[2] || '';
    } catch {
      return '';
    }
  };

  return (
    <div>
      {/* Page Title & Year Controls */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="page-title d-flex align-items-center gap-2.5">
            <CalendarDays size={26} className="text-primary" />
            <span>Company Holiday Calendar</span>
          </h1>
          <p className="text-muted mb-0">
            Official paid holidays and corporate office closures configured by Falcon Administration
          </p>
        </div>

        {/* Year Selector Pills */}
        <div className="d-flex align-items-center gap-1.5 p-1 bg-light rounded-3 border">
          {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedYear(yr)}
              className="btn btn-sm"
              style={{
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: selectedYear === yr ? '#FFFFFF' : 'transparent',
                color: selectedYear === yr ? '#2563EB' : '#64748B',
                boxShadow: selectedYear === yr ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: selectedYear === yr ? '1px solid #E2E8F0' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <div
            className="card p-3.5 border-0 h-100"
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 2px 12px -2px rgba(15, 23, 42, 0.05)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-semibold" style={{ fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Holidays ({selectedYear})
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={16} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A' }}>
              {loading ? '-' : holidays.length}
            </div>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Paid annual non-working days
            </div>
          </div>
        </Col>

        <Col md={4}>
          <div
            className="card p-3.5 border-0 h-100"
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 2px 12px -2px rgba(15, 23, 42, 0.05)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted fw-semibold" style={{ fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Upcoming Holidays
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#DCFCE7',
                  color: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={16} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803D' }}>
              {loading ? '-' : upcomingCount}
            </div>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Remaining in {selectedYear}
            </div>
          </div>
        </Col>

        <Col md={4}>
          <div
            className="card p-3.5 border-0 h-100"
            style={{
              background: nextHoliday ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' : '#FFFFFF',
              borderRadius: '16px',
              border: nextHoliday ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Next Official Holiday
              </span>
              <Sparkles size={16} color="#2563EB" />
            </div>
            {nextHoliday ? (
              <>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#1E3A8A' }} className="text-truncate">
                  {nextHoliday.name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#2563EB', fontWeight: 600, marginTop: '2px' }}>
                  {formatDateDisplay(nextHoliday.holidayDate)} ({nextHoliday.day}) &bull;{' '}
                  {nextHoliday.isToday
                    ? 'Today 🎉'
                    : nextHoliday.daysAway === 1
                    ? 'Tomorrow'
                    : `In ${nextHoliday.daysAway} days`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#64748B' }}>
                  No more holidays this year
                </div>
                <div className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                  Check next year's calendar
                </div>
              </>
            )}
          </div>
        </Col>
      </Row>

      {/* Main Content Card */}
      <div
        className="card border-0 p-0 overflow-hidden"
        style={{
          borderRadius: '20px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
        }}
      >
        {/* Card Filter Toolbar */}
        <div
          className="p-3 border-bottom d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3"
          style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
        >
          {/* Tab Filter */}
          <div className="d-flex align-items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Holidays', count: holidays.length },
              { id: 'UPCOMING', label: 'Upcoming', count: upcomingCount },
              { id: 'PAST', label: 'Past', count: pastCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabFilter(tab.id as any)}
                className="btn btn-sm d-flex align-items-center gap-1.5"
                style={{
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: tabFilter === tab.id ? '#FFFFFF' : 'transparent',
                  color: tabFilter === tab.id ? '#0F172A' : '#64748B',
                  border: tabFilter === tab.id ? '1px solid #CBD5E1' : '1px solid transparent',
                  boxShadow: tabFilter === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: tabFilter === tab.id ? '#EFF6FF' : '#E2E8F0',
                    color: tabFilter === tab.id ? '#2563EB' : '#475569',
                    fontSize: '11px',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="position-relative" style={{ minWidth: '240px' }}>
            <Search size={15} className="position-absolute text-muted" style={{ top: '10px', left: '12px' }} />
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search holiday or day..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '34px',
                height: '36px',
                borderRadius: '8px',
                fontSize: '13px',
                borderColor: '#CBD5E1',
              }}
            />
          </div>
        </div>

        {/* Holiday Table / List */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="text-muted mt-2" style={{ fontSize: '14px' }}>
              Loading holiday calendar...
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-5 text-danger">
            <Info size={28} className="mb-2" />
            <div>{error}</div>
            <button className="btn btn-primary btn-sm mt-3" onClick={fetchHolidays}>
              Retry
            </button>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <CalendarDays size={36} className="text-muted mb-2 opacity-50" />
            <div className="fw-semibold" style={{ fontSize: '15px' }}>
              No holidays found
            </div>
            <div className="small text-muted mt-1">
              {searchQuery
                ? `No holidays match "${searchQuery}"`
                : tabFilter === 'UPCOMING'
                ? `No upcoming holidays remaining in ${selectedYear}.`
                : `No past holidays recorded in ${selectedYear}.`}
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>DATE & DAY</th>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>HOLIDAY NAME</th>
                  <th style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>DESCRIPTION</th>
                  <th className="text-end" style={{ padding: '14px 18px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHolidays.map((item) => (
                  <tr key={item.id} style={{ opacity: item.isPast ? 0.75 : 1 }}>
                    {/* Date Block */}
                    <td style={{ padding: '16px 18px', width: '220px' }}>
                      <div className="d-flex align-items-center gap-3">
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '12px',
                            backgroundColor: item.isToday ? '#DCFCE7' : item.isUpcoming ? '#EFF6FF' : '#F1F5F9',
                            border: `1.5px solid ${item.isToday ? '#86EFAC' : item.isUpcoming ? '#BFDBFE' : '#E2E8F0'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: item.isToday ? '#15803D' : item.isUpcoming ? '#2563EB' : '#64748B',
                              letterSpacing: '0.04em',
                              lineHeight: 1,
                            }}
                          >
                            {getMonthAbbr(item.holidayDate)}
                          </span>
                          <span
                            style={{
                              fontSize: '16px',
                              fontWeight: 800,
                              color: item.isToday ? '#15803D' : item.isUpcoming ? '#0F172A' : '#475569',
                              lineHeight: 1.1,
                              marginTop: '2px',
                            }}
                          >
                            {getDayNumber(item.holidayDate)}
                          </span>
                        </div>

                        <div>
                          <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                            {formatDateDisplay(item.holidayDate)}
                          </div>
                          <div className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>
                            {item.day}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Holiday Name */}
                    <td style={{ padding: '16px 18px', minWidth: '220px' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold text-dark" style={{ fontSize: '14.5px' }}>
                          {item.name}
                        </span>
                        {item.isToday && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                              border: '1px solid #86EFAC',
                              fontSize: '10.5px',
                              fontWeight: 700,
                            }}
                          >
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td style={{ padding: '16px 18px' }}>
                      {item.description ? (
                        <span className="text-muted" style={{ fontSize: '13px', lineHeight: 1.45 }}>
                          {item.description}
                        </span>
                      ) : (
                        <span className="text-muted fst-italic" style={{ fontSize: '12.5px' }}>
                          Standard Company Holiday
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="text-end" style={{ padding: '16px 18px', width: '160px' }}>
                      {item.isToday ? (
                        <span
                          className="badge d-inline-flex align-items-center gap-1.5 px-2.5 py-1.5"
                          style={{
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        >
                          <PartyPopper size={13} />
                          <span>Today</span>
                        </span>
                      ) : item.isUpcoming ? (
                        <span
                          className="badge d-inline-flex align-items-center gap-1.5 px-2.5 py-1.5"
                          style={{
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '8px',
                          }}
                        >
                          <Clock size={12} />
                          <span>
                            {item.daysAway === 1 ? 'Tomorrow' : `In ${item.daysAway} days`}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="badge px-2.5 py-1.5"
                          style={{
                            backgroundColor: '#F1F5F9',
                            color: '#64748B',
                            border: '1px solid #E2E8F0',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '8px',
                          }}
                        >
                          Past Holiday
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
