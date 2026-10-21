import React from 'react';
import { ActivitiesPage } from '../../../ActivitiesPage';

/**
 * GLOBAL uses the same confirmed A+B operational Activity workspace as HQ.
 * Market-specific GPS/map planning APIs remain available for a later profile-driven
 * Activity planning section instead of maintaining a second incompatible UI.
 */
export function GlobalActivityPage() {
  return <ActivitiesPage />;
}
