# 🛡️ lbGuard Discord Koruma Botu

**🔒 LB Dev Tarafından Yapılmıştır | Satışını Yapmak Yasaktır 🔒**

Discord sunucunuzu koruyan gelişmiş bir güvenlik botu. Sunucunuza gelebilecek farklı saldırı ve istismar türlerine karşı koruma sağlar.

## ✨ Özellikler

- **9 Farklı Koruma Sistemi**: Sunucunuzun güvenliğini sağlayan kapsamlı koruma modülleri
- **Beyaz Liste**: Güvenilir kullanıcıları ve rolleri koruma sistemlerinden muaf tutma
- **Veritabanı Desteği**: SQLite, MongoDB, MySQL, JSON veya YAML desteği
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

## 📦 Hazır Kurulum Dosyaları

- **botubaslat.bat**: Botu kolayca başlatmanızı sağlar
- **komutlariyenile.bat**: Slash komutları Discord'a yeniden kaydetmenizi sağlar

## 💾 Veritabanı Seçenekleri

lbGuard, beş farklı veritabanı seçeneği sunar:

1. **SQLite** (varsayılan): Kurulum gerektirmeyen, dosya tabanlı hafif veritabanı
2. **MongoDB**: Büyük sunucular için ölçeklenebilir NoSQL veritabanı
3. **MySQL**: İlişkisel veritabanı desteği
4. **JSON**: Basit, dosya tabanlı JSON veritabanı
5. **YAML**: Okunabilir formatta YAML dosya veritabanı

Veritabanı seçeneğini `.env` dosyasında `DB_TYPE` ayarından değiştirebilirsiniz.

## ⚙️ Yapılandırma

Tüm koruma sistemleri için yapılandırma `src/utils/config.js` dosyasında bulunmaktadır. Her koruma sistemi için ayrı ayrı eşik değerleri ve alınacak önlemleri ayarlayabilirsiniz.

## 📄 Lisans ve Telif Hakkı

Bu proje MIT lisansı altında lisanslanmıştır. LB Dev tarafından geliştirilmiştir.

**⚠️ UYARI:** Bu botun satışını yapmak kesinlikle yasaktır. Sadece kişisel ve topluluk kullanımı için ücretsiz olarak dağıtılmaktadır.

**© 2025 LB Dev.** Tüm hakları saklıdır.
