package com.srceensharing.android.webrtc

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import com.srceensharing.android.signal.SignalMessage
import com.srceensharing.android.signal.SupabaseSignaling
import org.webrtc.AudioSource
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import java.util.UUID

class WebRtcScreenHost(
    private val context: Context,
    private val roomCode: String,
    projectionResultCode: Int,
    projectionData: Intent
) {
    private val id = UUID.randomUUID().toString()
    private val egl = EglBase.create()
    private val factory: PeerConnectionFactory
    private val videoSource: VideoSource
    private val capturer: ScreenCapturerAndroid
    private val textureHelper: SurfaceTextureHelper
    private val signaling: SupabaseSignaling
    private val peers = mutableMapOf<String, Peer>()
    private val iceServers = listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions()
        )
        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
            .createPeerConnectionFactory()
        videoSource = factory.createVideoSource(false)
        textureHelper = SurfaceTextureHelper.create("ScreenCapture", egl.eglBaseContext)
        capturer = ScreenCapturerAndroid(projectionData, object : MediaProjection.Callback() {
            override fun onStop() { stop() }
        })
        capturer.initialize(textureHelper, context, videoSource.capturerObserver)
        signaling = SupabaseSignaling(roomCode, id, ::handleSignal, ::handleSignalingState)
    }

    private fun handleSignalingState(state: SupabaseSignaling.State) {
        if (state == SupabaseSignaling.State.CONNECTED) {
            signaling.send(SignalMessage.Simple("host-ready", id))
        }
    }

    fun start() {
        capturer.startCapture(720, 1280, 30)
        signaling.connect()
    }

    private fun handleSignal(message: SignalMessage) {
        when (message) {
            is SignalMessage.Simple -> if (message.type == "viewer-join") createPeer(message.from)
            is SignalMessage.Answer -> peers[message.from]?.let { peer ->
                peer.connection.setRemoteDescription(SdpObserverAdapter(), SessionDescription(SessionDescription.Type.ANSWER, message.sdp))
                peer.pendingCandidates.forEach(peer.connection::addIceCandidate)
                peer.pendingCandidates.clear()
            }
            is SignalMessage.Ice -> peers[message.from]?.let { peer ->
                val candidate = IceCandidate(
                    message.candidate.optString("sdpMid"),
                    message.candidate.optInt("sdpMLineIndex"),
                    message.candidate.optString("candidate")
                )
                if (peer.connection.remoteDescription == null) peer.pendingCandidates += candidate
                else peer.connection.addIceCandidate(candidate)
            }
            else -> Unit
        }
    }

    private fun createPeer(viewerId: String) {
        if (peers.containsKey(viewerId)) return
        val connection = factory.createPeerConnection(iceServers, createObserver(viewerId)) ?: return
        val peer = Peer(connection)
        peers[viewerId] = peer
        connection.addTrack(factory.createVideoTrack("screen", videoSource), listOf("screen"))
        connection.createOffer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(description: SessionDescription) {
                connection.setLocalDescription(this, description)
                signaling.send(SignalMessage.Offer(id, viewerId, description.description))
            }
        }, MediaConstraints())
    }

    private fun createObserver(viewerId: String) = object : PeerConnection.Observer {
        override fun onIceCandidate(candidate: IceCandidate) {
            signaling.send(SignalMessage.Ice(id, viewerId, org.json.JSONObject()
                    .put("candidate", candidate.sdp)
                    .put("sdpMid", candidate.sdpMid)
                    .put("sdpMLineIndex", candidate.sdpMLineIndex)))
        }
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            if (newState == PeerConnection.PeerConnectionState.FAILED ||
                newState == PeerConnection.PeerConnectionState.CLOSED) {
                peers.entries.removeIf { it.value.connection.connectionState == newState }
            }
        }
        override fun onSignalingChange(p0: PeerConnection.SignalingState) = Unit
        override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState) = Unit
        override fun onIceConnectionReceivingChange(p0: Boolean) = Unit
        override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState) = Unit
        override fun onAddStream(p0: MediaStream) = Unit
        override fun onRemoveStream(p0: MediaStream) = Unit
        override fun onDataChannel(p0: org.webrtc.DataChannel) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(p0: org.webrtc.RtpReceiver, p1: Array<out MediaStream>) = Unit
        override fun onTrack(transceiver: org.webrtc.RtpTransceiver) = Unit
    }

    private class Peer(val connection: PeerConnection, val pendingCandidates: MutableList<IceCandidate> = mutableListOf())

    fun stop() {
        peers.values.forEach { it.connection.close() }
        peers.clear()
        runCatching { capturer.stopCapture() }
        signaling.close()
        videoSource.dispose()
        textureHelper.dispose()
        factory.dispose()
        egl.release()
    }
}

open class SdpObserverAdapter : org.webrtc.SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) = Unit
    override fun onSetSuccess() = Unit
    override fun onCreateFailure(error: String) = Unit
    override fun onSetFailure(error: String) = Unit
}
