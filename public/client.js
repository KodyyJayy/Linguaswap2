// public/client.js

const socket = io();

let localStream;
let peer;

document.getElementById('startButton').addEventListener('click', () => {
    const nativeLanguage = document.getElementById('nativeLanguage').value;
    const learnLanguage = document.getElementById('learnLanguage').value;

    document.getElementById('startButton').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'block';

    socket.emit('setPreferences', { nativeLanguage, learnLanguage });
});

socket.on('match', ({ matched, matchedSocketId }) => {
    if (matched) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('matchScreen').style.display = 'block';
        startVideoChat(matchedSocketId);
    } else {
        document.getElementById('loadingScreen').style.display = 'block';
        document.getElementById('loadingScreen').innerHTML = '<p>Searching for another user...</p>';
    }
});

document.getElementById('sendMessage').addEventListener('click', () => {
    const message = document.getElementById('messageInput').value;
    if (message.trim() !== '') {
        socket.emit('sendMessage', message);
        document.getElementById('messages').innerHTML += `<li>You: ${message}</li>`;
        document.getElementById('messageInput').value = '';
    }
});

function startVideoChat(matchedSocketId) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('localVideo').srcObject = stream;

            peer = new SimplePeer({
                initiator: true,
                trickle: false,
                stream: localStream,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' }  // Use a valid STUN server URL
                        // Add TURN servers here if necessary
                    ]
                }
            });

            peer.on('signal', signalData => {
                socket.emit('callUser', { userId: matchedSocketId, signalData });
            });

            socket.on('callIncoming', ({ signalData }) => {
                peer.signal(signalData);
            });

            peer.on('stream', remoteStream => {
                document.getElementById('remoteVideo').srcObject = remoteStream;
            });

            socket.on('callAnswered', ({ signalData }) => {
                peer.signal(signalData);
            });

            socket.on('callDisconnected', () => {
                closeVideoChat();
            });
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            alert('Error accessing media devices: ' + error.message);
        });
}

function closeVideoChat() {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
    }
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('remoteVideo').srcObject = null;
    if (peer) {
        peer.destroy();
    }
}
