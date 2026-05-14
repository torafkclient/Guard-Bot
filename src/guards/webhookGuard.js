const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent } = require('discord.js');

class WebhookGuard extends BaseGuard {
  constructor() {
    super({
      name: 'WebhookGuard',
      description: 'Webhook oluşturma, silme ve düzenleme işlemlerini takip eder ve yetkisiz değişiklikleri engeller.',
      enabled: true
    });
    
    this.recentActions = new Collection();
  }
  
  registerEvents(client) {
    client.on('webhookCreate', this.onWebhookCreate.bind(this));
    client.on('webhookUpdate', this.onWebhookUpdate.bind(this));
    client.on('webhookDelete', this.onWebhookDelete.bind(this));
    
    client.on('guildAuditLogEntryCreate', this.onAuditLogEntry.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      this.recentActions.sweep(action => now - action.timestamp > 600000);
    }, 60000);
  }
  
  async onAuditLogEntry(auditLogEntry, guild) {
    if (!this.enabled || !guild) return;
    
    if (![
      AuditLogEvent.WebhookCreate,
      AuditLogEvent.WebhookDelete,
      AuditLogEvent.WebhookUpdate
    ].includes(auditLogEntry.action)) return;
    
    try {
      const { executor } = auditLogEntry;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı webhook işlemi yaptı: ${executor.tag} (${executor.id})`);
        return;
      }
      
      let actionType = '';
      
      switch (auditLogEntry.action) {
        case AuditLogEvent.WebhookCreate:
          actionType = 'create';
          break;
        case AuditLogEvent.WebhookDelete:
          actionType = 'delete';
          break;
        case AuditLogEvent.WebhookUpdate:
          actionType = 'update';
          break;
      }
      
      const actionKey = `${guild.id}-${executor.id}`;
      if (!this.recentActions.has(actionKey)) {
        this.recentActions.set(actionKey, {
          userId: executor.id,
          webhookActions: 0,
          timestamp: Date.now()
        });
      }
      
      const userActions = this.recentActions.get(actionKey);
      userActions.webhookActions++;
      userActions.timestamp = Date.now();
      
      let webhookId = null;
      let channelId = null;
      
      if (auditLogEntry.action === AuditLogEvent.WebhookCreate) {
        webhookId = auditLogEntry.target?.id;
        channelId = auditLogEntry.extra?.channel?.id;
      }
      
      const maxWebhookActions = 2;
      const timePeriod = 60000;
      
      if (userActions.webhookActions >= maxWebhookActions && Date.now() - userActions.timestamp < timePeriod) {
        this.logger.guard(`[${this.name}] Webhook işlem limiti aşıldı! Kullanıcı: ${executor.tag} (${executor.id}), son ${timePeriod / 60000} dakika içinde ${userActions.webhookActions} webhook işlemi.`);
        
        await this.handleViolation(guild, executor.id, webhookId, channelId, actionType);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Denetim kaydı işlenirken hata: ${error.message}`);
    }
  }
  
  async onWebhookCreate(webhook) {
    if (!this.enabled || !webhook.guild) return;
    
    const { guild } = webhook;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.WebhookCreate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı webhook oluşturdu: ${executor.tag} (${executor.id})`);
        return;
      }
      
      this.logger.guard(`[${this.name}] Yeni webhook oluşturuldu! Kullanıcı: ${executor.tag} (${executor.id}), Webhook: ${webhook.name}, Kanal: ${webhook.channelId}`);
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: `${this.name} - Webhook Oluşturuldu`,
        description: `Bir webhook oluşturuldu. Bilginiz yoksa kontrol edin.`,
        color: this.config.logging.colorWarning,
        fields: [
          { name: 'Webhook Adı', value: webhook.name, inline: true },
          { name: 'Kanal', value: `<#${webhook.channelId}>`, inline: true },
          { name: 'Oluşturan', value: `${executor.tag} (${executor.id})`, inline: true }
        ]
      });
    } catch (error) {
      this.logger.error(`[${this.name}] Webhook oluşturma olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onWebhookUpdate(oldWebhook, newWebhook) {
    if (!this.enabled || !newWebhook.guild) return;
    
    const { guild } = newWebhook;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.WebhookUpdate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı webhook güncelledi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      this.logger.guard(`[${this.name}] Webhook güncellendi! Kullanıcı: ${executor.tag} (${executor.id}), Webhook: ${newWebhook.name}`);
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: `${this.name} - Webhook Güncellendi`,
        description: `Bir webhook güncellendi. Bilginiz yoksa kontrol edin.`,
        color: this.config.logging.colorInfo,
        fields: [
          { name: 'Webhook Adı', value: newWebhook.name, inline: true },
          { name: 'Kanal', value: `<#${newWebhook.channelId}>`, inline: true },
          { name: 'Güncelleyen', value: `${executor.tag} (${executor.id})`, inline: true },
          { name: 'Eski Ad', value: oldWebhook.name, inline: true }
        ]
      });
    } catch (error) {
      this.logger.error(`[${this.name}] Webhook güncelleme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onWebhookDelete(webhook) {
    if (!this.enabled || !webhook.guild) return;
    
    const { guild } = webhook;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.WebhookDelete
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı webhook sildi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      this.logger.guard(`[${this.name}] Webhook silindi! Kullanıcı: ${executor.tag} (${executor.id}), Webhook: ${webhook.name}`);
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: `${this.name} - Webhook Silindi`,
        description: `Bir webhook silindi. Bilginiz yoksa kontrol edin.`,
        color: this.config.logging.colorInfo,
        fields: [
          { name: 'Webhook Adı', value: webhook.name, inline: true },
          { name: 'Kanal', value: `<#${webhook.channelId}>`, inline: true },
          { name: 'Silen', value: `${executor.tag} (${executor.id})`, inline: true }
        ]
      });
    } catch (error) {
      this.logger.error(`[${this.name}] Webhook silme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async handleViolation(guild, userId, webhookId, channelId, actionType) {
    let action = this.config.guards.webhookProtection.action || 'ban';
    let reason = `[${this.name}] Webhook koruması: Kısa sürede çok fazla webhook işlemi (${actionType})`;
    
    try {
      if (webhookId && actionType === 'create') {
        try {
          const webhook = await this.client.fetchWebhook(webhookId).catch(() => null);
          
          if (webhook) {
            await webhook.delete(`[${this.name}] Güvenlik ihlali webhook'u siliniyor`).catch(() => {});
            this.logger.success(`[${this.name}] Şüpheli webhook silindi: ${webhook.name}`);
          }
        } catch (error) {
          this.logger.error(`[${this.name}] Webhook silinirken hata: ${error.message}`);
        }
      }
      
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (member) {
        await this.utils.takeAction(member, action, reason);
      } else {
        if (action === 'ban') {
          await guild.members.ban(userId, { reason }).catch(err => {
            this.logger.error(`[${this.name}] Kullanıcı banlanırken hata: ${err.message}`);
          });
        }
      }
      
      await this.logViolation(guild.id, userId, action, reason);
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: '⚠️ Webhook Güvenlik İhlali!',
        description: `Bir kullanıcı webhook güvenlik ihlali yaptı ve gerekli önlemler alındı.`,
        color: this.config.logging.colorError,
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'İşlem Türü', value: actionType, inline: true },
          { name: 'Alınan Önlem', value: action.toUpperCase(), inline: true },
          { name: 'Kanal', value: channelId ? `<#${channelId}>` : 'Bilinmiyor', inline: true }
        ],
        notifyOwner: true
      });
      
      this.recentActions.delete(`${guild.id}-${userId}`);
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new WebhookGuard();
