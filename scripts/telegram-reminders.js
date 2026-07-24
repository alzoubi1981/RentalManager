'use strict';

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

const serviceAccount = JSON.parse(required('FIREBASE_SERVICE_ACCOUNT'));
const botToken = required('TELEGRAM_BOT_TOKEN');
const chatId = required('TELEGRAM_CHAT_ID');
const documentId = process.env.FIREBASE_DOCUMENT_ID || 'aladdin-rental-manager';
const timeZone = process.env.APP_TIME_ZONE || 'America/New_York';

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const ref = db.collection('rentalManagers').doc(documentId);

function parts(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, year: +p.year, month: +p.month, day: +p.day };
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tomorrowDueDate(today, dueDay) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.min(Number(dueDay || 1), last) === d.getUTCDate();
}

async function sendMessage(text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(`Telegram error: ${JSON.stringify(body)}`);
}

async function main() {
  if (process.env.SEND_TEST === 'true') {
    await sendMessage(process.env.TEST_MESSAGE || '✅ تم ربط RentalManager V10.1 مع تيليغرام بنجاح.');
    console.log('Telegram test message sent.');
    return;
  }
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    console.log('Cloud document does not exist yet.');
    return;
  }
  const document = snapshot.data() || {};
  const state = document.state || document;
  const now = parts();
  const logs = state.notificationLog || {};
  const pending = [];

  for (const tenant of state.tenants || []) {
    const room = (state.rooms || []).find(r => r.id === tenant.roomId);
    const label = `${tenant.name}${room ? ` — ${room.name}` : ''}`;

    if (tomorrowDueDate(now.date, tenant.dueDay)) {
      const key = `rent:${tenant.id}:${addDays(now.date, 1)}`;
      if (!logs[key]) pending.push({ key, text: `تذكير: غدًا موعد دفع إيجار ${label}.` });
    }

    if (tenant.end && tenant.end === addDays(now.date, 30)) {
      const key = `contract:${tenant.id}:${tenant.end}`;
      if (!logs[key]) pending.push({ key, text: `تذكير: تبقى 30 يومًا على انتهاء عقد ${label}. تاريخ الانتهاء: ${tenant.end}` });
    }
  }

  for (const reminder of state.reminders || []) {
    if (reminder.sentAt || !reminder.date || !reminder.time) continue;
    if (`${reminder.date}T${reminder.time}` <= `${now.date}T${now.time}`) {
      pending.push({ key: `custom:${reminder.id}`, reminderId: reminder.id, text: reminder.text });
    }
  }

  if (!pending.length) {
    console.log('No reminders due.');
    return;
  }

  for (const item of pending) {
    await sendMessage(item.text);
    const sentAt = new Date().toISOString();
    state.notificationLog = state.notificationLog || {};
    state.notificationLog[item.key] = sentAt;
    if (item.reminderId) {
      const reminder = (state.reminders || []).find(r => r.id === item.reminderId);
      if (reminder) reminder.sentAt = sentAt;
    }
    console.log(`Sent ${item.key}`);
  }

  await ref.set({ state, updatedAt: FieldValue.serverTimestamp(), version: '10.1' }, { merge: false });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
