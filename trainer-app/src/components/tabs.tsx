import React from 'react';
import SharedTabBar, { type TabConfig } from '../../../shared/design/TabBar';

export { daypart, DaypartIcon } from '../../../shared/design/TabBar';

export type Tab = 'home' | 'students' | 'sessions' | 'attendance' | 'reports' | 'profile';

const TABS: TabConfig<Tab>[] = [
  { k: 'home', label: 'Home', glyph: '⌂' },
  { k: 'students', label: 'Athletes', glyph: '◉' },
  { k: 'sessions', label: 'Sessions', glyph: '◷' },
  { k: 'attendance', label: 'My Att.', glyph: '✓' },
  { k: 'reports', label: 'Reports', glyph: '▤' },
  { k: 'profile', label: 'Profile', glyph: '☺' },
];

export default function TabBar({
  tab,
  onTab,
  badges,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
}) {
  return <SharedTabBar tabs={TABS} tab={tab} onTab={onTab} badges={badges} />;
}
