import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function getSignalWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/signal/`;
}

/**
 * WebRTC video-call widget for TeleICU.
 *
 * Uses the browser's native RTCPeerConnection API and a shared
 * WebSocket signalling channel at /ws/signal/.
 *
 * Props:
 *   roomName  – signalling room identifier (default "teleicu")
 *   className – optional extra classes for the wrapper
 */
export default function VideoCall({ roomName = 'teleicu', className = '' }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const makingOfferRef = useRef(false);

  const { isConnected: wsConnected, lastMessage, sendMessage } = useWebSocket(getSignalWsUrl());

  // ── Helpers ──────────────────────────────────────────────────────────────

  const isWebRTCSupported =
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia !== 'undefined';

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onnegotiationneeded = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const endCall = useCallback(() => {
    cleanupPeerConnection();
    stopLocalStream();
    setIsCallActive(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setError('');
  }, [cleanupPeerConnection, stopLocalStream]);

  // ── Start a call (create offer) ──────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!wsConnected) {
      setError('Signalling server not connected. Please wait…');
      return;
    }
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      makingOfferRef.current = true;

      // Forward local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendMessage(
            JSON.stringify({
              type: 'ice-candidate',
              candidate: e.candidate,
              room: roomName,
            }),
          );
        }
      };

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendMessage(
            JSON.stringify({ type: 'offer', sdp: pc.localDescription, room: roomName }),
          );
        } catch (err) {
          console.error('onnegotiationneeded error:', err);
        }
      };

      setIsCallActive(true);
    } catch (err) {
      console.error('startCall error:', err);
      setError('Could not access camera/microphone. Check permissions.');
    }
  }, [wsConnected, roomName, sendMessage]);

  // ── Handle incoming signalling messages ──────────────────────────────────

  useEffect(() => {
    if (!lastMessage?.data) return;

    let data;
    try {
      data = JSON.parse(lastMessage.data);
    } catch {
      return;
    }

    // Only process messages for our room (or room-agnostic broadcast)
    if (data.room && data.room !== roomName) return;

    const pc = pcRef.current;
    if (!pc && data.type !== 'offer') return;

    const handleSignal = async () => {
      try {
        if (data.type === 'offer') {
          // Incoming call – create answer
          if (!pcRef.current) {
            // We don't auto-answer; the user must click "Start Call" first
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendMessage(
            JSON.stringify({ type: 'answer', sdp: pc.localDescription, room: roomName }),
          );
        } else if (data.type === 'answer' && pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } else if (data.type === 'ice-candidate' && pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('signalling handler error:', err);
      }
    };

    handleSignal();
  }, [lastMessage, roomName, sendMessage]);

  // ── Mute / video toggle ──────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted; // enabled=true means unmuted
        setIsMuted((prev) => !prev);
      }
    }
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff; // enabled=true means video ON
        setIsVideoOff((prev) => !prev);
      }
    }
  }, [isVideoOff]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  // ── Render ───────────────────────────────────────────────────────────────

  // Fallback when WebRTC is not available
  if (!isWebRTCSupported) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>📹</span> Video Call
        </h3>
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <div className="text-4xl mb-3">📹</div>
          <p className="text-gray-500 text-sm">
            Video calling is not available in your browser.
            <br />
            Please use a modern browser that supports WebRTC.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>📹</span> Video Call
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            wsConnected
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          {wsConnected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      {/* Video feeds */}
      <div className="relative bg-black aspect-video">
        {/* Remote video (full size) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        >
          <track kind="captions" />
        </video>

        {!isCallActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-5xl mb-3">📹</div>
              <p className="text-gray-300 text-sm">Press Start Call to begin</p>
            </div>
          </div>
        )}

        {/* Local video (PiP overlay) */}
        <div className="absolute bottom-3 right-3 w-1/4 aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          >
            <track kind="captions" />
          </video>
          {!isCallActive && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-xs bg-gray-900/60">
              Local
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center justify-center gap-3">
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={!wsConnected}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📞</span> Start Call
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                isMuted
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isMuted ? '🔇 Muted' : '🎤 Unmuted'}
            </button>

            <button
              onClick={toggleVideo}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                isVideoOff
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isVideoOff ? '📷 Video Off' : '📹 Video On'}
            </button>

            <button
              onClick={endCall}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <span>📞</span> End Call
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
