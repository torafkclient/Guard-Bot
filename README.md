# 🛡️ Guard Discord Koruma Botu

Discord sunucunuzu koruyan gelişmiş bir güvenlik botu. Sunucunuza gelebilecek farklı saldırı ve istismar türlerine karşı koruma sağlar.

## ✨ Özellikler

- **9 Farklı Koruma Sistemi**: Sunucunuzun güvenliğini sağlayan kapsamlı koruma modülleri
- **Beyaz Liste**: Güvenilir kullanıcıları ve rolleri koruma sistemlerinden muaf tutma
- **Veritabanı Desteği**: SQLite, MongoDB veya MySQL desteği
- **Log Sistemi**: Tüm güvenlik olaylarını takip etme
- **Slash Komut Desteği**: Kullanımı kolay Discord slash komutları

## 🔒 Koruma Sistemleri

lbGuard, aşağıdaki koruma sistemlerini içerir:

- **AntiRaid**: Kısa sürede çok sayıda kullanıcı girişini tespit eder ve önlem alır
- **AntiSpam**: Hızlı ve tekrarlayan mesaj gönderimlerini tespit eder
- **ChannelGuard**: Kanal oluşturma, silme ve düzenleme işlemlerini korur
- **RoleGuard**: Rol oluşturma, silme ve düzenleme işlemlerini korur
- **WebhookGuard**: Webhook oluşturma, silme ve düzenleme işlemlerini korur
- **BanKickGuard**: Toplu ban/kick işlemlerini tespit eder ve önler
- **BotGuard**: İzinsiz bot eklemelerine karşı korur
- **MessageGuard**: Toplu mesaj silme işlemlerini izler
- **ServerGuard**: Sunucu ayarlarının yetkisiz değiştirilmesini önler

## 🤖 Komutlar

| Komut | Açıklama |
|-------|----------|
| `/yardım` | Komutları ve koruma sistemlerini listeler |
| `/whitelist` | Beyaz listeyi yönetir (koruma sistemlerinden etkilenmeyecek kişiler) |
| `/koruma` | Koruma sistemlerini yönetir (aç/kapat) |
| `/bot` | Bot hakkında bilgi verir |
| `/davet` | Davet bağlantısı oluşturur |

## 📋 Gereksinimler

- Node.js 16.9.0 veya daha yeni
- Discord Bot Tokeni

## 🚀 Kurulum

1. Bağımlılıkları yükleyin:
   ```
   npm install
   ```

2. `.env` dosyasını yapılandırın:
   ```
   # Discord Bot Tokeni
   TOKEN=token_buraya_gelecek

   # Veritabanı Ayarları (mongodb, mysql veya sqlite)
   DB_TYPE=sqlite

   # Bot Ayarları
   CLIENT_ID=bot_client_id_buraya
   OWNER_ID=sahip_id_buraya
   LOG_CHANNEL_ID=log_kanal_id_buraya
   ```

3. Botu başlatın:
   ```
   npm start
   ```

## ⚙️ Yapılandırma

Tüm koruma sistemleri için yapılandırma `src/utils/config.js` dosyasında bulunmaktadır. Her koruma sistemi için ayrı ayrı eşik değerleri ve alınacak önlemleri ayarlayabilirsiniz.

**⚠️ UYARI:** Bu botun satışını yapmak kesinlikle yasaktır. Sadece kişisel ve topluluk kullanımı için ücretsiz olarak dağıtılmaktadır.
