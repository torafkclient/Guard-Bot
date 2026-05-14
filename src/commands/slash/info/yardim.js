const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yardım')
    .setDescription('lbGuard komutlarını ve koruma sistemlerini görüntüler.'),
  
  cooldown: 5, // 5 saniye
  
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // Komutu kullanabilmesi için gerekli yetki kontrolü
    if (!interaction.memberPermissions.has('ManageGuild')) {
      return interaction.reply({
        content: '❌ Bu komutu kullanabilmek için **Sunucuyu Yönet** yetkisine sahip olmalısınız!',
        ephemeral: true
      });
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🛡️ lbGuard | Koruma Botu')
      .setDescription('Discord sunucunuzu korumak için gelişmiş güvenlik sistemleri sunan bir bot.')
      .setColor('#00a0ff')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    // Koruma sistemleri bilgisi
    const guardCount = client.guards.size;
    const enabledGuards = [...client.guards.values()].filter(guard => guard.enabled).length;
    
    embed.addFields({ name: '📊 Koruma Durumu', value: `Toplam **${guardCount}** koruma sisteminin **${enabledGuards}** tanesi aktif.` });
    
    // Komutz kategorileri
    const guardCommands = getCommands(client, 'guard');
    const configCommands = getCommands(client, 'config');
    const infoCommands = getCommands(client, 'info');
    
    if (guardCommands.length > 0) {
      embed.addFields({ name: '🔒 Koruma Komutları', value: guardCommands.join('\n') });
    }
    
    if (configCommands.length > 0) {
      embed.addFields({ name: '⚙️ Yapılandırma Komutları', value: configCommands.join('\n') });
    }
    
    if (infoCommands.length > 0) {
      embed.addFields({ name: 'ℹ️ Bilgi Komutları', value: infoCommands.join('\n') });
    }
    
    // Aktif koruma sistemleri
    if (enabledGuards > 0) {
      const guardList = [];
      client.guards.forEach(guard => {
        if (guard.enabled) {
          guardList.push(`✅ **${guard.name}**: ${guard.description}`);
        }
      });
      
      if (guardList.length > 0) {
        embed.addFields({ name: '🔐 Aktif Koruma Sistemleri', value: guardList.join('\n') });
      }
    }
    
    interaction.reply({ embeds: [embed] });
  }
};

/**
 * Belirli bir kategorideki komutları döndürür
 * @param {import('discord.js').Client} client
 * @param {string} category Kategori adı
 * @returns {string[]} Komut açıklamaları
 */
function getCommands(client, category) {
  const commands = [];
  
  client.slashCommands.forEach(cmd => {
    // Komut dosya yolunu kontrol et
    if (cmd.category === category || (cmd.data && cmd.data.name && cmd.filePath && cmd.filePath.includes(`/slash/${category}/`))) {
      commands.push(`**/${cmd.data.name}** - ${cmd.data.description}`);
    }
  });
  
  return commands;
}
