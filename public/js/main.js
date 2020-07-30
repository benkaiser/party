var searchParams = new URLSearchParams(window.location.search);
var username = searchParams.get('name');
var roomName = window.location.pathname.replace('/','').toLocaleLowerCase() || 'liveparty2020';
const peers = {};
let music = {};
let localTracks = {};
let remoteTracks = {};
let isJoined = false;
let room;
var player;
var youtubeReady = false;
let jumpedForVideo = false;
let resolveYoutubeReady;
let youtubeVolume = 100;
const playerReadyPromise = new Promise((resolve, reject) => {
  resolveYoutubeReady = resolve;
});

if (!username) {
  username = prompt('What is your name?');
}
const myInfo = {
  name: username,
  room: roomName,
  participantId: null,
  x: 0.1,
  y: 0.1
};

JitsiMeetJS.init({
  disableAudioLevels: true,
});

connection = new JitsiMeetJS.JitsiConnection(null, null, {
  hosts: {
    domain: "meet.jit.si",
    muc: "conference.meet.jit.si",
    focus: "focus.meet.jit.si",
  },
  externalConnectUrl: "https://meet.jit.si/http-pre-bind",
  enableP2P: true,
  p2p: {
    enabled: true,
    preferH264: true,
    disableH264: true,
    useStunTurn: true,
  },
  useStunTurn: true,
  bosh: `https://meet.jit.si/http-bind?room=${roomName}`,
  websocket: "wss://meet.jit.si/xmpp-websocket",
  clientNode: "http://jitsi.org/jitsimeet",
});

connection.addEventListener(
  JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
  onConnectionSuccess
);
connection.addEventListener(
  JitsiMeetJS.events.connection.CONNECTION_FAILED,
  onConnectionFailed
);
connection.addEventListener(
  JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
  disconnect
);

connection.connect();

JitsiMeetJS.createLocalTracks({ devices: ["audio", /* "video" */] }).then(tracks => {
  for (const track of tracks) {

    switch (track.getType()) {
      case "audio":
        console.log(`attach local audio track`, track);
        localTracks.audio = track;
        break;

      case "video":
        console.log(`attach local video track`, track);
        break;

      default:
        console.warn(
          `Unknown track type, won't add: ${track.getType()}`,
          track
        );
    }

    if (isJoined) {
      room.addTrack(track);
      myInfo.participantId = room.myUserId();
      onPeerReady();
    }
  }
});

function onConnectionSuccess() {
  console.log('Connection success');

  room = window.room = connection.initJitsiConference(roomName, {
    openBridgeChannel: true,
  });
  room.setDisplayName(username);
  room.on(JitsiMeetJS.events.conference.TRACK_ADDED, onRemoteTrack);
  room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track, a) => {
    console.log("track removed", track, a);
  });
  room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, onConferenceJoined);
  room.join();
}

function onConferenceJoined() {
  console.log("conference joined!");
  isJoined = true;

  for (const track of Object.values(localTracks)) {
    console.log("onConferenceJoined add track", track);
    room.addTrack(track);
    myInfo.participantId = room.myUserId();
    onPeerReady();
  }
}

function onConnectionFailed() {
  console.log('Connection failed');
}

function disconnect() {
  console.log('Connection disconnect');
}

function getAudioForPeer(participantId) {
  return remoteTracks[participantId];
}

/**
 * Handles remote tracks
 * @param track JitsiTrack object
 */
