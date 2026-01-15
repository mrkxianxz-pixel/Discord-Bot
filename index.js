import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from '@discordjs/voice';
import ytdl from 'ytdl-core';
import play from 'play-dl';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Simple /play command using message content
client.on('messageCreate', async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const url = args[0];
    if (!url || !ytdl.validateURL(url)) {
      return message.reply("Please provide a valid YouTube URL!");
    }

    const channel = message.member.voice.channel;
    if (!channel) return message.reply("Join a voice channel first!");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    const stream = ytdl(url, { filter: 'audioonly' });
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    message.reply(`Now playing: ${url}`);
  }
});

// Login using Railway environment variable
client.login(process.env.DISCORD_TOKEN);
