import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  LocalNotificationSchema,
  PendingLocalNotificationSchema,
} from '@capacitor/local-notifications';
import type { PetRecord } from '../models';

const channelId = 'petcare-care-reminders';
const historyKey = 'petcare-reminder-history';

@Injectable({ providedIn: 'root' })
export class CareNotificationsService {
  private queue = Promise.resolve();
  private revision = 0;

  async refresh(owner: string, loadRecords: () => Promise<PetRecord[]>): Promise<void> {
    if (!this.supported()) return;
    const revision = ++this.revision;
    try {
      const records = await loadRecords();
      await this.enqueue(async () => {
        if (revision === this.revision) await this.reconcile(owner, records, () => true);
      });
    } catch (error) {
      console.warn('Could not refresh phone reminders.', error);
    }
  }

  save(owner: string, record: PetRecord): Promise<void> {
    this.revision++;
    return this.enqueue(() =>
      this.reconcile(owner, [record], (item) => item.extra.recordId === record.id),
    );
  }

  remove(owner: string, field: 'recordId' | 'petId', id: string): Promise<void> {
    this.revision++;
    return this.enqueue(() => this.reconcile(owner, [], (item) => item.extra[field] === id));
  }

  clear(): Promise<void> {
    this.revision++;
    return this.enqueue(async () => {
      await LocalNotifications.cancelAll();
      await LocalNotifications.removeAllDeliveredNotifications();
      const now = Date.now();
      const history = this.readHistory(new Date(now).setHours(0, 0, 0, 0));
      for (const key of Object.keys(history)) {
        if (history[key] > now) delete history[key];
      }
      localStorage.setItem(historyKey, JSON.stringify(history));
    });
  }

  private supported(): boolean {
    return (
      Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocalNotifications')
    );
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    if (!this.supported()) return Promise.resolve();
    this.queue = this.queue.then(work).catch((error) => {
      console.warn('Could not update phone reminders.', error);
    });
    return this.queue;
  }

  private async reconcile(
    owner: string,
    records: PetRecord[],
    inScope: (item: PendingLocalNotificationSchema) => boolean,
  ): Promise<void> {
    const { notifications: stored } = await LocalNotifications.getPending();
    const current = stored.filter((item) => item.extra?.channel === channelId && inScope(item));
    const byKey = new Map(current.map((item) => [item.extra.key, item]));
    const keep = new Set<number>();
    const upcoming: LocalNotificationSchema[] = [];
    const now = new Date();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const history = this.readHistory(startOfToday);
    let id = stored.reduce((highest, item) => Math.max(highest, item.id), 0);

    for (const record of records) {
      if (!record.nextDate) continue;
      for (const daysBefore of [1, 0]) {
        const at = new Date(`${record.nextDate}T09:00:00`);
        at.setDate(at.getDate() - daysBefore);
        const time = at.getTime();
        if (!Number.isFinite(time) || time < startOfToday) continue;

        const key = JSON.stringify([owner, record.id, record.nextDate, daysBefore]);
        const body = `${record.title} is due ${daysBefore ? 'tomorrow' : 'today'}.`;
        const existing = byKey.get(key);
        const timePassed = time <= now.getTime();
        if (existing && (timePassed || (existing.extra.time === time && existing.body === body))) {
          keep.add(existing.id);
          history[key] = time;
          continue;
        }
        // A reminder added after 9 a.m. can fire now, but reopening the app must not replay it.
        if (timePassed && history[key] !== undefined) continue;
        upcoming.push({
          id: ++id,
          title: 'Petcare reminder',
          body,
          channelId,
          isExactNotification: false,
          schedule: { at, allowWhileIdle: true },
          extra: { channel: channelId, key, recordId: record.id, petId: record.petId, time },
        });
      }
    }

    const obsolete = current.filter((item) => !keep.has(item.id));
    if (obsolete.length) {
      const ids = obsolete.map((item) => item.id);
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
      await LocalNotifications.removeDeliveredNotificationsById({ ids });
      for (const item of obsolete) {
        if (item.extra.time > now.getTime()) delete history[item.extra.key];
      }
    }
    localStorage.setItem(historyKey, JSON.stringify(history));

    if (upcoming.length) {
      let { display } = await LocalNotifications.checkPermissions();
      if (display === 'prompt') ({ display } = await LocalNotifications.requestPermissions());
      if (display !== 'granted') return;
      await LocalNotifications.createChannel({
        id: channelId,
        name: 'Care reminders',
        importance: 3,
        visibility: 0,
        vibration: true,
      });
      await LocalNotifications.schedule({ notifications: upcoming });
      for (const item of upcoming) history[item.extra.key] = item.extra.time;
      localStorage.setItem(historyKey, JSON.stringify(history));
    }
  }

  private readHistory(startOfToday: number): Record<string, number> {
    try {
      const stored: Record<string, number> = JSON.parse(localStorage.getItem(historyKey) || '{}');
      return Object.fromEntries(Object.entries(stored).filter(([, time]) => time >= startOfToday));
    } catch {
      return {};
    }
  }
}
