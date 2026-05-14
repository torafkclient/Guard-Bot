const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yenile')
    .setDescription('Slash komutları yeniler')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  cooldown: 10, // 10 saniye
  
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // Komutu sadece sunucu sahibi kullanabilir
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir!',
        ephemeral: true
      });
    }
    
    await interaction.deferReply();
    
    try {
      // Tüm komutları yeniden yükleme işlemi
      const commands = [];
      const commandsPath = path.join(__dirname, '..', '..', '..', 'commands', 'slash');
      const commandFolders = fs.readdirSync(commandsPath);
      
      // Önce koleksiyonu temizle
      client.slashCommands.clear();
      
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
          } else {
            logger.warn(`${file} komutunda "data" veya "execute" özelliği eksik!`);
          }
        }
      }
      
      // Sunucuda komutları güncelle
      const rest = new REST({ version: '10' }).setToken(client.config.bot.token);
      
      // Sunucu ID'si varsa o sunucuya özel komutları yükle
      if (client.config.bot.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(client.config.bot.clientId, client.config.bot.guildId),
          { body: commands }
        );
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Komutlar Yenilendi')
          .setDescription(`Toplam **${commands.length}** slash komut başarıyla yenilendi ve sunucuda güncellendi.`)
          .setColor('#00ff00')
          .addFields({
            name: 'Yenilenen Komutlar',
            value: commands.map(cmd => `/${cmd.name}`).join(', ')
          })
          .setFooter({ text: `${interaction.user.tag} tarafından yenilendi`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      } else {
        // Global komutları güncelle
        await rest.put(
          Routes.applicationCommands(client.config.bot.clientId),
          { body: commands }
        );
        
        const embed = new EmbedBuilder()
          .setTitle('✅ Komutlar Yenilendi')
          .setDescription(`Toplam **${commands.length}** slash komut başarıyla yenilendi ve global olarak güncellendi.`)
          .setColor('#00ff00')
          .addFields({
            name: 'Yenilenen Komutlar',
            value: commands.map(cmd => `/${cmd.name}`).join(', ')
          })
          .setFooter({ text: `${interaction.user.tag} tarafından yenilendi`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error(`Komutlar yenilenirken hata oluştu: ${error.message}`);
      await interaction.editReply({
        content: `❌ Komutlar yenilenirken bir hata oluştu: ${error.message}`
      });
    }
  }
};
