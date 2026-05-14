require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

// Gerekli bilgileri .env dosyasından al
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // İsteğe bağlı, sadece geliştirme sunucusuna özel komutlar için

// .env dosyasındaki TOKEN ve CLIENT_ID kontrol et
if (!token) {
  console.error('❌ ERROR: .env dosyasında TOKEN belirtilmemiş!');
  process.exit(1);
}

if (!clientId) {
  console.error('❌ ERROR: .env dosyasında CLIENT_ID belirtilmemiş!');
  process.exit(1);
}

// Komutları topla
async function registerCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'src', 'commands', 'slash');
  const commandFolders = fs.readdirSync(commandsPath);
  
  console.log('🔄 Slash komutlar taranıyor...');
  
  // Komut klasörlerini ve dosyalarını tara
  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      
      // Önbellekten temizle (kodda yapılan değişikliklerin yeni çalıştırmada algılanması için)
      delete require.cache[require.resolve(filePath)];
      
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ /${command.data.name} komutu bulundu ve eklendi`);
      } else {
        console.warn(`⚠️ ${file} komutunda "data" veya "execute" özelliği eksik!`);
      }
    }
  }
  
  // REST API istemcisi oluştur
  const rest = new REST({ version: '10' }).setToken(token);
  
  try {
    console.log(`🚀 Toplam ${commands.length} slash komut Discord API'ye kaydediliyor...`);
    
    // Komutları kaydet
    if (guildId) {
      // Geliştirme sunucusuna özel komutları kaydet (anında etkinleşir)
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`✅ Tüm komutlar başarıyla kaydedildi! (Sunucu: ${guildId})`);
    } else {
      // Global komutları kaydet (tüm sunucularda çalışır, ancak güncellenmesi 1 saate kadar sürebilir)
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Tüm komutlar global olarak başarıyla kaydedildi!');
      console.log('⚠️ Not: Global komutların tüm sunucularda etkinleşmesi 1 saate kadar sürebilir.');
    }
    
    // Komut listesini göster
    console.log('\n📋 Kaydedilen Komutlar:');
    commands.forEach(cmd => {
      console.log(`  • /${cmd.name} - ${cmd.description}`);
    });
    
    return commands.length;
  } catch (error) {
    console.error('❌ Komutlar kaydedilirken bir hata oluştu:', error);
    return 0;
  }
}

// Ana fonksiyon
(async () => {
  console.log('🔄 Slash komutları dağıtma ve yenileme işlemi başlatılıyor...');
  
  const commandCount = await registerCommands();
  
  if (commandCount > 0) {
    console.log(`\n🎉 İşlem tamamlandı! Toplam ${commandCount} slash komut başarıyla kaydedildi!`);
    console.log('\n📝 Kullanım:');
    console.log('  1. Discord sohbetinde "/" yazın');
    console.log('  2. Botun komutları otomatik olarak listelenecektir');
    console.log('  3. İstediğiniz komutu seçin ve çalıştırın');
  } else {
    console.error('❌ Hiçbir komut kaydedilemedi veya bir hata oluştu.');
  }
})();
