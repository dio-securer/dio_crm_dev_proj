import { createContext } from 'react';

// Preview override for one supported placement; absence preserves the existing UI.
export const ButtonPresentationContext = createContext<'primary' | 'secondary' | undefined>(undefined);
