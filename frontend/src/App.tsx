import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LeadsPage } from './LeadsPage';
import { AccountsPage } from './AccountsPage';
import { ActivitiesPage } from './ActivitiesPage';
import { ActivityReportsPage } from './ActivityReportsPage';
import { DirectWorkPage } from './DirectWorkPage';
import { OpportunitiesPage } from './OpportunitiesPage';
import { PipelinePage } from './PipelinePage';
import { ContractsPage } from './ContractsPage';
import { OrdersPage } from './OrdersPage';
import { FulfillmentPage } from './FulfillmentPage';
import { LedgerStatementsPage } from './LedgerStatementsPage';
import { Account360Page } from './Account360Page';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import { OpsStatusPage } from './OpsStatusPage';

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '10px 14px', textDecoration: 'none', borderRadius: 8,
  background: isActive ? '#14365d' : '#eef2f6', color: isActive ? '#fff' : '#172033'
});

export default function App() {
  return (
    <main style={{ fontFamily: 'Malgun Gothic, sans-serif', maxWidth: 1240, margin: '28px auto', padding: 20 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>DIO CRM</h1>
        <p style={{ marginTop: 0, color: '#667085' }}>Phase 8 — Hardening / Rollout</p>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <NavLink to="/" end style={linkStyle}>Lead</NavLink>
          <NavLink to="/accounts" style={linkStyle}>Account</NavLink>
          <NavLink to="/activities" style={linkStyle}>활동 / GPS</NavLink>
          <NavLink to="/activity-reports" style={linkStyle}>활동보고 / 승인</NavLink>
          <NavLink to="/direct-work" style={linkStyle}>직출 / 직퇴</NavLink>
          <NavLink to="/opportunities" style={linkStyle}>Opportunity</NavLink>
          <NavLink to="/pipeline" style={linkStyle}>Pipeline / Funnel</NavLink>
          <NavLink to="/contracts" style={linkStyle}>계약 / 수금</NavLink>
          <NavLink to="/orders" style={linkStyle}>주문</NavLink>
          <NavLink to="/fulfillment" style={linkStyle}>납품 / 매출 / 반품</NavLink>
          <NavLink to="/ledger-statements" style={linkStyle}>원장 / 거래명세서</NavLink>
          <NavLink to="/account360" style={linkStyle}>Account 360</NavLink>
          <NavLink to="/analytics" style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/ops" style={linkStyle}>운영상태</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/activity-reports" element={<ActivityReportsPage />} />
        <Route path="/direct-work" element={<DirectWorkPage />} />
        <Route path="/opportunities" element={<OpportunitiesPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/fulfillment" element={<FulfillmentPage />} />
        <Route path="/ledger-statements" element={<LedgerStatementsPage />} />
        <Route path="/account360" element={<Account360Page />} />
        <Route path="/analytics" element={<AnalyticsDashboardPage />} />
        <Route path="/ops" element={<OpsStatusPage />} />
      </Routes>
      <footer style={{ marginTop: 28, color: '#667085', fontSize: 12 }}>
        Phase 8 Source Baseline은 보안·성능·복원력·모니터링·배포 절차를 준비합니다. 실제 DEV DB 적용, Pilot, Cutover는 별도 환경/Production Gate입니다.
      </footer>
    </main>
  );
}
