const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const nowIso = () => new Date().toISOString();

function toOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toRequiredString(value, label) {
  const text = toOptionalString(value);
  if (!text) {
    throw new Error(`${label} zorunludur.`);
  }
  return text;
}

function assertGender(gender) {
  if (gender !== 'male' && gender !== 'female') {
    throw new Error('Cinsiyet zorunludur.');
  }
  return gender;
}

function assertPassengerType(passengerType) {
  if (!passengerType) {
    return 'adult';
  }
  if (passengerType !== 'adult' && passengerType !== 'child') {
    throw new Error('Yaş grubu zorunludur.');
  }
  return passengerType;
}

function toOptionalTourId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function rowToCustomer(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    documentNo: row.document_no,
    phone: row.phone,
    gender: row.gender,
    passengerType: row.passenger_type || 'adult',
    birthDate: row.birth_date,
    groupName: row.group_name,
    tourId: row.tour_id || 0,
    tourName: row.tour_name,
    tourStartDate: row.tour_start_date,
    tourEndDate: row.tour_end_date,
    tourHotelId: row.tour_hotel_id,
    tourHotelName: row.tour_hotel_name,
    notes: row.notes,
    roomId: row.room_id,
    roomNo: row.room_no,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
  };
}

function rowToTour(row) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    hotelId: row.hotel_id || 0,
    hotelName: row.hotel_name,
    notes: row.notes,
    customerCount: row.customer_count ?? 0,
  };
}

function rowToHotel(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    notes: row.notes,
    roomCount: row.room_count ?? 0,
  };
}

function rowToRoom(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
    roomNo: row.room_no,
    capacity: row.capacity,
    notes: row.notes,
    occupantCount: row.occupant_count ?? 0,
    genders: row.genders || '',
  };
}

function rowToAssignment(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerGender: row.customer_gender,
    roomId: row.room_id,
    roomNo: row.room_no,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name,
  };
}

function runSelect(db, sql, params = []) {
  const statement = db.prepare(sql);
  const rows = [];
  try {
    statement.bind(params);
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
  } finally {
    statement.free();
  }
  return rows;
}

