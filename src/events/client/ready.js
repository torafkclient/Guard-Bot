const logger = require('../../utils/logger');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ready',
  once: true,
  /**
   * @param {import('discord.js').Client} client Discord.js istemcisi
   */
  async execute(client) {
    const { bot } = client.config;
    
    // Veritabanı bağlantısını client'a ekle
    client.db = require('../../database/index').getDatabase();
    
    logger.success(`${client.user.tag} olarak giriş yapıldı!`);
    
    // Bot aktivitesini ayarla
    client.user.setPresence({
      activities: [{ name: 'lbGuard | /yardım', type: 3 }], // Watching
      status: 'online'
    });
    
    // Slash komutları kaydet
    await registerSlashCommands(client);
    
    // Koruma sistemlerinin durumunu kontrol et
    logger.info('Koruma sistemleri kontrol ediliyor...');
    const guardCount = client.guards.size;
    const enabledGuards = [...client.guards.values()].filter(guard => guard.enabled).length;
    
    logger.info(`Toplam ${guardCount} koruma sistemi bulundu, ${enabledGuards} tanesi etkin.`);
    
    // Aktif güvenlik sistemlerinin listesini yazdır
    if (enabledGuards > 0) {
      logger.info('Aktif koruma sistemleri:');
      client.guards.forEach(guard => {
        if (guard.enabled) {
          logger.info(`• ${guard.name}: ${guard.description}`);
        }
      });
    }
  }
};

/**
 * Slash komutları kaydeder
 * @param {import('discord.js').Client} client Discord.js istemcisi
 */
async function registerSlashCommands(client) {
  try {
    if (!client.config.bot.clientId) {
      logger.error('CLIENT_ID belirtilmediği için slash komutlar kaydedilemedi!');
      return;
    }
    
    // Komutları topla
    const commands = [];
    const commandsPath = path.join(__dirname, '..', '..', 'commands', 'slash');
    const commandFolders = fs.readdirSync(commandsPath);
    
    logger.info('Slash komutlar yükleniyor...');
    
    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      
      const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
      
      for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          logger.info(`/${command.data.name} komutu yüklendi.`);
        } else {
          logger.warn(`${file} komutunda "data" veya "execute" özelliği eksik!`);
        }
      }
    }
    
    // Komutları kaydet
    const rest = new REST({ version: '10' }).setToken(client.config.bot.token);
    
    try {
      logger.info(`${commands.length} slash komut kaydediliyor...`);
      
      if (client.config.bot.guildId) {
        // Geliştirme sunucusuna özel komutları kaydet
        await rest.put(
          Routes.applicationGuildCommands(client.config.bot.clientId, client.config.bot.guildId),
          { body: commands }
        );
        logger.success(`Slash komutlar başarıyla kaydedildi! (Sunucu: ${client.config.bot.guildId})`);
      } else {
        // Global komutları kaydet (tüm sunucularda çalışır, ancak güncellenmesi 1 saate kadar sürebilir)
        await rest.put(
          Routes.applicationCommands(client.config.bot.clientId),
          { body: commands }
        );
        logger.success('Slash komutlar başarıyla global olarak kaydedildi!');
      }
    } catch (error) {
      logger.error('Slash komutlar kaydedilirken bir hata oluştu:', error);
    }
  } catch (error) {
    logger.error('Slash komutlar yüklenirken bir hata oluştu:', error);
  }
}
