const BaseGuard = require('../structures/BaseGuard');
const { Collection } = require('discord.js');

class AntiRaidGuard extends BaseGuard {
  constructor() {
    super({
      name: 'AntiRaid',
      description: 'Sunucuya kısa sürede çok sayıda kullanıcı katılmasını tespit eder ve önlem alır.',
      enabled: true
    });
    
    this.recentJoins = new Collection();
  }
  
  registerEvents(client) {
    client.on('guildMemberAdd', this.onMemberJoin.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      this.recentJoins.sweep(timestamp => now - timestamp > 60000);
    }, 30000);
  }
  
  async onMemberJoin(member) {
    if (!this.enabled || !member || !member.guild) return;
    
    const { guild } = member;
    const guildId = guild.id;
    
    if (await this.utils.isWhitelisted(member.id, this.client)) {
      this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı katıldı: ${member.user.tag} (${member.id})`);
      return;
    }
    
    const now = Date.now();
    if (!this.recentJoins.has(guildId)) {
      this.recentJoins.set(guildId, new Collection());
    }
    
    const guildJoins = this.recentJoins.get(guildId);
    guildJoins.set(member.id, now);
    
    const joinThreshold = this.config.guards.antiRaid.joinThreshold || 5;
    const joinTime = this.config.guards.antiRaid.joinTime || 8000;
    const recentMembers = guildJoins.filter(timestamp => now - timestamp < joinTime);
    
    if (recentMembers.size >= joinThreshold) {
      this.logger.guard(`[${this.name}] Raid tespit edildi! Son ${joinTime / 1000} saniye içinde ${recentMembers.size} kişi katıldı.`);
      
      await this.handleRaid(guild, recentMembers, member);
    }
  }
  
  async handleRaid(guild, recentMembers, triggerMember) {
    const action = this.config.guards.antiRaid.action || 'kick';
    const reason = `[${this.name}] Raid koruması: Kısa sürede çok sayıda kullanıcı girişi tespit edildi`;
    
    await this.utils.sendLogMessage(this.client, guild.id, {
      title: '⚠️ Raid Tespit Edildi!',
      description: `Son ${this.config.guards.antiRaid.joinTime / 1000} saniye içinde ${recentMembers.size} kullanıcı sunucuya katıldı. Raid tespit edildi ve önlem alındı.`,
      color: this.config.logging.colorError,
      fields: [
        { name: 'Tetikleyen Kullanıcı', value: `${triggerMember.user.tag} (${triggerMember.id})`, inline: false },
        { name: 'Alınan Önlem', value: action.toUpperCase(), inline: true },
        { name: 'Etkilenen Kullanıcı Sayısı', value: `${recentMembers.size}`, inline: true }
      ],
      notifyOwner: true
    });
    
    for (const [userId, timestamp] of recentMembers.entries()) {
      try {
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        if (!targetMember) continue;
        
        if (action === 'timeout') {
          const duration = this.config.guards.antiRaid.timeoutDuration || 60000 * 10;
          await this.utils.takeAction(targetMember, action, reason, duration);
        } else {
          await this.utils.takeAction(targetMember, action, reason);
        }
        
        await this.logViolation(guild.id, userId, action, reason);
      } catch (error) {
        this.logger.error(`[${this.name}] Kullanıcıya işlem uygulanırken hata: ${error.message}`);
      }
    }
    
    this.recentJoins.get(guild.id).clear();
  }
}

module.exports = new AntiRaidGuard();
