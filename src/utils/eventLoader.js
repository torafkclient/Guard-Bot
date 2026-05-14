const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Discord.js olaylarını yükler
 * @param {import('discord.js').Client} client Discord.js istemcisi
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFolders = fs.readdirSync(eventsPath);

  let loadedEventsCount = 0;

  for (const folder of eventFolders) {
    const folderPath = path.join(eventsPath, folder);
    
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const eventFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
      const filePath = path.join(folderPath, file);
      const event = require(filePath);
      
      if (!event.name || !event.execute) {
        logger.warn(`${file} olayında "name" veya "execute" özelliği eksik!`);
        continue;
      }
      
      logger.info(`${event.name} olayı yükleniyor...`);
      
      try {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
          client.on(event.name, (...args) => event.execute(client, ...args));
        }
        
        loadedEventsCount++;
        logger.success(`${event.name} olayı başarıyla yüklendi!`);
      } catch (error) {
        logger.error(`${event.name} olayı yüklenirken hata oluştu: ${error.message}`);
      }
    }
  }
  
  logger.success(`Toplam ${loadedEventsCount} olay başarıyla yüklendi!`);
  
  return loadedEventsCount;
}

function loadEventsFlat(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
  let loadedEventsCount = 0;
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (!event.name || !event.execute) {
      logger.warn(`${file} olayında "name" veya "execute" özelliği eksik!`);
      continue;
    }
    
    logger.info(`${event.name} olayı yükleniyor...`);
    
    try {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(client, ...args));
      } else {
        client.on(event.name, (...args) => event.execute(client, ...args));
      }
      
      loadedEventsCount++;
      logger.success(`${event.name} olayı başarıyla yüklendi!`);
    } catch (error) {
      logger.error(`${event.name} olayı yüklenirken hata oluştu: ${error.message}`);
    }
  }
  
  logger.success(`Toplam ${loadedEventsCount} olay başarıyla yüklendi!`);
  
  return loadedEventsCount;
}

module.exports = { loadEvents, loadEventsFlat };
