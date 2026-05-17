# Ham Umre Kayıt Sistemi

Ham Umre turları için hazırlanmış basit bir masaüstü kayıt ve odalama uygulamasıdır.

Uygulama ile otel ve oda bilgileri girilebilir, tur oluşturulabilir, müşteriler turlara eklenebilir ve oda yerleşimi yapılabilir. Oda yerleşimi PDF olarak, müşteri listesi ise Excel olarak dışa aktarılabilir.

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

Bu komut React arayüzünü başlatır ve Electron penceresini açar.

## Kullanılan Teknolojiler

- Electron
- React
- TypeScript
- SQLite

## Temel Özellikler

- Otel ve oda yönetimi
- Tur oluşturma
- Müşteri kaydı
- Yetişkin ve çocuk seçimi
- Kapasiteye göre odalama
- PDF oda yerleşim çıktısı
- Excel müşteri listesi çıktısı

## Paketleme

Windows kurulum dosyası oluşturmak için:

```bash
npm run dist:win
```

## Not

Bu proje açık kaynak olarak geliştirilmiştir. GitHub bağlantısı daha sonra eklenecektir.
