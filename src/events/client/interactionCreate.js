const logger = require('../../utils/logger');
const { Collection } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  once: false,
  /**
   * @param {import('discord.js').Client} client Discord.js istemcisi
   * @param {import('discord.js').Interaction} interaction Etkileşim
   */
  async execute(client, interaction) {
    // Autocomplete isteği ise
    if (interaction.isAutocomplete()) {
      const command = client.slashCommands.get(interaction.commandName);
      
      if (!command || !command.autocomplete) return;
      
      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        logger.error(`Otomatik tamamlama çalıştırılırken hata: ${error.message}`);
      }
      
      return;
    }
    
    // Slash komut değilse işlemi sonlandır
    if (!interaction.isChatInputCommand()) return;
    
    // Komut bilgisini al
    const command = client.slashCommands.get(interaction.commandName);
    
    // Komut bulunamadıysa işlemi sonlandır
    if (!command) return;
    
    // Cooldown kontrolü
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection());
    }
    
    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;
    
    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return interaction.reply({
          content: `⏳ Lütfen **${timeLeft.toFixed(1)}** saniye daha bekleyin!`,
          ephemeral: true
        });
      }
    }
    
    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    
    // Komut kullanımını logla
    logger.command(`${interaction.user.tag} (${interaction.user.id}) | /${interaction.commandName} ${interaction.options.data.map(o => o.name).join(' ')}`);
    
    try {
      // Komutu çalıştır
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Komut çalıştırılırken hata oluştu: ${error.message}`, error);
      
      const errorMessage = {
        content: '❌ Bu komutu çalıştırırken bir hata oluştu!',
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(e => {});
      } else {
        await interaction.reply(errorMessage).catch(e => {});
      }
    }
  }
};
