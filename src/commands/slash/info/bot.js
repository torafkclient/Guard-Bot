const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require('discord.js');
const { version } = require('../../../../package.json');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Bot hakkında bilgi verir ve durumunu gösterir.'),
  
  cooldown: 5, // 5 saniye
  
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply();
    
    // Bot başlangıç zamanı
    const uptime = formatUptime(client.uptime);
    
    // Sistem bilgileri
    const osType = os.type();
    const osVersion = os.release();
    const architecture = os.arch();
    const cpuModel = os.cpus()[0].model;
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    
    // Koruma sistemleri
    const guardCount = client.guards.size;
    const enabledGuards = [...client.guards.values()].filter(guard => guard.enabled).length;
    
    // Ping hesapla
    const pingStart = Date.now();
    await interaction.editReply('Ping hesaplanıyor...');
    const pingEnd = Date.now();
    const apiPing = pingEnd - pingStart;
    const wsPing = client.ws.ping;
    
    // İstatistikleri ekle
    const embed = new EmbedBuilder()
      .setTitle(`🛡️ lbGuard - Discord Koruma Botu`)
      .setDescription('Discord sunucunuzu korumak için gelişmiş güvenlik sistemleri sunan bir bot.')
      .setColor('#00a0ff')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '⏱️ Çalışma Süresi', value: uptime, inline: true },
        { name: '📊 Sunucu Sayısı', value: client.guilds.cache.size.toString(), inline: true },
        { name: '👥 Kullanıcı Sayısı', value: client.users.cache.size.toString(), inline: true },
        { name: '🔒 Koruma Sistemleri', value: `${enabledGuards}/${guardCount} aktif`, inline: true },
        { name: '📡 Ping', value: `API: ${apiPing}ms | WebSocket: ${wsPing}ms`, inline: true },
        { name: '🧠 RAM Kullanımı', value: `${memoryUsage} MB / ${totalMemory} GB`, inline: true },
        { name: '🖥️ Sistem', value: `${osType} ${osVersion} (${architecture})`, inline: false },
        { name: '📦 Versiyonlar', value: `lbGuard: v${version}\nDiscord.js: v${discordJsVersion}\nNode.js: ${process.version}`, inline: false }
      )
      .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.editReply({ content: null, embeds: [embed] });
  }
};

/**
 * Belirtilen milisaniyeyi okunabilir çalışma süresi formatına dönüştürür
 * @param {number} ms Milisaniye
 * @returns {string} Formatlı süre
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  const parts = [];
  
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0) parts.push(`${minutes} dakika`);
  if (seconds > 0) parts.push(`${seconds} saniye`);
  
  return parts.join(', ');
}
