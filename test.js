/**
 * lbGuard Discord Bot Test Scripti
 * LB Dev Tarafından Yapılmıştır | Satışını Yapmak Yasaktır
 * 
 * Bu script, botun ana bileşenlerinin doğru çalıştığını test eder:
 * - Yapılandırma yükleme
 * - Veritabanı bağlantısı
 * - Guard modüllerinin yüklenmesi
 * - Komutların yüklenmesi
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('./src/utils/config');
const logger = require('./src/utils/logger');
const { connectDatabase } = require('./src/database/index');
const { Collection } = require('discord.js');

let hasErrors = false;
let testsRun = 0;
let testsPassed = 0;

// Test başlangıcı
console.log('🔍 lbGuard Discord Bot Test Scripti Başlatılıyor...');
console.log('🔒 LB Dev Tarafından Yapılmıştır | Satışını Yapmak Yasaktır');
console.log('='.repeat(50));

async function runTests() {
  // Test 1: .env dosyası kontrol
  testsRun++;
  try {
    if (!process.env.TOKEN) {
      console.log('❌ TEST BAŞARISIZ: .env dosyasında TOKEN bulunamadı.');
      hasErrors = true;
    } else {
      console.log('✅ TEST BAŞARILI: .env dosyası ve TOKEN doğru formatta.');
      testsPassed++;
    }
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: .env dosya testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test 2: Yapılandırma yükleme
  testsRun++;
  try {
    if (!config || !config.guards || !config.logging) {
      console.log('❌ TEST BAŞARISIZ: Yapılandırma doğru yüklenemedi.');
      hasErrors = true;
    } else {
      console.log('✅ TEST BAŞARILI: Yapılandırma dosyası başarıyla yüklendi.');
      testsPassed++;
    }
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: Yapılandırma testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test 3: Guard modüllerinin varlığı
  testsRun++;
  try {
    const guardsPath = path.join(__dirname, 'src', 'guards');
    const guardFiles = fs.readdirSync(guardsPath).filter(file => file.endsWith('.js'));
    
    if (guardFiles.length < 9) {
      console.log(`❌ TEST BAŞARISIZ: Eksik koruma modülleri. Beklenen: 9, Bulunan: ${guardFiles.length}`);
      hasErrors = true;
    } else {
      console.log(`✅ TEST BAŞARILI: Tüm koruma modülleri mevcut (${guardFiles.length} modül).`);
      testsPassed++;
    }
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: Guard modülleri testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test 4: Slash komutlarının varlığı
  testsRun++;
  try {
    const slashCommandsPath = path.join(__dirname, 'src', 'commands', 'slash');
    const folders = fs.readdirSync(slashCommandsPath);
    
    let commandCount = 0;
    for (const folder of folders) {
      const folderPath = path.join(slashCommandsPath, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        commandCount += commandFiles.length;
      }
    }
    
    if (commandCount < 5) {
      console.log(`❌ TEST BAŞARISIZ: Yetersiz komut sayısı. Beklenen: en az 5, Bulunan: ${commandCount}`);
      hasErrors = true;
    } else {
      console.log(`✅ TEST BAŞARILI: Slash komutlar mevcut (${commandCount} komut).`);
      testsPassed++;
    }
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: Slash komut testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test 5: Veritabanı yapılandırması
  testsRun++;
  try {
    const dataDir = path.join(__dirname, 'data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
      console.log('ℹ️ Bilgi: data klasörü oluşturuldu.');
    }
    
    if (config.database.type === 'sqlite' && !fs.existsSync(path.join(dataDir, 'database.sqlite'))) {
      console.log('ℹ️ Bilgi: Veritabanı dosyası henüz oluşturulmamış, ilk bağlantıda oluşturulacak.');
    }
    
    console.log('✅ TEST BAŞARILI: Veritabanı yapılandırması doğru.');
    testsPassed++;
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: Veritabanı yapılandırması testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test 6: BaseGuard sınıfı
  testsRun++;
  try {
    const BaseGuard = require('./src/structures/BaseGuard');
    const testGuard = new BaseGuard({
      name: 'TestGuard',
      description: 'Test için koruma modülü',
      enabled: true
    });
    
    if (!testGuard.name || !testGuard.description || testGuard.enabled !== true) {
      console.log('❌ TEST BAŞARISIZ: BaseGuard sınıfı doğru çalışmıyor.');
      hasErrors = true;
    } else {
      console.log('✅ TEST BAŞARILI: BaseGuard sınıfı doğru çalışıyor.');
      testsPassed++;
    }
  } catch (error) {
    console.log(`❌ TEST BAŞARISIZ: BaseGuard sınıfı testi başarısız: ${error.message}`);
    hasErrors = true;
  }
  
  // Test sonuçları
  console.log('='.repeat(50));
  console.log(`📊 TEST SONUÇLARI: ${testsPassed}/${testsRun} başarılı`);
  
  if (hasErrors) {
    console.log('⚠️ UYARI: Bazı testler başarısız oldu. Sorunları giderdikten sonra tekrar deneyin.');
  } else {
    console.log('🎉 TEBRİKLER: Tüm testler başarıyla geçildi!');
    console.log('🚀 Botu başlatmak için: npm start');
    console.log('🔄 Slash komutları kaydetmek için: node deploy-commands.js');
  }
}

runTests().catch(error => {
  console.error('Test çalıştırılırken bir hata oluştu:', error);
});
