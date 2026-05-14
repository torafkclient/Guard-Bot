const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  bot: {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    prefix: process.env.PREFIX || '/',
    ownerId: process.env.OWNER_ID,
  },
  
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lbguard'
    },
    
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'lbguard'
    },
    
    sqlite: {
      filename: './data/database.sqlite'
    },
    
    json: {
      filename: './data/database.json'
    },
    
    yaml: {
      filename: './data/database.yaml'
    }
  },
  
  guards: {
    enabled: true,
    
    antiRaid: {
      enabled: true,
      joinThreshold: 5,
      joinTime: 8000,
      action: 'kick',
      timeoutDuration: 60000 * 10
    },
    
    antiSpam: {
      enabled: true,
      messageThreshold: 5,
      timeThreshold: 3000,
      action: 'mute',
      muteDuration: 60000 * 5
    },
    
    channelProtection: {
      enabled: true,
      maxChannelCreations: 3,
      timePeriod: 60000 * 5,
      action: 'ban'
    },
    
    roleProtection: {
      enabled: true,
      maxRoleCreations: 3,
      timePeriod: 60000 * 5,
      action: 'ban'
    },
    
    serverProtection: {
      enabled: true,
      action: 'ban'
    },
    
    banKickProtection: {
      enabled: true,
      maxActions: 3,
      timePeriod: 60000 * 1,
      action: 'ban'
    },
    
    webhookProtection: {
      enabled: true,
      action: 'ban'
    },
    
    botProtection: {
      enabled: true,
      action: 'ban'
    },
    
    messageProtection: {
      enabled: true,
      maxBulkDeletes: 2,
      timePeriod: 60000 * 10,
      action: 'warn'
    }
  },
  
  logging: {
    enabled: true,
    channelId: process.env.LOG_CHANNEL_ID,
    colorError: '#FF0000',
    colorWarning: '#FFA500',
    colorSuccess: '#00FF00',
    colorInfo: '#0000FF'
  },
  
  whitelist: {
    users: [],
    roles: [],
  }
};
