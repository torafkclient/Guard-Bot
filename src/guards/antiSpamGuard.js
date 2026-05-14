const BaseGuard = require('../structures/BaseGuard');
const { Collection } = require('discord.js');

class AntiSpamGuard extends BaseGuard {
  constructor() {
    super({
      name: 'AntiSpam',
      description: 'Kullanıcıların kısa sürede çok sayıda mesaj göndermesini tespit eder ve önlem alır.',
      enabled: true
    });
    
    this.userMessages = new Collection();
    
    this.warnings = new Collection();
  }
  
  registerEvents(client) {
    client.on('messageCreate', this.onMessage.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      this.userMessages.forEach((messages, userId) => {
        messages.sweep(msg => now - msg.timestamp > 600000);
        if (messages.size === 0) this.userMessages.delete(userId);
      });
      
      this.warnings.sweep(timestamp => now - timestamp > 3600000);
    }, 60000);
  }
  
  async onMessage(message) {
    if (!this.enabled || !message || !message.guild || message.author.bot) return;
    
    const { guild, author, content, channel } = message;
    const userId = author.id;
    const guildId = guild.id;
    
    if (await this.utils.isWhitelisted(userId, this.client)) return;
    
    const member = message.member || await guild.members.fetch(userId).catch(() => null);
    if (member && this.utils.hasAdminPermission(member)) return;
    
    if (!this.userMessages.has(userId)) {
      this.userMessages.set(userId, new Collection());
    }
    
    const userMessages = this.userMessages.get(userId);
    
    userMessages.set(message.id, {
      content,
      timestamp: Date.now(),
      channelId: channel.id,
      messageId: message.id
    });
    
    await this.checkForSpam(message, userMessages);
  }
  
  async checkForSpam(message, userMessages) {
    const { guild, author, channel } = message;
    const userId = author.id;
    
    const now = Date.now();
    const messageThreshold = this.config.guards.antiSpam.messageThreshold || 5;
    const timeThreshold = this.config.guards.antiSpam.timeThreshold || 3000;
    
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < timeThreshold);
    
    if (recentMessages.size >= messageThreshold) {
      this.logger.guard(`[${this.name}] Spam tespit edildi! Kullanıcı: ${author.tag} (${userId}), son ${timeThreshold / 1000} saniye içinde ${recentMessages.size} mesaj gönderdi.`);
      
      try {
        const messagesToDelete = recentMessages.map(msg => msg.messageId).slice(0, 10);
        if (messagesToDelete.length > 0) {
          await channel.bulkDelete(messagesToDelete).catch(() => {
            messagesToDelete.forEach(async msgId => {
              const msg = await channel.messages.fetch(msgId).catch(() => null);
              if (msg) await msg.delete().catch(() => {});
            });
          });
        }
      } catch (error) {
        this.logger.error(`[${this.name}] Spam mesajları silinirken hata: ${error.message}`);
      }
      
      await this.handleSpam(guild, author, message, recentMessages);
      
      userMessages.clear();
    }
  }
  
  async handleSpam(guild, author, message, recentMessages) {
    const userId = author.id;
    const guildId = guild.id;
    const member = message.member || await guild.members.fetch(userId).catch(() => null);
    
    if (!member) return;
    
    if (!this.warnings.has(`${guildId}-${userId}`)) {
      this.warnings.set(`${guildId}-${userId}`, {
        count: 0,
        timestamp: Date.now()
      });
    }
    
    const warning = this.warnings.get(`${guildId}-${userId}`);
    warning.count++;
    warning.timestamp = Date.now();
    
    let action = this.config.guards.antiSpam.action || 'mute';
    const reason = `[${this.name}] Spam koruması: Kısa sürede çok sayıda mesaj gönderme (${recentMessages.size} mesaj)`;
    
    if (warning.count >= 3) {
      if (action === 'mute' || action === 'warn') {
        action = 'kick';
      }
      warning.count = 0;
    }
    
    if (action === 'mute') {
      const duration = this.config.guards.antiSpam.muteDuration || 60000 * 5;
      await this.utils.takeAction(member, action, reason, duration);
    } else {
      await this.utils.takeAction(member, action, reason);
    }
    
    await this.logViolation(guildId, userId, action, reason);
    
    try {
      const dm = await member.createDM();
      await dm.send({
        content: `**${guild.name}** sunucusunda spam yapmaktan dolayı ${action === 'mute' ? 'geçici olarak susturuldunuz' : action === 'kick' ? 'sunucudan atıldınız' : action === 'ban' ? 'sunucudan yasaklandınız' : 'uyarıldınız'}. Lütfen kuralları okuyup, kısa sürede çok fazla mesaj göndermekten kaçının.`
      });
    } catch (error) {
    }
  }
}

module.exports = new AntiSpamGuard();
