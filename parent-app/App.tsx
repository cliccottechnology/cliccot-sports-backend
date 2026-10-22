import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import TabBar, { type Tab } from './src/components/tabs';
import ForcePasswordChange from './src/components/ForcePasswordChange';
import { academyBrand, clearTokens, logout as revokeSession, setOnSessionExpired, type Me } from './src/api';
import AttendanceScreen from './src/screens/AttendanceScreen';
import ChildrenScreen from './src/screens/ChildrenScreen';
import FeesScreen from './src/screens/FeesScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import StudentDetailScreen from './src/screens/StudentDetailScreen';
import SupportScreen from './src/screens/SupportScreen';
import { C } from './src/theme';
import { usePoppinsFonts } from '../shared/design/fonts';

type Stack =
  | { screen: 'child'; id: number }
  | { screen: 'notifications' }
  | { screen: 'support' };

export default function App() {
  const [fontsLoaded, fontError] = usePoppinsFonts();
  const [user, setUser] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Stack | null>(null);
  const [selChildId, setSelChildId] = useState<number | null>(null);
  const [tabKey, setTabKey] = useState(0);

  const logout = useCallback(() => {
    revokeSession().catch(() => {});
    clearTokens();
    setUser(null);
    setStack(null);
    setTab('home');
    setSelChildId(null);
  }, []);

  useEffect(() => {
    setOnSessionExpired(logout);
    return () => setOnSessionExpired(null);
  }, [logout]);

  // Browser tab follows the academy name from Settings (like the admin panel).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    academyBrand()
      .then((b) => {
        document.title = `${b.name} — Parent App`;
      })
      .catch(() => {});
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    setStack(null);
    setTabKey((k) => k + 1);
  };

  const openChild = (id: number) => setStack({ screen: 'child', id });

  // Hold the first paint until Poppins is ready so text never flashes a fallback.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: C.navyDeep }} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.navyDeep }}>
        <StatusBar style="light" />
        {/* Centered phone-width column: full-width on phones, capped on desktop web. */}
        <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.navyDeep }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 560, backgroundColor: C.bg }}>
            {!user ? (
              <LoginScreen
                onDone={(u) => {
                  setSelChildId(null);
                  setUser(u);
                }}
              />
            ) : user.must_change_password ? (
              <ForcePasswordChange
                onDone={() => setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev))}
                onLogout={logout}
              />
            ) : stack?.screen === 'child' ? (
              <StudentDetailScreen childId={stack.id} onBack={() => setStack(null)} />
            ) : stack?.screen === 'notifications' ? (
              <NotificationsScreen onBack={() => setStack(null)} onChanged={() => setTabKey((k) => k + 1)} />
            ) : stack?.screen === 'support' ? (
              <SupportScreen onBack={() => setStack(null)} onChanged={() => setTabKey((k) => k + 1)} />
            ) : (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }} key={tabKey}>
                  {tab === 'home' && (
                    <HomeScreen
                      user={user}
                      selChildId={selChildId}
                      onSelectChild={setSelChildId}
                      onTab={switchTab}
                      onNotifications={() => setStack({ screen: 'notifications' })}
                      onSupport={() => setStack({ screen: 'support' })}
                      onOpenChild={openChild}
                    />
                  )}
                  {tab === 'children' && (
                    <ChildrenScreen selChildId={selChildId} onSelectChild={setSelChildId} onOpenChild={openChild} />
                  )}
                  {tab === 'attendance' && (
                    <AttendanceScreen selChildId={selChildId} onSelectChild={setSelChildId} />
                  )}
                  {tab === 'fees' && <FeesScreen selChildId={selChildId} onSelectChild={setSelChildId} />}
                  {tab === 'profile' && (
                    <ProfileScreen
                      user={user}
                      selChildId={selChildId}
                      onSelectChild={setSelChildId}
                      onSupport={() => setStack({ screen: 'support' })}
                      onLogout={logout}
                    />
                  )}
                </View>
                <TabBar tab={tab} onTab={switchTab} />
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
