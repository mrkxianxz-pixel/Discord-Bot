import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import play from 'play-dl';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Map to store queues per guild
const queues = new Map();

client.once('ready', () => {
  if (client.user) console.log(`Logged in as ${client.user.tag}!`);
  else console.error("Client.user is undefined. Check your token.");
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---------------------- PLAY COMMAND ----------------------
  if (command === 'play') {
    const url = args[0];
    if (!url) return message.reply('Please provide a YouTube URL!');

    // Validate URL
    if (!play.yt_validate(url)) return message.reply('Invalid YouTube URL!');

    const channel = message.member.voice.channel;
    if (!channel) return message.reply('Join a voice channel first!');

    // Join or get connection
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    // Setup guild queue
    if (!queues.has(message.guild.id)) {
      queues.set(message.guild.id, []);
    }
    const queue = queues.get(message.guild.id);

    // Add song to queue
    queue.push({ url, requestedBy: message.author.tag });

    message.reply(`Added to queue: ${url}`);

    // If nothing is playing, start playback
    if (queue.length === 1) {
      playNext(message.guild.id, connection, message);
    }
  }

  // ---------------------- SKIP COMMAND ----------------------
  if (command === 'skip') {
    const queue = queues.get(message.guild.id);
    if (!queue || queue.length === 0) return message.reply('Nothing is playing!');
    queue.shift(); // remove current song
    const connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    playNext(message.guild.id, connection, message);
    message.reply('Skipped current song!');
  }

  // ---------------------- STOP COMMAND ----------------------
  if (command === 'stop') {
    queues.set(message.guild.id, []);
    message.reply('Stopped the music and cleared the queue.');
  }
});

// ---------------------- FUNCTION TO PLAY NEXT SONG ----------------------
async function playNext(guildId, connection, message) {
  const queue = queues.get(guildId);
  if (!queue || queue.length === 0) {
    connection.destroy();
    return;
  }

  const song = queue[0];

  try {
    const streamInfo = await play.stream(song.url);
    const resource = createAudioResource(streamInfo.stream, { inputType: streamInfo.type });
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      queue.shift(); // remove finished song
      playNext(guildId, connection, message); // play next if exists
    });

    player.on('error', (error) => {
      console.error('AudioPlayerError:', error);
      queue.shift(); // remove failed song
      playNext(guildId, connection, message); // continue with next song
    });

    message.channel.send(`Now playing: ${song.url} (requested by ${song.requestedBy})`);
  } catch (err) {
    console.error('Failed to play song:', err);
    message.channel.send(`Failed to play: ${song.url}`);
    queue.shift();
    playNext(guildId, connection, message);
  }
}

// Login
client.login(process.env.DISCORD_TOKEN);
