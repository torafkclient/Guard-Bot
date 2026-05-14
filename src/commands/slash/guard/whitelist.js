const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Beyaz listeyi yönetir (koruma sistemlerinden etkilenmeyecek güvenilir kullanıcılar)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('ekle')
        .setDescription('Bir kullanıcı veya rolü beyaz listeye ekler')
        .addStringOption(option =>
          option.setName('tür')
            .setDescription('Eklenecek öğenin türü')
            .setRequired(true)
            .addChoices(
              { name: 'Kullanıcı', value: 'user' },
              { name: 'Rol', value: 'role' }
            ))
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Kullanıcı veya rol ID\'si')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('çıkar')
        .setDescription('Bir kullanıcı veya rolü beyaz listeden çıkarır')
        .addStringOption(option =>
          option.setName('tür')
            .setDescription('Çıkarılacak öğenin türü')
            .setRequired(true)
            .addChoices(
              { name: 'Kullanıcı', value: 'user' },
              { name: 'Rol', value: 'role' }
            ))
        .addStringOption(option =>
          option.setName('id')
            .setDescription('Kullanıcı veya rol ID\'si')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('listele')
        .setDescription('Beyaz listedeki kullanıcı ve rolleri listeler')),
  
  cooldown: 5, // 5 saniye
  
  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    await interaction.deferReply();
    
    // Komutu sadece sunucu sahibi kullanabilir
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.editReply({
        content: '❌ Bu komutu yalnızca sunucu sahibi kullanabilir!'
      });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
      case 'ekle':
        await addToWhitelist(interaction, client);
        break;
      case 'çıkar':
        await removeFromWhitelist(interaction, client);
        break;
      case 'listele':
        await listWhitelist(interaction, client);
        break;
    }
  }
};

/**
 * Beyaz listeye kullanıcı/rol ekler
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function addToWhitelist(interaction, client) {
  const type = interaction.options.getString('tür');
  const id = interaction.options.getString('id');
  
  // ID formatını kontrol et
  if (!/^\d{17,19}$/.test(id)) {
    return interaction.editReply({
      content: '❌ Geçersiz ID formatı! ID bir 17-19 haneli bir sayı olmalıdır.'
    });
  }
  
  try {
    let success = false;
    let name = id;
    
    // Kullanıcı veya rol varlığını kontrol et
    if (type === 'user') {
      try {
        const user = await client.users.fetch(id);
        name = user.tag;
      } catch (error) {
        return interaction.editReply({
          content: '❌ Bu ID\'ye sahip bir kullanıcı bulunamadı!'
        });
      }
      
      // Veritabanına ekle
      success = await addUserToWhitelist(client, id, name, interaction.user.id);
    } else if (type === 'role') {
      try {
        const role = await interaction.guild.roles.fetch(id);
        if (!role) throw new Error('Rol bulunamadı');
        name = role.name;
      } catch (error) {
        return interaction.editReply({
          content: '❌ Bu ID\'ye sahip bir rol bulunamadı!'
        });
      }
      
      // Veritabanına ekle
      success = await addRoleToWhitelist(client, id, name, interaction.user.id);
    }
    
    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Beyaz Liste Güncellendi')
        .setDescription(`**${type === 'user' ? 'Kullanıcı' : 'Rol'}** beyaz listeye eklendi.`)
        .addFields(
          { name: type === 'user' ? 'Kullanıcı' : 'Rol', value: `${name} (${id})`, inline: true },
          { name: 'Ekleyen', value: `${interaction.user.tag}`, inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();
      
      interaction.editReply({ embeds: [embed] });
    } else {
      interaction.editReply({
        content: '❌ Bu öğe zaten beyaz listede!'
      });
    }
  } catch (error) {
    console.error(error);
    interaction.editReply({
      content: `❌ Bir hata oluştu: ${error.message}`
    });
  }
}

/**
 * Beyaz listeden kullanıcı/rol çıkarır
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function removeFromWhitelist(interaction, client) {
  const type = interaction.options.getString('tür');
  const id = interaction.options.getString('id');
  
  // ID formatını kontrol et
  if (!/^\d{17,19}$/.test(id)) {
    return interaction.editReply({
      content: '❌ Geçersiz ID formatı! ID bir 17-19 haneli bir sayı olmalıdır.'
    });
  }
  
  try {
    let success = false;
    
    // Veritabanından kaldır
    if (type === 'user') {
      success = await removeUserFromWhitelist(client, id);
    } else if (type === 'role') {
      success = await removeRoleFromWhitelist(client, id);
    }
    
    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Beyaz Liste Güncellendi')
        .setDescription(`**${type === 'user' ? 'Kullanıcı' : 'Rol'}** beyaz listeden çıkarıldı.`)
        .addFields(
          { name: 'ID', value: id, inline: true },
          { name: 'İşlemi Yapan', value: interaction.user.tag, inline: true }
        )
        .setColor('#ff0000')
        .setTimestamp();
      
      interaction.editReply({ embeds: [embed] });
    } else {
      interaction.editReply({
        content: '❌ Bu öğe beyaz listede bulunamadı!'
      });
    }
  } catch (error) {
    console.error(error);
    interaction.editReply({
      content: `❌ Bir hata oluştu: ${error.message}`
    });
  }
}

/**
 * Beyaz listeyi görüntüler
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').Client} client
 */
