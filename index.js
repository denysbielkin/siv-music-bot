const Discord = require('discord.js');
const {
    prefix,
    token,
} = require('./config.json');
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');

const client = new Discord.Client();

const queue = new Map();

client.once('ready', () => {
    console.log('Ready!');
});

client.once('reconnecting', () => {
    console.log('Reconnecting!');
});

client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}p`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}songs`)) {
        songs(message, serverQueue)
    } else if (message.content.startsWith(`${prefix}clear`)) {
        clear(message, serverQueue)
    } else {
        message.channel.send('You need to enter a valid command!')
    }
});

async function execute(message, serverQueue) {
    const videoPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/gi;
    const playlistPattern = /^.*(youtu.be\/|list=)([^#\&\?]*).*/gi;

    const args = message.content.split(' ');
    const isPlaylist = args[1].includes('share')
    if(isPlaylist) {
        console.log('ITS PLAYLIST~!');
    }

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }
    if(args[1]) {
        let songInfo = {}
        let song = null
        let mySongList = [];
        if(isPlaylist) {
            const songListFromPlaylist = await ytpl(args[1], {pages: 1});
            for (let i = 0; i < songListFromPlaylist.items.length; i++) {
                mySongList.push({
                    title: songListFromPlaylist.items[i].title,
                    url: songListFromPlaylist.items[i].url,
                })
            }
        } else {
            songInfo = await ytdl.getInfo(args[1]);
            song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url,
            };
        }
        const songs = song ? [song] : mySongList;

        if (!serverQueue) {
            const queueContruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs,
                volume: 5,
                playing: true,
            };

            queue.set(message.guild.id, queueContruct);

            try {
                var connection = await voiceChannel.join();
                queueContruct.connection = connection;
                play(message.guild, queueContruct.songs[0]);
            } catch (err) {
                console.log(err);
                queue.delete(message.guild.id);
                return message.channel.send(err);
            }
        } else {
            if(isPlaylist) {
                serverQueue.songs = mySongList
            }
            serverQueue.songs = [...serverQueue?.songs, ...songs];
            return message.channel.send(`${song.title} has been added to the queue!`);
        }
    }
}

function skip(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue?.connection?.dispatcher?.end();
}

function clear(message, serverQueue) {
    if(serverQueue?.songs){
        serverQueue.songs = [];
    }
}
async function stop(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if(serverQueue?.songs){
        serverQueue.songs = [];
    }
    // serverQueue.connection.dispatcher.end();
    message.channel.send('Shutting down').then(()=>client.destroy()).then(()=>client.login(token));
    // serverQueue?.voiceChannel.leave();
}
function songs(message, serverQueue) {
    if(serverQueue?.songs == undefined || serverQueue.songs.length === 0) {
        message.channel.send('No songs in queue.');
    } else {
        let list = [];
        for (let i = 0; i < serverQueue.songs.length; i++){
            const current = i+1;
            list.push('\n[' +  current + '] ' + serverQueue.songs[i].title + '\n');
        }
        message.channel.send(list.join(''));
    }

}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
        .on('end', () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => {
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

client.login(token);
