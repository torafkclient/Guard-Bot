const BaseGuard = require('../structures/BaseGuard');
const { AuditLogEvent } = require('discord.js');

class ServerGuard extends BaseGuard {
  constructor() {
    super({
      name: 'ServerGuard',
      description: 'Sunucu ayarları değişikliklerini izler ve yetkisiz değişiklikleri engeller.',
      enabled: true
    });
  }
  
  registerEvents(client) {
    client.on('guildUpdate', this.onGuildUpdate.bind(this));
    client.on('guildMemberUpdate', this.onGuildMemberUpdate.bind(this));
    client.on('guildAuditLogEntryCreate', this.onAuditLogEntry.bind(this));
  }
  
  async onAuditLogEntry(auditLogEntry, guild) {
    if (!this.enabled || !guild) return;
    
    if (![
      AuditLogEvent.GuildUpdate,
      AuditLogEvent.EmojiCreate,
      AuditLogEvent.EmojiDelete,
      AuditLogEvent.EmojiUpdate,
      AuditLogEvent.StickerCreate,
      AuditLogEvent.StickerDelete,
      AuditLogEvent.StickerUpdate,
      AuditLogEvent.GuildVanityUpdate,
      AuditLogEvent.GuildMfaLevelUpdate
    ].includes(auditLogEntry.action)) return;
    
    try {
      const { executor } = auditLogEntry;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı sunucu ayarını değiştirdi: ${executor.tag} (${executor.id}), İşlem: ${auditLogEntry.action}`);
        return;
      }
      
      if ([AuditLogEvent.GuildUpdate, AuditLogEvent.GuildVanityUpdate, AuditLogEvent.GuildMfaLevelUpdate].includes(auditLogEntry.action)) {
        this.logger.guard(`[${this.name}] Kritik sunucu ayarı değiştirildi! Kullanıcı: ${executor.tag} (${executor.id}), İşlem: ${auditLogEntry.action}`);
        
        await this.handleViolation(guild, executor.id, auditLogEntry.action, auditLogEntry);
      }
      
      if ([
        AuditLogEvent.EmojiCreate,
        AuditLogEvent.EmojiDelete,
        AuditLogEvent.EmojiUpdate,
        AuditLogEvent.StickerCreate,
        AuditLogEvent.StickerDelete,
        AuditLogEvent.StickerUpdate
      ].includes(auditLogEntry.action)) {
        await this.logEmojiStickerChange(guild, executor.id, auditLogEntry);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Denetim kaydı işlenirken hata: ${error.message}`);
    }
  }
  
  async onGuildUpdate(oldGuild, newGuild) {
    if (!this.enabled) return;
    
    try {
      const criticalChanges = this.checkCriticalChanges(oldGuild, newGuild);
      
      if (criticalChanges) {
        const auditLogs = await newGuild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.GuildUpdate
        });
        
        const log = auditLogs.entries.first();
        if (!log || Date.now() - log.createdTimestamp > 5000) return;
        
        const { executor } = log;
        
        if (executor.id === this.client.user.id || executor.id === newGuild.ownerId) return;
        
        if (await this.utils.isWhitelisted(executor.id, this.client)) {
          this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı sunucu ayarlarını güncelledi: ${executor.tag} (${executor.id})`);
          return;
        }
        
        this.logger.guard(`[${this.name}] Kritik sunucu ayarı değişikliği tespit edildi! Kullanıcı: ${executor.tag} (${executor.id})`);
        
        const changes = this.getGuildChanges(oldGuild, newGuild);
        this.logger.warn(`[${this.name}] Değişiklikler: ${changes.join(', ')}`);
        
        if (oldGuild.name !== newGuild.name) {
          await this.reverseNameChange(newGuild, oldGuild.name);
        }
        
        await this.handleViolation(newGuild, executor.id, 'guild_update', log);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Sunucu güncelleme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onGuildMemberUpdate(oldMember, newMember) {
    if (!this.enabled) return;
    
    const { guild } = newMember;
    
    try {
      if (newMember.id === guild.ownerId && oldMember.id !== guild.ownerId) {
        this.logger.guard(`[${this.name}] Sunucu sahibi değişti! Yeni sahip: ${newMember.user.tag} (${newMember.id})`);
        
        await this.utils.sendLogMessage(this.client, guild.id, {
          title: '⚠️ DİKKAT! Sunucu Sahibi Değişti!',
          description: `Sunucu sahibi değişti! Bu değişiklik bilinciniz dahilinde değilse hemen durumu kontrol edin ve gerekli önlemleri alın.`,
          color: this.config.logging.colorError,
          fields: [
            { name: 'Yeni Sahip', value: `${newMember.user.tag} (${newMember.id})`, inline: true }
          ],
          notifyOwner: true
        });
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Üye güncelleme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async logEmojiStickerChange(guild, executorId, auditLogEntry) {
    try {
      let action = '';
      let targetName = '';
      let targetType = '';
      
      switch (auditLogEntry.action) {
        case AuditLogEvent.EmojiCreate:
          action = 'Emoji oluşturma';
          targetType = 'Emoji';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
        case AuditLogEvent.EmojiDelete:
          action = 'Emoji silme';
          targetType = 'Emoji';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
        case AuditLogEvent.EmojiUpdate:
          action = 'Emoji güncelleme';
          targetType = 'Emoji';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
        case AuditLogEvent.StickerCreate:
          action = 'Sticker oluşturma';
          targetType = 'Sticker';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
        case AuditLogEvent.StickerDelete:
          action = 'Sticker silme';
          targetType = 'Sticker';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
        case AuditLogEvent.StickerUpdate:
          action = 'Sticker güncelleme';
          targetType = 'Sticker';
          targetName = auditLogEntry.target ? auditLogEntry.target.name : 'Bilinmiyor';
          break;
      }
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: `${this.name} - ${action}`,
        description: `Bir kullanıcı sunucuda ${targetType.toLowerCase()} değişikliği yaptı.`,
        color: this.config.logging.colorInfo,
        fields: [
          { name: 'Kullanıcı', value: `<@${executorId}> (${executorId})`, inline: true },
          { name: 'İşlem', value: action, inline: true },
          { name: targetType, value: targetName, inline: true }
        ]
      });
    } catch (error) {
      this.logger.error(`[${this.name}] Emoji/Sticker değişikliği loglanırken hata: ${error.message}`);
    }
  }
  
  checkCriticalChanges(oldGuild, newGuild) {
    if (oldGuild.name !== newGuild.name) return true;
    if (oldGuild.iconURL() !== newGuild.iconURL()) return true;
    if (oldGuild.bannerURL() !== newGuild.bannerURL()) return true;
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) return true;
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) return true;
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) return true;
    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) return true;
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) return true;
    if (oldGuild.afkChannelId !== newGuild.afkChannelId) return true;
    
    return false;
  }
  
  getGuildChanges(oldGuild, newGuild) {
    const changes = [];
    
    if (oldGuild.name !== newGuild.name) changes.push(`Sunucu Adı: ${oldGuild.name} -> ${newGuild.name}`);
    if (oldGuild.iconURL() !== newGuild.iconURL()) changes.push('Sunucu İkonu Değişti');
    if (oldGuild.bannerURL() !== newGuild.bannerURL()) changes.push('Sunucu Banner Değişti');
    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`Özel URL: ${oldGuild.vanityURLCode} -> ${newGuild.vanityURLCode}`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`Doğrulama Seviyesi: ${oldGuild.verificationLevel} -> ${newGuild.verificationLevel}`);
    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) changes.push('İçerik Filtresi Değişti');
    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) changes.push('Bildirim Ayarları Değişti');
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push('Sistem Kanalı Değişti');
    if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push('AFK Kanalı Değişti');
    
    return changes;
  }
  
  async reverseNameChange(guild, oldName) {
    try {
      await guild.setName(oldName, `[${this.name}] Yetkisiz sunucu adı değişikliği geri alınıyor`);
      this.logger.success(`[${this.name}] Sunucu adı eski haline geri getirildi: ${oldName}`);
    } catch (error) {
      this.logger.error(`[${this.name}] Sunucu adı geri alınırken hata: ${error.message}`);
    }
  }
  
  async handleViolation(guild, userId, violationType, auditLogEntry) {
    let action = this.config.guards.serverProtection.action || 'ban';
    let reason = `[${this.name}] Yetkisiz sunucu ayarı değişikliği`;
    
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      
      if (member) {
        try {
          await this.utils.takeAction(member, 'demote', `[${this.name}] Yetkisiz sunucu ayarı değişikliği nedeniyle roller alındı`);
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
      
      let details = '';
      if (auditLogEntry?.changes) {
        details = auditLogEntry.changes.map(change => {
          return `${change.key}: ${change.old || 'Yok'} -> ${change.new || 'Yok'}`;
        }).join('\n');
      }
      
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: '⚠️ Sunucu Ayarı Koruma İhlali!',
        description: `Bir kullanıcı yetkisiz sunucu ayarı değişikliği yaptı ve gerekli önlemler alındı.`,
        color: this.config.logging.colorError,
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'İhlal Türü', value: violationType, inline: true },
          { name: 'Alınan Önlem', value: action.toUpperCase(), inline: true },
          { name: 'Değişiklik Detayları', value: details || 'Detay bulunamadı', inline: false }
        ],
        notifyOwner: true
      });
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new ServerGuard();
