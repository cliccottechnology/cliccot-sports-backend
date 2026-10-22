import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Donut from '../components/Donut';
import {
  AppHeader,
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  IconBubble,
  SectionHeader,
  SkeletonCard,
} from '../components/ui';
import { C, S, fmtDate, fmtDayDate, fmtTime, inr } from '../theme';
import { attendanceStats, certLabel, childName, num } from '../util';
import {
  certificateEligibility,
  child as fetchChild,
  childAttendance,
  childCertificates,
  childFees,
  childSessions,
  mediaUrl,
  payments,
  type AttendanceRec,
  type CertEligibility,
  type Certificate,
  type Child,
  type Fee,
  type Payment,
  type SessionItem,
} from '../api';

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 }}>
      <Text style={{ color: C.sub, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '800', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function StudentDetailScreen({ childId, onBack }: { childId: number; onBack: () => void }) {
  const [kid, setKid] = React.useState<Child | null>(null);
  const [att, setAtt] = React.useState<AttendanceRec[]>([]);
  const [fees, setFees] = React.useState<Fee[]>([]);
  const [certs, setCerts] = React.useState<Certificate[]>([]);
  const [sessions, setSessions] = React.useState<SessionItem[]>([]);
  const [pays, setPays] = React.useState<Payment[]>([]);
  const [elig, setElig] = React.useState<CertEligibility | null>(null);
  const [err, setErr] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [c, a, f, ce, se, pe, ee] = await Promise.all([
          fetchChild(childId),
          childAttendance(childId, 100).catch(() => []),
          childFees(childId).catch(() => []),
          childCertificates(childId).catch(() => []),
          childSessions(childId, 60).catch(() => []),
          payments().catch(() => []),
          certificateEligibility().catch(() => []),
        ]);
        if (!live) return;
        setKid(c);
        setAtt(a);
        setFees(f);
        setCerts(ce);
        setSessions(se);
        // Receipts for this child only — payments are scoped to the parent's
        // linked students on the server, then matched to this child's fees.
        const feeIds = new Set(f.map((x) => x.id));
        setPays(pe.filter((p) => feeIds.has(p.student_fee)));
        setElig(ee.find((r) => r.student === childId) || null);
      } catch (e: any) {
        if (live) setErr(e?.response?.data?.message || e?.message || 'Could not load this profile.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [childId]);

  const stats = attendanceStats(att);
  const dueFees = fees.filter((f) => !['paid', 'cancelled', 'refunded'].includes(f.status));
  const dueAmount = dueFees.reduce((a, f) => a + num(f.balance ?? num(f.amount) - num(f.paid_total)), 0);
  const recent = att.slice(0, 6);
  const sessionById = Object.fromEntries(sessions.map((s) => [s.id, s]));

  // Batch / coach / location / times the child actually trains under — taken
  // from real scheduled sessions, not a hardcoded sport list.
  const todayISO = new Date().toISOString().slice(0, 10);
  const batches = Array.from(new Set(sessions.map((s) => s.batch_name).filter(Boolean) as string[]));
  const coach = sessions.find((s) => s.coach_name)?.coach_name;
  const location = sessions.find((s) => s.location_name)?.location_name;
  const nextSession = sessions
    .filter((s) => (s.status === 'scheduled' || s.status === 'in_progress') && (!s.date || s.date >= todayISO))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
  const sessionWindow = nextSession
    ? `${fmtDayDate(nextSession.date || todayISO)} · ${fmtTime(nextSession.start_time)}${
        nextSession.end_time ? `–${fmtTime(nextSession.end_time)}` : ''
      }`
    : undefined;
  const settled = pays.reduce((a, p) => a + num(p.amount), 0);
  const schedule = [...sessions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 8);
  const el = certLabel(elig?.state);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow={kid ? kid.student_id : 'PROFILE'}
        title={kid ? childName(kid) : 'Your child'}
        subtitle={kid ? [kid.sport_name].filter(Boolean).join(' · ') || 'Student profile' : 'Loading…'}
      >
        {kid ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.sm }}>
            <Avatar name={childName(kid)} size={64} ring uri={mediaUrl(kid.photo)} />
            <View style={{ marginLeft: S.md, flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{childName(kid)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 2 }}>
                {kid.sport_name || 'No sport assigned'}{kid.status ? ` · ${kid.status}` : ''}
              </Text>
            </View>
            <Badge status={kid.status} />
          </View>
        ) : null}
      </AppHeader>

      <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 30 }}>
        <ErrorBanner msg={err} />
        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <SectionHeader title="Attendance" hint="Overall record" />
            <Card>
              <Donut
                slices={[
                  { label: 'Present', value: stats.present, color: C.green },
                  { label: 'Late', value: stats.late, color: C.amber },
                  { label: 'Absent', value: stats.absent, color: C.red },
                  { label: 'Leave', value: stats.leave, color: C.navy },
                ]}
                centerLabel={`${stats.pct}%`}
                centerSub="attendance"
              />
              <Text style={{ color: C.faint, fontSize: 11.5, textAlign: 'center', marginTop: S.sm, lineHeight: 16 }}>
                Based on {stats.marked} marked session{stats.marked === 1 ? '' : 's'} (present + late = attended).
                {stats.notMarked > 0
                  ? ` ${stats.notMarked} not yet marked — not counted.`
                  : ''}
              </Text>
            </Card>

            <SectionHeader title="Recent attendance" hint={recent.length ? 'Latest check-ins' : undefined} />
            {recent.length === 0 ? (
              <Card><EmptyState glyph="✓" title="No attendance yet" hint="Check-ins appear once training begins." /></Card>
            ) : (
              recent.map((r) => {
                const s = sessionById[r.session];
                return (
                  <Card key={r.id} style={{ marginBottom: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconBubble glyph="✓" bg={C.navySoft} fg={C.navy} size={40} />
                      <View style={{ flex: 1, marginLeft: S.md }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>
                          {s ? `${s.batch_name || 'Session'}` : `Session ${r.session}`}
                        </Text>
                        <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                          {(r.marked_at || '').slice(0, 10) || (s?.date ? fmtDayDate(s.date) : '—')}
                        </Text>
                      </View>
                      <Badge status={r.status} />
                    </View>
                  </Card>
                );
              })
            )}

            <SectionHeader title="Fees" hint={dueAmount > 0 ? `${inr(dueAmount)} outstanding` : 'All settled'} />
            {fees.length === 0 ? (
              <Card><EmptyState glyph="₹" title="No fees allocated" hint="Fee records for this child appear here." /></Card>
            ) : (
              fees.map((f) => (
                <Card key={f.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }}>{f.period_label}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                        {inr(f.amount)} · paid {inr(num(f.paid_total))}
                        {f.due_date ? ` · due ${fmtDayDate(f.due_date)}` : ''}
                      </Text>
                    </View>
                    <Badge status={f.status} />
                  </View>
                </Card>
              ))
            )}

            <SectionHeader title="Payment history" hint={pays.length ? `${pays.length} transaction${pays.length === 1 ? '' : 's'}${settled ? ` · ${inr(settled)}` : ''}` : 'No payments yet'} />
            {pays.length === 0 ? (
              <Card>
                <EmptyState glyph="▤" title="No payments yet" hint="Verified payments and receipts appear here." />
              </Card>
            ) : (
              pays.map((p) => (
                <Card key={p.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble glyph="₹" bg={p.status === 'success' ? C.greenSoft : C.greyBg} fg={p.status === 'success' ? C.green : C.greyFg} size={40} />
                    <View style={{ flex: 1, marginLeft: S.md }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>{inr(p.amount)}</Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }}>
                        {p.receipt_no ? `Receipt ${p.receipt_no}` : p.provider ? `${p.provider} · pending` : 'Payment'}
                        {p.created_at ? ` · ${fmtDayDate(p.created_at.slice(0, 10))}` : ''}
                      </Text>
                    </View>
                    <Badge status={p.status} />
                  </View>
                </Card>
              ))
            )}

            <SectionHeader title="Certificate status" hint="Milestone review" />
            <Card style={{ marginBottom: S.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBubble glyph="✦" bg={el.bg} fg={el.fg} size={42} />
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }}>{el.label}</Text>
                  <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }} numberOfLines={3}>
                    {elig?.milestone_date
                      ? `3-month milestone on ${fmtDayDate(elig.milestone_date)}${
                          elig.state === 'issued' ? '' : ' · issued by the academy once approved'
                        }`
                      : 'Enrolment date required to compute the milestone.'}
                  </Text>
                </View>
              </View>
              {elig?.milestone_date ? (
                <View style={{ marginTop: S.md, borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.sm }}>
                  <InfoRow label="Attendance required" value={elig.checks?.attendance ? 'Met' : 'Not yet met'} />
                  <InfoRow label="Sessions required" value={elig.checks?.sessions ? 'Met' : 'Not yet met'} />
                  <InfoRow label="Active status" value={elig.checks?.active ? 'Met' : 'Not yet met'} />
                  {elig.attendance_pct != null ? <InfoRow label="Attendance to date" value={`${elig.attendance_pct}%`} /> : null}
                </View>
              ) : null}
            </Card>

            <SectionHeader title="Certificates" hint={certs.length ? `${certs.length} issued` : 'Milestone awards'} />
            {certs.length === 0 ? (
              <Card><EmptyState glyph="✦" title="No certificates yet" hint="Certificates are issued at training milestones." /></Card>
            ) : (
              certs.map((c) => {
                const file = mediaUrl(c.file);
                return (
                  <Card key={c.id} style={{ marginBottom: S.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconBubble glyph="✦" bg={C.goldSoft} fg={C.gold} size={42} />
                      <View style={{ flex: 1, marginLeft: S.md }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>{c.title}</Text>
                        <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                          {[c.sport_name, c.period_from && c.period_to ? `${c.period_from} → ${c.period_to}` : null, c.certificate_no ? `No. ${c.certificate_no}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                    </View>
                    {file ? (
                      <Pressable
                        onPress={() => Linking.openURL(file).catch(() => {})}
                        accessibilityRole="link"
                        style={{ marginTop: S.md, backgroundColor: C.navy, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13.5 }}>Open Certificate PDF</Text>
                      </Pressable>
                    ) : null}
                  </Card>
                );
              })
            )}

            <SectionHeader title="Training" hint="Assigned batch & coach" />
            <Card>
              <InfoRow label="Batch" value={batches.length ? batches.join(', ') : 'Not assigned yet'} />
              <InfoRow label="Coach" value={coach} />
              <InfoRow label="Location" value={location} />
              <InfoRow label="Next session" value={sessionWindow} />
            </Card>

            <SectionHeader title="Schedule" hint={schedule.length ? 'Sessions & any changes' : undefined} />
            {schedule.length === 0 ? (
              <Card><EmptyState glyph="◷" title="No sessions scheduled" hint="Training dates appear once the batch is planned." /></Card>
            ) : (
              schedule.map((s) => (
                <Card key={s.id} style={{ marginBottom: S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: C.text, fontSize: 14 }} numberOfLines={1}>
                        {s.batch_name || 'Session'}
                      </Text>
                      <Text style={{ color: C.sub, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                        {s.date ? fmtDayDate(s.date) : '—'} · {fmtTime(s.start_time)}{s.end_time ? `–${fmtTime(s.end_time)}` : ''}
                        {s.location_name ? ` · ${s.location_name}` : ''}
                      </Text>
                    </View>
                    <Badge status={s.status} />
                  </View>
                </Card>
              ))
            )}

            <SectionHeader title="Profile" hint="Academy record" />
            <Card>
              <InfoRow label="Student ID" value={kid?.student_id} />
              <InfoRow label="Sport" value={kid?.sport_name} />
              <InfoRow label="Date of birth" value={kid?.dob ? fmtDate(kid.dob) : undefined} />
              <InfoRow label="Gender" value={kid?.gender} />
              <InfoRow label="Enrolled" value={kid?.enrollment_date ? fmtDayDate(kid.enrollment_date) : undefined} />
              <InfoRow label="School" value={kid?.school_name} />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
