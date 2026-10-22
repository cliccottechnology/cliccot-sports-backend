import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { checkIn, myCheckins, mySessions, requestCorrection, updateCheckIn, type CheckIn, type SessionItem } from '../api';
import { AppHeader, Badge, Card, EmptyState, ErrorBanner, SectionHeader, SuccessBanner } from '../components/ui';
import { DaypartIcon, daypart } from '../components/tabs';
import { C, S, fmtDate, fmtTime } from '../theme';

const REQUESTABLE: ('present' | 'late' | 'leave')[] = ['present', 'late', 'leave'];

const deadlineText = (dl?: string | null) => {
  if (!dl) return '';
  const t = new Date(dl);
  if (isNaN(t.getTime())) return '';
  const hh = t.getHours();
  const mm = String(t.getMinutes()).padStart(2, '0');
  const h12 = hh % 12 || 12;
  return `${h12}:${mm} ${hh >= 12 ? 'PM' : 'AM'}`;
};
const minsLeft = (dl?: string | null) => {
  if (!dl) return null;
  const t = new Date(dl).getTime();
  if (isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
};
const correctionChip = (ci: CheckIn) => {
  switch (ci.correction_status) {
    case 'pending':
      return { text: 'Correction requested', color: C.amber };
    case 'approved':
      return { text: 'Correction approved', color: C.green };
    case 'rejected':
      return { text: 'Correction rejected', color: C.red };
    default:
      return null;
  }
};

const splitLine = (list: CheckIn[]) => {
  const parts: string[] = [];
  const n = (s: string) => list.filter((c) => c.status === s).length;
  if (n('present')) parts.push(`${n('present')} present`);
  if (n('absent')) parts.push(`${n('absent')} absent`);
  if (n('late')) parts.push(`${n('late')} late`);
  if (n('leave')) parts.push(`${n('leave')} leave`);
  return parts.join(' · ') || 'no marks';
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mondayISO = () => {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function inRange(dateStr: string | undefined, from: string, to: string) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

export default function MyAttendanceScreen() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [checkins, setCheckins] = useState<Record<number, CheckIn>>({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [requestFor, setRequestFor] = useState<number | null>(null);
  const [reqStatus, setReqStatus] = useState<'present' | 'late' | 'leave'>('present');
  const [reqReason, setReqReason] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [ss, ci] = await Promise.all([mySessions(), myCheckins()]);
      setSessions(ss);
      setCheckins(Object.fromEntries(ci.map((x) => [x.session, x])));
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Couldn't load attendance.");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = async (s: SessionItem, status: 'present' | 'late' | 'absent' | 'leave') => {
    setSavingId(s.id);
    setErr('');
    setOk('');
    try {
      const existing = checkins[s.id];
      const ci = existing ? await updateCheckIn(existing.id, status) : await checkIn(s.id, status);
      setCheckins((m) => ({ ...m, [s.id]: ci }));
      setOk(
        existing
          ? `Corrected to ${status} for ${s.batch_name || 'session'}.`
          : `Marked ${status} for ${s.batch_name || 'session'}.`,
      );
      setEditingId(null);
    } catch (e: any) {
      setErr(
        e?.response?.data?.message ||
          (typeof e?.response?.data === 'object' ? JSON.stringify(e.response.data) : null) ||
          e?.message ||
          "Couldn't save. Nothing was recorded — retry.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const submitCorrection = async (ci: CheckIn) => {
    setErr('');
    setOk('');
    if (reqReason.trim().length < 3) {
      setErr('Please describe why the automatic absence is incorrect.');
      return;
    }
    setSavingId(ci.session);
    try {
      await requestCorrection(ci.id, reqStatus, reqReason.trim());
      setOk('Correction request submitted — Admin will review it.');
      setRequestFor(null);
      setReqReason('');
      setReqStatus('present');
      await load();
    } catch (e: any) {
      setErr(
        e?.response?.data?.message ||
          (typeof e?.response?.data === 'object' ? JSON.stringify(e.response.data) : null) ||
          e?.message ||
          "Couldn't submit the correction request.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const statusButtons = (s: SessionItem, active: string | undefined, busy: boolean) =>
    (
      [
        ['present', 'Present', C.green],
        ['late', 'Late', C.amber],
        ['absent', 'Absent', C.red],
        ['leave', 'Leave', C.navy],
      ] as const
    ).map(([k, label, bg]) => (
      <Pressable
        key={k}
        onPress={() => mark(s, k)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Mark ${label} for ${s.batch_name}`}
        style={{
          backgroundColor: bg,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 16,
          opacity: busy ? 0.6 : 1,
          borderWidth: active === k ? 3 : 0,
          borderColor: '#fff',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
          {busy ? '…' : active === k ? `${label} ✓` : label}
        </Text>
      </Pressable>
    ));

  const today = todayISO();
  const weekFrom = mondayISO();
  const monthFrom = `${monthPrefix()}-01`;
  const allCi = Object.values(checkins);
  const ciDate = (c: CheckIn) => (c.marked_at || '').slice(0, 10);
  const weekCi = allCi.filter((c) => inRange(ciDate(c), weekFrom, today));
  const monthCi = allCi.filter((c) => inRange(ciDate(c), monthFrom, today));
  const weekPresent = weekCi.filter((c) => c.status === 'present').length;
  const weekLate = weekCi.filter((c) => c.status === 'late').length;
  const weekAbsent = weekCi.filter((c) => c.status === 'absent').length;
  const weekLeave = weekCi.filter((c) => c.status === 'leave').length;
  const monthPresent = monthCi.filter((c) => c.status === 'present').length;
  const monthLate = monthCi.filter((c) => c.status === 'late').length;
  const monthAbsent = monthCi.filter((c) => c.status === 'absent').length;
  const monthLeave = monthCi.filter((c) => c.status === 'leave').length;
  const weekTotal = weekPresent + weekLate + weekAbsent + weekLeave;
  const monthTotal = monthPresent + monthLate + monthAbsent + monthLeave;
  const missed = sessions.filter((s) => (s.date || '') < today && !checkins[s.id]).length;
  const autoAbsent = [...allCi]
    .filter((c) => c.auto_marked)
    .sort((a, b) => String(b.session_date || '').localeCompare(String(a.session_date || '')));

  const todayList = sessions.filter((s) => (s.date || '').slice(0, 10) === today && !checkins[s.id]?.auto_marked);
  const upcomingList = sessions
    .filter((s) => (s.date || '') > today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 10);
  const history = [...allCi].sort((a, b) => String(b.marked_at || '').localeCompare(String(a.marked_at || ''))).slice(0, 20);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader eyebrow="MY ATTENDANCE" title="Mark Yourself" subtitle="Your own check-ins, one per session." />
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        <SuccessBanner msg={ok} />

        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: S.md }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.navy }}>{loading ? '–' : weekTotal}</Text>
            <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700', marginTop: 2 }}>This week</Text>
            <Text style={{ fontSize: 11, color: C.faint, fontWeight: '600' }}>
              {loading ? '' : splitLine(weekCi)}
            </Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: S.md }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.navy }}>{loading ? '–' : monthTotal}</Text>
            <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700', marginTop: 2 }}>This month</Text>
            <Text style={{ fontSize: 11, color: C.faint, fontWeight: '600' }}>
              {loading ? '' : splitLine(monthCi)}
            </Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', paddingVertical: S.md }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: missed > 0 ? C.amber : C.green }}>{loading ? '–' : missed}</Text>
            <Text style={{ fontSize: 11.5, color: C.sub, fontWeight: '700', marginTop: 2 }}>Missed</Text>
            <Text style={{ fontSize: 11, color: C.faint, fontWeight: '600' }}>past, unmarked</Text>
          </Card>
        </View>

        {autoAbsent.length > 0 && (
          <>
            <SectionHeader title="Automatically marked absent" hint="These were recorded by the system — request a correction if you actually attended." />
            {autoAbsent.map((ci) => {
              const busy = savingId === ci.session;
              const chip = correctionChip(ci);
              return (
                <Card key={ci.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.navy, fontSize: 14.5 }}>
                        {ci.batch_name || `Session ${ci.session}`}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 1 }}>
                        {fmtDate(ci.session_date)}
                        {deadlineText(ci.deadline) ? ` · deadline ${deadlineText(ci.deadline)}` : ''}
                      </Text>
                    </View>
                    <Badge status={ci.status} />
                  </View>
                  {chip && (
                    <Text style={{ color: chip.color, fontWeight: '800', fontSize: 12, marginTop: 6 }}>
                      {chip.text}
                    </Text>
                  )}
                  {ci.can_request_correction && requestFor !== ci.session && (
                    <Pressable
                      onPress={() => {
                        setRequestFor(ci.session);
                        setReqStatus('present');
                        setReqReason('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Request a correction for ${ci.batch_name}`}
                      style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: C.navy, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Request Correction</Text>
                    </Pressable>
                  )}
                  {requestFor === ci.session && (
                    <View style={{ marginTop: 10, backgroundColor: C.bg, borderRadius: 12, padding: S.md }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.faint, letterSpacing: 0.6, marginBottom: 6 }}>
                        I ACTUALLY ATTENDED AS
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {REQUESTABLE.map((k) => (
                          <Pressable
                            key={k}
                            onPress={() => setReqStatus(k)}
                            accessibilityRole="button"
                            accessibilityLabel={`Request ${k}`}
                            style={{
                              borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14,
                              backgroundColor: reqStatus === k ? C.accent : '#fff',
                              borderWidth: 1, borderColor: C.line,
                            }}
                          >
                            <Text style={{ color: reqStatus === k ? '#fff' : C.text, fontWeight: '800', fontSize: 12.5, textTransform: 'capitalize' }}>
                              {k}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        value={reqReason}
                        onChangeText={setReqReason}
                        placeholder="Reason (e.g. app had no network; I took the session)"
                        placeholderTextColor={C.faint}
                        multiline
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, minHeight: 70, color: C.text, fontSize: 13 }}
                      />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Pressable
                          onPress={() => submitCorrection(ci)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel="Submit correction request"
                          style={{ flex: 1, backgroundColor: C.navy, borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                            {busy ? 'Submitting…' : 'Submit Request'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setRequestFor(null)}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel correction request"
                          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' }}
                        >
                          <Text style={{ color: C.sub, fontWeight: '800', fontSize: 13 }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}

        <SectionHeader title="Today — mark individually" hint="One check-in per session. Saved only after the backend confirms — correct a mistaken mark any time." />
        {todayList.length === 0 && !loading ? (
          <Card><EmptyState title="No sessions today" hint="Your check-in list appears on session days." /></Card>
        ) : (
          todayList.map((s) => {
            const ci = checkins[s.id];
            const busy = savingId === s.id;
            return (
              <Card key={s.id} style={{ marginBottom: S.sm, flexDirection: 'row', alignItems: 'center' }}>
                <DaypartIcon start={s.start_time} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: C.navy, fontSize: 15 }}>
                    {daypart(s.start_time)} · {s.batch_name || `Session ${s.id}`}
                  </Text>
                  <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 1 }}>
                    {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                    {s.sport_name ? ` · ${s.sport_name}` : ''}
                  </Text>
                  {ci ? (
                    <View style={{ marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge status={ci.status} />
                        {ci.auto_marked ? (
                          <Text style={{ marginLeft: 6, color: C.red, fontWeight: '900', fontSize: 10.5, letterSpacing: 0.4 }}>
                            AUTO
                          </Text>
                        ) : null}
                        <Text style={{ color: C.sub, fontSize: 12, marginLeft: 8 }}>
                          {ci.marked_at ? ci.marked_at.slice(11, 16) : ''}
                        </Text>
                        {!ci.auto_marked && (
                          <Pressable
                            onPress={() => setEditingId(editingId === s.id ? null : s.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Correct check-in for ${s.batch_name}`}
                            style={{ marginLeft: 'auto', padding: 4 }}
                          >
                            <Text style={{ color: C.accent, fontWeight: '800', fontSize: 12.5 }}>
                              {editingId === s.id ? 'Cancel' : 'Correct'}
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      {ci.auto_marked ? (
                        <View style={{ marginTop: 6 }}>
                          <Text style={{ color: C.sub, fontSize: 12 }}>
                            Automatically marked absent
                            {deadlineText(ci.deadline) ? ` · deadline ${deadlineText(ci.deadline)}` : ''}
                            {(() => {
                              const m = minsLeft(ci.deadline);
                              return m !== null && m > 0 ? ` · ${m} min left to request a fix` : '';
                            })()}
                          </Text>
                          {(() => {
                            const chip = correctionChip(ci);
                            return chip ? (
                              <Text style={{ color: chip.color, fontWeight: '800', fontSize: 12, marginTop: 3 }}>
                                {chip.text}
                              </Text>
                            ) : null;
                          })()}

                          {ci.can_request_correction && requestFor !== s.id && (
                            <Pressable
                              onPress={() => {
                                setRequestFor(s.id);
                                setReqStatus('present');
                                setReqReason('');
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Request a correction for ${s.batch_name}`}
                              style={{
                                marginTop: 8, alignSelf: 'flex-start', backgroundColor: C.navy,
                                borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16,
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                                Request Correction
                              </Text>
                            </Pressable>
                          )}

                          {requestFor === s.id && (
                            <View style={{ marginTop: 10, backgroundColor: C.bg, borderRadius: 12, padding: S.md }}>
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.faint, letterSpacing: 0.6, marginBottom: 6 }}>
                                I ACTUALLY ATTENDED AS
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                {REQUESTABLE.map((k) => (
                                  <Pressable
                                    key={k}
                                    onPress={() => setReqStatus(k)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Request ${k}`}
                                    style={{
                                      borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14,
                                      backgroundColor: reqStatus === k ? C.accent : '#fff',
                                      borderWidth: 1, borderColor: C.line,
                                    }}
                                  >
                                    <Text style={{ color: reqStatus === k ? '#fff' : C.text, fontWeight: '800', fontSize: 12.5, textTransform: 'capitalize' }}>
                                      {k}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                              <TextInput
                                value={reqReason}
                                onChangeText={setReqReason}
                                placeholder="Reason (e.g. app had no network; I took the session)"
                                placeholderTextColor={C.faint}
                                multiline
                                style={{
                                  backgroundColor: '#fff', borderWidth: 1, borderColor: C.line,
                                  borderRadius: 10, padding: 10, minHeight: 70, color: C.text, fontSize: 13,
                                }}
                              />
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                <Pressable
                                  onPress={() => submitCorrection(ci)}
                                  disabled={busy}
                                  accessibilityRole="button"
                                  accessibilityLabel="Submit correction request"
                                  style={{ flex: 1, backgroundColor: C.navy, borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
                                >
                                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                                    {busy ? 'Submitting…' : 'Submit Request'}
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => setRequestFor(null)}
                                  accessibilityRole="button"
                                  accessibilityLabel="Cancel correction request"
                                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' }}
                                >
                                  <Text style={{ color: C.sub, fontWeight: '800', fontSize: 13 }}>Cancel</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        editingId === s.id && (
                          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                            {statusButtons(s, ci.status, busy)}
                          </View>
                        )
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: C.faint, letterSpacing: 0.6, marginBottom: 6 }}>
                        MARK MANUALLY
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {statusButtons(s, undefined, busy)}
                      </View>
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        )}

        <SectionHeader title="Upcoming" hint="Your next assigned sessions" />
        {upcomingList.length === 0 && !loading ? (
          <Card><EmptyState title="Nothing upcoming" /></Card>
        ) : (
          upcomingList.map((s) => (
            <Card key={s.id} style={{ marginBottom: S.sm, padding: S.md, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.text }}>{s.batch_name || `Session ${s.id}`}</Text>
                <Text style={{ color: C.sub, fontSize: 12.5 }}>{fmtDate(s.date)} · {fmtTime(s.start_time)}</Text>
              </View>
              {checkins[s.id] ? <Badge status={checkins[s.id].status} /> : <Badge status={s.status} />}
            </Card>
          ))
        )}

        <SectionHeader title="History" hint="Latest first · mirrors the academy record" />
        {history.length === 0 && !loading ? (
          <Card><EmptyState title="No check-ins yet" /></Card>
        ) : (
          history.map((c, i) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i === history.length - 1 ? 0 : 1, borderBottomColor: C.line, backgroundColor: '#fff', paddingHorizontal: S.md, borderRadius: i === 0 ? 12 : 0 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.text }}>{c.batch_name || `Session ${c.session}`}</Text>
                <Text style={{ color: C.sub, fontSize: 12.5 }}>{fmtDate(c.session_date)} {c.marked_at ? `· ${c.marked_at.slice(11, 16)}` : ''}</Text>
                {c.auto_marked || c.correction_status ? (
                  <Text style={{ fontSize: 11, fontWeight: '700', marginTop: 2, color: correctionChip(c)?.color || C.red }}>
                    {correctionChip(c)?.text || 'Automatically marked absent'}
                  </Text>
                ) : null}
              </View>
              <Badge status={c.status} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
