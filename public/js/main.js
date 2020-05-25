var username = new URLSearchParams(window.location.search).get('name');
const peers = {};
if (!username) {
  username = prompt('What is your name?');
}
const myInfo = {
  name: username,
  peerId: null,
  x: 0.1,
  y: 0.1
};
const peer = new Peer({
  host: window.location.hostname,
  port: 9000,
  path: '/party'
});

peer.on('open', function(id) {
  console.log('Peer ready (' + id + ')');
  myInfo.peerId = id;
  onPeerReady();
});

peer.on('connection', function(conn) {
  console.log(conn);
});

peer.on('call', function(call) {
  requestMediaStream()
  .then(mediaStream => {
    call.answer(mediaStream);
  });
  call.on('stream', onReceiveStream.bind(null, peers[call.peer]));
});

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
  peers[peerInfo.peerId] = peerInfo;
  requestMediaStream()
  .then(mediaStream => {
    var call = peer.call(peerInfo.peerId, mediaStream);
    call.on('stream', onReceiveStream.bind(null, peerInfo));
  });
  redraw();
});
socket.on('updateInfo', (peerInfo) => {
  peers[peerInfo.peerId] = {
    ...peers[peerInfo.peerId],
    ...peerInfo
  };
  redraw();
});
socket.on('leaver', (peerInfo) => {
  console.log('Peer left: ' + peerInfo.name);
  delete peers[peerInfo.peerId];
  redraw();
});

function requestMediaStream() {
  return new Promise((resolve, reject) => {
    navigator.getUserMedia({
        audio: true,
        video: false
    }, resolve, reject);
  });
}

function onReceiveStream(peerInfo, stream){
  var audio = document.createElement('audio');
  document.body.appendChild(audio);
  audio.srcObject = stream;
  audio.onloadedmetadata = function(e){
      console.log('now playing the audio');
      console.log(peerInfo);
      audio.play();
  }
  audio.volume = 0.0;
  if (peers[peerInfo.peerId].audio) {
    peers[peerInfo.peerId].audio.pause();
    peers[peerInfo.peerId].audio.remove();
  }
  peers[peerInfo.peerId].audio = audio;
}

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

function redraw() {
  requestAnimationFrame(onFrame);
  Object.entries(peers).forEach(([_, peer]) => {
    if (!peer.audio) {
      return;
    }
    const distance = getDistance(myInfo, peer);
    let volume = Math.min(Math.max(1 - distance, 0.05), 1);
    console.log('Distance: ' + distance);
    console.log('Volume: ' + volume);
    peer.audio.volume = volume;
  });
}

function getDistance(peer1, peer2) {
  const xDiff = Math.abs(peer1.x - peer2.x);
  const yDiff = Math.abs(peer1.y - peer2.y);
  const hyp = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2));
  return hyp;
}

function onFrame() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgb(255, 255, 255)';
  // ctx.fillRect(50, 50, 50 * Math.random(), 500 * Math.random());
  ctx.font = "30px Arial";
  ctx.fillText("Me", w * myInfo.x, h * myInfo.y);

  Object.entries(peers).forEach(([_, peer]) => {
    ctx.font = "30px Arial";
    ctx.fillText(peer.name, w * peer.x, h * peer.y);  
  })
}

document.body.addEventListener('click', (event) => {
  myInfo.x = event.clientX / window.innerWidth;
  myInfo.y = event.clientY / window.innerHeight;
  socket.emit('updateInfo', myInfo);
  redraw();
});