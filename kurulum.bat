@echo off
title lbGuard Discord Bot - Kurulum
color 0A

echo =====================================
echo lbGuard Discord Botu - Kurulum Sihirbazi
echo =====================================
echo.
echo Bu kurulum sihirbazi, lbGuard Discord botunu hazirlamak icin gerekli adimlari gerceklestirecek.
echo.
echo Lutfen internet baglantinizin aktif oldugunu kontrol edin.
echo.
echo Kuruluma baslamak icin bir tusa basin...
pause > nul

cls
echo =====================================
echo 1/3 - Gerekli paketlerin yuklenmesi
echo =====================================
echo.
echo Gerekli npm paketleri yukleniyor...
call npm install
echo.
echo Paketler basariyla yuklendi!
echo.
echo Devam etmek icin bir tusa basin...
pause > nul

cls
echo =====================================
echo 2/3 - Slash komutlarin kaydedilmesi
echo =====================================
echo.
echo Discord slash komutlari sunucunuza kaydetmek icin node deploy-commands.js komutu calistirilacak.
echo.
echo NOT: Bu islemin calismasi icin .env dosyasinda TOKEN, CLIENT_ID ve GUILD_ID degerlerinin 
echo dogru sekilde ayarlanmis olmasi gerekmektedir.
echo.
echo Devam etmek icin bir tusa basin...
pause > nul
echo.
call node deploy-commands.js
echo.
echo Devam etmek icin bir tusa basin...
pause > nul

cls
echo =====================================
echo 3/3 - Kurulum Tamamlandi
echo =====================================
echo.
echo lbGuard Discord Bot kurulumu basariyla tamamlandi!
echo.
echo Botu baslatmak icin asagidaki seceneklerden birini kullanabilirsiniz:
echo 1) botubaslat.bat dosyasini calistirin
echo 2) "node index.js" komutunu manuel olarak calistirin
echo.
echo Botu yapilandirmak icin AYARLAR.md dosyasini inceleyebilirsiniz.
echo.
echo Kurulum sihirbazindan cikmak icin bir tusa basin...
pause > nul
exit
