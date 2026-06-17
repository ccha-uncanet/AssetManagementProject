import api from './api';

export const getPrinters = () =>
  api.get('/print/printers').then(r => r.data);

export const printZPL = (printer, items, printerType, template) =>
  api.post('/print', { printer, items, printerType, template }).then(r => r.data);

export const previewZPL = (items, printerType, template) =>
  api.post('/print/labelary-preview', { items, printerType, template }, { responseType: 'blob' })
     .then(r => r.data);
