const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent } = require('discord.js');

class BanKickGuard extends BaseGuard {
  constructor() {
    super({
      name: 'BanKickGuard',
      description: 'Toplu ban/kick işlemlerini tespit eder ve engeller.',
      enabled: true
    });
    
    this.recentBans = new Collection();
    this.recentKicks = new Collection();
  }
  
  registerEvents(client) {
    client.on('guildBanAdd', this.onGuildBanAdd.bind(this));
    client.on('guildMemberRemove', this.onGuildMemberRemove.bind(this));
    
    client.on('guildAuditLogEntryCreate', this.onAuditLogEntry.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      
      this.recentBans.forEach((bans, userId) => {
        bans.sweep(timestamp => now - timestamp > 300000);
        if (bans.size === 0) this.recentBans.delete(userId);
      });
      
      this.recentKicks.forEach((kicks, userId) => {
        kicks.sweep(timestamp => now - timestamp > 300000);
        if (kicks.size === 0) this.recentKicks.delete(userId);
      });
    }, 60000);
  }
  
  async onAuditLogEntry(auditLogEntry, guild) {
    if (!this.enabled || !guild) return;
    
    if (![
      AuditLogEvent.MemberBanAdd,
      AuditLogEvent.MemberKick
    ].includes(auditLogEntry.action)) return;
    
    try {
      const { executor, target } = auditLogEntry;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı ban/kick işlemi yaptı: ${executor.tag} (${executor.id})`);
        return;
      }
      
      if (auditLogEntry.action === AuditLogEvent.MemberBanAdd) {
        await this.handleBan(guild, executor.id, target.id);
      } else if (auditLogEntry.action === AuditLogEvent.MemberKick) {
        await this.handleKick(guild, executor.id, target.id);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Denetim kaydı işlenirken hata: ${error.message}`);
    }
  }
  
  async onGuildBanAdd(ban) {
    if (!this.enabled || !ban.guild) return;
    
    const { guild, user } = ban;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı bir üyeyi banladı: ${executor.tag} (${executor.id})`);
        return;
      }
      
      await this.handleBan(guild, executor.id, user.id);
    } catch (error) {
      this.logger.error(`[${this.name}] Ban olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onGuildMemberRemove(member) {
    if (!this.enabled || !member.guild) return;
    
    const { guild, user } = member;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick
      });
      
      const log = auditLogs.entries.first();
      
      if (!log || Date.now() - log.createdTimestamp > 5000 || log.target.id !== user.id) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı bir üyeyi kickledi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      await this.handleKick(guild, executor.id, user.id);
    } catch (error) {
      this.logger.error(`[${this.name}] Kick olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async handleBan(guild, executorId, targetId) {
    if (!this.recentBans.has(executorId)) {
      this.recentBans.set(executorId, new Collection());
    }
    
    const userBans = this.recentBans.get(executorId);
    userBans.set(targetId, Date.now());
    
    const maxBanActions = this.config.guards.banKickProtection.maxActions || 3;
    const timePeriod = this.config.guards.banKickProtection.timePeriod || 60000;
    
    const now = Date.now();
    const recentBans = userBans.filter(timestamp => now - timestamp < timePeriod);
    
    this.logger.info(`[${this.name}] ${executorId} kullanıcısı son ${timePeriod / 1000} saniye içinde ${recentBans.size} ban işlemi gerçekleştirdi.`);
    
    if (recentBans.size >= maxBanActions) {
      this.logger.guard(`[${this.name}] Ban limiti aşıldı! Kullanıcı: ${executorId}, son ${timePeriod / 60000} dakika içinde ${recentBans.size} ban işlemi.`);
      
      await this.handleViolation(guild, executorId, 'ban');
    }
  }
  
  async handleKick(guild, executorId, targetId) {
    if (!this.recentKicks.has(executorId)) {
      this.recentKicks.set(executorId, new Collection());
    }
    
    const userKicks = this.recentKicks.get(executorId);
    userKicks.set(targetId, Date.now());
    
    const maxKickActions = this.config.guards.banKickProtection.maxActions || 3;
    const timePeriod = this.config.guards.banKickProtection.timePeriod || 60000;
    
    const now = Date.now();
    const recentKicks = userKicks.filter(timestamp => now - timestamp < timePeriod);
    
    this.logger.info(`[${this.name}] ${executorId} kullanıcısı son ${timePeriod / 1000} saniye içinde ${recentKicks.size} kick işlemi gerçekleştirdi.`);
    
    if (recentKicks.size >= maxKickActions) {
      this.logger.guard(`[${this.name}] Kick limiti aşıldı! Kullanıcı: ${executorId}, son ${timePeriod / 60000} dakika içinde ${recentKicks.size} kick işlemi.`);
      
      await this.handleViolation(guild, executorId, 'kick');
    }
  }
  
  async handleViolation(guild, userId, violationType) {
    let action = this.config.guards.banKickProtection.action || 'ban';
    let reason = `[${this.name}] ${violationType === 'ban' ? 'Ban' : 'Kick'} koruması: Kısa sürede çok fazla ${violationType} işlemi`;
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (member) {
        try {
          await this.utils.takeAction(member, 'demote', `[${this.name}] Toplu ${violationType} ihlali nedeniyle roller alındı`);
          this.logger.success(`[${this.name}] İhlal yapan üyenin yetkileri düşürüldü: ${userId}`);
        } catch (error) {
          this.logger.error(`[${this.name}] Üye yetkileri düşürülürken hata: ${error.message}`);
        }
        
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
        title: '⚠️ Ban/Kick Güvenlik İhlali!',
        description: `Bir kullanıcı toplu ${violationType} işlemi yaptı ve gerekli önlemler alındı.`,
        color: this.config.logging.colorError,
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'İhlal Türü', value: violationType === 'ban' ? 'Toplu Ban' : 'Toplu Kick', inline: true },
          { name: 'Alınan Önlem', value: action.toUpperCase(), inline: true }
        ],
        notifyOwner: true
      });
      
      if (violationType === 'ban') {
        this.recentBans.delete(userId);
      } else {
        this.recentKicks.delete(userId);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new BanKickGuard();
