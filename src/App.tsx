import {
  BedDouble,
  Building2,
  CalendarDays,
  Download,
  Edit3,
  Hotel,
  Info,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Assignment, Customer, CustomerInput, Gender, Hotel as HotelType, HotelInput, PassengerType, Room, RoomInput, Tour, TourInput } from './types';

type Tab = 'customers' | 'tours' | 'hotels' | 'rooming' | 'exports' | 'about';
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;
type ConfirmRequest = { message: string; action: () => Promise<void>; success: string } | null;
type PerformAction = (action: () => Promise<void>, success: string) => Promise<void>;
type ConfirmAction = (message: string, action: () => Promise<void>, success: string) => void;

const emptyCustomer: CustomerInput = {
  fullName: '',
  documentNo: '',
  phone: '+90',
  gender: 'male',
  passengerType: 'adult',
  birthDate: '',
  connection: '',
  tourId: 0,
  notes: '',
};

const turkishProvinces = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Aksaray',
  'Amasya',
  'Ankara',
  'Antalya',
  'Ardahan',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bartın',
  'Batman',
  'Bayburt',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Düzce',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Iğdır',
  'Isparta',
  'İstanbul',
  'İzmir',
  'Kahramanmaraş',
  'Karabük',
  'Karaman',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırıkkale',
  'Kırklareli',
  'Kırşehir',
  'Kilis',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Mardin',
  'Mersin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Osmaniye',
  'Rize',
  'Sakarya',
  'Samsun',
  'Şanlıurfa',
  'Siirt',
  'Sinop',
  'Şırnak',
  'Sivas',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Uşak',
  'Van',
  'Yalova',
  'Yozgat',
  'Zonguldak',
];

const emptyHotel: HotelInput = {
  name: '',
  address: '',
  notes: '',
};

const emptyTour = (hotelId = 0): TourInput => ({
  name: '',
  startDate: '',
  endDate: '',
  hotelId,
  notes: '',
});

const emptyRoom = (hotelId = 0): RoomInput => ({
  hotelId,
  roomNo: '',
  capacity: 2,
  notes: '',
});

const recordsPerPage = 10;

const tabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
  { id: 'hotels', label: 'Otel ve Oda', icon: Building2 },
  { id: 'tours', label: 'Turlar', icon: CalendarDays },
  { id: 'customers', label: 'Müşteri', icon: Users },
  { id: 'rooming', label: 'Odalama', icon: BedDouble },
  { id: 'exports', label: 'PDF Çıktı', icon: Download },
];

const footerTabs: Array<{ id: Tab; label: string; icon: typeof Users }> = [
  { id: 'about', label: 'Hakkında', icon: Info },
];

function genderLabel(gender: Gender) {
  return gender === 'female' ? 'Kadın' : 'Erkek';
}

function passengerTypeLabel(passengerType: PassengerType) {
  return passengerType === 'child' ? 'Çocuk' : 'Yetişkin';
}

