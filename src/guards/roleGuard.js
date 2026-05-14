const BaseGuard = require('../structures/BaseGuard');
const { Collection, AuditLogEvent, PermissionsBitField } = require('discord.js');

class RoleGuard extends BaseGuard {
  constructor() {
    super({
      name: 'RoleGuard',
      description: 'Rol oluşturma, silme ve düzenleme işlemlerini takip eder ve yetkisiz değişiklikleri engeller.',
      enabled: true
    });
    
    this.recentActions = new Collection();
    
    this.deletedRoles = new Collection();
  }
  
  registerEvents(client) {
    client.on('roleCreate', this.onRoleCreate.bind(this));
    client.on('roleDelete', this.onRoleDelete.bind(this));
    client.on('roleUpdate', this.onRoleUpdate.bind(this));
    
    setInterval(() => {
      const now = Date.now();
      this.recentActions.sweep(action => now - action.timestamp > 600000);
      this.deletedRoles.sweep(role => now - role.timestamp > 1800000);
    }, 60000);
  }
  
  async onRoleCreate(role) {
    if (!this.enabled || !role.guild) return;
    
    const { guild } = role;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleCreate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı rol oluşturdu: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const actionKey = `${guild.id}-${executor.id}`;
      if (!this.recentActions.has(actionKey)) {
        this.recentActions.set(actionKey, {
          userId: executor.id,
          roleCreations: 0,
          roleDeletions: 0,
          roleUpdates: 0,
          timestamp: Date.now()
        });
      }
      
      const userActions = this.recentActions.get(actionKey);
      userActions.roleCreations++;
      userActions.timestamp = Date.now();
      
      const maxRoleCreations = this.config.guards.roleProtection.maxRoleCreations || 3;
      const timePeriod = this.config.guards.roleProtection.timePeriod || 300000;
      
      if (userActions.roleCreations >= maxRoleCreations && Date.now() - userActions.timestamp < timePeriod) {
        this.logger.guard(`[${this.name}] Rol oluşturma limiti aşıldı! Kullanıcı: ${executor.tag} (${executor.id}), son ${timePeriod / 60000} dakika içinde ${userActions.roleCreations} rol oluşturuldu.`);
        
        await this.handleViolation(guild, executor.id, role, 'create');
      }
      
      if (this.hasDangerousPermissions(role)) {
        this.logger.guard(`[${this.name}] Tehlikeli izinlere sahip rol oluşturuldu! Kullanıcı: ${executor.tag} (${executor.id}), Rol: ${role.name}`);
        
        await this.handleDangerousRole(guild, executor.id, role);
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Rol oluşturma olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onRoleDelete(role) {
    if (!this.enabled || !role.guild) return;
    
    const { guild } = role;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleDelete
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor, target } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı rol sildi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const actionKey = `${guild.id}-${executor.id}`;
      if (!this.recentActions.has(actionKey)) {
        this.recentActions.set(actionKey, {
          userId: executor.id,
          roleCreations: 0,
          roleDeletions: 0,
          roleUpdates: 0,
          timestamp: Date.now()
        });
      }
      
      const userActions = this.recentActions.get(actionKey);
      userActions.roleDeletions++;
      userActions.timestamp = Date.now();
      
      this.deletedRoles.set(role.id, {
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield,
        mentionable: role.mentionable,
        timestamp: Date.now()
      });
      
      const maxRoleDeletions = this.config.guards.roleProtection.maxRoleCreations || 3;
      const timePeriod = this.config.guards.roleProtection.timePeriod || 300000;
      
      if (userActions.roleDeletions >= maxRoleDeletions && Date.now() - userActions.timestamp < timePeriod) {
        this.logger.guard(`[${this.name}] Rol silme limiti aşıldı! Kullanıcı: ${executor.tag} (${executor.id}), son ${timePeriod / 60000} dakika içinde ${userActions.roleDeletions} rol silindi.`);
        
        await this.handleViolation(guild, executor.id, null, 'delete');
      }
      
      if (this.isImportantRole(role)) {
        this.logger.guard(`[${this.name}] Önemli bir rol silindi! Rol: ${role.name}, Kullanıcı: ${executor.tag} (${executor.id})`);
        
        await this.handleViolation(guild, executor.id, null, 'delete_important');
        
        try {
          const deletedRoleInfo = this.deletedRoles.get(role.id);
          
          if (deletedRoleInfo) {
            const newRole = await guild.roles.create({
              name: deletedRoleInfo.name,
              color: deletedRoleInfo.color,
              hoist: deletedRoleInfo.hoist,
              position: deletedRoleInfo.position,
              permissions: deletedRoleInfo.permissions,
              mentionable: deletedRoleInfo.mentionable,
              reason: `[${this.name}] Silinen önemli rol geri oluşturuluyor`
            });
            
            this.logger.success(`[${this.name}] Silinen önemli rol geri oluşturuldu: ${newRole.name}`);
          }
        } catch (error) {
          this.logger.error(`[${this.name}] Silinen rol geri oluşturulurken hata: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Rol silme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  async onRoleUpdate(oldRole, newRole) {
    if (!this.enabled || !newRole.guild) return;
    
    const { guild } = newRole;
    
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleUpdate
      });
      
      const log = auditLogs.entries.first();
      if (!log || Date.now() - log.createdTimestamp > 5000) return;
      
      const { executor } = log;
      
      if (executor.id === this.client.user.id || executor.id === guild.ownerId) return;
      
      if (await this.utils.isWhitelisted(executor.id, this.client)) {
        this.logger.info(`[${this.name}] Beyaz listedeki kullanıcı rol güncelledi: ${executor.tag} (${executor.id})`);
        return;
      }
      
      const permissionsChanged = this.checkPermissionChanges(oldRole, newRole);
      
      if (permissionsChanged) {
        this.logger.guard(`[${this.name}] Kritik rol izin değişikliği tespit edildi! Kullanıcı: ${executor.tag} (${executor.id}), Rol: ${newRole.name}`);
        
        await this.handleViolation(guild, executor.id, newRole, 'update', permissionsChanged);
        
        try {
          await newRole.setPermissions(oldRole.permissions, `[${this.name}] Yetkisiz izin değişikliği geri alınıyor`);
          this.logger.success(`[${this.name}] Rol izinleri eski haline geri getirildi: ${newRole.name}`);
        } catch (error) {
          this.logger.error(`[${this.name}] Rol izinleri geri alınırken hata: ${error.message}`);
        }
      }
      
      if (this.isImportantRole(newRole) && oldRole.name !== newRole.name) {
        this.logger.guard(`[${this.name}] Önemli bir rol adı değiştirildi! Eski: ${oldRole.name}, Yeni: ${newRole.name}, Kullanıcı: ${executor.tag} (${executor.id})`);
        
        await this.handleViolation(guild, executor.id, newRole, 'rename_important');
        
        try {
          await newRole.setName(oldRole.name, `[${this.name}] Yetkisiz rol adı değişikliği geri alınıyor`);
          this.logger.success(`[${this.name}] Rol adı eski haline geri getirildi: ${oldRole.name}`);
        } catch (error) {
          this.logger.error(`[${this.name}] Rol adı geri alınırken hata: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`[${this.name}] Rol güncelleme olayı işlenirken hata: ${error.message}`);
    }
  }
  
  checkPermissionChanges(oldRole, newRole) {
    const criticalPermissions = [
      PermissionsBitField.Flags.Administrator,
      PermissionsBitField.Flags.BanMembers,
      PermissionsBitField.Flags.KickMembers,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageGuild,
      PermissionsBitField.Flags.ManageRoles,
      PermissionsBitField.Flags.ManageWebhooks,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.MentionEveryone
    ];
    
    for (const permission of criticalPermissions) {
      if (!oldRole.permissions.has(permission) && newRole.permissions.has(permission)) {
        return true;
      }
    }
    
    return false;
  }
  
  hasDangerousPermissions(role) {
    const dangerousPermissions = [
      PermissionsBitField.Flags.Administrator,
      PermissionsBitField.Flags.BanMembers,
      PermissionsBitField.Flags.KickMembers,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageGuild,
      PermissionsBitField.Flags.ManageRoles
    ];
    
    for (const permission of dangerousPermissions) {
      if (role.permissions.has(permission)) {
        return true;
      }
    }
    
    return false;
  }
  
  isImportantRole(role) {
    return role.permissions.has(PermissionsBitField.Flags.Administrator) ||
           role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
           role.permissions.has(PermissionsBitField.Flags.ManageRoles);
  }
  
  async handleDangerousRole(guild, userId, role) {
    try {
      await role.setPermissions(0n, `[${this.name}] Tehlikeli izinlere sahip rol düzenleniyor`);
      
      const reason = `[${this.name}] Tehlikeli izinlere sahip rol oluşturma`;
      
      await this.logViolation(guild.id, userId, 'warn', reason);
      
      this.logger.success(`[${this.name}] Tehlikeli rol izinleri kaldırıldı: ${role.name}`);
    } catch (error) {
      this.logger.error(`[${this.name}] Tehlikeli rol düzenlenirken hata: ${error.message}`);
    }
  }
  
  async handleViolation(guild, userId, role, actionType, permissionViolation = false) {
    let action = this.config.guards.roleProtection.action || 'ban';
    let reason = '';
    
    switch (actionType) {
      case 'create':
        reason = `[${this.name}] Kısa sürede çok fazla rol oluşturma`;
        if (role) {
          try {
            await role.delete(`[${this.name}] Yetkisiz rol oluşturma`).catch(() => {});
          } catch (error) {
            this.logger.error(`[${this.name}] Rol silinirken hata: ${error.message}`);
          }
        }
        break;
      
      case 'delete':
        reason = `[${this.name}] Kısa sürede çok fazla rol silme`;
        break;
      
      case 'delete_important':
        reason = `[${this.name}] Önemli bir rolü silme`;
        action = 'ban';
        break;
      
      case 'update':
        reason = `[${this.name}] Kritik rol izin değişikliği yapma`;
        break;
      
      case 'rename_important':
        reason = `[${this.name}] Önemli bir rolün adını değiştirme`;
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

module.exports = new RoleGuard();
