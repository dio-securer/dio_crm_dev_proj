import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LeadsPage } from './LeadsPage';
import { AccountsPage } from './AccountsPage';
import { ActivitiesPage } from './ActivitiesPage';
import { ActivityReportsPage } from './ActivityReportsPage';
import { DirectWorkPage } from './DirectWorkPage';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '10px 14px', textDecoration: 'none', borderRadius: 8,
  background: isActive ? '#14365d' : '#eef2f6', color: isActive ? '#fff' : '#172033'
});

export default function App() {
  return (
    <main style={{ fontFamily: 'Malgun Gothic, sans-serif', maxWidth: 1180, margin: '28px auto', padding: 20 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>DIO CRM</h1>
        <p style={{ marginTop: 0, color: '#667085' }}>Phase 3 — Sales Activity</p>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <NavLink to="/" end style={linkStyle}>Lead</NavLink>
          <NavLink to="/accounts" style={linkStyle}>Account</NavLink>
          <NavLink to="/activities" style={linkStyle}>활동 / GPS</NavLink>
          <NavLink to="/activity-reports" style={linkStyle}>활동보고 / 승인</NavLink>
          <NavLink to="/direct-work" style={linkStyle}>직출 / 직퇴</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activity-reports" element={<ActivityReportsPage />} />
        <Route path="/direct-work" element={<DirectWorkPage />} />
      </Routes>
      <footer style={{ marginTop: 28, color: '#667085', fontSize: 12 }}>
        DB Migration/외부 Adapter 적용은 별도 환경 Gate입니다. GPS Mock/정확도 차단정책은 GAP-002 확정 전 수집만 하고 차단하지 않습니다.
      </footer>
    </main>
  );
}
