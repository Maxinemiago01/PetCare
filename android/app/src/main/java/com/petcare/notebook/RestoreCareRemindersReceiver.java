package com.petcare.notebook;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import com.capacitorjs.plugins.localnotifications.LocalNotificationSchedule;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.getcapacitor.CapConfig;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;

public class RestoreCareRemindersReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        long now = System.currentTimeMillis();
        Calendar midnight = Calendar.getInstance();
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);

        NotificationStorage storage = new NotificationStorage(context);
        List<LocalNotification> missed = new ArrayList<>();
        for (LocalNotification reminder : storage.getSavedNotifications()) {
            if (!"petcare-care-reminders".equals(reminder.getChannelId()) || reminder.getCancelled()) continue;
            LocalNotificationSchedule schedule = reminder.getSchedule();
            Date at = schedule == null ? null : schedule.getAt();
            if (at != null && at.getTime() >= midnight.getTimeInMillis() && at.getTime() <= now) {
                missed.add(reminder);
            }
        }
        // The plugin restores future alarms. A saved time earlier today posts immediately.
        if (!missed.isEmpty()) {
            new LocalNotificationManager(storage, null, context, CapConfig.loadDefault(context)).schedule(null, missed);
        }
    }
}
