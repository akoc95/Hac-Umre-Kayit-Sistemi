const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld('api', {
  customers: {
    list: () => invoke('customers:list'),
    create: (payload) => invoke('customers:create', payload),
    update: (id, payload) => invoke('customers:update', { id, payload }),
    delete: (id) => invoke('customers:delete', { id }),
  },
  hotels: {
    list: () => invoke('hotels:list'),
    create: (payload) => invoke('hotels:create', payload),
    update: (id, payload) => invoke('hotels:update', { id, payload }),
    delete: (id) => invoke('hotels:delete', { id }),
  },
  tours: {
    list: () => invoke('tours:list'),
    create: (payload) => invoke('tours:create', payload),
    update: (id, payload) => invoke('tours:update', { id, payload }),
    delete: (id) => invoke('tours:delete', { id }),
  },
  rooms: {
    list: () => invoke('rooms:list'),
    create: (payload) => invoke('rooms:create', payload),
    update: (id, payload) => invoke('rooms:update', { id, payload }),
    delete: (id) => invoke('rooms:delete', { id }),
  },
  assignments: {
    list: () => invoke('assignments:list'),
    assign: (customerId, roomId) => invoke('assignments:assign', { customerId, roomId }),
    move: (customerId, roomId) => invoke('assignments:move', { customerId, roomId }),
    unassign: (customerId) => invoke('assignments:unassign', { customerId }),
  },
  exports: {
    excel: (kind) => invoke('exports:excel', { kind }),
    pdf: (kind) => invoke('exports:pdf', { kind }),
  },
});
