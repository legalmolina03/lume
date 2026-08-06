/**
 * Scheduled reminder dispatcher (Section 4: Notifications).
 *
 * Invoked on a cron — every 15 minutes is a good cadence — it finds users whose
 * reminder time falls in the current bucket, works out whether they actually
 * have anything outstanding, and pushes at most two notifications: one for
 * unlogged habits and one for due or overdue tasks. Users with nothing pending
 * are skipped, so the reminder keeps meaning something.
 *
 * Deploy:  supabase functions deploy send-reminders
 * Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
 *                               VAPID_SUBJECT=mailto:you@example.com
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

/** Cron cadence. A reminder fires if its time falls inside the current window. */
const BUCKET_MINUTES = 15

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// Service role: this runs with no user session and must read across accounts.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

/** Local wall-clock date and minutes-since-midnight in an IANA timezone. */
function localNow(timezone: string): { date: string; minutes: number; weekday: number } {
  const now = new Date()
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    }).formatToParts(now)
  } catch {
    return localNow('UTC')
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: Math.max(0, weekdays.indexOf(get('weekday'))),
  }
}

function minutesOf(time: string): number {
  const [hours, mins] = time.split(':')
  return Number(hours) * 60 + Number(mins)
}

async function pushToUser(userId: string, payload: Payload): Promise<number> {
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subscriptions?.length) return 0

  let sent = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      )
      sent += 1
    } catch (err) {
      // 404/410 mean the browser threw the subscription away — so should we,
      // otherwise dead endpoints accumulate forever.
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        console.error('push failed', sub.endpoint, err)
      }
    }
  }
  return sent
}

Deno.serve(async () => {
  const { data: settingsRows, error } = await admin
    .from('user_settings')
    .select('*')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  let notified = 0

  for (const settings of settingsRows ?? []) {
    const { date, minutes, weekday } = localNow(settings.timezone ?? 'UTC')

    const reminderAt = settings.habit_reminder_time
      ? minutesOf(settings.habit_reminder_time)
      : null
    const inBucket =
      reminderAt !== null &&
      minutes >= reminderAt &&
      minutes < reminderAt + BUCKET_MINUTES

    if (!inBucket) continue

    /* --------------------------------------------------- unlogged habits -- */

    const { data: habits } = await admin
      .from('habits')
      .select('id, name, frequency_type, target_days, goal_type, goal_target')
      .eq('user_id', settings.user_id)
      .eq('archived', false)

    const dueToday = (habits ?? []).filter(
      (h) =>
        h.frequency_type !== 'weekly_days' ||
        (h.target_days as number[]).includes(weekday),
    )

    if (dueToday.length > 0) {
      const { data: logs } = await admin
        .from('habit_logs')
        .select('habit_id, completed, value')
        .eq('user_id', settings.user_id)
        .eq('date', date)

      const satisfied = new Set(
        (logs ?? [])
          .filter((log) => {
            const habit = dueToday.find((h) => h.id === log.habit_id)
            if (!habit) return false
            return habit.goal_type === 'numeric'
              ? Number(log.value ?? 0) >= Number(habit.goal_target ?? 0)
              : log.completed
          })
          .map((log) => log.habit_id),
      )

      const outstanding = dueToday.filter((h) => !satisfied.has(h.id))

      if (outstanding.length > 0) {
        notified += await pushToUser(settings.user_id, {
          title: 'Still open today',
          body:
            outstanding.length === 1
              ? `${outstanding[0].name} isn't logged yet.`
              : `${outstanding.length} habits aren't logged yet.`,
          url: '/',
          tag: 'lume-habits',
        })
      }
    }

    /* ------------------------------------------------ due / overdue tasks -- */

    if (settings.task_reminder_enabled) {
      const { data: tasks } = await admin
        .from('tasks')
        .select('id, title, due_date')
        .eq('user_id', settings.user_id)
        .eq('status', 'open')
        .not('due_date', 'is', null)
        .lte('due_date', date)

      if (tasks?.length) {
        const overdue = tasks.filter((t) => t.due_date < date).length
        notified += await pushToUser(settings.user_id, {
          title: overdue > 0 ? 'Overdue tasks' : 'Due today',
          body:
            tasks.length === 1
              ? tasks[0].title
              : `${tasks.length} tasks need attention${
                  overdue > 0 ? `, ${overdue} overdue` : ''
                }.`,
          url: '/tasks',
          tag: 'lume-tasks',
        })
      }
    }
  }

  return new Response(JSON.stringify({ notified }), {
    headers: { 'content-type': 'application/json' },
  })
})
