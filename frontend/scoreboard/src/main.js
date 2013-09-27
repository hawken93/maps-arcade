var io = require('socket.io-client');
var _ = require('underscore')._;
var objsync = require('objsync');

var socket = io.connect('http://' + window.location.host + '/results');

socket.on('error', function () {
    socket.socket.reconnect();
});

var sync = new objsync(socket, {delimiter:'/'});

sync.on('update', function () {
    showResults(sync.getObject());
});

function showResults(results) {
    results = _.sortBy(results, function (result) {
        return result.runningTime;
    });
    var displayText = '';

    for (var idx in results) {
        var result = results[idx];

        displayText += result.name + ' (' + result.runningTime + ')<br/>';
    }

    document.body.innerHTML = displayText;
}