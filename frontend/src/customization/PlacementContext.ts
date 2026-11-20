import { createContext } from 'react';
import type { PlacementOrders } from '@dio-crm/contracts/crm-customization';
export const PlacementContext = createContext<PlacementOrders>({});
