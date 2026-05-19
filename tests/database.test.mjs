import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDatabaseStore } = require('../electron/database');

let tempDir;
let store;

async function makeStore() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hac-umre-db-'));
  const dbPath = path.join(tempDir, 'test.sqlite');
  const wasmFilePath = path.resolve('node_modules/sql.js/dist/sql-wasm.wasm');
  store = await createDatabaseStore({ dbPath, wasmFilePath }).init();
  return store;
}

beforeEach(async () => {
  await makeStore();
});

afterEach(() => {
  if (store) {
    store.close();
  }
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('database store', () => {
  it('creates, updates and deletes customers', () => {
    const id = store.createCustomer({
      fullName: 'Ali Yilmaz',
      documentNo: '123',
      phone: '555',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '1980-01-01',
      connection: 'İstanbul',
      tourId: 0,
      notes: 'Not',
    });

    expect(store.listCustomers()).toHaveLength(1);

    store.updateCustomer(id, {
      fullName: 'Ali Veli Yilmaz',
      documentNo: '123',
      phone: '555',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '1980-01-01',
      connection: 'Ankara',
      tourId: 0,
      notes: '',
    });

    expect(store.listCustomers()[0].fullName).toBe('Ali Veli Yilmaz');
    expect(store.listCustomers()[0].connection).toBe('Ankara');
    store.deleteCustomer(id);
    expect(store.listCustomers()).toHaveLength(0);
  });

  it('creates rooms with automatic internal room numbers', () => {
    const hotelId = store.createHotel({ name: 'Mekke Otel', address: '', notes: '' });
    store.createRoom({ hotelId, roomNo: '', capacity: 2, notes: '' });
    store.createRoom({ hotelId, roomNo: '', capacity: 3, notes: '' });

    expect(store.listRooms()).toHaveLength(2);
  });

  it('creates tours and assigns customers to tours', () => {
    const hotelId = store.createHotel({ name: 'Tur Oteli', address: '', notes: '' });
    const tourId = store.createTour({
      name: 'Mayis Umre',
      startDate: '2026-05-20',
      endDate: '2026-05-30',
      hotelId,
      notes: 'Ana grup',
    });
    const customerId = store.createCustomer({
      fullName: 'Zeynep Kaya',
      documentNo: '',
      phone: '',
      gender: 'female',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });

    expect(store.listTours()[0].customerCount).toBe(1);
    expect(store.listCustomers().find((customer) => customer.id === customerId).tourName).toBe('Mayis Umre');
  });

  it('adds incrementing suffixes for duplicate tour names', () => {
    const hotelId = store.createHotel({ name: 'Sira Oteli', address: '', notes: '' });

    store.createTour({ name: '26 Haziran Turu', startDate: '', endDate: '', hotelId, notes: '' });
    store.createTour({ name: '26 Haziran Turu', startDate: '', endDate: '', hotelId, notes: '' });
    store.createTour({ name: '26 Haziran Turu', startDate: '', endDate: '', hotelId, notes: '' });

    expect(store.listTours().map((tour) => tour.name)).toEqual([
      '26 Haziran Turu',
      '26 Haziran Turu #2',
      '26 Haziran Turu #3',
    ]);
  });

  it('enforces room capacity', () => {
    const hotelId = store.createHotel({ name: 'Medine Otel', address: '', notes: '' });
    const roomId = store.createRoom({ hotelId, roomNo: '201', capacity: 1, notes: '' });
    const tourId = store.createTour({
      name: 'Kapasite Turu',
      startDate: '',
      endDate: '',
      hotelId,
      notes: '',
    });
    const manId = store.createCustomer({
      fullName: 'Mehmet Kaya',
      documentNo: '',
      phone: '',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });
    const womanId = store.createCustomer({
      fullName: 'Ayse Kaya',
      documentNo: '',
      phone: '',
      gender: 'female',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });

    store.assignCustomer(manId, roomId);
    expect(() => store.moveCustomer(womanId, roomId)).toThrow('Oda kapasitesi dolu.');
  });

  it('allows mixed gender placement when capacity allows another person', () => {
    const hotelId = store.createHotel({ name: 'Karma Test Otel', address: '', notes: '' });
    const roomId = store.createRoom({ hotelId, roomNo: '301', capacity: 2, notes: '' });
    const tourId = store.createTour({
      name: 'Karma Turu',
      startDate: '',
      endDate: '',
      hotelId,
      notes: '',
    });
    const manId = store.createCustomer({
      fullName: 'Hasan Demir',
      documentNo: '',
      phone: '',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });
    const womanId = store.createCustomer({
      fullName: 'Fatma Demir',
      documentNo: '',
      phone: '',
      gender: 'female',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });

    store.assignCustomer(manId, roomId);
    expect(() => store.moveCustomer(womanId, roomId)).not.toThrow();
    expect(store.listAssignments()).toHaveLength(2);
  });

  it('blocks deleting occupied rooms and hotels with rooms', () => {
    const hotelId = store.createHotel({ name: 'Silme Test Otel', address: '', notes: '' });
    const roomId = store.createRoom({ hotelId, roomNo: '401', capacity: 2, notes: '' });
    const tourId = store.createTour({
      name: 'Silme Turu',
      startDate: '',
      endDate: '',
      hotelId,
      notes: '',
    });
    const customerId = store.createCustomer({
      fullName: 'Osman Sahin',
      documentNo: '',
      phone: '',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '',
      tourId,
      notes: '',
    });

    store.assignCustomer(customerId, roomId);

    expect(() => store.deleteRoom(roomId)).toThrow('Dolu oda silinemez.');
    expect(() => store.deleteHotel(hotelId)).toThrow('Odası olan otel silinemez.');
  });

  it('tracks room capacity separately for each tour', () => {
    const hotelId = store.createHotel({ name: 'Tur Ayirma Otel', address: '', notes: '' });
    const roomId = store.createRoom({ hotelId, roomNo: '', capacity: 1, notes: '' });
    const firstTourId = store.createTour({ name: 'Birinci Tur', startDate: '', endDate: '', hotelId, notes: '' });
    const secondTourId = store.createTour({ name: 'Ikinci Tur', startDate: '', endDate: '', hotelId, notes: '' });
    const firstCustomerId = store.createCustomer({
      fullName: 'Birinci Musteri',
      documentNo: '',
      phone: '',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '',
      tourId: firstTourId,
      notes: '',
    });
    const secondCustomerId = store.createCustomer({
      fullName: 'Ikinci Musteri',
      documentNo: '',
      phone: '',
      gender: 'male',
      passengerType: 'adult',
      birthDate: '',
      tourId: secondTourId,
      notes: '',
    });

    store.assignCustomer(firstCustomerId, roomId);
    expect(() => store.moveCustomer(secondCustomerId, roomId)).not.toThrow();
    expect(store.listAssignments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ customerId: firstCustomerId, roomId, tourId: firstTourId }),
        expect.objectContaining({ customerId: secondCustomerId, roomId, tourId: secondTourId }),
      ])
    );
  });
});
