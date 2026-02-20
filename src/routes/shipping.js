import express from 'express';

const router = express.Router();

const TARIFFS = {
  'Bogotá': 12000,
  'Medellín': 15000,
  'Cali': 15000,
  'default': 18000
};

router.get('/quote', (req, res)=>{
  const city = (req.query.city||'').trim();
  const cost = TARIFFS[city] ?? TARIFFS.default;
  res.json({ city, cost, etaDays: city==='Bogotá'? 2 : 3 });
});

export default router;
