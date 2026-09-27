import React from 'react';

export default function AdminLoading() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ height: '32px', width: '220px', background: '#e2e8f0', borderRadius: '6px' }} />
        <div style={{ height: '24px', width: '120px', background: '#e2e8f0', borderRadius: '4px' }} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ height: '40px', width: '160px', background: '#e2e8f0', borderRadius: '8px' }} />
        <div style={{ height: '40px', width: '160px', background: '#e2e8f0', borderRadius: '8px' }} />
        <div style={{ height: '40px', width: '160px', background: '#e2e8f0', borderRadius: '8px' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            style={{
              height: '140px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>
    </div>
  );
}
