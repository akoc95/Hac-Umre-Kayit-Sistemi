const fs = require('fs');
const { BrowserWindow } = require('electron');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function groupByHotel(rooms) {
  return rooms.reduce((groups, room) => {
    const name = room.hotelName || 'Otel belirtilmedi';
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    groups.get(name).push(room);
    return groups;
  }, new Map());
}

function createRoomingHtml(rooms, assignments) {
  const occupiedRooms = rooms.filter((room) =>
    assignments.some((assignment) => assignment.roomId === room.id)
  );

  const hotelSections = Array.from(groupByHotel(occupiedRooms).entries())
    .map(([hotelName, hotelRooms]) => {
      const cards = hotelRooms
        .map((room) => {
          const occupants = assignments.filter((assignment) => assignment.roomId === room.id);
          const occupantItems = occupants
            .map(
              (person) => `
                <li>
                  <strong>${escapeHtml(person.customerName)}</strong>
                </li>
              `
            )
            .join('');

          return `
            <article class="room-card">
              <header>
                <div>
                  <span class="label">Oda</span>
                  <h3>${escapeHtml(room.roomNo)}</h3>
                </div>
                <p>${occupants.length}/${escapeHtml(room.capacity)}</p>
              </header>
              <ul>${occupantItems}</ul>
              ${room.notes ? `<footer>${escapeHtml(room.notes)}</footer>` : ''}
            </article>
          `;
        })
        .join('');

      return `
        <section class="hotel-section">
          <div class="hotel-heading">
            <h2>${escapeHtml(hotelName)}</h2>
          </div>
          <div class="room-grid">${cards}</div>
        </section>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #22302d;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
          }
          h2, h3, p { margin: 0; }
          .hotel-section { break-inside: avoid; margin-bottom: 18px; }
          .hotel-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #2f5f5b;
            color: #ffffff;
            border-radius: 8px 8px 0 0;
            padding: 9px 12px;
          }
          .hotel-heading h2 { font-size: 18px; }
          .room-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            border: 1px solid #d9ded8;
            border-top: 0;
            border-radius: 0 0 8px 8px;
            padding: 10px;
          }
          .room-card {
            min-height: 112px;
            border: 1px solid #d9ded8;
            border-radius: 8px;
            background: #fffdf8;
            overflow: hidden;
            break-inside: avoid;
          }
          .room-card header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            background: #eef4eb;
            border-bottom: 1px solid #d9ded8;
            padding: 9px 10px;
          }
          .label { color: #66736d; font-size: 10px; text-transform: uppercase; }
          .room-card h3 { font-size: 20px; color: #244743; }
          .room-card header p {
            min-width: 42px;
            border-radius: 999px;
            background: #ffffff;
            color: #244743;
            font-weight: 700;
            text-align: center;
            padding: 5px 8px;
          }
          ul { list-style: none; margin: 0; padding: 8px; display: grid; gap: 6px; }
          li {
            border: 1px solid #ece4d7;
            border-radius: 7px;
            padding: 7px 8px;
            background: #ffffff;
          }
          li strong { display: block; font-size: 12px; }
          footer {
            border-top: 1px solid #ece4d7;
            color: #66736d;
            font-size: 11px;
            padding: 7px 8px;
          }
        </style>
      </head>
      <body>
        ${hotelSections || '<p>Yerle?en m??teri bulunamad?.</p>'}
      </body>
    </html>
  `;
}

async function writeRoomingPdf(filePath, rooms, assignments) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
    },
  });

  try {
    const html = createRoomingHtml(rooms, assignments);
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await window.webContents.printToPDF({
      printBackground: true,
      landscape: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
    });
    fs.writeFileSync(filePath, pdf);
  } finally {
    window.destroy();
  }
}

module.exports = {
  createRoomingHtml,
  writeRoomingPdf,
};
