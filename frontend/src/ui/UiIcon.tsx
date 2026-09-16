import React from 'react';

export type UiIconName =
  | 'phone'
  | 'mail'
  | 'calendar'
  | 'plus'
  | 'more'
  | 'user'
  | 'users'
  | 'building'
  | 'map-pin'
  | 'clock'
  | 'target'
  | 'briefcase'
  | 'pencil'
  | 'link'
  | 'search'
  | 'chevron-down'
  | 'chevron-right'
  | 'inbox'
  | 'alert-circle'
  | 'loader'
  | 'activity'
  | 'arrow-right'
  | 'layout'
  | 'database'
  | 'shuffle'
  | 'check'
  | 'file-text';

type Props = {
  name: UiIconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
};

const paths: Record<UiIconName, React.ReactNode> = {
  phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" /></>,
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  calendar: <><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  user: <><path d="M19 21a7 7 0 0 0-14 0" /><circle cx="12" cy="7" r="4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  building: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" /></>,
  'map-pin': <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  briefcase: <><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.14 1.14" /><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.14-1.14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  'chevron-down': <><path d="m6 9 6 6 6-6" /></>,
  'chevron-right': <><path d="m9 18 6-6-6-6" /></>,
  inbox: <><path d="M4 4h16l2 9v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /><path d="M2 13h6l2 3h4l2-3h6" /></>,
  'alert-circle': <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
  loader: <><path d="M21 12a9 9 0 1 1-3-6.7" /></>,
  activity: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
  'arrow-right': <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></>,
  shuffle: <><path d="m16 3 4 4-4 4" /><path d="M4 7h3c4 0 5 10 10 10h3" /><path d="m16 21 4-4-4-4" /><path d="M4 17h3c1.7 0 2.8-1.8 4-4" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  'file-text': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></>
};

export function UiIcon({ name, size = '1em', strokeWidth = 1.9, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
