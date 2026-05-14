const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent } = require('discord.js');

class BotGuard extends BaseGuard {
  constructor() {
    super({
      name: 'BotGuard',
      description: 'Sunucuya izinsiz bot eklemelerini tespit eder ve engeller.',
      enabled: true
    });
    
    this.recentBotAdds = new Collection();
    
    this.trustedBots = [];
  }
  
  registerEvents(client) {
    client.on('guildMemberAdd', this.onGuildMemberAdd.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      
      this.recentBotAdds.sweep(entry => now - entry.timestamp > 600000);
    }, 60000);
  }
  
  async onGuildMemberAdd(member) {
    if (!this.enabled || !member.guild) return;
    
    if (!member.user.bot) return;
    
    const { guild, user } = member;
    const botId = user.id;
    
    this.logger.info(`[${this.name}] Bot eklendi: ${user.tag} (${botId})`);
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.BotAdd
      });
      
      const log = auditLogs.entries.first();
      
      if (!log || Date.now() - log.createdTimestamp > 10000) {
        this.logger.warn(`[${this.name}] Bot ekleyen kullanıcı tespit edilemedi: ${user.tag} (${botId})`);
        
        await this.notifyBotAdded(guild, botId, null);
        return;
      }
      
      const { executor } = log;
      const executorId = executor.id;
      
      if (executorId === this.client.user.id || executorId === guild.ownerId) {
        this.logger.info(`[${this.name}] Bot sahibi veya sunucu sahibi tarafından eklendi: ${user.tag} (${botId})`);
        return;
      }
      
      if (await this.utils.isWhitelisted(executorId, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı bir bot ekledi: ${executor.tag} (${executorId})`);
        return;
      }
      
      if (await this.isTrustedBot(botId)) {
        this.logger.info(`[${this.name}] Güvenilir bot eklendi: ${user.tag} (${botId})`);
        return;
      }
      
      if (!this.recentBotAdds.has(executorId)) {
        this.recentBotAdds.set(executorId, {
          userId: executorId,
          bots: [],
          timestamp: Date.now()
        });
      }
      
      const userBotAdds = this.recentBotAdds.get(executorId);
      userBotAdds.bots.push({
        botId,
        botTag: user.tag,
        timestamp: Date.now()
      });
      userBotAdds.timestamp = Date.now();
      
      await this.notifyBotAdded(guild, botId, executorId);
      
      const maxBotAdds = 2;
      
      if (userBotAdds.bots.length > maxBotAdds) {
        this.logger.guard(`[${this.name}] Bot ekleme limiti aşıldı! Kullanıcı: ${executor.tag} (${executorId}), toplam ${userBotAdds.bots.length} bot ekledi.`);
        
        await this.handleViolation(guild, executorId, botId);
      } else {
        await this.checkBotPermissions(guild, member, executorId);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Bot ekleme işlemi kontrol edilirken hata: ${error.message}`);
    }
  }
  
  async checkBotPermissions(guild, botMember, addedBy) {
    try {
      const hasDangerousPermissions = botMember.permissions.has([
        'Administrator',
        'ManageGuild',
        'ManageRoles',
        'ManageChannels',
        'BanMembers',
        'KickMembers'
      ]);
      
      if (hasDangerousPermissions) {
        this.logger.warn(`[${this.name}] Eklenen bot tehlikeli izinlere sahip: ${botMember.user.tag} (${botMember.id})`);
        
        try {
          await botMember.roles.set([], `[${this.name}] Güvenlik: Bot tehlikeli izinlere sahip`);
          this.logger.success(`[${this.name}] Bot izinleri kısıtlandı: ${botMember.user.tag}`);
          
          await this.utils.sendLogMessage(this.client, guild.id, {
            title: '⚠️ Bot İzinleri Kısıtlandı!',
            description: `Eklenen bir bot tehlikeli izinlere sahipti ve izinleri kısıtlandı.`,
            color: this.config.logging.colorWarning,
            fields: [
              { name: 'Bot', value: `${botMember.user.tag} (${botMember.id})`, inline: true },
              { name: 'Ekleyen', value: addedBy ? `<@${addedBy}> (${addedBy})` : 'Bilinmiyor', inline: true },
              { name: 'İşlem', value: 'Rolleri kaldırıldı', inline: true }
            ],
            notifyOwner: true
          });
        } catch (error) {
          this.logger.error(`[${this.name}] Bot izinleri kısıtlanırken hata: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Bot izinleri kontrol edilirken hata: ${error.message}`);
    }
  }
  
  async isTrustedBot(botId) {
    try {
      const defaultTrustedBots = [
        '845767163893194784', // Midjourney
        '967679691910545428', // ProBot
        '155149108183695360', // Dyno Bot
        '234395307759108106', // YAGPDB.xyz
        '235148962103951360', // Groovy
        '159985870458322944', // MEE6
        '184405311681986560', // FredBoat
        '322862723090219008', // Dank Memer
        '292953664492929025'  // Rythm
      ];
      
      if (this.trustedBots.length === 0) {
        const dbType = this.config.database.type.toLowerCase();
        const db = this.client.db;
        
        if (dbType === 'mongodb') {
          this.trustedBots = defaultTrustedBots;
        } else if (dbType === 'mysql') {
          this.trustedBots = defaultTrustedBots;
        } else if (dbType === 'sqlite') {
          this.trustedBots = defaultTrustedBots;
        } else {
          this.trustedBots = defaultTrustedBots;
        }
      }
      
      return this.trustedBots.includes(botId);
    } catch (error) {
      this.logger.error(`[${this.name}] Güvenilir bot listesi kontrol edilirken hata: ${error.message}`);
      return false;
    }
  }
  
  async notifyBotAdded(guild, botId, addedBy) {
    try {
      await this.utils.sendLogMessage(this.client, guild.id, {
        title: '🤖 Bot Eklendi',
        description: `Sunucunuza yeni bir bot eklendi. Bilginiz dahilinde değilse kontrol edin.`,
        color: this.config.logging.colorInfo,
        fields: [
          { name: 'Bot', value: `<@${botId}> (${botId})`, inline: true },
          { name: 'Ekleyen', value: addedBy ? `<@${addedBy}> (${addedBy})` : 'Bilinmiyor', inline: true }
        ],
        notifyOwner: true
      });
    } catch (error) {
      this.logger.error(`[${this.name}] Bot ekleme bildirimi gönderilirken hata: ${error.message}`);
    }
  }
  
  async handleViolation(guild, userId, botId) {
    let action = this.config.guards.botProtection.action || 'ban';
    let reason = `[${this.name}] İzinsiz bot ekleme sınırı aşıldı`;
    
    try {
      try {
        const botMember = await guild.members.fetch(botId).catch(() => null);
        if (botMember) {
          await botMember.kick(`[${this.name}] Güvenlik: İzinsiz eklenen bot`);
          this.logger.success(`[${this.name}] İzinsiz eklenen bot kicklendi: ${botId}`);
        }
      } catch (error) {
        this.logger.error(`[${this.name}] Bot kicklenirken hata: ${error.message}`);
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
        title: '⚠️ Bot Koruma İhlali!',
        description: `Bir kullanıcı izinsiz bot ekleme limiti aştı ve gerekli önlemler alındı.`,
        color: this.config.logging.colorError,
        fields: [
          { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
          { name: 'Son Eklenen Bot', value: `<@${botId}> (${botId})`, inline: true },
          { name: 'Alınan Önlem', value: `Bot Kicklendi, Kullanıcı ${action.toUpperCase()}`, inline: true }
        ],
        notifyOwner: true
      });
      
      this.recentBotAdds.delete(userId);
    } catch (error) {
      this.logger.error(`[${this.name}] İhlal işlemi yapılırken hata: ${error.message}`);
    }
  }
}

module.exports = new BotGuard();
