const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent } = require('discord.js');

class MessageGuard extends BaseGuard {
  constructor() {
    super({
      name: 'MessageGuard',
      description: 'Toplu mesaj silme işlemlerini izler ve önlem alır.',
      enabled: true
    });
    
    this.messageDeletions = new Collection();
  }
  
  registerEvents(client) {
    client.on('messageDelete', this.onMessageDelete.bind(this));
    client.on('messageDeleteBulk', this.onMessageDeleteBulk.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      
      this.messageDeletions.sweep(entry => now - entry.timestamp > 600000);
    }, 60000);
  }
  
  async onMessageDelete(message) {
    if (!this.enabled || !message.guild) return;
    
    const { guild, channel, author } = message;
    
    try {
      if (author?.bot) return;
      
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MessageDelete
      });
      
      const log = auditLogs.entries.first();
      
      if (!log || Date.now() - log.createdTimestamp > 5000 || log.target?.id !== author?.id) {
        return;
      }
      
      const { executor } = log;
      const executorId = executor.id;
      
      if (executorId === this.client.user.id || executorId === guild.ownerId) return;
      
      if (executorId === author.id) return;
      
      if (await this.utils.isWhitelisted(executorId, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı bir mesaj sildi: ${executor.tag} (${executorId})`);
        return;
      }
      
      await this.trackMessageDeletion(guild.id, channel.id, executorId, message.id);
    } catch (error) {
      this.logger.error(`[${this.name}] Mesaj silme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onMessageDeleteBulk(messages) {
    if (!this.enabled) return;
    
    const firstMessage = messages.first();
    if (!firstMessage || !firstMessage.guild) return;
    
    const { guild, channel } = firstMessage;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MessageBulkDelete
      });
      
      const log = auditLogs.entries.first();
      
      if (!log || Date.now() - log.createdTimestamp > 5000) {
        this.logger.warn(`[${this.name}] Toplu mesaj silme işlemi tespit edildi, fakat sileni belirlenemedi.`);
        return;
      }
      
      const { executor } = log;
      const executorId = executor.id;
      
      if (executorId === this.client.user.id || executorId === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executorId, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı toplu mesaj sildi: ${executor.tag} (${executorId})`);
        return;
      }
      
      this.logger.warn(`[${this.name}] Toplu mesaj silme işlemi tespit edildi. Kullanıcı: ${executor.tag} (${executorId}), Silinen mesaj sayısı: ${messages.size}`);
      
      if (messages.size > 5) { // Eğer 5'ten fazla mesaj silindiyse
        await this.handleBulkDeletion(guild, executorId, channel.id, messages.size);
      } else {
        for (const [messageId, message] of messages.entries()) {
          await this.trackMessageDeletion(guild.id, channel.id, executorId, messageId);
        }
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Toplu mesaj silme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async trackMessageDeletion(guildId, channelId, userId, messageId) {
    const key = `${guildId}-${userId}`;
    
    if (!this.messageDeletions.has(key)) {
      this.messageDeletions.set(key, {
        userId,
        guildId,
        channels: {},
        totalDeletions: 0,
        timestamp: Date.now()
      });
    }
    
    const userDeletions = this.messageDeletions.get(key);
    
    if (!userDeletions.channels[channelId]) {
      userDeletions.channels[channelId] = {
        channelId,
        deletions: [],
        lastDeletion: Date.now()
      };
    }
    
    const channelDeletions = userDeletions.channels[channelId];
    channelDeletions.deletions.push({
      messageId,
      timestamp: Date.now()
    });
    channelDeletions.lastDeletion = Date.now();
    
    userDeletions.totalDeletions++;
    userDeletions.timestamp = Date.now();
    
    const maxBulkDeletes = this.config.guards.messageProtection.maxBulkDeletes || 2;
    const timePeriod = this.config.guards.messageProtection.timePeriod || 60000 * 10;
    
    const now = Date.now();
    const recentDeletions = Object.values(userDeletions.channels).reduce((total, channel) => {
      return total + channel.deletions.filter(del => now - del.timestamp < timePeriod).length;
    }, 0);
    
    if (recentDeletions >= 10) { // En az 10 mesaj silme işlemi olduğunda
      const guild = this.client.guilds.cache.get(guildId);
      
      if (guild) {
        this.logger.guard(`[${this.name}] Çok sayıda mesaj silme tespit edildi! Kullanıcı: ${userId}, son ${timePeriod / 60000} dakika içinde ${recentDeletions} mesaj silindi.`);
        
        await this.handleBulkDeletion(guild, userId, channelId, recentDeletions);
      }
    }
  }
  
  async handleBulkDeletion(guild, userId, channelId, messageCount) {
    const action = this.config.guards.messageProtection.action || 'warn';
    const reason = `[${this.name}] Toplu mesaj silme: ${messageCount} mesaj silindi`;
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (member) {
        await this.utils.takeAction(member, action, reason);
      }
      
      await this.logViolation(guild.id, userId, action, reason);
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: '⚠️ Toplu Mesaj Silme Tespit Edildi!',
        description: `Bir kullanıcı tarafından çok sayıda mesaj silindi ve gerekli önlemler alındı.`,
        color: this.config.logging.colorWarning,
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'Kanal', value: `<#${channelId}>`, inline: true },
          { name: 'Silinen Mesaj Sayısı', value: `${messageCount}`, inline: true },
          { name: 'Alınan Önlem', value: action.toUpperCase(), inline: true }
        ]
      });
      
      this.messageDeletions.delete(`${guild.id}-${userId}`);
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new MessageGuard();
