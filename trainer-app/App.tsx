import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { invalidateCoachData, type StudentEntry } from './src/coach';
import TabBar, { type Tab } from './src/components/tabs';
import ForcePasswordChange from './src/components/ForcePasswordChange';
import {
  academyBrand,
  clearTokens,
  setOnSessionExpired,
  type Analysis,
  type Me,
  type SessionItem,
} from './src/api';
import AttendanceScreen from './src/screens/AttendanceScreen';
import AchievementsScreen from './src/screens/AchievementsScreen';
import FeesScreen from './src/screens/FeesScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import MyAttendanceScreen from './src/screens/MyAttendanceScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import StudentDetailScreen from './src/screens/StudentDetailScreen';
import StudentsScreen from './src/screens/StudentsScreen';
import { C } from './src/theme';
import { usePoppinsFonts } from '../shared/design/fonts';

type Stack =
  | { screen: 'attendance'; session: SessionItem }
  | { screen: 'photo'; session: SessionItem }
  | { screen: 'review'; session: SessionItem; analysis: Analysis; photoUri: string }
  | { screen: 'student'; student: StudentEntry }
  | { screen: 'fees' }
  | { screen: 'achievements' }
  | { screen: 'notifications' };

export default function App() {
  const [fontsLoaded, fontError] = usePoppinsFonts();
  const [user, setUser] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Stack | null>(null);
  const [tabKey, setTabKey] = useState(0);

  const logout = useCallback(() => {
    clearTokens();
    invalidateCoachData();
    setUser(null);
    setStack(null);
    setTab('home');
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
        document.title = `${b.name} — Trainer App`;
      })
      .catch(() => {});
  }, []);

  const openSession = (s: SessionItem) => setStack({ screen: 'attendance', session: s });
  const changed = () => {
    invalidateCoachData();
    setTabKey((k) => k + 1);
    setStack(null);
  };
  const switchTab = (t: Tab) => {
    setTab(t);
    setTabKey((k) => k + 1);
  };

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
                  invalidateCoachData();
                  setUser(u);
                }}
              />
            ) : user.must_change_password ? (
              <ForcePasswordChange
                onDone={() => setUser((prev) => (prev ? { ...prev, must_change_password: false } : prev))}
                onLogout={logout}
              />
            ) : stack?.screen === 'attendance' ? (
              <AttendanceScreen
                session={stack.session}
                onBack={changed}
                onPhoto={() => setStack({ screen: 'photo', session: stack.session })}
                onSaved={changed}
              />
            ) : stack?.screen === 'photo' ? (
              <PhotoScreen
                session={stack.session}
                onBack={() => setStack({ screen: 'attendance', session: stack.session })}
                onAnalyzed={(analysis, photoUri) =>
                  setStack({ screen: 'review', session: stack.session, analysis, photoUri })
                }
              />
            ) : stack?.screen === 'review' ? (
              <ReviewScreen
                session={stack.session}
                analysis={stack.analysis}
                photoUri={stack.photoUri}
                onBack={() => setStack({ screen: 'photo', session: stack.session })}
                onDone={changed}
              />
            ) : stack?.screen === 'student' ? (
              <StudentDetailScreen
                student={stack.student}
                onBack={() => setStack(null)}
                onChanged={() => {
                  invalidateCoachData();
                  setTabKey((k) => k + 1);
                }}
              />
            ) : stack?.screen === 'fees' ? (
              <FeesScreen onBack={() => setStack(null)} />
            ) : stack?.screen === 'achievements' ? (
              <AchievementsScreen onBack={() => setStack(null)} />
            ) : stack?.screen === 'notifications' ? (
              <NotificationsScreen onBack={() => setStack(null)} onChanged={() => setTabKey((k) => k + 1)} />
            ) : (
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }} key={tabKey}>
                  {tab === 'home' && (
                    <HomeScreen
                      user={user}
                      onSession={openSession}
                      onTab={switchTab}
                      onFees={() => setStack({ screen: 'fees' })}
                      onNotifications={() => setStack({ screen: 'notifications' })}
                      onAchievements={() => setStack({ screen: 'achievements' })}
                    />
                  )}
                  {tab === 'students' && (
                    <StudentsScreen onStudent={(s) => setStack({ screen: 'student', student: s })} />
                  )}
                  {tab === 'sessions' && (
                    <SessionsScreen
                      onScan={(s) => setStack({ screen: 'photo', session: s })}
                      onManual={openSession}
                    />
                  )}
                  {tab === 'attendance' && <MyAttendanceScreen key={tabKey} />}
                  {tab === 'reports' && <ReportsScreen />}
                  {tab === 'profile' && <ProfileScreen user={user} onLogout={logout} onProfileSaved={(u) => setUser((prev) => (prev ? { ...prev, ...u } : prev))} />}
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
