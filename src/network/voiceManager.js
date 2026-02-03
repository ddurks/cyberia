// WebRTC voice manager for proximity-based voice chat
// Handles RTCPeerConnection lifecycle, audio streams, and signaling

export class VoiceManager {
  constructor(networkClient) {
    this.networkClient = networkClient;
    this.localStream = null;
    this.peerConnections = new Map(); // playerId -> RTCPeerConnection
    this.audioElements = new Map(); // playerId -> HTMLAudioElement
    this.currentPeers = new Set(); // Current voice peers from server
    
    // ICE servers for NAT traversal
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  // Get local microphone stream
  async getLocalStream() {
    if (this.localStream) return this.localStream;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return this.localStream;
    } catch (error) {
      console.error('[VoiceManager] Failed to get microphone:', error);
      throw error;
    }
  }

  // Handle voicePeers update from server
  async updateVoicePeers(peersArray, playerId) {
    const newPeers = new Set(peersArray);

    // Remove peers no longer in range
    for (const peerId of this.currentPeers) {
      if (!newPeers.has(peerId)) {
        this.closePeerConnection(peerId);
      }
    }

    this.currentPeers = newPeers;

    // Add new peers in range
    for (const peerId of newPeers) {
      if (!this.peerConnections.has(peerId)) {
        // Only initiator creates the offer (lower ID initiates)
        const shouldInitiate = playerId < peerId;
        await this.createPeerConnection(peerId, shouldInitiate);
      }
    }
  }

  // Create RTCPeerConnection for a peer
  async createPeerConnection(peerId, shouldInitiate) {
    try {
      // Get local stream if not already got it
      if (!this.localStream) {
        await this.getLocalStream();
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
      });

      // Add local stream tracks
      for (const track of this.localStream.getTracks()) {
        peerConnection.addTrack(track, this.localStream);
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log(
          `[VoiceManager] Received remote stream from ${peerId}:`,
          event.streams
        );
        this.attachRemoteStream(peerId, event.streams[0]);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send only the essential fields
          const candidateData = {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          };
          this.networkClient.sendRTCIce(peerId, JSON.stringify(candidateData));
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'disconnected'
        ) {
          this.closePeerConnection(peerId);
        }
      };

      this.peerConnections.set(peerId, peerConnection);

      // Initiator creates offer
      if (shouldInitiate) {
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          this.networkClient.sendRTCOffer(peerId, peerConnection.localDescription.sdp);
        } catch (error) {
          console.error('[VoiceManager] Failed to create offer:', error);
          this.closePeerConnection(peerId);
        }
      }
    } catch (error) {
      console.error('[VoiceManager] Failed to create peer connection:', error);
    }
  }

  // Handle incoming offer from peer
  async handleRTCOffer(fromId, sdp) {
    try {
      let peerConnection = this.peerConnections.get(fromId);
      if (!peerConnection) {
        // Non-initiator: peer initiated, create connection but don't send offer
        if (!this.localStream) {
          await this.getLocalStream();
        }
        peerConnection = new RTCPeerConnection({
          iceServers: this.iceServers,
        });
        for (const track of this.localStream.getTracks()) {
          peerConnection.addTrack(track, this.localStream);
        }
        peerConnection.ontrack = (event) => {
          this.attachRemoteStream(fromId, event.streams[0]);
        };
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            const candidateData = {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            };
            this.networkClient.sendRTCIce(fromId, JSON.stringify(candidateData));
          }
        };
        peerConnection.onconnectionstatechange = () => {
          if (
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'disconnected'
          ) {
            this.closePeerConnection(fromId);
          }
        };
        this.peerConnections.set(fromId, peerConnection);
      }

      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      this.networkClient.sendRTCAnswer(fromId, peerConnection.localDescription.sdp);
    } catch (error) {
      console.error('[VoiceManager] Failed to handle offer:', error);
      this.closePeerConnection(fromId);
    }
  }

  // Handle incoming answer from peer
  async handleRTCAnswer(fromId, sdp) {
    try {
      const peerConnection = this.peerConnections.get(fromId);
      if (!peerConnection) {
        return;
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error('[VoiceManager] Failed to handle answer:', error);
      this.closePeerConnection(fromId);
    }
  }

  // Handle incoming ICE candidate from peer
  async handleRTCIce(fromId, candidateStr) {
    try {
      const peerConnection = this.peerConnections.get(fromId);
      if (!peerConnection) {
        return;
      }

      const candidateObj = JSON.parse(candidateStr);
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj));
    } catch (error) {
      console.error('[VoiceManager] Failed to add ICE candidate:', error);
    }
  }

  // Attach remote audio stream to audio element
  attachRemoteStream(peerId, stream) {
    let audioElement = this.audioElements.get(peerId);
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.autoplay = true;
      audioElement.playsinline = true;
      audioElement.id = `audio-${peerId}`;
      document.body.appendChild(audioElement);
      this.audioElements.set(peerId, audioElement);
    }

    audioElement.srcObject = stream;
  }

  // Close peer connection and cleanup
  closePeerConnection(peerId) {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
    }

    const audioElement = this.audioElements.get(peerId);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElement.remove();
      this.audioElements.delete(peerId);
    }
  }

  // Cleanup: close all connections and stop local stream
  disconnect() {
    for (const peerId of Array.from(this.peerConnections.keys())) {
      this.closePeerConnection(peerId);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.currentPeers.clear();
  }

  // Mute/unmute local audio
  setMuted(muted) {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        if (track.kind === 'audio') {
          track.enabled = !muted;
        }
      }
    }
  }

  // Get current peer count
  getPeerCount() {
    return this.peerConnections.size;
  }
}
