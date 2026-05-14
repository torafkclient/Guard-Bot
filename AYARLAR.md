🛡️ MonicaProject Discord Botu - Kurulum ve Ayarlar

Bu belge, MonicaProject Discord Koruma Botunun kurulumu ve yapılandırılması hakkında detaylı bilgiler sunmaktadır.

📋 Gereksinimler
Node.js 16.9.0 veya daha yeni sürüm
Discord Bot Tokeni (https://discord.com/developers/applications
 adresinden alabilirsiniz)
Bot için gerekli izinler (Administrator yetkisi önerilir)
🚀 İlk Kurulum Adımları
Gerekli bağımlılıkları yükleyin:
npm install
.env dosyasını yapılandırın:
# Discord Bot Tokeni
TOKEN=bot_token_buraya

# Veritabanı Ayarları (mongodb, mysql, sqlite, json veya yaml)
DB_TYPE=sqlite

# MongoDB Ayarları (Eğer DB_TYPE=mongodb ise)
MONGODB_URI=mongodb://localhost:27017/monicaproject

# MySQL Ayarları (Eğer DB_TYPE=mysql ise)
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=şifreniz
MYSQL_DATABASE=monicaproject

# Bot Ayarları
PREFIX=/
CLIENT_ID=bot_client_id_buraya
GUILD_ID=sunucu_id_buraya

# Log Kanalı ID
LOG_CHANNEL_ID=log_kanal_id_buraya

# Diğer Ayarlar
OWNER_ID=sahip_id_buraya
Slash komutları kaydedin:
node deploy-commands.js

veya komutlariyenile.bat dosyasını çalıştırın.

Botu başlatın:
node index.js

veya botubaslat.bat dosyasını çalıştırın.

💾 Veritabanı Seçenekleri

MonicaProject beş farklı veritabanı seçeneği sunar:

1. SQLite (Varsayılan)
Kurulum gerektirmez
Dosya tabanlı, taşınabilir
Küçük ve orta ölçekli sunucular için idealdir
.env dosyasında: DB_TYPE=sqlite
2. MongoDB
Büyük sunucular için ölçeklenebilir NoSQL veritabanı
MongoDB'nin kurulu olması gerekir
Yüksek performans ve esneklik sağlar
.env dosyasında: DB_TYPE=mongodb
3. MySQL
İlişkisel veritabanı desteği
MySQL'in kurulu olması gerekir
Kompleks sorgular için idealdir
.env dosyasında: DB_TYPE=mysql
4. JSON
Basit, dosya tabanlı veritabanı
İnsan tarafından okunabilir format
Kurulum gerektirmez
.env dosyasında: DB_TYPE=json
5. YAML
Okunabilir formatta dosya tabanlı veritabanı
Karmaşık yapılar için daha temiz sözdizimi
Kurulum gerektirmez
.env dosyasında: DB_TYPE=yaml
⚙️ Koruma Sistemleri Yapılandırması

Tüm koruma sistemleri için yapılandırma src/utils/config.js dosyasında bulunmaktadır. Bu dosyada her koruma sistemi için ayrı ayrı şu parametreleri ayarlayabilirsiniz:

enabled: Koruma sistemini açık/kapalı duruma getirir (true/false)
action: Kural ihlali durumunda yapılacak işlem (kick, ban, mute, warn)
Koruma sistemi özelindeki eşik değerleri ve süreler

Örnek:

antiRaid: {
  enabled: true,
  joinThreshold: 5,
  joinTime: 8000,
  action: 'kick',
  timeoutDuration: 60000 * 10
}
🔒 Beyaz Liste (Whitelist) Yönetimi

Beyaz liste, koruma sistemlerinden etkilenmeyecek güvenilir kullanıcılar ve roller için kullanılır.

Discord üzerinden:
/whitelist ekle user @kullanıcı
/whitelist ekle role @rol
/whitelist çıkar user @kullanıcı
/whitelist çıkar role @rol
/whitelist liste
config.js üzerinden:
whitelist: {
  users: ['kullanıcı_id_1', 'kullanıcı_id_2'],
  roles: ['rol_id_1', 'rol_id_2']
}
📝 Log Sistemi

Log sistemi, tüm güvenlik olaylarını belirttiğiniz kanalda raporlar.

.env:

LOG_CHANNEL_ID=log_kanal_id_buraya

Dosyalar:

logs/combined.log
logs/error.log
logs/exceptions.log
🤖 Komutları Yenileme
node deploy-commands.js

veya komutlariyenile.bat

🆘 Sorun Giderme
Bot çalışmıyor:
Token doğru mu kontrol et
Yetkileri kontrol et
logs/error.log bak
Slash komutlar yok:
deploy-commands çalıştır
CLIENT_ID & GUILD_ID kontrol et
Veritabanı hatası:
DB çalışıyor mu kontrol et
.env bilgileri doğru mu
📄 Lisans ve Telif Hakkı

Bu proje MIT lisansı altında lisanslanmıştır. MonicaProject tarafından geliştirilmiştir.

⚠️ UYARI: Bu botun satışını yapmak kesinlikle yasaktır. Sadece kişisel ve topluluk kullanımı için ücretsiz olarak dağıtılmaktadır.

© 2025 MonicaProject. Tüm hakları saklıdır.