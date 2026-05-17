const ExcelJS = require('exceljs');

function genderText(gender) {
  return gender === 'female' ? 'Kadın' : 'Erkek';
}

function passengerTypeText(passengerType) {
  return passengerType === 'child' ? 'Çocuk' : 'Yetişkin';
}

function roomText(item) {
  if (!item.roomNo) {
    return 'Atanmadı';
  }
  return `${item.hotelName} / ${item.roomNo}`;
}

function styleSheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2F5F5B' },
  };
  worksheet.getRow(1).alignment = { vertical: 'middle' };
  worksheet.columns.forEach((column) => {
    let width = column.header ? String(column.header).length + 4 : 12;
    column.eachCell({ includeEmpty: false }, (cell) => {
      width = Math.max(width, String(cell.value || '').length + 3);
    });
    column.width = Math.min(Math.max(width, 12), 36);
  });
}

async function createCustomersWorkbook(customers) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hac Umre Kayıt Sistemi';
  const sheet = workbook.addWorksheet('Müşteriler');
  sheet.columns = [
    { header: 'Ad Soyad', key: 'fullName' },
    { header: 'TC / Pasaport', key: 'documentNo' },
    { header: 'Telefon', key: 'phone' },
    { header: 'Cinsiyet', key: 'gender' },
    { header: 'Yaş Grubu', key: 'passengerType' },
    { header: 'Doğum Tarihi', key: 'birthDate' },
    { header: 'Tur', key: 'tourName' },
    { header: 'Tur Oteli', key: 'tourHotelName' },
    { header: 'Oda Durumu', key: 'roomStatus' },
    { header: 'Notlar', key: 'notes' },
  ];

  customers.forEach((customer) => {
    sheet.addRow({
      fullName: customer.fullName,
      documentNo: customer.documentNo || '',
      phone: customer.phone || '',
      gender: genderText(customer.gender),
      passengerType: passengerTypeText(customer.passengerType),
      birthDate: customer.birthDate || '',
      tourName: customer.tourName || '',
      tourHotelName: customer.tourHotelName || '',
      roomStatus: roomText(customer),
      notes: customer.notes || '',
    });
  });

  styleSheet(sheet);
  return workbook;
}

async function createRoomingWorkbook(rooms, assignments) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hac Umre Kayıt Sistemi';
  const sheet = workbook.addWorksheet('Oda Yerleşimi');
  sheet.columns = [
    { header: 'Otel', key: 'hotelName' },
    { header: 'Oda No', key: 'roomNo' },
    { header: 'Kapasite', key: 'capacity' },
    { header: 'Dolu', key: 'occupantCount' },
    { header: 'Müşteriler', key: 'customers' },
    { header: 'Cinsiyet', key: 'gender' },
    { header: 'Notlar', key: 'notes' },
  ];

  rooms.forEach((room) => {
    const occupants = assignments.filter((assignment) => assignment.roomId === room.id);
    const gender = occupants.length > 0 ? genderText(occupants[0].customerGender) : '';
    sheet.addRow({
      hotelName: room.hotelName,
      roomNo: room.roomNo,
      capacity: room.capacity,
      occupantCount: occupants.length,
      customers: occupants.map((occupant) => occupant.customerName).join(', '),
      gender,
      notes: room.notes || '',
    });
  });

  styleSheet(sheet);
  return workbook;
}

module.exports = {
  createCustomersWorkbook,
  createRoomingWorkbook,
};
