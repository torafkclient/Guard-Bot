require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadEvents } = require('./src/utils/eventLoader');
const { connectDatabase } = require('./src/database/index');
const config = require('./src/utils/config');
const logger = require('./src/utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new Collection();
client.guards = new Collection();
client.config = config;

const guardsPath = path.join(__dirname, 'src', 'guards');
const guardFiles = fs.readdirSync(guardsPath).filter(file => file.endsWith('.js'));

for (const file of guardFiles) {
  const guard = require(path.join(guardsPath, file));
  logger.info(`${file} koruma sistemi yükleniyor...`);
  client.guards.set(guard.name, guard);
  
  if (typeof guard.setup === 'function') {
    guard.setup(client);
    logger.success(`${guard.name} koruma sistemi başarıyla yüklendi!`);
  }
}

const slashCommandsPath = path.join(__dirname, 'src', 'commands', 'slash');
if (fs.existsSync(slashCommandsPath)) {
  const slashCommandFolders = fs.readdirSync(slashCommandsPath);

  for (const folder of slashCommandFolders) {
    const commandsPath = path.join(slashCommandsPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        client.slashCommands.set(command.data.name, command);
        logger.info(`${command.data.name} komutu yüklendi!`);
      } else {
        logger.warn(`${file} komutunda "data" veya "execute" özelliği eksik!`);
      }
    }
  }
}

loadEvents(client);

connectDatabase().then(() => {
  logger.success('Veritabanına başarıyla bağlandı!');
}).catch(error => {
  logger.error('Veritabanına bağlanırken bir hata oluştu:', error);
});

process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış istisna:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('İşlenmemiş Reddetme:', reason);
});

client.login(process.env.TOKEN)
  .then(() => {
    logger.success(`${client.user.tag} olarak giriş yapıldı!`);
  })
  .catch(err => {
    logger.error('Giriş yaparken bir hata oluştu:', err);
  });
