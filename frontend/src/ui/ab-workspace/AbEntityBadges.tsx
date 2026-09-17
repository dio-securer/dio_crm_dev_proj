import React from 'react';

type Badge = { label: string; tone?: 'info' | 'success' | 'warning' | 'neutral' };

export function AbEntityBadges({ badges }: { badges: Badge[] }) {
  return (
    <div className="ab-entity-badges">
      {badges.map(badge => (
        <span key={badge.label} className={`ab-entity-badge tone-${badge.tone ?? 'neutral'}`}>{badge.label}</span>
      ))}
    </div>
  );
}
