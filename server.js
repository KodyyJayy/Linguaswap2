// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static(__dirname + '/public'));

// Maintain a list of users waiting for a match
let waitingUsers = [];

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        // Remove user from waiting list if they disconnect
        waitingUsers = waitingUsers.filter(user => user.socketId !== socket.id);
    });

    socket.on('setPreferences', (preferences) => {
        console.log('Received preferences:', preferences);

        waitingUsers.push({ socketId: socket.id, preferences });

        // Try to find a match
        const match = findMatch(socket.id, preferences);
        if (match) {
            // Remove matched users from waiting list
            waitingUsers = waitingUsers.filter(user => user.socketId !== socket.id && user.socketId !== match.socketId);

            // Notify both users of the match
            io.to(socket.id).emit('match', { matched: true, matchedSocketId: match.socketId });
            io.to(match.socketId).emit('match', { matched: true, matchedSocketId: socket.id });
        } else {
            // No match found, keep the user in the waiting list
            io.to(socket.id).emit('match', { matched: false });
        }
    });

    function findMatch(socketId, preferences) {
        return waitingUsers.find(user => 
            user.socketId !== socketId && 
            user.preferences.learnLanguage === preferences.nativeLanguage &&
            user.preferences.nativeLanguage === preferences.learnLanguage
        );
    }

    // Handle chat messages
    socket.on('sendMessage', (message) => {
        socket.to(socket.matchedSocketId).emit('receiveMessage', message);
    });

    // Handle video/audio chat
    socket.on('callUser', ({ userId, signalData }) => {
        io.to(userId).emit('callIncoming', { signalData, from: socket.id });
    });

    socket.on('answerCall', ({ signalData, to }) => {
        io.to(to).emit('callAnswered', { signalData, from: socket.id });
    });

    socket.on('disconnectCall', (userId) => {
        io.to(userId).emit('callDisconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
