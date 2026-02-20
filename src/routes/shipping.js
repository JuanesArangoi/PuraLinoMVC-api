import express from 'express';

const router = express.Router();

const TARIFFS = {
  'Bogotá': 12000, 'Soacha': 12000, 'Chía': 13000, 'Zipaquirá': 14000, 'Facatativá': 14000,
  'Medellín': 15000, 'Bello': 15000, 'Envigado': 15000, 'Itagüí': 15000, 'Rionegro': 16000,
  'Cali': 15000, 'Palmira': 15000, 'Buenaventura': 18000, 'Tuluá': 16000,
  'Barranquilla': 16000, 'Soledad': 16000, 'Cartagena': 16000, 'Santa Marta': 17000,
  'Bucaramanga': 16000, 'Floridablanca': 16000, 'Cúcuta': 17000,
  'Pereira': 15000, 'Manizales': 15000, 'Armenia': 15000, 'Ibagué': 15000,
  'Villavicencio': 16000, 'Neiva': 16000, 'Pasto': 18000, 'Popayán': 17000,
  'Montería': 17000, 'Valledupar': 18000, 'Sincelejo': 18000,
  'default': 20000
};

const ETA_DAYS = {
  'Bogotá': 1, 'Soacha': 1, 'Chía': 2, 'Zipaquirá': 2, 'Facatativá': 2,
  'Medellín': 2, 'Cali': 2, 'Barranquilla': 3, 'Cartagena': 3,
  'default': 4
};

router.get('/quote', (req, res)=>{
  const city = (req.query.city||'').trim();
  const cost = TARIFFS[city] ?? TARIFFS.default;
  const etaDays = ETA_DAYS[city] ?? ETA_DAYS.default;
  res.json({ city, cost, etaDays });
});

export default router;