async function listWhitelist(interaction, client) {
  try {
    // Veritabanından beyaz listeyi al
    const [users, roles] = await Promise.all([
      getUsersFromWhitelist(client),
      getRolesFromWhitelist(client)
    ]);
    
    const embed = new EmbedBuilder()
      .setTitle('🔍 Beyaz Liste')
      .setDescription('Koruma sistemlerinden etkilenmeyecek güvenilir kullanıcı ve roller.')
      .setColor('#00a0ff')
      .setTimestamp();
    
    // Kullanıcıları ekle
    if (users.length > 0) {
      embed.addFields({
        name: '👤 Kullanıcılar',
        value: users.map(user => `• ${user.username} (${user.id})`).join('\n') || 'Beyaz listede kullanıcı bulunamadı.'
      });
    } else {
      embed.addFields({
        name: '👤 Kullanıcılar',
        value: 'Beyaz listede kullanıcı bulunamadı.'
      });
    }
    
    // Rolleri ekle
    if (roles.length > 0) {
      embed.addFields({
        name: '🏷️ Roller',
        value: roles.map(role => `• ${role.name} (${role.id})`).join('\n') || 'Beyaz listede rol bulunamadı.'
      });
    } else {
      embed.addFields({
        name: '🏷️ Roller',
        value: 'Beyaz listede rol bulunamadı.'
      });
    }
    
    interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    interaction.editReply({
      content: `❌ Bir hata oluştu: ${error.message}`
    });
  }
}

/**
 * Kullanıcıyı beyaz listeye ekler
 * @param {import('discord.js').Client} client
 * @param {string} userId Kullanıcı ID'si
 * @param {string} username Kullanıcı adı
 * @param {string} addedBy Ekleyen kişi ID'si
 * @returns {Promise<boolean>} Başarılı ise true döner
 */
