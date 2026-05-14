const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('koruma')
    .setDescription('lbGuard koruma sistemlerini yönetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('durum')
        .setDescription('Koruma sistemlerinin durumunu görüntüler'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('aç')
        .setDescription('Belirtilen koruma sistemini aktifleştirir')
        .addStringOption(option =>
          option.setName('sistem')
            .setDescription('Aktifleştirilecek koruma sistemi')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kapat')
        .setDescription('Belirtilen koruma sistemini devre dışı bırakır')
        .addStringOption(option =>
          option.setName('sistem')
            .setDescription('Devre dışı bırakılacak koruma sistemi')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tümünü-aç')
        .setDescription('Tüm koruma sistemlerini aktifleştirir'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tümünü-kapat')
        .setDescription('Tüm koruma sistemlerini devre dışı bırakır')),
  
  cooldown: 5, // 5 saniye
  
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
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'durum':
        await showGuardStatus(interaction, client);
        break;
      case 'aç':
        await enableGuard(interaction, client);
        break;
      case 'kapat':
        await disableGuard(interaction, client);
        break;
      case 'tümünü-aç':
        await enableAllGuards(interaction, client);
        break;
      case 'tümünü-kapat':
        await disableAllGuards(interaction, client);
        break;
    }
  },
  
  /**
   * Otomatik tamamlama için
   * @param {import('discord.js').AutocompleteInteraction} interaction 
   * @param {import('discord.js').Client} client 
   */
  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'sistem') {
      // Koruma sistemlerinin listesini al
      const guards = Array.from(client.guards.values()).map(guard => ({
        name: `${guard.name} ${guard.enabled ? '✅' : '❌'}`,
        value: guard.name
      }));
      
      // Arama filtresi
      const filtered = guards.filter(guard => 
        guard.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );
      
      await interaction.respond(
        filtered.slice(0, 25) // Discord maksimum 25 seçenek gösterebilir
      );
    }
  }
};

/**
 * Koruma sistemlerinin durumunu gösterir
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function showGuardStatus(interaction, client) {
  await interaction.deferReply();
  
  const embed = new EmbedBuilder()
    .setTitle('🔐 lbGuard - Koruma Sistemleri')
    .setDescription('Koruma sistemlerinin mevcut durumları aşağıda listelenmiştir.')
    .setColor('#00a0ff')
    .setFooter({ text: `${interaction.user.tag} tarafından istendi`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();
  
  // Toplam durumu ekle
  const guardCount = client.guards.size;
  const enabledCount = [...client.guards.values()].filter(guard => guard.enabled).length;
  
  embed.addFields({
    name: '📊 Genel Durum',
    value: `Toplam **${guardCount}** koruma sisteminin **${enabledCount}** tanesi aktif.`,
    inline: false
  });
  
  // Sistemlerin durumunu ekle
  const guardsList = [];
  client.guards.forEach(guard => {
    guardsList.push(`${guard.enabled ? '✅' : '❌'} **${guard.name}**: ${guard.description}`);
  });
  
  if (guardsList.length > 0) {
    embed.addFields({
      name: '🛡️ Sistemler',
      value: guardsList.join('\n\n'),
      inline: false
    });
  }
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Belirtilen koruma sistemini etkinleştirir
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function enableGuard(interaction, client) {
  await interaction.deferReply();
  
  const guardName = interaction.options.getString('sistem');
  const guard = client.guards.get(guardName);
  
  if (!guard) {
    return interaction.editReply({
      content: `❌ **${guardName}** adında bir koruma sistemi bulunamadı!`
    });
  }
  
  if (guard.enabled) {
    return interaction.editReply({
      content: `ℹ️ **${guard.name}** koruma sistemi zaten etkin durumda!`
    });
  }
  
  // Koruma sistemini etkinleştir
  guard.enable();
  
  const embed = new EmbedBuilder()
    .setTitle('✅ Koruma Sistemi Etkinleştirildi')
    .setDescription(`**${guard.name}** koruma sistemi başarıyla etkinleştirildi.`)
    .addFields(
      { name: 'Koruma Sistemi', value: guard.name, inline: true },
      { name: 'Açıklama', value: guard.description, inline: true },
      { name: 'İşlemi Yapan', value: interaction.user.tag, inline: false }
    )
    .setColor('#00ff00')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Belirtilen koruma sistemini devre dışı bırakır
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function disableGuard(interaction, client) {
  await interaction.deferReply();
  
  const guardName = interaction.options.getString('sistem');
  const guard = client.guards.get(guardName);
  
  if (!guard) {
    return interaction.editReply({
      content: `❌ **${guardName}** adında bir koruma sistemi bulunamadı!`
    });
  }
  
  if (!guard.enabled) {
    return interaction.editReply({
      content: `ℹ️ **${guard.name}** koruma sistemi zaten devre dışı!`
    });
  }
  
  // Koruma sistemini devre dışı bırak
  guard.disable();
  
  const embed = new EmbedBuilder()
    .setTitle('🚫 Koruma Sistemi Devre Dışı Bırakıldı')
    .setDescription(`**${guard.name}** koruma sistemi başarıyla devre dışı bırakıldı.`)
    .addFields(
      { name: 'Koruma Sistemi', value: guard.name, inline: true },
      { name: 'Açıklama', value: guard.description, inline: true },
      { name: 'İşlemi Yapan', value: interaction.user.tag, inline: false }
    )
    .setColor('#ff0000')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Tüm koruma sistemlerini etkinleştirir
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function enableAllGuards(interaction, client) {
  await interaction.deferReply();
  
  let enabledCount = 0;
  
  client.guards.forEach(guard => {
    if (!guard.enabled) {
      guard.enable();
      enabledCount++;
    }
  });
  
  const embed = new EmbedBuilder()
    .setTitle('✅ Tüm Koruma Sistemleri Etkinleştirildi')
    .setDescription(`Toplam **${enabledCount}** koruma sistemi başarıyla etkinleştirildi.`)
    .addFields(
      { name: 'İşlemi Yapan', value: interaction.user.tag, inline: false }
    )
    .setColor('#00ff00')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

/**
 * Tüm koruma sistemlerini devre dışı bırakır
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function disableAllGuards(interaction, client) {
  await interaction.deferReply();
  
  let disabledCount = 0;
  
  client.guards.forEach(guard => {
    if (guard.enabled) {
      guard.disable();
      disabledCount++;
    }
  });
  
  const embed = new EmbedBuilder()
    .setTitle('🚫 Tüm Koruma Sistemleri Devre Dışı Bırakıldı')
    .setDescription(`Toplam **${disabledCount}** koruma sistemi başarıyla devre dışı bırakıldı.`)
    .addFields(
      { name: 'İşlemi Yapan', value: interaction.user.tag, inline: false }
    )
    .setColor('#ff0000')
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}