function getOne(db, sql, params = []) {
  const rows = runSelect(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function getScalar(db, sql, params = []) {
  const row = getOne(db, sql, params);
  if (!row) {
    return null;
  }
  return Object.values(row)[0];
}

function hasColumn(db, tableName, columnName) {
  return runSelect(db, `PRAGMA table_info(${tableName})`).some((column) => column.name === columnName);
}

function createDatabaseStore(options) {
  const dbPath = options.dbPath;
  const wasmFilePath = options.wasmFilePath;
  let SQL;
  let db;

  function persist() {
    if (!dbPath) {
      return;
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const data = Buffer.from(db.export());
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, data);
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
    }
    fs.renameSync(tempPath, dbPath);
  }

  function migrate() {
    db.run('PRAGMA foreign_keys = ON;');
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        document_no TEXT,
        phone TEXT,
        gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
        passenger_type TEXT NOT NULL DEFAULT 'adult' CHECK (passenger_type IN ('adult', 'child')),
        birth_date TEXT,
        group_name TEXT,
        tour_id INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS hotels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        start_date TEXT,
        end_date TEXT,
        hotel_id INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotel_id INTEGER NOT NULL,
        room_no TEXT NOT NULL,
        capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 4),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (hotel_id, room_no),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS room_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL UNIQUE,
        room_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
      );
    `);
    if (!hasColumn(db, 'customers', 'tour_id')) {
      db.run('ALTER TABLE customers ADD COLUMN tour_id INTEGER REFERENCES tours(id) ON DELETE SET NULL');
    }
    if (!hasColumn(db, 'customers', 'passenger_type')) {
      db.run("ALTER TABLE customers ADD COLUMN passenger_type TEXT NOT NULL DEFAULT 'adult' CHECK (passenger_type IN ('adult', 'child'))");
    }
    persist();
  }

  async function init() {
    SQL = await initSqlJs({
      locateFile: (file) => {
        if (wasmFilePath) {
          return wasmFilePath;
        }
        return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
      },
    });

    if (dbPath && fs.existsSync(dbPath)) {
      db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
      db = new SQL.Database();
    }
    migrate();
    return api;
  }

  function assertReady() {
    if (!db) {
        throw new Error('Veritabanı hazır değil.');
    }
  }

  function write(action) {
    assertReady();
    try {
      const result = action();
      persist();
      return result;
    } catch (error) {
      throw normalizeDbError(error);
    }
  }

  function listCustomers() {
    assertReady();
    return runSelect(
      db,
      `
      SELECT
        c.*,
        t.name AS tour_name,
        t.start_date AS tour_start_date,
        t.end_date AS tour_end_date,
        t.hotel_id AS tour_hotel_id,
        th.name AS tour_hotel_name,
        r.id AS room_id,
        r.room_no,
        h.id AS hotel_id,
        h.name AS hotel_name
      FROM customers c
      LEFT JOIN tours t ON t.id = c.tour_id
      LEFT JOIN hotels th ON th.id = t.hotel_id
      LEFT JOIN room_assignments ra ON ra.customer_id = c.id
      LEFT JOIN rooms r ON r.id = ra.room_id
      LEFT JOIN hotels h ON h.id = r.hotel_id
      ORDER BY c.full_name COLLATE NOCASE
      `
    ).map(rowToCustomer);
  }

  function createCustomer(input) {
    return write(() => {
      const createdAt = nowIso();
      db.run(
        `
        INSERT INTO customers
          (full_name, document_no, phone, gender, passenger_type, birth_date, group_name, tour_id, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          toRequiredString(input.fullName, 'Ad soyad'),
          toOptionalString(input.documentNo),
          toOptionalString(input.phone),
          assertGender(input.gender),
          assertPassengerType(input.passengerType),
          toOptionalString(input.birthDate),
          null,
          toOptionalTourId(input.tourId),
          toOptionalString(input.notes),
          createdAt,
          createdAt,
        ]
      );
      return getScalar(db, 'SELECT last_insert_rowid() AS id');
    });
  }

  function updateCustomer(id, input) {
    return write(() => {
      const exists = getOne(db, 'SELECT id FROM customers WHERE id = ?', [id]);
      if (!exists) {
        throw new Error('Müşteri bulunamadı.');
      }
      db.run(
        `
        UPDATE customers
        SET full_name = ?,
            document_no = ?,
            phone = ?,
            gender = ?,
            passenger_type = ?,
            birth_date = ?,
            group_name = ?,
            tour_id = ?,
            notes = ?,
            updated_at = ?
        WHERE id = ?
        `,
        [
          toRequiredString(input.fullName, 'Ad soyad'),
          toOptionalString(input.documentNo),
          toOptionalString(input.phone),
          assertGender(input.gender),
          assertPassengerType(input.passengerType),
          toOptionalString(input.birthDate),
          null,
          toOptionalTourId(input.tourId),
          toOptionalString(input.notes),
          nowIso(),
          id,
        ]
      );
      return id;
    });
  }

  function deleteCustomer(id) {
    return write(() => {
      db.run('DELETE FROM customers WHERE id = ?', [id]);
      return id;
    });
  }

  function listHotels() {
    assertReady();
    return runSelect(
      db,
      `
      SELECT h.*, COUNT(r.id) AS room_count
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.id
      GROUP BY h.id
      ORDER BY h.name COLLATE NOCASE
      `
    ).map(rowToHotel);
  }

  function createHotel(input) {
    return write(() => {
      const createdAt = nowIso();
      db.run(
        'INSERT INTO hotels (name, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [
          toRequiredString(input.name, 'Otel adı'),
          toOptionalString(input.address),
          toOptionalString(input.notes),
          createdAt,
          createdAt,
        ]
      );
      return getScalar(db, 'SELECT last_insert_rowid() AS id');
    });
  }

  function updateHotel(id, input) {
    return write(() => {
      const exists = getOne(db, 'SELECT id FROM hotels WHERE id = ?', [id]);
      if (!exists) {
        throw new Error('Otel bulunamadı.');
      }
      db.run(
        'UPDATE hotels SET name = ?, address = ?, notes = ?, updated_at = ? WHERE id = ?',
        [
          toRequiredString(input.name, 'Otel adı'),
          toOptionalString(input.address),
          toOptionalString(input.notes),
          nowIso(),
          id,
        ]
      );
      return id;
    });
  }

  function deleteHotel(id) {
    return write(() => {
      const roomCount = getScalar(db, 'SELECT COUNT(*) AS count FROM rooms WHERE hotel_id = ?', [id]);
      if (roomCount > 0) {
        throw new Error('Odası olan otel silinemez.');
      }
      db.run('DELETE FROM hotels WHERE id = ?', [id]);
      return id;
    });
  }

  function listTours() {
    assertReady();
    return runSelect(
      db,
      `
      SELECT
        t.*,
        h.name AS hotel_name,
        COUNT(c.id) AS customer_count
      FROM tours t
      LEFT JOIN hotels h ON h.id = t.hotel_id
      LEFT JOIN customers c ON c.tour_id = t.id
      GROUP BY t.id
      ORDER BY t.start_date COLLATE NOCASE, t.name COLLATE NOCASE
      `
    ).map(rowToTour);
  }

  function createTour(input) {
    return write(() => {
      const hotelId = toOptionalTourId(input.hotelId);
      if (!hotelId) {
        throw new Error('Otel seçimi zorunludur.');
      }
      const hotel = getOne(db, 'SELECT id FROM hotels WHERE id = ?', [hotelId]);
      if (!hotel) {
        throw new Error('Otel bulunamadı.');
      }
      const createdAt = nowIso();
      db.run(
        'INSERT INTO tours (name, start_date, end_date, hotel_id, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          toRequiredString(input.name, 'Tur adı'),
          toOptionalString(input.startDate),
          toOptionalString(input.endDate),
          hotelId,
          toOptionalString(input.notes),
          createdAt,
          createdAt,
        ]
      );
      return getScalar(db, 'SELECT last_insert_rowid() AS id');
    });
  }

  function updateTour(id, input) {
    return write(() => {
      const exists = getOne(db, 'SELECT id FROM tours WHERE id = ?', [id]);
      if (!exists) {
        throw new Error('Tur bulunamadı.');
      }
      const hotelId = toOptionalTourId(input.hotelId);
      if (!hotelId) {
        throw new Error('Otel seçimi zorunludur.');
      }
      const hotel = getOne(db, 'SELECT id FROM hotels WHERE id = ?', [hotelId]);
      if (!hotel) {
        throw new Error('Otel bulunamadı.');
      }
      db.run(
        'UPDATE tours SET name = ?, start_date = ?, end_date = ?, hotel_id = ?, notes = ?, updated_at = ? WHERE id = ?',
        [
          toRequiredString(input.name, 'Tur adı'),
          toOptionalString(input.startDate),
          toOptionalString(input.endDate),
          hotelId,
          toOptionalString(input.notes),
          nowIso(),
          id,
        ]
      );
      return id;
    });
  }

  function deleteTour(id) {
    return write(() => {
      const customerCount = getScalar(db, 'SELECT COUNT(*) AS count FROM customers WHERE tour_id = ?', [id]);
      if (customerCount > 0) {
        throw new Error('Müşterisi olan tur silinemez.');
      }
      db.run('DELETE FROM tours WHERE id = ?', [id]);
      return id;
    });
  }

  function listRooms() {
    assertReady();
    return runSelect(
      db,
      `
      SELECT
        r.*,
        h.name AS hotel_name,
        COUNT(ra.id) AS occupant_count,
        GROUP_CONCAT(DISTINCT c.gender) AS genders
      FROM rooms r
      INNER JOIN hotels h ON h.id = r.hotel_id
      LEFT JOIN room_assignments ra ON ra.room_id = r.id
      LEFT JOIN customers c ON c.id = ra.customer_id
      GROUP BY r.id
      ORDER BY h.name COLLATE NOCASE, r.room_no COLLATE NOCASE
      `
    ).map(rowToRoom);
  }

  function createRoom(input) {
    return write(() => {
      const capacity = Number(input.capacity);
      if (![1, 2, 3, 4].includes(capacity)) {
        throw new Error('Oda kapasitesi 1, 2, 3 veya 4 olmalı.');
      }
      const hotel = getOne(db, 'SELECT id FROM hotels WHERE id = ?', [input.hotelId]);
      if (!hotel) {
        throw new Error('Otel bulunamadı.');
      }
      const createdAt = nowIso();
      db.run(
        'INSERT INTO rooms (hotel_id, room_no, capacity, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          input.hotelId,
          toRequiredString(input.roomNo, 'Oda no'),
          capacity,
          toOptionalString(input.notes),
          createdAt,
          createdAt,
        ]
      );
      return getScalar(db, 'SELECT last_insert_rowid() AS id');
    });
  }

  function updateRoom(id, input) {
    return write(() => {
      const capacity = Number(input.capacity);
      if (![1, 2, 3, 4].includes(capacity)) {
        throw new Error('Oda kapasitesi 1, 2, 3 veya 4 olmalı.');
      }
      const currentCount = getScalar(db, 'SELECT COUNT(*) AS count FROM room_assignments WHERE room_id = ?', [id]);
      if (currentCount > capacity) {
        throw new Error('Yeni kapasite odadaki mevcut kişi sayısından küçük olamaz.');
      }
      db.run(
        'UPDATE rooms SET room_no = ?, capacity = ?, notes = ?, updated_at = ? WHERE id = ?',
        [toRequiredString(input.roomNo, 'Oda no'), capacity, toOptionalString(input.notes), nowIso(), id]
      );
      return id;
    });
  }

  function deleteRoom(id) {
    return write(() => {
      const occupantCount = getScalar(db, 'SELECT COUNT(*) AS count FROM room_assignments WHERE room_id = ?', [id]);
      if (occupantCount > 0) {
        throw new Error('Dolu oda silinemez.');
      }
      db.run('DELETE FROM rooms WHERE id = ?', [id]);
      return id;
    });
  }

  function listAssignments() {
    assertReady();
    return runSelect(
      db,
      `
      SELECT
        ra.id,
        c.id AS customer_id,
        c.full_name AS customer_name,
        c.gender AS customer_gender,
        r.id AS room_id,
        r.room_no,
        h.id AS hotel_id,
        h.name AS hotel_name
      FROM room_assignments ra
      INNER JOIN customers c ON c.id = ra.customer_id
      INNER JOIN rooms r ON r.id = ra.room_id
      INNER JOIN hotels h ON h.id = r.hotel_id
      ORDER BY h.name COLLATE NOCASE, r.room_no COLLATE NOCASE, c.full_name COLLATE NOCASE
      `
    ).map(rowToAssignment);
  }

  function validateRooming(customerId, roomId) {
    const customer = getOne(db, 'SELECT id, full_name, gender FROM customers WHERE id = ?', [customerId]);
    if (!customer) {
      throw new Error('Müşteri bulunamadı.');
    }

    const room = getOne(db, 'SELECT id, capacity FROM rooms WHERE id = ?', [roomId]);
    if (!room) {
      throw new Error('Oda bulunamadı.');
    }

    const currentAssignment = getOne(db, 'SELECT room_id FROM room_assignments WHERE customer_id = ?', [customerId]);
    const occupancy = getScalar(
      db,
      'SELECT COUNT(*) AS count FROM room_assignments WHERE room_id = ? AND customer_id <> ?',
      [roomId, customerId]
    );
    if (occupancy >= room.capacity) {
      throw new Error('Oda kapasitesi dolu.');
    }


    return { currentRoomId: currentAssignment ? currentAssignment.room_id : null };
  }

  function assignCustomer(customerId, roomId) {
    return write(() => {
      db.run('BEGIN TRANSACTION;');
      try {
        const { currentRoomId } = validateRooming(customerId, roomId);
        if (currentRoomId) {
          throw new Error('Müşteri zaten bir odaya atanmış. Taşıma işlemini kullanın.');
        }
        const createdAt = nowIso();
        db.run(
          'INSERT INTO room_assignments (customer_id, room_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [customerId, roomId, createdAt, createdAt]
        );
        db.run('COMMIT;');
        return getScalar(db, 'SELECT last_insert_rowid() AS id');
      } catch (error) {
        db.run('ROLLBACK;');
        throw error;
      }
    });
  }

  function moveCustomer(customerId, roomId) {
    return write(() => {
      db.run('BEGIN TRANSACTION;');
      try {
        const { currentRoomId } = validateRooming(customerId, roomId);
        if (currentRoomId === roomId) {
          db.run('COMMIT;');
          return customerId;
        }
        const updatedAt = nowIso();
        if (currentRoomId) {
          db.run('UPDATE room_assignments SET room_id = ?, updated_at = ? WHERE customer_id = ?', [
            roomId,
            updatedAt,
            customerId,
          ]);
        } else {
          db.run(
            'INSERT INTO room_assignments (customer_id, room_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
            [customerId, roomId, updatedAt, updatedAt]
          );
        }
        db.run('COMMIT;');
        return customerId;
      } catch (error) {
        db.run('ROLLBACK;');
        throw error;
      }
    });
  }

  function unassignCustomer(customerId) {
    return write(() => {
      db.run('DELETE FROM room_assignments WHERE customer_id = ?', [customerId]);
      return customerId;
    });
  }

  function normalizeDbError(error) {
    const message = error && error.message ? error.message : String(error);
    if (message.includes('UNIQUE constraint failed: hotels.name')) {
      return new Error('Bu otel adı zaten kayıtlı.');
    }
    if (message.includes('UNIQUE constraint failed: rooms.hotel_id, rooms.room_no')) {
      return new Error('Bu otelde aynı oda no zaten var.');
    }
    if (message.includes('UNIQUE constraint failed: room_assignments.customer_id')) {
      return new Error('Müşteri zaten bir odaya atanmış.');
    }
    return error;
  }

  function close() {
    if (db) {
      persist();
      db.close();
      db = null;
    }
  }

  const api = {
    init,
    close,
    persist,
    listCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    listHotels,
    createHotel,
    updateHotel,
    deleteHotel,
    listTours,
    createTour,
    updateTour,
    deleteTour,
    listRooms,
    createRoom,
    updateRoom,
    deleteRoom,
    listAssignments,
    assignCustomer,
    moveCustomer,
    unassignCustomer,
  };

  return api;
}

module.exports = {
  createDatabaseStore,
};
