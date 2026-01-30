import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Platform, Vibration } from 'react-native';
import NotificationService from './NotificationService';

class CallService extends EventEmitter {
  constructor() {
    super();
    this.currentCall = null;
    this.xmppService = null;
    this.callStartTime = null;
  }

  setXmppService(xmppService) {
    if (this.xmppService) {
      this.xmppService.off('jingle_incoming', this._onJingleIncoming);
      this.xmppService.off('jingle_accepted', this._onJingleAccepted);
      this.xmppService.off('jingle_terminated', this._onJingleTerminated);
    }

    this.xmppService = xmppService;

    this._onJingleIncoming = (data) => {
      console.log('CallService: incoming call from', data.from);
      this.handleIncomingCall(data.from, data.callId, data.isVideo);
    };

    this._onJingleAccepted = (data) => {
      console.log('CallService: call accepted', data.callId);
      this.handleCallAccepted(data.callId);
    };

    this._onJingleTerminated = (data) => {
      console.log('CallService: call terminated', data.callId, data.reason);
      this.handleCallTerminated(data.callId, data.reason);
    };

    this.xmppService.on('jingle_incoming', this._onJingleIncoming);
    this.xmppService.on('jingle_accepted', this._onJingleAccepted);
    this.xmppService.on('jingle_terminated', this._onJingleTerminated);
    
    console.log('CallService: XmppService connected');
  }

  async startCall(toJid, isVideo = false) {
    if (!this.xmppService || !this.xmppService.isConnected) {
      console.error('XMPP not connected');
      return null;
    }

    if (this.currentCall) {
      console.log('Already in a call');
      return null;
    }

    const callId = 'call_' + uuidv4();
    
    this.currentCall = {
      id: callId,
      to: toJid,
      from: this.xmppService.userJid,
      isVideo,
      isOutgoing: true,
      state: 'calling',
      startTime: null,
      isMuted: false,
      isSpeaker: false
    };

    console.log('CallService: starting call to', toJid, 'callId:', callId);
    this.xmppService.sendJingleInitiate(toJid, callId, isVideo);
    
    this.emit('call_state_changed', { callId, state: 'calling' });
    
    return callId;
  }

  async acceptCall(callId) {
    if (!this.currentCall || this.currentCall.id !== callId) {
      console.error('No matching call to accept');
      return false;
    }

    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    this.currentCall.state = 'connected';
    this.currentCall.startTime = Date.now();
    this.callStartTime = Date.now();

    const initiatorJid = this.currentCall.from;
    console.log('CallService: accepting call from', initiatorJid);
    this.xmppService.sendJingleAccept(initiatorJid, callId);
    
    this.emit('call_state_changed', { callId, state: 'connected' });
    
    return true;
  }

  async rejectCall(callId) {
    if (!this.currentCall || this.currentCall.id !== callId) {
      return;
    }

    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    const targetJid = this.currentCall.isOutgoing ? this.currentCall.to : this.currentCall.from;
    console.log('CallService: rejecting call, sending terminate to', targetJid);
    this.xmppService.sendJingleTerminate(targetJid, callId, 'decline');
    
    this.emit('call_state_changed', { callId, state: 'ended', reason: 'rejected' });
    this.currentCall = null;
  }

  async endCall(callId) {
    if (!this.currentCall) return;

    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }

    const targetJid = this.currentCall.isOutgoing ? this.currentCall.to : this.currentCall.from;
    const actualCallId = callId || this.currentCall.id;
    
    console.log('CallService: ending call, sending terminate to', targetJid);
    this.xmppService.sendJingleTerminate(targetJid, actualCallId, 'success');
    
    const duration = this.callStartTime ? Math.floor((Date.now() - this.callStartTime) / 1000) : 0;
    
    this.emit('call_state_changed', { 
      callId: actualCallId, 
      state: 'ended', 
      reason: 'hangup',
      duration 
    });
    
    this.currentCall = null;
    this.callStartTime = null;
  }

  handleIncomingCall(fromJid, callId, isVideo) {
    console.log('CallService: handleIncomingCall from', fromJid, 'callId:', callId);
    
    if (this.currentCall) {
      console.log('Already in a call, rejecting incoming');
      this.xmppService.sendJingleTerminate(fromJid, callId, 'busy');
      return;
    }

    this.currentCall = {
      id: callId,
      from: fromJid,
      to: this.xmppService.userJid,
      isVideo,
      isOutgoing: false,
      state: 'ringing',
      startTime: null,
      isMuted: false,
      isSpeaker: false
    };

    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 500, 200, 500], true);
    }
    
    NotificationService.showCallNotification(fromJid, isVideo);
    
    this.emit('incoming_call', { from: fromJid, callId, isVideo });
    this.emit('call_state_changed', { callId, state: 'ringing' });
  }

  handleCallAccepted(callId) {
    console.log('CallService: handleCallAccepted', callId);
    
    if (!this.currentCall || this.currentCall.id !== callId) {
      console.log('No matching call for accepted event');
      return;
    }

    this.currentCall.state = 'connected';
    this.currentCall.startTime = Date.now();
    this.callStartTime = Date.now();
    
    this.emit('call_state_changed', { callId, state: 'connected' });
  }

  handleCallTerminated(callId, reason) {
    console.log('CallService: handleCallTerminated', callId, reason);
    
    if (!this.currentCall || this.currentCall.id !== callId) {
      console.log('No matching call for terminated event');
      return;
    }

    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    
    const duration = this.callStartTime ? Math.floor((Date.now() - this.callStartTime) / 1000) : 0;
    
    this.emit('call_state_changed', { callId, state: 'ended', reason, duration });
    this.currentCall = null;
    this.callStartTime = null;
  }

  toggleMute() {
    if (!this.currentCall) return false;
    this.currentCall.isMuted = !this.currentCall.isMuted;
    this.emit('call_state_changed', { 
      callId: this.currentCall.id, 
      state: this.currentCall.state,
      isMuted: this.currentCall.isMuted 
    });
    return this.currentCall.isMuted;
  }

  toggleSpeaker() {
    if (!this.currentCall) return false;
    this.currentCall.isSpeaker = !this.currentCall.isSpeaker;
    this.emit('call_state_changed', { 
      callId: this.currentCall.id, 
      state: this.currentCall.state,
      isSpeaker: this.currentCall.isSpeaker 
    });
    return this.currentCall.isSpeaker;
  }

  getCurrentCall() {
    return this.currentCall;
  }

  getCallDuration() {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime) / 1000);
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export default new CallService();
