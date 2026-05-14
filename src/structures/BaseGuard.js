/**
 * Temel Guard sınıfı - Tüm koruma sistemleri bu sınıftan türetilir
 */
class BaseGuard {
  /**
   * @param {Object} options Guard sistemi yapılandırması
   * @param {string} options.name Guard sistemi adı
   * @param {string} options.description Guard sistemi açıklaması
   * @param {boolean} options.enabled Guard sistemi etkin mi?
   */
  constructor(options) {
    this.name = options.name || 'UnknownGuard';
    this.description = options.description || 'Bir güvenlik sistemi.';
    this.enabled = options.enabled !== false;
    this.logger = require('../utils/logger');
    this.config = require('../utils/config');
    this.utils = require('../utils/guardUtils');
  }
  
  /**
   * Guard sistemini kurar ve gerekli olay dinleyicilerini ekler
   * @param {import('discord.js').Client} client Discord.js istemcisi
   */
  setup(client) {
    this.client = client;
    
    if (!this.enabled) {
      this.logger.info(`${this.name} koruma sistemi devre dışı bırakıldı.`);
      return;
    }
    
    this.logger.info(`${this.name} koruma sistemi başlatılıyor...`);
    this.registerEvents(client);
    this.logger.success(`${this.name} koruma sistemi başarıyla başlatıldı!`);
  }
  
  /**
   * Olay dinleyicilerini kaydetmek için bu metodu alt sınıflarda uygulayın
   * @param {import('discord.js').Client} client Discord.js istemcisi
   */
  registerEvents(client) {
    throw new Error('registerEvents metodu uygulanmamış');
  }
  
  /**
   * Guard sistemini etkinleştirir
   */
  enable() {
    this.enabled = true;
    this.logger.info(`${this.name} koruma sistemi etkinleştirildi.`);
  }
  
  /**
   * Guard sistemini devre dışı bırakır
   */
  disable() {
    this.enabled = false;
    this.logger.info(`${this.name} koruma sistemi devre dışı bırakıldı.`);
  }
  
  /**
   * İhlal tespiti yapıldığında log kaydı oluşturur ve bildirim gönderir
   * @param {string} guildId Sunucu kimliği
   * @param {string} userId Kullanıcı kimliği
   * @param {string} action Alınan önlem
   * @param {string} reason Sebep
   */
  async logViolation(guildId, userId, action, reason) {
    await this.utils.logGuardAction(this.client, {
      guildId,
      userId,
      guardType: this.name,
      actionTaken: action,
      reason
    });
    
    await this.utils.sendLogMessage(this.client, guildId, {
      title: `${this.name} İhlal Tespit Edildi`,
      description: `Bir güvenlik ihlali tespit edildi ve gerekli önlemler alındı.`,
      color: this.config.logging.colorWarning,
      fields: [
        { name: 'Kullanıcı', value: `<@${userId}>`, inline: true },
        { name: 'Kullanıcı ID', value: userId, inline: true },
        { name: 'İşlem', value: action, inline: true },
        { name: 'Sebep', value: reason, inline: false }
      ],
      notifyOwner: action === 'ban'
    });
    
    this.logger.guard(`[${this.name}] İhlal: ${reason} | Kullanıcı: ${userId} | İşlem: ${action}`);
  }
}

module.exports = BaseGuard;
