const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../utils/config');
const logger = require('../utils/logger');

let db = null;

/**
 * Veritabanına bağlanır
 * @returns {Promise<any>} Veritabanı bağlantısı
 */
async function connectDatabase() {
  const dbType = config.database.type.toLowerCase();
  
  logger.database(`Veritabanı tipi: ${dbType}`);
  
  switch (dbType) {
    case 'mongodb':
      return connectMongoDB();
    case 'mysql':
      return connectMySQL();
    case 'sqlite':
      return connectSQLite();
    case 'json':
      return connectJSON();
    case 'yaml':
      return connectYAML();
    default:
      logger.error(`Bilinmeyen veritabanı tipi: ${dbType}`);
      throw new Error(`Bilinmeyen veritabanı tipi: ${dbType}`);
  }
}

/**
 * MongoDB'ye bağlanır
 * @returns {Promise<mongoose.Connection>} MongoDB bağlantısı
 */
async function connectMongoDB() {
  try {
    logger.database('MongoDB bağlantısı kuruluyor...');
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    await mongoose.connect(config.database.mongodb.uri, options);
    
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB bağlantı hatası: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB bağlantısı kapatıldı');
    });
    
    logger.database('MongoDB bağlantısı başarılı!');
    db = mongoose.connection;
    return db;
  } catch (error) {
    logger.error(`MongoDB bağlantı hatası: ${error.message}`);
    throw error;
  }
}

/**
 * MySQL'e bağlanır
 * @returns {Promise<mysql.Connection>} MySQL bağlantısı
 */
async function connectMySQL() {
  try {
    logger.database('MySQL bağlantısı kuruluyor...');
    
    const connection = await mysql.createConnection({
      host: config.database.mysql.host,
      user: config.database.mysql.user,
      password: config.database.mysql.password,
      database: config.database.mysql.database
    });
    
    await createMySQLTables(connection);
    
    logger.database('MySQL bağlantısı başarılı!');
    db = connection;
    return db;
  } catch (error) {
    logger.error(`MySQL bağlantı hatası: ${error.message}`);
    throw error;
  }
}

/**
 * SQLite'a bağlanır
 * @returns {Promise<sqlite3.Database>} SQLite bağlantısı
 */
function connectSQLite() {
  return new Promise((resolve, reject) => {
    logger.database('SQLite bağlantısı kuruluyor...');
    
    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
    const dbPath = path.join(dataDir, 'database.sqlite');
    const sqliteDB = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error(`SQLite bağlantı hatası: ${err.message}`);
        reject(err);
        return;
      }
      
      createSQLiteTables(sqliteDB)
        .then(() => {
          logger.database('SQLite bağlantısı başarılı!');
          db = sqliteDB;
          resolve(db);
        })
        .catch(err => {
          logger.error(`SQLite tablo oluşturma hatası: ${err.message}`);
          reject(err);
        });
    });
  });
}

/**
 * JSON dosyasını veritabanı olarak kullanır
 * @returns {Promise<object>} JSON veritabanı
 */
