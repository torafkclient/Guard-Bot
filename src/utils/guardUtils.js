const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('./config');
const logger = require('./logger');

class GuardUtils {
  static async isWhitelisted(userId, client) {
    const dbType = config.database.type.toLowerCase();
    const db = client.db;
    
    if (!userId) return false;
    
    if (userId === config.bot.ownerId) return true;
    
    if (config.whitelist.users.includes(userId)) return true;
    
    try {
      if (dbType === 'mongodb') {
        const { schemas } = require('../database/index');
        const user = await schemas.WhitelistedUser.findOne({ id: userId });
        return !!user;
      } else if (dbType === 'mysql') {
        const [rows] = await db.execute('SELECT id FROM whitelisted_users WHERE id = ?', [userId]);
        return rows.length > 0;
      } else if (dbType === 'sqlite') {
        return new Promise((resolve) => {
          db.get('SELECT id FROM whitelisted_users WHERE id = ?', [userId], (err, row) => {
            if (err) {
              logger.error(`Whitelist sorgusu hatası: ${err.message}`);
              resolve(false);
            } else {
              resolve(!!row);
            }
          });
        });
      }
    } catch (error) {
      logger.error(`Whitelist kontrolü hatası: ${error.message}`);
      return false;
    }
    
    return false;
  }
  
  static async isWhitelistedRole(roleId, client) {
    const dbType = config.database.type.toLowerCase();
    const db = client.db;
    
    if (!roleId) return false;
    
    if (config.whitelist.roles.includes(roleId)) return true;
    
    try {
      if (dbType === 'mongodb') {
        const { schemas } = require('../database/index');
        const role = await schemas.WhitelistedRole.findOne({ id: roleId });
        return !!role;
      } else if (dbType === 'mysql') {
        const [rows] = await db.execute('SELECT id FROM whitelisted_roles WHERE id = ?', [roleId]);
        return rows.length > 0;
      } else if (dbType === 'sqlite') {
        return new Promise((resolve) => {
          db.get('SELECT id FROM whitelisted_roles WHERE id = ?', [roleId], (err, row) => {
            if (err) {
              logger.error(`Whitelist rol sorgusu hatası: ${err.message}`);
              resolve(false);
            } else {
              resolve(!!row);
            }
          });
        });
      }
    } catch (error) {
      logger.error(`Whitelist rol kontrolü hatası: ${error.message}`);
      return false;
    }
    
    return false;
  }
  
  static hasAdminPermission(member) {
    if (!member) return false;
    
    if (member.guild.ownerId === member.id) return true;
    
    return member.permissions.has(PermissionsBitField.Flags.Administrator);
  }
  
  static async sendLogMessage(client, guildId, options) {
    if (!config.logging.enabled || !config.logging.channelId) return;
    
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      
      const logChannel = guild.channels.cache.get(config.logging.channelId);
      if (!logChannel) return;
      
      const embed = new EmbedBuilder()
        .setTitle(options.title || 'lbGuard Koruma Sistemi')
        .setDescription(options.description || 'Bir güvenlik olayı tespit edildi.')
        .setColor(options.color || config.logging.colorInfo)
        .setTimestamp();
      
      if (options.fields && Array.isArray(options.fields)) {
        options.fields.forEach(field => {
          embed.addFields({ name: field.name, value: field.value, inline: field.inline || false });
        });
      }
      
      embed.setFooter({ text: `${client.user.username} Guard System`, iconURL: client.user.displayAvatarURL() });
      
      await logChannel.send({ embeds: [embed] });
      
      if (options.notifyOwner) {
        const owner = await guild.fetchOwner();
        try {
          await owner.send({ embeds: [embed] });
        } catch (error) {
          logger.warn(`Sunucu sahibine özel mesaj gönderilemedi: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Log mesajı gönderilirken hata oluştu: ${error.message}`);
    }
  }
  
  static async logGuardAction(client, data) {
    const dbType = config.database.type.toLowerCase();
    const db = client.db;
    
    try {
      if (dbType === 'mongodb') {
        const { schemas } = require('../database/index');
        await new schemas.GuardAction({
          guildId: data.guildId,
          userId: data.userId,
          guardType: data.guardType,
          actionTaken: data.actionTaken,
          reason: data.reason
        }).save();
      } else if (dbType === 'mysql') {
        await db.execute(
          'INSERT INTO guard_actions (guild_id, user_id, guard_type, action_taken, reason) VALUES (?, ?, ?, ?, ?)',
          [data.guildId, data.userId, data.guardType, data.actionTaken, data.reason]
        );
      } else if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
          db.run(
            'INSERT INTO guard_actions (guild_id, user_id, guard_type, action_taken, reason) VALUES (?, ?, ?, ?, ?)',
            [data.guildId, data.userId, data.guardType, data.actionTaken, data.reason],
            function(err) {
              if (err) {
                logger.error(`Guard aksiyonu kayıt hatası: ${err.message}`);
                reject(err);
              } else {
                resolve(this.lastID);
              }
            }
          );
        });
      }
    } catch (error) {
      logger.error(`Guard aksiyonu kaydedilirken hata oluştu: ${error.message}`);
    }
  }
  
  static async takeAction(member, action, reason, duration = 60000) {
    if (!member || !member.guild) return false;
    
    try {
      switch (action.toLowerCase()) {
        case 'ban':
          await member.ban({ reason: reason });
          break;
        case 'kick':
          await member.kick(reason);
          break;
        case 'mute':
          await member.timeout(duration, reason);
          break;
        case 'timeout':
          await member.timeout(duration, reason);
          break;
        case 'warn':
          break;
        case 'demote':
          const roles = member.roles.cache.filter(role => 
            role.id !== member.guild.id &&
            !role.managed
          );
          
          await member.roles.remove(roles, reason);
          break;
        default:
          logger.warn(`Bilinmeyen eylem türü: ${action}`);
          return false;
      }
      return true;
    } catch (error) {
      logger.error(`Eylem alınırken hata oluştu (${action}): ${error.message}`);
      return false;
    }
  }
}

module.exports = GuardUtils;
