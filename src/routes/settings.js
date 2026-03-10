import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Setting } from '../models/index.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'puralino/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1920, height: 600, crop: 'fill', gravity: 'center' }, { quality: 'auto:good' }]
  }
});

const upload = multer({ storage: bannerStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// ── Helper: upsert a setting by key ──
async function upsertSetting(key, value) {
  const [setting, created] = await Setting.findOrCreate({ where: { key }, defaults: { value } });
  if (!created) {
    setting.value = value;
    setting.changed('value', true);
    await setting.save();
  }
  return setting;
}

// GET /settings/banner — public, returns banner config
router.get('/banner', async (req, res) => {
  try {
    const setting = await Setting.findOne({ where: { key: 'banner' } });
    res.json(setting ? setting.value : { imageUrl: '', title: '', subtitle: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /settings/banner — admin only, update banner text
router.put('/banner', authRequired, adminOnly, async (req, res) => {
  try {
    const { title, subtitle } = req.body;
    const current = await Setting.findOne({ where: { key: 'banner' } });
    const value = current ? { ...current.value, title, subtitle } : { imageUrl: '', title, subtitle };
    const setting = await upsertSetting('banner', value);
    res.json(setting.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /settings/banner/image — admin only, upload banner image
router.post('/banner/image', authRequired, adminOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó imagen' });

    const imageUrl = req.file.path;
    const publicId = req.file.filename;

    const current = await Setting.findOne({ where: { key: 'banner' } });

    // Delete old banner from Cloudinary if exists
    if (current && current.value && current.value.publicId) {
      cloudinary.uploader.destroy(current.value.publicId).catch(() => {});
    }

    const value = current
      ? { ...current.value, imageUrl, publicId }
      : { imageUrl, publicId, title: '', subtitle: '' };

    const setting = await upsertSetting('banner', value);

    res.json(setting.value);
  } catch (err) {
    console.error('Banner upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /settings/banner/image — admin only, remove banner image
router.delete('/banner/image', authRequired, adminOnly, async (req, res) => {
  try {
    const current = await Setting.findOne({ where: { key: 'banner' } });
    if (current && current.value && current.value.publicId) {
      await cloudinary.uploader.destroy(current.value.publicId).catch(() => {});
    }
    const value = current ? { ...current.value, imageUrl: '', publicId: '' } : { imageUrl: '', publicId: '', title: '', subtitle: '' };
    const setting = await upsertSetting('banner', value);
    res.json(setting.value);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
