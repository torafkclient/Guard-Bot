const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent } = require('discord.js');

class ChannelGuard extends BaseGuard {
  constructor() {
    super({
      name: 'ChannelGuard',
      description: 'Kanal oluşturma, silme ve düzenleme işlemlerini takip eder ve yetkisiz değişiklikleri engeller.',
      enabled: true
    });
    
    this.recentActions = new Collection();
  }
  
  registerEvents(client) {
    client.on('channelCreate', this.onChannelCreate.bind(this));
    client.on('channelDelete', this.onChannelDelete.bind(this));
    client.on('channelUpdate', this.onChannelUpdate.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      this.recentActions.sweep(action => now - action.timestamp > 600000);
    }, 60000);
  }
  
  async onChannelCreate(channel) {
    if (!this.enabled || !channel.guild) return;
    
    const { guild } = channel;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı kanal oluşturdu: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const actionKey = `${guild.id}-${executor.id}`;
      if (!this.recentActions.has(actionKey)) {
        this.recentActions.set(actionKey, {
          userId: executor.id,
          channelCreations: 0,
          channelDeletions: 0,
          channelUpdates: 0,
          timestamp: Date.now()
        });
      }
      
      const userActions = this.recentActions.get(actionKey);
      userActions.channelCreations++;
      userActions.timestamp = Date.now();
      
      const maxChannelCreations = this.config.guards.channelProtection.maxChannelCreations || 3;
      const timePeriod = this.config.guards.channelProtection.timePeriod || 300000;
      
      if (userActions.channelCreations >= maxChannelCreations && Date.now() - userActions.timestamp < timePeriod) {
        this.logger.guard(`[${this.name}] Kanal oluşturma limiti aşıldı! Kullanıcı: ${executor.tag} (${executor.id}), son ${timePeriod / 60000} dakika içinde ${userActions.channelCreations} kanal oluşturuldu.`);
        
        await this.handleViolation(guild, executor.id, channel, 'create');
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Kanal oluşturma olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onChannelDelete(channel) {
    if (!this.enabled || !channel.guild) return;
    
    const { guild } = channel;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı kanal sildi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const actionKey = `${guild.id}-${executor.id}`;
      if (!this.recentActions.has(actionKey)) {
        this.recentActions.set(actionKey, {
          userId: executor.id,
          channelCreations: 0,
          channelDeletions: 0,
          channelUpdates: 0,
          timestamp: Date.now()
        });
      }
      
      const userActions = this.recentActions.get(actionKey);
      userActions.channelDeletions++;
      userActions.timestamp = Date.now();
      
      const maxChannelDeletions = this.config.guards.channelProtection.maxChannelCreations || 3;
      const timePeriod = this.config.guards.channelProtection.timePeriod || 300000;
      
      if (userActions.channelDeletions >= maxChannelDeletions && Date.now() - userActions.timestamp < timePeriod) {
        this.logger.guard(`[${this.name}] Kanal silme limiti aşıldı! Kullanıcı: ${executor.tag} (${executor.id}), son ${timePeriod / 60000} dakika içinde ${userActions.channelDeletions} kanal silindi.`);
        
        await this.handleViolation(guild, executor.id, channel, 'delete');
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Kanal silme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onChannelUpdate(oldChannel, newChannel) {
    if (!this.enabled || !newChannel.guild) return;
    
    const { guild } = newChannel;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelUpdate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı kanal güncelledi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const permissionsChanged = this.checkPermissionChanges(oldChannel, newChannel);
      
      if (permissionsChanged) {
        this.logger.guard(`[${this.name}] Kritik kanal izin değişikliği tespit edildi! Kullanıcı: ${executor.tag} (${executor.id}), Kanal: ${newChannel.name}`);
        
        await this.handleViolation(guild, executor.id, newChannel, 'update', permissionsChanged);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Kanal güncelleme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  checkPermissionChanges(oldChannel, newChannel) {
    const everyoneRole = newChannel.guild.roles.everyone;
    
    const oldPerms = oldChannel.permissionOverwrites.cache.get(everyoneRole.id);
    const newPerms = newChannel.permissionOverwrites.cache.get(everyoneRole.id);
    
    if (!oldPerms && !newPerms) return false;
    
    if (!oldPerms && newPerms) return true;
    
    if (oldPerms && !newPerms) return true;
    
    const criticalPermissions = [
      'Administrator',
      'ManageChannels',
      'ManageGuild',
      'ManageRoles',
      'ManageWebhooks',
      'ManageMessages',
      'MentionEveryone'
    ];
    
    for (const perm of criticalPermissions) {
      if (oldPerms.allow.has(perm) !== newPerms.allow.has(perm) ||
          oldPerms.deny.has(perm) !== newPerms.deny.has(perm)) {
        return true;
      }
    }
    
    return false;
  }
  
  async handleViolation(guild, userId, channel, actionType, permissionViolation = false) {
    let action = this.config.guards.channelProtection.action || 'ban';
    let reason = '';
    
    switch (actionType) {
      case 'create':
        reason = `[${this.name}] Kısa sürede çok fazla kanal oluşturma`;
        try {
          await channel.delete().catch(() => {});
        } catch (error) {
          this.logger.error(`[${this.name}] Kanal silinirken hata: ${error.message}`);
        }
        break;
      
      case 'delete':
        reason = `[${this.name}] Kısa sürede çok fazla kanal silme`;
        break;
      
      case 'update':
        reason = `[${this.name}] Kritik kanal izin değişikliği yapma`;
        
        if (permissionViolation) {
          try {
            const everyoneRole = guild.roles.everyone;
            await channel.permissionOverwrites.edit(everyoneRole, {
              ViewChannel: null,
              SendMessages: null,
              Connect: null
            });
          } catch (error) {
            this.logger.error(`[${this.name}] Kanal izinleri geri alınırken hata: ${error.message}`);
          }
        }
        break;
    }
    
    try {
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
      
      this.recentActions.delete(`${guild.id}-${userId}`);
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new ChannelGuard();
