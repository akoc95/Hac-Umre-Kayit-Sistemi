export type Gender = 'male' | 'female';
export type PassengerType = 'adult' | 'child';

export interface CustomerInput {
  fullName: string;
  documentNo: string;
  phone: string;
  gender: Gender;
  passengerType: PassengerType;
  birthDate: string;
  connection: string;
  tourId: number;
  notes: string;
}

export interface Customer extends CustomerInput {
  id: number;
  groupName: string | null;
  tourName: string | null;
  tourStartDate: string | null;
  tourEndDate: string | null;
  tourHotelId: number | null;
  tourHotelName: string | null;
  roomId: number | null;
  roomNo: string | null;
  hotelId: number | null;
  hotelName: string | null;
}

export interface TourInput {
  name: string;
  startDate: string;
  endDate: string;
  hotelId: number;
  notes: string;
}

export interface Tour extends TourInput {
  id: number;
  hotelName: string | null;
  customerCount: number;
}

export interface HotelInput {
  name: string;
  address: string;
  notes: string;
}

export interface Hotel extends HotelInput {
  id: number;
  roomCount: number;
}

export interface RoomInput {
  hotelId: number;
  roomNo: string;
  capacity: number;
  notes: string;
}

export interface Room extends RoomInput {
  id: number;
  hotelName: string;
  occupantCount: number;
  genders: string;
}

export interface Assignment {
  id: number;
  customerId: number;
  customerName: string;
  customerGender: Gender;
  tourId: number;
  roomId: number;
  roomNo: string;
  hotelId: number;
  hotelName: string;
}

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };
