package com.srceensharing.android

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.srceensharing.android.capture.ScreenCaptureService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ScreenShareApp() }
    }

    @Composable
    private fun ScreenShareApp() {
        var room by remember { mutableStateOf("") }
        var sharing by remember { mutableStateOf(false) }
        var pendingRoom by remember { mutableStateOf("") }
        val projectionLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                val service = Intent(this, ScreenCaptureService::class.java)
                    .putExtra(ScreenCaptureService.EXTRA_ROOM, pendingRoom)
                    .putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
                    .putExtra(ScreenCaptureService.EXTRA_DATA, result.data)
                ContextCompat.startForegroundService(this, service)
                sharing = true
            }
        }

        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("Share your Android screen", style = MaterialTheme.typography.headlineSmall)
                Text("Use the same room code as the browser viewer.")
                OutlinedTextField(
                    value = room,
                    onValueChange = { room = it.filter(Char::isLetterOrDigit).take(32) },
                    label = { Text("Room code") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    enabled = room.isNotBlank() && !sharing,
                    onClick = {
                        pendingRoom = room
                        val manager = getSystemService(MediaProjectionManager::class.java)
                        projectionLauncher.launch(manager.createScreenCaptureIntent())
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Start sharing") }
                Button(
                    enabled = sharing,
                    onClick = {
                        stopService(Intent(this@MainActivity, ScreenCaptureService::class.java))
                        sharing = false
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Stop sharing") }
                if (sharing) Text("Sharing is active for room $room")
            }
        }
    }
}
