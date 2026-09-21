package com.srceensharing.android.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjectionManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.srceensharing.android.R
import com.srceensharing.android.webrtc.WebRtcScreenHost

class ScreenCaptureService : Service() {
    private var host: WebRtcScreenHost? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        val room = intent?.getStringExtra(EXTRA_ROOM).orEmpty()
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, -1) ?: -1
        val data = intent?.getParcelableExtra<Intent>(EXTRA_DATA)
        if (room.isBlank() || resultCode < 0 || data == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        createChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.capture_notification))
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .build()
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        host?.stop()
        host = WebRtcScreenHost(this, room, resultCode, data).also { it.start() }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        host?.stop()
        host = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.capture_notification), NotificationManager.IMPORTANCE_LOW)
        )
    }

    companion object {
        const val ACTION_STOP = "com.srceensharing.android.STOP"
        const val EXTRA_ROOM = "room"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "projection_data"
        private const val CHANNEL_ID = "screen_capture"
        private const val NOTIFICATION_ID = 7
    }
}
