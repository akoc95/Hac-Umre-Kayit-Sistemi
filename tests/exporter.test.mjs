import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCustomersWorkbook, createRoomingWorkbook } = require('../electron/exporter');

describe('excel exporter', () => {
  it('creates customer workbook with expected columns', async () => {
    const workbook = await createCustomersWorkbook([
      {
        fullName: 'Ali Yilmaz',
        documentNo: '123',
        phone: '555',
        gender: 'male',
        passengerType: 'adult',
        birthDate: '',
        connection: 'Ankara',
        tourName: 'A',
        tourHotelName: 'Mekke Otel',
        notes: '',
        hotelName: 'Mekke Otel',
        roomNo: '101',
      },
    ]);
    const sheet = workbook.getWorksheet('Müşteriler');

    expect(sheet.getRow(1).values).toContain('Ad Soyad');
    expect(sheet.getRow(2).getCell(7).value).toBe('Ankara');
    expect(sheet.getRow(2).getCell(10).value).toBe('Mekke Otel / 101');
  });

  it('creates rooming workbook with occupants', async () => {
    const workbook = await createRoomingWorkbook(
      [{ id: 1, hotelName: 'Medine Otel', roomNo: '201', capacity: 2, notes: '' }],
      [{ roomId: 1, customerName: 'Ayse Kaya', customerGender: 'female' }]
    );
    const sheet = workbook.getWorksheet('Oda Yerleşimi');

    expect(sheet.getRow(1).values).toContain('Müşteriler');
    expect(sheet.getRow(2).getCell(4).value).toBe('Ayse Kaya');
  });
});
