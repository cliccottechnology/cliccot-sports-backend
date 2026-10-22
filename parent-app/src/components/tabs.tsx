import React from 'react';
import SharedTabBar, { type TabConfig } from '../../../shared/design/TabBar';

export { daypart, DaypartIcon } from '../../../shared/design/TabBar';

export type Tab = 'home' | 'children' | 'attendance' | 'fees' | 'profile';

const TABS: TabConfig<Tab>[] = [
  { k: 'home', label: 'Home', glyph: '⌂' },
  { k: 'children', label: 'Children', glyph: '◉' },
  { k: 'attendance', label: 'Attend.', glyph: '✓' },
  { k: 'fees', label: 'Fees', glyph: '₹' },
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
