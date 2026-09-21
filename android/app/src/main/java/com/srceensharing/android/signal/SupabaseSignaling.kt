package com.srceensharing.android.signal

import android.util.Log
import com.srceensharing.android.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.UUID

class SupabaseSignaling(
    private val roomCode: String,
    private val clientId: String = UUID.randomUUID().toString(),
    private val onSignal: (SignalMessage) -> Unit,
    private val onState: (State) -> Unit
) {
    enum class State { CONNECTING, CONNECTED, CLOSED, ERROR }

    private val client = OkHttpClient()
    private var socket: WebSocket? = null
    private val topic = "realtime:room-$roomCode"
    private val joinRef = "1"

    fun connect() {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        val wsBase = base.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://")
        val request = Request.Builder()
            .url("$wsBase/realtime/v1/websocket?apikey=${BuildConfig.SUPABASE_ANON_KEY}&vsn=1.0.0")
            .build()
        onState(State.CONNECTING)
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val join = JSONObject()
                    .put("topic", topic)
                    .put("event", "phx_join")
                    .put("payload", JSONObject().put("config", JSONObject().put("broadcast", JSONObject().put("self", false))))
                    .put("ref", joinRef)
                webSocket.send(join.toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching {
                    val message = JSONObject(text)
                    when (message.optString("event")) {
                        "phx_reply" -> if (message.optJSONObject("payload")?.optString("status") == "ok") {
                            onState(State.CONNECTED)
                        }
                        "broadcast" -> {
                            val payload = message.optJSONObject("payload") ?: return
                            val signal = payload.optJSONObject("payload") ?: return
                            SignalMessage.parse(signal)?.takeIf { it.from != clientId }?.let(onSignal)
                        }
                    }
                }.onFailure {
                    Log.w(TAG, "Ignoring malformed signaling message", it)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onState(State.ERROR)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                onState(State.CLOSED)
            }
        })
    }

    fun send(message: SignalMessage) {
        val envelope = JSONObject()
            .put("topic", topic)
            .put("event", "broadcast")
            .put("payload", JSONObject().put("event", "signal").put("payload", message.toJson()))
            .put("ref", JSONObject.NULL)
        socket?.send(envelope.toString())
    }

    fun close() {
        socket?.close(1000, "capture stopped")
        socket = null
        client.dispatcher.executorService.shutdown()
    }

    companion object { private const val TAG = "SupabaseSignaling" }
}
