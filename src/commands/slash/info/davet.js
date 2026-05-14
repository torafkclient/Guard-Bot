const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('davet')
    .setDescription('Botu sunucunuza davet etmek için bağlantı oluşturur.'),
  
  cooldown: 5, // 5 saniye
  
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // Bot ID'sini al
    const clientId = client.user.id;
    
    // Gereken izinleri hesapla
    const perms = [
      'ADMINISTRATOR' // Tam yetki istiyoruz çünkü koruma botu
    ];
    
    // Davet bağlantısını oluştur
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    
    // Github bağlantısı
    const githubLink = 'https://github.com/lbGuard/discord-guard-bot';
    
    // Discord sunucu bağlantısı
    const supportLink = 'https://discord.gg/lbguard';
    
    const embed = new EmbedBuilder()
      .setTitle('🔗 lbGuard - Davet Bağlantısı')
      .setDescription(`lbGuard Discord koruma botunu sunucunuza ekleyerek gelişmiş koruma özelliklerinden faydalanın!`)
      .setColor('#00a0ff')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🤖 Bot Davet', value: `[Tıkla ve Davet Et](${inviteLink})`, inline: false },
        { name: '📚 Komutlar', value: 'Botun komutlarını görüntülemek için `/yardım` komutunu kullanabilirsiniz.', inline: false },
        { name: '🌐 Github', value: `[lbGuard Github](${githubLink})`, inline: true },
        { name: '💬 Destek Sunucusu', value: `[Discord Sunucumuz](${supportLink})`, inline: true }
      )
      .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }
};
