const { REST, Routes } = require('discord.js');
const token = process.env.DISCORD_BOT_TOKEN;
const guild = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;

// Load your commands
const fs = require('fs');
const path = './artifacts/discord-bot/src/commands/';
const commands = [];
fs.readdirSync(path).forEach(f => {
  if(f.endsWith('.ts') || f.endsWith('.js')) {
    const cmd = require('./' + path + f);
    if(cmd?.default?.data) commands.push(cmd.default.data.toJSON());
  }
});

const rest = new REST({version:'10'}).setToken(token);
rest.put(Routes.applicationGuildCommands(clientId, guild), {body: commands})
.then(() => console.log('✅ COMMANDS REGISTERED!'))
.catch(console.error);