function onRemoteTrack(track) {
  if (track.isLocal()) {
    return;
  }
  const participantId = track.getParticipantId();
  // const participant = initRemoteParticipant(participantId, 1);

  track.addEventListener(
    JitsiMeetJS.events.track.TRACK_AUDIO_LEVEL_CHANGED,
    (audioLevel) => console.log(`Audio Level remote: ${audioLevel}`)
  );
  track.addEventListener(JitsiMeetJS.events.track.TRACK_MUTE_CHANGED, () =>
    console.log("remote track muted")
  );
  track.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, () =>
    console.log("remote track stoped")
  );
  track.addEventListener(
    JitsiMeetJS.events.track.TRACK_AUDIO_OUTPUT_CHANGED,
    (deviceId) =>
      console.log(`track audio output device was changed to ${deviceId}`)
  );

  const id = participantId + track.getType();

  switch (track.getType()) {
    case "audio":
      console.log("create remote video audio", participantId, id);
      const audioElement = document.createElement("audio");
      audioElement.id = id;
      audioElement.autoplay = true;
      audioElement.volume = 0;
      document.body.appendChild(audioElement);
      track.attach(audioElement);
      remoteTracks[participantId] = {
        audio: track,
        element: audioElement
      };
      redraw();
    break

    case "video":
      console.log("create remote video track", participantId, id);
      // const videoElement = relmContext.createVideoElement(participant.playerId);
      // if (videoElement) {
      //   // NOTE: no need to append videoElement, it has already been added to video bubble
      //   videoElement.id = id;
      //   adjustVideoClasses(track.videoType === "camera", false, videoElement);
      //   track.attach(videoElement);
      // } else {
      //   console.warn("Can't create video element for remote player");
      // }
    break

    default:
      console.error(`Can't create remote track of type ${track.getType()}`)
  }
}

var socket = io();
socket.on('connect', () => {
  console.log('Socket ready');
  onSocketReady();
});
socket.on('joiner', (peerInfo) => {
  if (peerInfo === null) {
    return;
  }
  console.log('Peer joined: ' + peerInfo.name);
  peers[peerInfo.participantId] = peerInfo;
  redraw();
});
socket.on('updateInfo', (peerInfo) => {
  peers[peerInfo.participantId] = {
    ...peers[peerInfo.participantId],
    ...peerInfo
  };
  redraw();
});
socket.on('leaver', (peerInfo) => {
  console.log('Peer left: ' + (peerInfo ? peerInfo.name : ''));
  if (peerInfo) {
    delete peers[peerInfo.participantId];
  }
  redraw();
});
socket.on('music', (musicInfo) => {
  setMusic(musicInfo);
});

var peerReady = false;
function onPeerReady() {
  peerReady = true;
  onAllReady();
}

var socketReady = false;
function onSocketReady() {
  socketReady = true;
  onAllReady();
}

function onAllReady() {
  if (socketReady && peerReady) {
    console.log('Emitting join');
    socket.emit('join', myInfo);
  }
}

var ctx;
function setup() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  requestAnimationFrame(onFrame);
};

setup();

function getPeersWithAudio() {
  return Object.entries(peers).map(([_, peer]) => {
    const peerAudio = getAudioForPeer(peer.participantId);
    if (!peerAudio) { return; }
    return {
      ...peer,
      ...peerAudio
    };
  }).filter(peer => !!peer);
}

function redraw() {
  requestAnimationFrame(onFrame);
  getPeersWithAudio().forEach(peer => {
    const distance = getDistance(myInfo, peer);
    let volume = 1 - easeOutCirc(distance);
    console.log('Distance: ' + distance);
    console.log('Volume: ' + volume);
    peer.element.volume = volume;
  });
  updateYoutubeVolume();
}

function updateYoutubeVolume() {
  const distance = getDistance(myInfo, { x: 0.5, y: 0 });
  let volume = 1 - easeOutCirc(distance);
  console.log('Music Distance: ' + distance);
  console.log('Music Volume: ' + volume);
  if (youtubeReady) {
    player.setVolume(Math.min(volume * 1.5 * 100, 100) * youtubeVolume / 100);
  }
}

function getDistance(peer1, peer2) {
  const xDiff = Math.abs(peer1.x - peer2.x);
  const yDiff = Math.abs(peer1.y - peer2.y);
  const hyp = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2)) / Math.sqrt(2);
  return hyp;
}