async function addUserToWhitelist(client, userId, username, addedBy) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  // Önce kontrol et
  const exists = await checkUserInWhitelist(client, userId);
  if (exists) return false;
  
  try {
    // Veritabanı tipine göre ekleme işlemi
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      await new schemas.WhitelistedUser({
        id: userId,
        username: username,
        addedBy: addedBy
      }).save();
    } else if (dbType === 'mysql') {
      await db.execute(
        'INSERT INTO whitelisted_users (id, username, added_by) VALUES (?, ?, ?)',
        [userId, username, addedBy]
      );
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO whitelisted_users (id, username, added_by) VALUES (?, ?, ?)',
          [userId, username, addedBy],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(true);
            }
          }
        );
      });
    }
    
    return true;
  } catch (error) {
    console.error(`Kullanıcı beyaz listeye eklenirken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Rolü beyaz listeye ekler
 * @param {import('discord.js').Client} client
 * @param {string} roleId Rol ID'si
 * @param {string} roleName Rol adı
 * @param {string} addedBy Ekleyen kişi ID'si
 * @returns {Promise<boolean>} Başarılı ise true döner
 */
async function addRoleToWhitelist(client, roleId, roleName, addedBy) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  // Önce kontrol et
  const exists = await checkRoleInWhitelist(client, roleId);
  if (exists) return false;
  
  try {
    // Veritabanı tipine göre ekleme işlemi
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      await new schemas.WhitelistedRole({
        id: roleId,
        name: roleName,
        addedBy: addedBy
      }).save();
    } else if (dbType === 'mysql') {
      await db.execute(
        'INSERT INTO whitelisted_roles (id, name, added_by) VALUES (?, ?, ?)',
        [roleId, roleName, addedBy]
      );
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO whitelisted_roles (id, name, added_by) VALUES (?, ?, ?)',
          [roleId, roleName, addedBy],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(true);
            }
          }
        );
      });
    }
    
    return true;
  } catch (error) {
    console.error(`Rol beyaz listeye eklenirken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Kullanıcıyı beyaz listeden çıkarır
 * @param {import('discord.js').Client} client
 * @param {string} userId Kullanıcı ID'si
 * @returns {Promise<boolean>} Başarılı ise true döner
 */
async function removeUserFromWhitelist(client, userId) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  // Önce kontrol et
  const exists = await checkUserInWhitelist(client, userId);
  if (!exists) return false;
  
  try {
    // Veritabanı tipine göre silme işlemi
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      const result = await schemas.WhitelistedUser.deleteOne({ id: userId });
      return result.deletedCount > 0;
    } else if (dbType === 'mysql') {
      const [result] = await db.execute('DELETE FROM whitelisted_users WHERE id = ?', [userId]);
      return result.affectedRows > 0;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.run('DELETE FROM whitelisted_users WHERE id = ?', [userId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        });
      });
    }
    
    return false;
  } catch (error) {
    console.error(`Kullanıcı beyaz listeden çıkarılırken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Rolü beyaz listeden çıkarır
 * @param {import('discord.js').Client} client
 * @param {string} roleId Rol ID'si
 * @returns {Promise<boolean>} Başarılı ise true döner
 */
async function removeRoleFromWhitelist(client, roleId) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  // Önce kontrol et
  const exists = await checkRoleInWhitelist(client, roleId);
  if (!exists) return false;
  
  try {
    // Veritabanı tipine göre silme işlemi
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      const result = await schemas.WhitelistedRole.deleteOne({ id: roleId });
      return result.deletedCount > 0;
    } else if (dbType === 'mysql') {
      const [result] = await db.execute('DELETE FROM whitelisted_roles WHERE id = ?', [roleId]);
      return result.affectedRows > 0;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.run('DELETE FROM whitelisted_roles WHERE id = ?', [roleId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        });
      });
    }
    
    return false;
  } catch (error) {
    console.error(`Rol beyaz listeden çıkarılırken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Kullanıcının beyaz listede olup olmadığını kontrol eder
 * @param {import('discord.js').Client} client
 * @param {string} userId Kullanıcı ID'si
 * @returns {Promise<boolean>} Beyaz listede ise true döner
 */
async function checkUserInWhitelist(client, userId) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  try {
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      const user = await schemas.WhitelistedUser.findOne({ id: userId });
      return !!user;
    } else if (dbType === 'mysql') {
      const [rows] = await db.execute('SELECT id FROM whitelisted_users WHERE id = ?', [userId]);
      return rows.length > 0;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.get('SELECT id FROM whitelisted_users WHERE id = ?', [userId], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        });
      });
    }
    
    return false;
  } catch (error) {
    console.error(`Kullanıcı beyaz liste kontrolü hatası: ${error.message}`);
    throw error;
  }
}

/**
 * Rolün beyaz listede olup olmadığını kontrol eder
 * @param {import('discord.js').Client} client
 * @param {string} roleId Rol ID'si
 * @returns {Promise<boolean>} Beyaz listede ise true döner
 */
async function checkRoleInWhitelist(client, roleId) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  try {
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      const role = await schemas.WhitelistedRole.findOne({ id: roleId });
      return !!role;
    } else if (dbType === 'mysql') {
      const [rows] = await db.execute('SELECT id FROM whitelisted_roles WHERE id = ?', [roleId]);
      return rows.length > 0;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.get('SELECT id FROM whitelisted_roles WHERE id = ?', [roleId], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        });
      });
    }
    
    return false;
  } catch (error) {
    console.error(`Rol beyaz liste kontrolü hatası: ${error.message}`);
    throw error;
  }
}

/**
 * Beyaz listedeki tüm kullanıcıları döndürür
 * @param {import('discord.js').Client} client
 * @returns {Promise<Array>} Kullanıcı listesi
 */
async function getUsersFromWhitelist(client) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  try {
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      return await schemas.WhitelistedUser.find({});
    } else if (dbType === 'mysql') {
      const [rows] = await db.execute('SELECT id, username FROM whitelisted_users');
      return rows;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.all('SELECT id, username FROM whitelisted_users', (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
    
    return [];
  } catch (error) {
    console.error(`Beyaz liste kullanıcıları alınırken hata: ${error.message}`);
    throw error;
  }
}

/**
 * Beyaz listedeki tüm rolleri döndürür
 * @param {import('discord.js').Client} client
 * @returns {Promise<Array>} Rol listesi
 */
async function getRolesFromWhitelist(client) {
  const dbType = client.config.database.type.toLowerCase();
  const db = client.db;
  
  try {
    if (dbType === 'mongodb') {
      const { schemas } = require('../../../database/index');
      return await schemas.WhitelistedRole.find({});
    } else if (dbType === 'mysql') {
      const [rows] = await db.execute('SELECT id, name FROM whitelisted_roles');
      return rows;
    } else if (dbType === 'sqlite') {
      return new Promise((resolve, reject) => {
        db.all('SELECT id, name FROM whitelisted_roles', (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    }
    
    return [];
  } catch (error) {
    console.error(`Beyaz liste rolleri alınırken hata: ${error.message}`);
    throw error;
  }
}
