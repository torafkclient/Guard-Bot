const logger = require('../../utils/logger');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'messageCreate',
  once: false,
  /**
   * @param {import('discord.js').Client} client Discord.js istemcisi
   * @param {import('discord.js').Message} message Mesaj
   */
  async execute(client, message) {
    // Bot mesajlarını ve DM mesajlarını yoksay
    if (message.author.bot || !message.guild) return;
    
    // Prefix kontrol et (varsayılan olarak "/" ama .env dosyasında PREFIX değişkeni de kullanılabilir)
    const prefix = process.env.PREFIX || '/';
    
    // Prefix ile başlamıyorsa işlemi sonlandır
    if (!message.content.startsWith(prefix)) return;
    
    // Komutu ve argümanları al
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Sadece "yenile" komutunu dinle şimdilik
    if (commandName === 'yenile') {
      // Sunucu sahibi kontrolü
      if (message.guild.ownerId !== message.author.id) {
        return message.reply('❌ Bu komutu yalnızca sunucu sahibi kullanabilir!');
      }
      
      const msg = await message.reply('Slash komutlar yenileniyor...');
      
      try {
        // Tüm komutları yeniden yükleme işlemi
        const commands = [];
        const commandsPath = path.join(__dirname, '..', '..', 'commands', 'slash');
        const commandFolders = fs.readdirSync(commandsPath);
        
        // Önce koleksiyonu temizle
        client.slashCommands.clear();
        
        let loadedCount = 0;
        
        // Yeni komutları yükle
        for (const folder of commandFolders) {
          const folderPath = path.join(commandsPath, folder);
          if (!fs.statSync(folderPath).isDirectory()) continue;
          
          const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
          
          for (const file of commandFiles) {
            delete require.cache[require.resolve(path.join(folderPath, file))];
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            
            // Komut dosyasının yolunu kaydet
            command.filePath = filePath;
            command.category = folder;
            
            if ('data' in command && 'execute' in command) {
              client.slashCommands.set(command.data.name, command);
              commands.push(command.data.toJSON());
              loadedCount++;
              logger.info(`/${command.data.name} komutu bellekte yenilendi.`);
            } else {
              logger.warn(`${file} komutunda "data" veya "execute" özelliği eksik!`);
            }
          }
        }
        
        // Sunucuda komutları güncelle
        const rest = new REST({ version: '10' }).setToken(client.config.bot.token);
        
        if (client.config.bot.guildId) {
          // Sunucu ID'si varsa o sunucuya özel komutları yükle
          await rest.put(
            Routes.applicationGuildCommands(client.config.bot.clientId, client.config.bot.guildId),
            { body: commands }
          );
          
          await msg.edit(`✅ Toplam **${loadedCount}** slash komut başarıyla yenilendi ve sunucuda güncellendi!\n\n**Yenilenen Komutlar:** ${commands.map(cmd => `\`/${cmd.name}\``).join(', ')}`);
        } else {
          // Global komutları güncelle
          await rest.put(
            Routes.applicationCommands(client.config.bot.clientId),
            { body: commands }
          );
          
          await msg.edit(`✅ Toplam **${loadedCount}** slash komut başarıyla yenilendi ve global olarak güncellendi!\n\n**Yenilenen Komutlar:** ${commands.map(cmd => `\`/${cmd.name}\``).join(', ')}`);
        }
        
        logger.success(`${loadedCount} slash komut başarıyla yenilendi!`);
      } catch (error) {
        logger.error(`Komutlar yenilenirken hata oluştu: ${error.message}`);
        await msg.edit(`❌ Komutlar yenilenirken bir hata oluştu: ${error.message}`);
      }
    }
  }
};