function onFrame() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgb(255, 255, 255)';

  drawScene(ctx, w, h);

  // ctx.fillRect(50, 50, 50 * Math.random(), 500 * Math.random());
  ctx.font = "30px Arial";
  ctx.fillText(username, w * myInfo.x, h * myInfo.y);


  getPeersWithAudio().forEach(peer => {
    ctx.font = "30px Arial";
    ctx.fillText(peer.name, w * peer.x, h * peer.y);
  });
}

function drawScene(ctx, w, h) {
  ctx.font = "100px Arial";
  ctx.fillText("🚪", w * 0.1, h * 0.15);
  ctx.fillText("🛋️", w * 0.1, h * 0.8);
  // ctx.fillText("📺", w * 0.8, h * 0.2);
  ctx.fillText("🎲", w * 0.8, h * 0.2);
  ctx.font = "50px Arial";
  ctx.fillText("🍧", w * 0.75, h * 0.75);
  ctx.fillText("🥤", w * 0.77, h * 0.75);
  ctx.fillText("🍪", w * 0.8, h * 0.75);
  ctx.fillText("🍿", w * 0.75, h * 0.8);
  ctx.fillText("🎂", w * 0.77, h * 0.8);
  ctx.fillText("🍕", w * 0.8, h * 0.8);
}

// Modified from https://easings.net/#easeOutCirc as a starting place
function easeOutCirc(x) {
  return Math.sqrt(
      Math.max(0.8 - Math.pow(x - 1, 2), 0)
  );
}

document.getElementById('canvas').addEventListener('click', (event) => {
  event.preventDefault();
  myInfo.x = event.clientX / window.innerWidth;
  myInfo.y = event.clientY / window.innerHeight;
  socket.emit('updateInfo', myInfo);
  redraw();
  if (player) {
    player.playVideo();
  }
  return false;
});
document.getElementById('loadTrack').addEventListener('click', () => {
  const url = prompt('Youtube video link?');
  const id = youtube_parser(url);
  socket.emit('setMusic', id);
});
document.getElementById('volumeSlider').oninput = function() {
  youtubeVolume = this.value;
  updateYoutubeVolume();
}
window.addEventListener('resize', () => {
  redraw();
});


function youtube_parser(url){
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  var match = url.match(regExp);
  return (match&&match[7].length==11)? match[7] : false;
}

// setup youtube
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    videoId: '',
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function setMusic(musicInfo) {
  jumpedForVideo = false;
  playerReadyPromise.then(() => {
    music.musicInfo = musicInfo;
    player.loadVideoById(musicInfo.id, 0);
  });
}

function renderMusic() {
  document.getElementById('musicTitle').innerHTML = music.title;
}

function onPlayerReady(event) {
  resolveYoutubeReady();
  youtubeReady = true;
}

setInterval(() => {
  if (youtubeReady) {
    player.playVideo();
  }
}, 1000);

function updateTitle() {
  try {
    music.title = 'Unknown Song';
    music.title = player.getVideoData().title;
    music.title = player.getVideoData().title.split('-')[1].trim();
  } catch (error) {
    // no-op
  }
  renderMusic();
}

var done = false;
function onPlayerStateChange(event) {
  if (event.data == YT.PlayerState.PLAYING) {
    redraw();
    updateTitle();
    if (!jumpedForVideo) {
      const duration = player.getDuration() * 1000;
      const epochOffset = (+new Date());
      const epochDiff = epochOffset - music.musicInfo.startTime;
      const placeToPlay = (epochDiff % duration) / 1000;
      player.seekTo(placeToPlay);
      jumpedForVideo = true;
    }
  }
  if(event.data == YT.PlayerState.ENDED){
    const duration = player.getDuration() * 1000;
    const epochOffset = (+new Date());
    const epochDiff = epochOffset - music.musicInfo.startTime;
    const placeToPlay = (epochDiff % duration) / 1000;
    player.seekTo(placeToPlay);
  }
}