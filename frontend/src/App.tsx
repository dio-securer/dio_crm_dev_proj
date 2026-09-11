import React from 'react';

export default function App() {
  return (
    <main style={{ fontFamily: 'Malgun Gothic, sans-serif', maxWidth: 1100, margin: '40px auto', padding: 20 }}>
      <h1>DIO CRM</h1>
      <p>Phase 1 Platform Foundation</p>
      <section>
        <h2>Foundation modules</h2>
        <ul>
          <li>Authentication / JWT</li>
          <li>User / Organization</li>
          <li>Role / Permission</li>
          <li>Common Code</li>
          <li>Audit / Interface Log</li>
          <li>File Metadata / Notification</li>
        </ul>
      </section>
    </main>
  );
}