function connectJSON() {
  return new Promise((resolve, reject) => {
    try {
      logger.database('JSON veritabanı hazırlanıyor...');
      
      const dataDir = path.join(__dirname, '..', '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }
      
      const jsonDbPath = path.join(dataDir, 'database.json');
      
      // Eğer dosya yoksa oluştur
      if (!fs.existsSync(jsonDbPath)) {
        const initialData = {
          whitelisted_users: [],
          whitelisted_roles: [],
          incident_logs: [],
          guard_actions: []
        };
        
        fs.writeFileSync(jsonDbPath, JSON.stringify(initialData, null, 2));
      }
      
      // JSON veritabanı nesnesi
      const jsonDB = {
        filePath: jsonDbPath,
        
        // Tüm veritabanını okur
        readAll: function() {
          try {
            const content = fs.readFileSync(this.filePath, 'utf8');
            return JSON.parse(content);
          } catch (error) {
            logger.error(`JSON veritabanı okuma hatası: ${error.message}`);
            return null;
          }
        },
        
        // Belirli bir koleksiyonu okur
        readCollection: function(collection) {
          const data = this.readAll();
          return data && data[collection] ? data[collection] : [];
        },
        
        // Veri ekler
        insertOne: function(collection, document) {
          const data = this.readAll();
          if (!data[collection]) {
            data[collection] = [];
          }
          
          // ID oluştur
          if (!document.id) {
            document.id = Date.now().toString();
          }
          
          // Tarih ekle
          if (!document.timestamp) {
            document.timestamp = new Date().toISOString();
          }
          
          data[collection].push(document);
          fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
          return document;
        },
        
        // Veriyi günceller
        updateOne: function(collection, query, update) {
          const data = this.readAll();
          if (!data[collection]) return null;
          
          const index = data[collection].findIndex(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          });
          
          if (index === -1) return null;
          
          const updatedItem = { ...data[collection][index], ...update };
          data[collection][index] = updatedItem;
          
          fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
          return updatedItem;
        },
        
        // Veriyi siler
        deleteOne: function(collection, query) {
          const data = this.readAll();
          if (!data[collection]) return false;
          
          const initialLength = data[collection].length;
          
          data[collection] = data[collection].filter(item => {
            for (const key in query) {
              if (item[key] === query[key]) return false;
            }
            return true;
          });
          
          if (initialLength === data[collection].length) return false;
          
          fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
          return true;
        },
        
        // Veri arar
        findOne: function(collection, query) {
          const data = this.readAll();
          if (!data[collection]) return null;
          
          return data[collection].find(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          }) || null;
        },
        
        // Çoklu veri arar
        find: function(collection, query = {}) {
          const data = this.readAll();
          if (!data[collection]) return [];
          
          if (Object.keys(query).length === 0) {
            return data[collection];
          }
          
          return data[collection].filter(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          });
        }
      };
      
      logger.database('JSON veritabanı başarıyla hazırlandı!');
      db = jsonDB;
      resolve(db);
    } catch (error) {
      logger.error(`JSON veritabanı hatası: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * YAML dosyasını veritabanı olarak kullanır
 * @returns {Promise<object>} YAML veritabanı
 */
function connectYAML() {
  return new Promise((resolve, reject) => {
    try {
      logger.database('YAML veritabanı hazırlanıyor...');
      
      const dataDir = path.join(__dirname, '..', '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }
      
      const yamlDbPath = path.join(dataDir, 'database.yaml');
      
      // Eğer dosya yoksa oluştur
      if (!fs.existsSync(yamlDbPath)) {
        const initialData = {
          whitelisted_users: [],
          whitelisted_roles: [],
          incident_logs: [],
          guard_actions: []
        };
        
        fs.writeFileSync(yamlDbPath, yaml.dump(initialData));
      }
      
      // YAML veritabanı nesnesi
      const yamlDB = {
        filePath: yamlDbPath,
        
        // Tüm veritabanını okur
        readAll: function() {
          try {
            const content = fs.readFileSync(this.filePath, 'utf8');
            return yaml.load(content);
          } catch (error) {
            logger.error(`YAML veritabanı okuma hatası: ${error.message}`);
            return null;
          }
        },
        
        // Belirli bir koleksiyonu okur
        readCollection: function(collection) {
          const data = this.readAll();
          return data && data[collection] ? data[collection] : [];
        },
        
        // Veri ekler
        insertOne: function(collection, document) {
          const data = this.readAll();
          if (!data[collection]) {
            data[collection] = [];
          }
          
          // ID oluştur
          if (!document.id) {
            document.id = Date.now().toString();
          }
          
          // Tarih ekle
          if (!document.timestamp) {
            document.timestamp = new Date().toISOString();
          }
          
          data[collection].push(document);
          fs.writeFileSync(this.filePath, yaml.dump(data));
          return document;
        },
        
        // Veriyi günceller
        updateOne: function(collection, query, update) {
          const data = this.readAll();
          if (!data[collection]) return null;
          
          const index = data[collection].findIndex(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          });
          
          if (index === -1) return null;
          
          const updatedItem = { ...data[collection][index], ...update };
          data[collection][index] = updatedItem;
          
          fs.writeFileSync(this.filePath, yaml.dump(data));
          return updatedItem;
        },
        
        // Veriyi siler
        deleteOne: function(collection, query) {
          const data = this.readAll();
          if (!data[collection]) return false;
          
          const initialLength = data[collection].length;
          
          data[collection] = data[collection].filter(item => {
            for (const key in query) {
              if (item[key] === query[key]) return false;
            }
            return true;
          });
          
          if (initialLength === data[collection].length) return false;
          
          fs.writeFileSync(this.filePath, yaml.dump(data));
          return true;
        },
        
        // Veri arar
        findOne: function(collection, query) {
          const data = this.readAll();
          if (!data[collection]) return null;
          
          return data[collection].find(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          }) || null;
        },
        
        // Çoklu veri arar
        find: function(collection, query = {}) {
          const data = this.readAll();
          if (!data[collection]) return [];
          
          if (Object.keys(query).length === 0) {
            return data[collection];
          }
          
          return data[collection].filter(item => {
            for (const key in query) {
              if (item[key] !== query[key]) return false;
            }
            return true;
          });
        }
      };
      
      logger.database('YAML veritabanı başarıyla hazırlandı!');
      db = yamlDB;
      resolve(db);
    } catch (error) {
      logger.error(`YAML veritabanı hatası: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * MySQL tablolarını oluşturur
 * @param {mysql.Connection} connection MySQL bağlantısı
 */
async function createMySQLTables(connection) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS whitelisted_users (
      id VARCHAR(22) PRIMARY KEY,
      username VARCHAR(100),
      added_by VARCHAR(22),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS whitelisted_roles (
      id VARCHAR(22) PRIMARY KEY,
      name VARCHAR(100),
      added_by VARCHAR(22),
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS incident_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(22) NOT NULL,
      user_id VARCHAR(22) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS guard_actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(22) NOT NULL,
      user_id VARCHAR(22) NOT NULL,
      guard_type VARCHAR(50) NOT NULL,
      action_taken VARCHAR(50) NOT NULL,
      reason TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  
  for (const query of tables) {
    await connection.execute(query);
  }
  
  logger.database('MySQL tabloları başarıyla oluşturuldu');
}

/**
 * SQLite tablolarını oluşturur
 * @param {sqlite3.Database} db SQLite bağlantısı
 */
function createSQLiteTables(db) {
  return new Promise((resolve, reject) => {
    const tables = [
      `CREATE TABLE IF NOT EXISTS whitelisted_users (
        id TEXT PRIMARY KEY,
        username TEXT,
        added_by TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS whitelisted_roles (
        id TEXT PRIMARY KEY,
        name TEXT,
        added_by TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS incident_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS guard_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        guard_type TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    
    db.serialize(() => {
      try {
        tables.forEach(query => {
          db.run(query);
        });
        logger.database('SQLite tabloları başarıyla oluşturuldu');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Mevcut veritabanı bağlantısını döndürür
 * @returns {any} Veritabanı bağlantısı
 */
function getDatabase() {
  if (!db) {
    throw new Error('Veritabanı bağlantısı henüz kurulmadı');
  }
  return db;
}

const schemas = {
  WhitelistedUser: mongoose.model('WhitelistedUser', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
  })),
  
  WhitelistedRole: mongoose.model('WhitelistedRole', new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
  })),
  
  IncidentLog: mongoose.model('IncidentLog', new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    actionType: { type: String, required: true },
    details: { type: String },
    timestamp: { type: Date, default: Date.now }
  })),
  
  GuardAction: mongoose.model('GuardAction', new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    guardType: { type: String, required: true },
    actionTaken: { type: String, required: true },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now }
  }))
};

module.exports = {
  connectDatabase,
  getDatabase,
  schemas
};
