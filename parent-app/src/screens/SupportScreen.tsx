import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import {
  AppHeader,
  Badge,
  Btn,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  Field,
  IconBubble,
  Input,
  SectionHeader,
  SkeletonCard,
  SuccessBanner,
} from '../components/ui';
import { C, S, fmtDateTime } from '../theme';
import { createTicket, errMsg, replyTicket, supportTickets, type SupportTicket } from '../api';

const CATEGORIES = [
  { k: 'billing', label: 'Fees' },
  { k: 'academic', label: 'Academy' },
  { k: 'account', label: 'Account' },
  { k: 'technical', label: 'Technical' },
  { k: 'other', label: 'Other' },
];

export default function SupportScreen({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [openId, setOpenId] = React.useState<number | null>(null);

  const [creating, setCreating] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState('academic');
  const [creatingBusy, setCreatingBusy] = React.useState(false);

  const [replyBody, setReplyBody] = React.useState('');
  const [replyBusy, setReplyBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const t = await supportTickets();
      setTickets(Array.isArray(t) ? t : []);
    } catch (e: any) {
      setErr(errMsg(e, 'Could not load your support tickets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      setErr('Please add a subject and a description.');
      return;
    }
    setCreatingBusy(true);
    setErr('');
    setOk('');
    try {
      const t = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority: 'medium',
      });
      setTickets((prev) => [t, ...prev]);
      setSubject('');
      setDescription('');
      setCategory('academic');
      setCreating(false);
      setOk('Ticket submitted. The academy team will respond soon.');
      onChanged();
    } catch (e: any) {
      setErr(errMsg(e, 'Could not submit your ticket.'));
    } finally {
      setCreatingBusy(false);
    }
  };

  const send = async (id: number) => {
    const body = replyBody.trim();
    if (!body) return;
    setReplyBusy(true);
    setErr('');
    try {
      await replyTicket(id, body);
      setReplyBody('');
      await load();
      onChanged();
    } catch (e: any) {
      setErr(errMsg(e, 'Could not send your reply.'));
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader
        onBack={onBack}
        eyebrow="HELP DESK"
        title="Support"
        subtitle="Raise and track your requests"
        right={
          !creating ? (
            <Pressable onPress={() => { setCreating(true); setOk(''); }} accessibilityRole="button" style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>+ New</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: S.lg, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.navy]} />}
      >
        <ErrorBanner msg={err} />
        <SuccessBanner msg={ok} />

        {creating ? (
          <Card style={{ marginBottom: S.md }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: S.md }}>New request</Text>
            <Field label="Subject">
              <Input value={subject} onChangeText={(t) => { setSubject(t); setErr(''); }} placeholder="Short summary" editable={!creatingBusy} />
            </Field>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.text, marginBottom: 8, letterSpacing: 0.6 }}>CATEGORY</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.md }}>
              {CATEGORIES.map((c) => (
                <Chip key={c.k} label={c.label} active={category === c.k} onPress={() => setCategory(c.k)} />
              ))}
            </View>
            <Field label="Description">
              <Input
                value={description}
                onChangeText={(t) => { setDescription(t); setErr(''); }}
                placeholder="Describe what you need help with"
                multiline
                editable={!creatingBusy}
                style={{ minHeight: 96, textAlignVertical: 'top' }}
              />
            </Field>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <View style={{ flex: 1 }}>
                <Btn title="Cancel" kind="secondary" onPress={() => { setCreating(false); setErr(''); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn title="Submit" kind="accent" onPress={submit} loading={creatingBusy} />
              </View>
            </View>
          </Card>
        ) : null}

        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : tickets.length === 0 ? (
          <Card>
            <EmptyState glyph="☎" title="No support requests" hint="Tap “+ New” to raise a request for the academy." />
          </Card>
        ) : (
          <>
            <SectionHeader title="My requests" hint={`${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`} />
            {tickets.map((t) => {
              const open = openId === t.id;
              return (
                <Card key={t.id} style={{ marginBottom: S.sm }}>
                  <Pressable onPress={() => { setOpenId(open ? null : t.id); setReplyBody(''); }} accessibilityRole="button" accessibilityLabel={t.subject}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconBubble glyph={t.status === 'resolved' || t.status === 'closed' ? '✓' : '☎'} bg={t.status === 'resolved' || t.status === 'closed' ? C.greenSoft : C.accentSoft} fg={t.status === 'resolved' || t.status === 'closed' ? C.green : C.accentDeep} size={42} />
                      <View style={{ flex: 1, marginLeft: S.md }}>
                        <Text style={{ fontWeight: '800', color: C.text, fontSize: 14.5 }} numberOfLines={1}>{t.subject}</Text>
                        <Text style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
                          #{t.id}{t.category_display ? ` · ${t.category_display}` : ''}{t.status_display ? ` · ${t.status_display}` : ''}
                        </Text>
                      </View>
                      <Badge status={t.status} />
                    </View>
                  </Pressable>

                  {open ? (
                    <View style={{ marginTop: S.md, borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.md }}>
                      <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>{t.description}</Text>
                      {t.replies && t.replies.length ? (
                        <View style={{ marginTop: S.md }}>
                          {t.replies.map((r) => (
                            <View key={r.id} style={{ backgroundColor: C.navyTint, borderRadius: 12, padding: S.md, marginBottom: S.sm }}>
                              <Text style={{ color: C.navy, fontWeight: '800', fontSize: 12 }}>
                                {r.author_name || 'Academy'} · {r.created_at ? fmtDateTime(r.created_at) : ''}
                              </Text>
                              <Text style={{ color: C.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{r.body}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <Field label="Add a reply">
                        <Input
                          value={replyBody}
                          onChangeText={setReplyBody}
                          placeholder="Write a message…"
                          multiline
                          editable={!replyBusy}
                          style={{ minHeight: 72, textAlignVertical: 'top' }}
                        />
                      </Field>
                      <Btn title="Send reply" kind="primary" onPress={() => send(t.id)} loading={replyBusy} />
                    </View>
                  ) : (
                    <Text style={{ color: C.faint, fontSize: 12, marginTop: S.sm }}>
                      Tap to view details{t.reply_count ? ` · ${t.reply_count} repl${t.reply_count === 1 ? 'y' : 'ies'}` : ''}
                    </Text>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}
