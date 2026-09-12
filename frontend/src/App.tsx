import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LeadsPage } from './LeadsPage';
import { AccountsPage } from './AccountsPage';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '10px 14px', textDecoration: 'none', borderRadius: 8,
  background: isActive ? '#14365d' : '#eef2f6', color: isActive ? '#fff' : '#172033'
});

export default function App() {
  return (
    <main style={{ fontFamily: 'Malgun Gothic, sans-serif', maxWidth: 1180, margin: '28px auto', padding: 20 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>DIO CRM</h1>
        <p style={{ marginTop: 0, color: '#667085' }}>Phase 2 — Customer / Lead / Account</p>
        <nav style={{ display: 'flex', gap: 8 }}>
          <NavLink to="/" end style={linkStyle}>Lead</NavLink>
          <NavLink to="/accounts" style={linkStyle}>Account</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
      </Routes>
      <footer style={{ marginTop: 28, color: '#667085', fontSize: 12 }}>
        Foundation DB 적용은 별도 환경 Gate로 관리됩니다. 현재 UI는 Phase 2 API 계약 기준으로 동작합니다.
      </footer>
    </main>
  );
}
