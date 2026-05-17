import type { Assignment, Customer, CustomerInput, Hotel, HotelInput, Room, RoomInput, Tour, TourInput } from './types';

type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

declare global {
  interface Window {
    api: {
      customers: {
        list: () => Promise<ApiResult<Customer[]>>;
        create: (payload: CustomerInput) => Promise<ApiResult<number>>;
        update: (id: number, payload: CustomerInput) => Promise<ApiResult<number>>;
        delete: (id: number) => Promise<ApiResult<number>>;
      };
      hotels: {
        list: () => Promise<ApiResult<Hotel[]>>;
        create: (payload: HotelInput) => Promise<ApiResult<number>>;
        update: (id: number, payload: HotelInput) => Promise<ApiResult<number>>;
        delete: (id: number) => Promise<ApiResult<number>>;
      };
      tours: {
        list: () => Promise<ApiResult<Tour[]>>;
        create: (payload: TourInput) => Promise<ApiResult<number>>;
        update: (id: number, payload: TourInput) => Promise<ApiResult<number>>;
        delete: (id: number) => Promise<ApiResult<number>>;
      };
      rooms: {
        list: () => Promise<ApiResult<Room[]>>;
        create: (payload: RoomInput) => Promise<ApiResult<number>>;
        update: (id: number, payload: Omit<RoomInput, 'hotelId'>) => Promise<ApiResult<number>>;
        delete: (id: number) => Promise<ApiResult<number>>;
      };
      assignments: {
        list: () => Promise<ApiResult<Assignment[]>>;
        assign: (customerId: number, roomId: number) => Promise<ApiResult<number>>;
        move: (customerId: number, roomId: number) => Promise<ApiResult<number>>;
        unassign: (customerId: number) => Promise<ApiResult<number>>;
      };
      exports: {
        excel: (kind: 'customers' | 'rooming') => Promise<ApiResult<{ canceled: boolean; filePath?: string }>>;
        pdf: (kind: 'rooming') => Promise<ApiResult<{ canceled: boolean; filePath?: string }>>;
      };
    };
  }
}

export {};