function roomStatus(customer: Customer) {
  return customer.roomId ? `${customer.hotelName} / ${customer.tourName || 'Tur yok'}` : 'Atanmadı';
}
function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('tr-TR').format(date) : '';
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end || '-';
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hotels, setHotels] = useState<HotelType[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest>(null);
  const [loading, setLoading] = useState(true);

  async function unwrap<T>(promise: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
    const result = await promise;
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  }

  async function refreshData(showMessage = false) {
    try {
      const [nextCustomers, nextHotels, nextTours, nextRooms, nextAssignments] = await Promise.all([
        unwrap(window.api.customers.list()),
        unwrap(window.api.hotels.list()),
        unwrap(window.api.tours.list()),
        unwrap(window.api.rooms.list()),
        unwrap(window.api.assignments.list()),
      ]);
      setCustomers(nextCustomers);
      setHotels(nextHotels);
      setTours(nextTours);
      setRooms(nextRooms);
      setAssignments(nextAssignments);
      if (showMessage) {
        setNotice({ tone: 'success', text: 'Liste yenilendi.' });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function perform(action: () => Promise<void>, success: string) {
    try {
      await action();
      await refreshData();
      setNotice({ tone: 'success', text: success });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  }

  function confirmAction(message: string, action: () => Promise<void>, success: string) {
    setConfirmRequest({ message, action, success });
  }

  async function runConfirmedAction() {
    const request = confirmRequest;
    if (!request) {
      return;
    }
    setConfirmRequest(null);
    await perform(request.action, request.success);
  }

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const stats = useMemo(() => {
    const assigned = customers.filter((customer) => customer.roomId).length;
    const beds = rooms.reduce((total, room) => total + room.capacity, 0);
    return {
      customers: customers.length,
      assigned,
      tours: tours.length,
      rooms: rooms.length,
      beds,
    };
  }, [customers, rooms, tours]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Hotel size={28} aria-hidden />
          <div>
            <strong>Hac Umre</strong>
            <span>Kayıt Sistemi</span>
          </div>
        </div>

        <nav className="nav" aria-label="Ana menu">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={classNames('navButton', activeTab === tab.id && 'active')}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <Icon size={18} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <nav className="nav footerNav" aria-label="Yardım">
          {footerTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={classNames('navButton', activeTab === tab.id && 'active')}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <Icon size={18} aria-hidden />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="summary">
            <Metric label="Müşteri" value={stats.customers} />
            <Metric label="Tur" value={stats.tours} />
            <Metric label="Odalanan" value={stats.assigned} />
            <Metric label="Oda" value={stats.rooms} />
            <Metric label="Yatak" value={stats.beds} />
          </div>
          <button className="iconTextButton" type="button" onClick={() => refreshData(true)} title="Yenile">
            <RefreshCw size={17} aria-hidden />
            <span>Yenile</span>
          </button>
        </header>

        {notice && (
          <div className={classNames('notice', notice.tone)} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} title="Kapat">
              <X size={15} aria-hidden />
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading">Yükleniyor...</div>
        ) : (
          <>
            {activeTab === 'customers' && (
              <CustomersView customers={customers} tours={tours} perform={perform} confirmAction={confirmAction} />
            )}
            {activeTab === 'tours' && (
              <ToursView tours={tours} hotels={hotels} perform={perform} confirmAction={confirmAction} />
            )}
            {activeTab === 'hotels' && (
              <HotelsView hotels={hotels} rooms={rooms} perform={perform} confirmAction={confirmAction} />
            )}
            {activeTab === 'rooming' && (
              <RoomingView customers={customers} tours={tours} rooms={rooms} assignments={assignments} perform={perform} />
            )}
            {activeTab === 'exports' && (
              <ExportsView tours={tours} perform={perform} />
            )}
            {activeTab === 'about' && (
              <AboutView />
            )}
          </>
        )}
        {confirmRequest && (
          <div className="modalBackdrop" role="presentation">
            <div className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
              <h2 id="confirm-title">Onay</h2>
              <p>{confirmRequest.message}</p>
              <div className="buttonRow confirmActions">
                <button className="ghostButton" type="button" onClick={() => setConfirmRequest(null)}>
                  Vazgeç
                </button>
                <button className="primaryButton" type="button" onClick={runConfirmedAction}>
                  Sil
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CustomersView({
  customers,
  tours,
  perform,
  confirmAction,
}: {
  customers: Customer[];
  tours: Tour[];
  perform: PerformAction;
  confirmAction: ConfirmAction;
}) {
  const [form, setForm] = useState<CustomerInput>(emptyCustomer);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    const sortedCustomers = [...customers].sort((first, second) => first.id - second.id);
    if (!needle) {
      return sortedCustomers;
    }
    return sortedCustomers.filter((customer) =>
      [customer.id, customer.fullName, customer.documentNo, customer.phone, customer.connection, customer.tourName, customer.tourHotelName, customer.hotelName, customer.roomNo]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(needle))
    );
  }, [customers, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  const visibleCustomers = useMemo(
    () => filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage),
    [currentPage, filtered]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  function reset() {
    setForm(emptyCustomer);
    setEditingId(null);
  }

  function edit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      fullName: customer.fullName,
      documentNo: customer.documentNo || '',
      phone: customer.phone || '',
      gender: customer.gender,
      passengerType: customer.passengerType || 'adult',
      birthDate: customer.birthDate || '',
      connection: customer.connection || '',
      tourId: customer.tourId || 0,
      notes: customer.notes || '',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (editingId) {
        await unwrapResult(window.api.customers.update(editingId, form));
      } else {
        await unwrapResult(window.api.customers.create(form));
      }
      reset();
    }, editingId ? 'Müşteri güncellendi.' : 'Müşteri eklendi.');
  }

  return (
    <section className="workspace twoColumn">
      <form className="panel formPanel" onSubmit={submit}>
        <PanelTitle title={editingId ? 'Müşteri Düzenle' : 'Müşteri Ekle'} />
        <label>
          <span>Ad Soyad</span>
          <input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
        </label>
        <label>
          <span>TC / Pasaport</span>
          <input value={form.documentNo} onChange={(event) => setForm({ ...form, documentNo: event.target.value })} />
        </label>
        <label>
          <span>Telefon</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value || '+90' })} />
        </label>
        <div className="formGrid">
          <label>
            <span>Cinsiyet</span>
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })} required>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
            </select>
          </label>
          <label>
            <span>Yaş Grubu</span>
            <select value={form.passengerType} onChange={(event) => setForm({ ...form, passengerType: event.target.value as PassengerType })} required>
              <option value="adult">Yetişkin</option>
              <option value="child">Çocuk</option>
            </select>
          </label>
        </div>
        <div className="formGrid">
          <label>
            <span>Doğum Tarihi</span>
            <input type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />
          </label>
          <label>
            <span>Bağlantı</span>
            <select value={form.connection} onChange={(event) => setForm({ ...form, connection: event.target.value })}>
              <option value="">İl seçin</option>
              {turkishProvinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="formGrid">
          <label>
            <span>Tur</span>
            <select value={form.tourId} onChange={(event) => setForm({ ...form, tourId: Number(event.target.value) })}>
              <option value={0}>Tur seçin</option>
              {tours.map((tour) => (
                <option key={tour.id} value={tour.id}>
                  {tour.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Notlar</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
        </label>
        <div className="buttonRow">
          <button className="primaryButton" type="submit">
            <Save size={17} aria-hidden />
            <span>{editingId ? 'Güncelle' : 'Kaydet'}</span>
          </button>
          {editingId && (
            <button className="ghostButton" type="button" onClick={reset}>
              <X size={17} aria-hidden />
              <span>Vazgeç</span>
            </button>
          )}
        </div>
      </form>

      <section className="panel listPanel">
        <div className="listHeader">
          <PanelTitle title="Müşteri Listesi" />
          <input
            className="searchInput"
            placeholder="Ara"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Ad Soyad</th>
                <th>Cinsiyet</th>
                <th>Yaş Grubu</th>
                <th>Bağlantı</th>
                <th>Telefon</th>
                <th>Tur</th>
                <th>Oda Durumu</th>
                <th aria-label="Islemler" />
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.id}</td>
                  <td>
                    <strong>{customer.fullName}</strong>
                    <small>{customer.documentNo || 'Kimlik yok'}</small>
                  </td>
                  <td>{genderLabel(customer.gender)}</td>
                  <td>{passengerTypeLabel(customer.passengerType)}</td>
                  <td>{customer.connection || '-'}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>
                    <strong>{customer.tourName || '-'}</strong>
                    {customer.tourHotelName && <small>{customer.tourHotelName}</small>}
                  </td>
                  <td>{roomStatus(customer)}</td>
                  <td className="actions">
                    <button type="button" onClick={() => edit(customer)} title="Düzenle">
                      <Edit3 size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        confirmAction(`${customer.fullName} kaydı silinsin mi?`, async () => {
                          await unwrapResult(window.api.customers.delete(customer.id));
                        }, 'Müşteri silindi.');
                      }}
                      title="Sil"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <EmptyRow colSpan={9} text="Kayıt bulunamadı." />}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="paginationBar">
            <span>
              {filtered.length} kayıt - Sayfa {currentPage}/{pageCount}
            </span>
            <div className="paginationButtons">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                Önceki
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>
                Sonraki
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function ToursView({
  tours,
  hotels,
  perform,
  confirmAction,
}: {
  tours: Tour[];
  hotels: HotelType[];
  perform: PerformAction;
  confirmAction: ConfirmAction;
}) {
  const [form, setForm] = useState<TourInput>(emptyTour(hotels[0]?.id || 0));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTours = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR');
    if (!needle) {
      return tours;
    }
    return tours.filter((tour) =>
      [tour.id, tour.name, tour.hotelName, tour.notes, tour.startDate, tour.endDate, tour.customerCount]
        .filter((value) => value !== null && value !== undefined && value !== '')
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(needle))
    );
  }, [query, tours]);

  const pageCount = Math.max(1, Math.ceil(filteredTours.length / recordsPerPage));
  const visibleTours = useMemo(
    () => filteredTours.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage),
    [currentPage, filteredTours]
  );

  useEffect(() => {
    if (!form.hotelId && hotels.length > 0) {
      setForm((current) => ({ ...current, hotelId: hotels[0].id }));
    }
  }, [hotels, form.hotelId]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  function reset(hotelId = hotels[0]?.id || 0) {
    setForm(emptyTour(hotelId));
    setEditingId(null);
  }

  function edit(tour: Tour) {
    setEditingId(tour.id);
    setForm({
      name: tour.name,
      startDate: tour.startDate || '',
      endDate: tour.endDate || '',
      hotelId: tour.hotelId || 0,
      notes: tour.notes || '',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (editingId) {
        await unwrapResult(window.api.tours.update(editingId, form));
      } else {
        await unwrapResult(window.api.tours.create(form));
      }
      reset(form.hotelId);
    }, editingId ? 'Tur güncellendi.' : 'Tur oluşturuldu.');
  }

  return (
    <section className="workspace twoColumn">
      <form className="panel formPanel" onSubmit={submit}>
        <PanelTitle title={editingId ? 'Tur Düzenle' : 'Tur Oluştur'} />
        <label>
          <span>Tur Adı</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <div className="formGrid">
          <label>
            <span>Başlangıç Tarihi</span>
            <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
          </label>
          <label>
            <span>Bitiş Tarihi</span>
            <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          </label>
        </div>
        <label>
          <span>Bölge</span>
          <select value={form.hotelId} onChange={(event) => setForm({ ...form, hotelId: Number(event.target.value) })} required>
            <option value={0}>Bölge seçin</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Notlar</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
        </label>
        <div className="buttonRow">
          <button className="primaryButton" type="submit" disabled={!form.hotelId}>
            <Save size={17} aria-hidden />
            <span>{editingId ? 'Güncelle' : 'Oluştur'}</span>
          </button>
          {editingId && (
            <button className="ghostButton" type="button" onClick={() => reset(form.hotelId)}>
              <X size={17} aria-hidden />
              <span>Vazgeç</span>
            </button>
          )}
        </div>
      </form>

      <section className="panel listPanel">
        <div className="listHeader">
          <PanelTitle title="Tur Listesi" />
          <input
            className="searchInput"
            placeholder="Ara"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Tur</th>
                <th>Tarih</th>
                <th>Bölge</th>
                <th>Müşteri</th>
                <th aria-label="Islemler" />
              </tr>
            </thead>
            <tbody>
              {visibleTours.map((tour) => (
                <tr key={tour.id}>
                  <td>
                    <strong>{tour.name}</strong>
                    <small>{tour.notes || 'Not yok'}</small>
                  </td>
                  <td>{formatDateRange(tour.startDate, tour.endDate)}</td>
                  <td>{tour.hotelName || '-'}</td>
                  <td>{tour.customerCount}</td>
                  <td className="actions">
                    <button type="button" onClick={() => edit(tour)} title="Düzenle">
                      <Edit3 size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        confirmAction(`${tour.name} turu silinsin mi?`, async () => {
                          await unwrapResult(window.api.tours.delete(tour.id));
                        }, 'Tur silindi.');
                      }}
                      title="Sil"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTours.length === 0 && <EmptyRow colSpan={5} text="Kayıt bulunamadı." />}
            </tbody>
          </table>
        </div>
        {filteredTours.length > 0 && (
          <div className="paginationBar">
            <span>
              {filteredTours.length} kayıt - Sayfa {currentPage}/{pageCount}
            </span>
            <div className="paginationButtons">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                Önceki
              </button>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>
                Sonraki
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function HotelsView({
  hotels,
  rooms,
  perform,
  confirmAction,
}: {
  hotels: HotelType[];
  rooms: Room[];
  perform: PerformAction;
  confirmAction: ConfirmAction;
}) {
  const [hotelForm, setHotelForm] = useState<HotelInput>(emptyHotel);
  const [editingHotelId, setEditingHotelId] = useState<number | null>(null);
  const [selectedHotelId, setSelectedHotelId] = useState<number>(hotels[0]?.id || 0);
  const [roomForm, setRoomForm] = useState<RoomInput>(emptyRoom(hotels[0]?.id || 0));
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedHotelId && hotels.length > 0) {
      setSelectedHotelId(hotels[0].id);
      setRoomForm((current) => ({ ...current, hotelId: hotels[0].id }));
    }
  }, [hotels, selectedHotelId]);

  const selectedRooms = rooms.filter((room) => room.hotelId === selectedHotelId);

  function resetHotel() {
    setHotelForm(emptyHotel);
    setEditingHotelId(null);
  }

  function resetRoom(hotelId = selectedHotelId, capacity = roomForm.capacity) {
    setRoomForm({ ...emptyRoom(hotelId), capacity });
    setEditingRoomId(null);
  }

  async function submitHotel(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (editingHotelId) {
        await unwrapResult(window.api.hotels.update(editingHotelId, hotelForm));
      } else {
        const id = await unwrapResult(window.api.hotels.create(hotelForm));
        setSelectedHotelId(id);
        setRoomForm(emptyRoom(id));
      }
      resetHotel();
    }, editingHotelId ? 'Bölge güncellendi.' : 'Bölge eklendi.');
  }

  async function submitRoom(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (editingRoomId) {
        await unwrapResult(window.api.rooms.update(editingRoomId, {
          capacity: roomForm.capacity,
          notes: '',
        }));
      } else {
        await unwrapResult(window.api.rooms.create({ ...roomForm, roomNo: '', notes: '' }));
      }
      resetRoom(roomForm.hotelId);
    }, editingRoomId ? 'Oda güncellendi.' : 'Oda eklendi.');
  }

  return (
    <section className="workspace hotelLayout">
      <section className="panel">
        <form className="stackForm" onSubmit={submitHotel}>
          <PanelTitle title={editingHotelId ? 'Bölge Düzenle' : 'Bölge Ekle'} />
          <label>
            <span>Bölge Adı</span>
            <input value={hotelForm.name} onChange={(event) => setHotelForm({ ...hotelForm, name: event.target.value })} required />
          </label>
          <label>
            <span>Adres</span>
            <input value={hotelForm.address} onChange={(event) => setHotelForm({ ...hotelForm, address: event.target.value })} />
          </label>
          <label>
            <span>Notlar</span>
            <textarea value={hotelForm.notes} onChange={(event) => setHotelForm({ ...hotelForm, notes: event.target.value })} rows={3} />
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="submit">
              <Save size={17} aria-hidden />
              <span>{editingHotelId ? 'Güncelle' : 'Kaydet'}</span>
            </button>
            {editingHotelId && (
              <button className="ghostButton" type="button" onClick={resetHotel}>
                <X size={17} aria-hidden />
                <span>Vazgeç</span>
              </button>
            )}
          </div>
        </form>

        <div className="hotelList">
          {hotels.map((hotel) => (
            <div
              key={hotel.id}
              className={classNames('hotelButton', selectedHotelId === hotel.id && 'active')}
              onClick={() => {
                setSelectedHotelId(hotel.id);
                resetRoom(hotel.id);
              }}
            >
              <span>
                <strong>{hotel.name}</strong>
                <small>{hotel.roomCount} oda</small>
              </span>
              <span className="hotelActions">
                <button
                  type="button"
                  title="Düzenle"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingHotelId(hotel.id);
                    setHotelForm({
                      name: hotel.name,
                      address: hotel.address || '',
                      notes: hotel.notes || '',
                    });
                  }}
                >
                  <Edit3 size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  title="Sil"
                  onClick={(event) => {
                    event.stopPropagation();
                    confirmAction(`${hotel.name} bölgesi silinsin mi?`, async () => {
                      await unwrapResult(window.api.hotels.delete(hotel.id));
                    }, 'Bölge silindi.');
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </span>
            </div>
          ))}
          {hotels.length === 0 && <div className="emptyBox">Önce otel ekleyin.</div>}
        </div>
      </section>

      <section className="panel listPanel">
        <form className="roomForm" onSubmit={submitRoom}>
          <PanelTitle title={editingRoomId ? 'Oda Düzenle' : 'Oda Ekle'} />
          <label>
            <span>Otel</span>
            <select
              value={roomForm.hotelId}
              onChange={(event) => setRoomForm({ ...roomForm, hotelId: Number(event.target.value) })}
              disabled={Boolean(editingRoomId)}
              required
            >
              <option value={0}>Seçin</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Kapasite</span>
            <select value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: Number(event.target.value) })}>
              <option value={1}>1 kişilik</option>
              <option value={2}>2 kişilik</option>
              <option value={3}>3 kişilik</option>
              <option value={4}>4 kişilik</option>
            </select>
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="submit" disabled={!roomForm.hotelId}>
              <Plus size={17} aria-hidden />
              <span>{editingRoomId ? 'Güncelle' : 'Ekle'}</span>
            </button>
            {editingRoomId && (
              <button className="ghostButton" type="button" onClick={() => resetRoom(roomForm.hotelId)}>
                <X size={17} aria-hidden />
                <span>Vazgeç</span>
              </button>
            )}
          </div>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Kapasite</th>
                <th>Dolu</th>
                <th aria-label="Islemler" />
              </tr>
            </thead>
            <tbody>
              {selectedRooms.map((room) => (
                <tr key={room.id}>
                  <td><strong>{room.capacity} Kişilik Oda</strong></td>
                  <td>{room.occupantCount}</td>
                  <td className="actions">
                    <button
                      type="button"
                      title="Düzenle"
                      onClick={() => {
                        setEditingRoomId(room.id);
                        setRoomForm({
                          hotelId: room.hotelId,
                          roomNo: '',
                          capacity: room.capacity,
                          notes: '',
                        });
                      }}
                    >
                      <Edit3 size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Sil"
                      onClick={() => {
                        confirmAction(`${room.capacity} kişilik oda silinsin mi?`, async () => {
                          await unwrapResult(window.api.rooms.delete(room.id));
                        }, 'Oda silindi.');
                      }}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {selectedRooms.length === 0 && <EmptyRow colSpan={3} text="Bu otelde oda yok." />}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function RoomingView({
  customers,
  tours,
  rooms,
  assignments,
  perform,
}: {
  customers: Customer[];
  tours: Tour[];
  rooms: Room[];
  assignments: Assignment[];
  perform: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [selectedTourId, setSelectedTourId] = useState<number>(tours[0]?.id || 0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const toursWithCustomers = useMemo(
    () => tours.filter((tour) => customers.some((customer) => customer.tourId === tour.id)),
    [customers, tours]
  );

  useEffect(() => {
    if (selectedTourId && !toursWithCustomers.some((tour) => tour.id === selectedTourId)) {
      setSelectedTourId(0);
      return;
    }
    if (!selectedTourId && toursWithCustomers.length > 0) {
      setSelectedTourId(toursWithCustomers[0].id);
    }
  }, [selectedTourId, toursWithCustomers]);

  const selectedTour = useMemo(() => tours.find((tour) => tour.id === selectedTourId), [tours, selectedTourId]);
  const tourCustomers = useMemo(
    () => (selectedTourId ? customers.filter((customer) => customer.tourId === selectedTourId) : []),
    [customers, selectedTourId]
  );
  const filteredCustomers = useMemo(() => {
    const normalizedSearch = customerSearch.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedSearch) {
      return tourCustomers;
    }
    return tourCustomers.filter((customer) =>
      `${customer.fullName} ${customer.documentNo || ''} ${customer.phone || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
    );
  }, [customerSearch, tourCustomers]);

  useEffect(() => {
    if (selectedCustomerId && !tourCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(0);
      return;
    }
    if (!selectedCustomerId && tourCustomers.length > 0) {
      setSelectedCustomerId(tourCustomers[0].id);
    }
  }, [selectedCustomerId, tourCustomers]);

  const selectedCustomer = tourCustomers.find((customer) => customer.id === selectedCustomerId);
  const visibleRooms = selectedTour?.hotelId ? rooms.filter((room) => room.hotelId === selectedTour.hotelId) : [];
  const unassigned = tourCustomers.filter((customer) => !customer.roomId);
  const assigned = tourCustomers.filter((customer) => customer.roomId);

  function occupants(roomId: number) {
    return assignments.filter((assignment) => assignment.roomId === roomId && assignment.tourId === selectedTourId);
  }

  return (
    <section className="workspace roomingLayout">
      <section className="panel">
        <PanelTitle title="Müşteri Seç" />
        <label>
          <span>Tur</span>
          <select value={selectedTourId} onChange={(event) => setSelectedTourId(Number(event.target.value))}>
            <option value={0}>Tur seçin</option>
            {toursWithCustomers.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Müşteri</span>
          <input
            className="customerSelectSearch"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Müşteri ara"
            disabled={!selectedTourId}
          />
          <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(Number(event.target.value))} disabled={!selectedTourId}>
            <option value={0}>Seçin</option>
            {filteredCustomers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </select>
        </label>
        {selectedCustomer && (
          <div className="selectedCustomer">
            <strong>{selectedCustomer.fullName}</strong>
            <span>{selectedCustomer.tourName || 'Tur seçilmedi'}</span>
            <small>{roomStatus(selectedCustomer)}</small>
            {selectedCustomer.roomId && (
              <button
                className="ghostButton"
                type="button"
                onClick={() =>
                  perform(async () => {
                    await unwrapResult(window.api.assignments.unassign(selectedCustomer.id));
                  }, 'Müşteri odadan çıkarıldı.')
                }
              >
                <LogOut size={16} aria-hidden />
                <span>Odadan Çıkar</span>
              </button>
            )}
          </div>
        )}

        <div className="splitCounts">
          <div>
            <strong>{unassigned.length}</strong>
            <span>Atanmadı</span>
          </div>
          <div>
            <strong>{assigned.length}</strong>
            <span>Odada</span>
          </div>
        </div>
      </section>

      <section className="panel roomsPanel">
        <div className="listHeader">
          <PanelTitle title="Oda Yerleşimi" />
          <span className="roomingHotelName">{selectedTour?.hotelName || 'Tur oteli seçilmedi'}</span>
        </div>

        <div className="roomGrid">
          {visibleRooms.map((room) => {
            const people = occupants(room.id);
            const full = people.length >= room.capacity;
            return (
              <article className={classNames('roomCard', full && 'full')} key={room.id}>
                <header>
                  <div>
                    <strong>{room.capacity} Kişilik Oda</strong>
                    <span>{room.hotelName}</span>
                  </div>
                  <em>
                    {people.length}/{room.capacity}
                  </em>
                </header>
                <div className="occupants">
                  {people.map((person) => (
                    <div key={person.customerId}>
                      <span>{person.customerName}</span>
                    </div>
                  ))}
                  {people.length === 0 && <small>Oda boş</small>}
                </div>
                <button
                  type="button"
                  className="primaryButton compact"
                  disabled={!selectedTourId || !selectedCustomer || full}
                  onClick={() =>
                    selectedCustomer &&
                    perform(async () => {
                      await unwrapResult(window.api.assignments.move(selectedCustomer.id, room.id));
                    }, 'Oda ataması yapıldı.')
                  }
                >
                  <BedDouble size={16} aria-hidden />
                  <span>Yerleştir</span>
                </button>
              </article>
            );
          })}
          {visibleRooms.length === 0 && <div className="emptyBox wide">Oda bulunamadı.</div>}
        </div>
      </section>
    </section>
  );
}

function ExportsView({
  tours,
  perform,
}: {
  tours: Tour[];
  perform: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [selectedTourId, setSelectedTourId] = useState<number>(tours[0]?.id || 0);
  const [tourSearch, setTourSearch] = useState('');
  const toursWithCustomers = useMemo(() => tours.filter((tour) => tour.customerCount > 0), [tours]);
  const filteredTours = useMemo(() => {
    const normalizedSearch = tourSearch.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedSearch) {
      return toursWithCustomers;
    }
    return toursWithCustomers.filter((tour) =>
      `${tour.name} ${tour.hotelName || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
    );
  }, [tourSearch, toursWithCustomers]);

  useEffect(() => {
    if (selectedTourId && !toursWithCustomers.some((tour) => tour.id === selectedTourId)) {
      setSelectedTourId(0);
      return;
    }
    if (!selectedTourId && toursWithCustomers.length > 0) {
      setSelectedTourId(toursWithCustomers[0].id);
    }
  }, [selectedTourId, toursWithCustomers]);

  async function exportExcel(kind: 'customers' | 'rooming') {
    await perform(async () => {
      const result = await unwrapResult(window.api.exports.excel(kind));
      if (result.canceled) {
        throw new Error('Kaydetme işlemi iptal edildi.');
      }
    }, 'Excel dosyası hazırlandı.');
  }
  async function exportPdf() {
    await perform(async () => {
      if (!selectedTourId) {
        throw new Error('PDF çıktısı için tur seçin.');
      }
      const result = await unwrapResult(window.api.exports.pdf('rooming', selectedTourId));
      if (result.canceled) {
        throw new Error('Kaydetme işlemi iptal edildi.');
      }
    }, 'PDF dosyası hazırlandı.');
  }

  return (
    <section className="workspace exportLayout">
      <button className="exportButton" type="button" onClick={() => exportExcel('customers')}>
        <Users size={28} aria-hidden />
        <strong>Müşteri Listesi</strong>
        <span>Kayıtlı müşterileri oda durumlarıyla Excel dosyasına aktar.</span>
      </button>
      <div className="exportButton exportControl">
        <BedDouble size={28} aria-hidden />
        <strong>Oda Yerleşimi PDF</strong>
        <label>
          <span>Tur</span>
          <input
            className="customerSelectSearch"
            value={tourSearch}
            onChange={(event) => setTourSearch(event.target.value)}
            placeholder="Tur ara"
          />
          <select value={selectedTourId} onChange={(event) => setSelectedTourId(Number(event.target.value))}>
            <option value={0}>Tur seçin</option>
            {filteredTours.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primaryButton compact" type="button" onClick={exportPdf} disabled={!selectedTourId}>
          <Download size={16} aria-hidden />
          <span>PDF Al</span>
        </button>
      </div>
    </section>
  );
}

function AboutView() {
  return (
    <section className="workspace aboutLayout">
      <section className="panel aboutPanel">
        <PanelTitle title="Hakkında" />
        <div className="aboutContent">
          <strong>Hac Umre Kayıt Sistemi</strong>
          <p>Proje açık kaynak geliştirilmiştir.</p>
          <a href="https://github.com/akoc95/Hac-Umre-Kayit-Sistemi" target="_blank" rel="noreferrer">
            akoc95/Hac-Umre-Kayit-Sistemi
          </a>
        </div>
      </section>
    </section>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <h2>{title}</h2>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="emptyCell">
        {text}
      </td>
    </tr>
  );
}

async function unwrapResult<T>(promise: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
  const result = await promise;
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}
