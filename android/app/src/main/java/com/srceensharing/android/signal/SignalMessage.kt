package com.srceensharing.android.signal

import org.json.JSONObject

sealed interface SignalMessage {
    val type: String
    val from: String
    val to: String?

    data class Offer(override val from: String, override val to: String, val sdp: String) : SignalMessage {
        override val type = "offer"
    }
    data class Answer(override val from: String, override val to: String, val sdp: String) : SignalMessage {
        override val type = "answer"
    }
    data class Ice(override val from: String, override val to: String, val candidate: JSONObject) : SignalMessage {
        override val type = "ice"
    }
    data class Simple(override val type: String, override val from: String) : SignalMessage {
        override val to: String? = null
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("type", type)
        put("from", from)
        to?.let { put("to", it) }
        when (this@SignalMessage) {
            is Offer -> put("sdp", JSONObject().put("type", "offer").put("sdp", sdp))
            is Answer -> put("sdp", JSONObject().put("type", "answer").put("sdp", sdp))
            is Ice -> put("candidate", candidate)
            is Simple -> Unit
        }
    }

    companion object {
        fun parse(json: JSONObject): SignalMessage? {
            val type = json.optString("type")
            val from = json.optString("from")
            if (type.isBlank() || from.isBlank()) return null
            return when (type) {
                "offer" -> Offer(from, json.optString("to"), json.optJSONObject("sdp")?.optString("sdp").orEmpty())
                "answer" -> Answer(from, json.optString("to"), json.optJSONObject("sdp")?.optString("sdp").orEmpty())
                "ice" -> json.optJSONObject("candidate")?.let { Ice(from, json.optString("to"), it) }
                "viewer-join", "host-ready", "viewer-leave" -> Simple(type, from)
                else -> null
            }
        }
    }
}
