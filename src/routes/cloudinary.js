import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { Product } from '../models/Product.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'puralino/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }, { quality: 'auto' }]
  }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// Upload images and attach to a product
router.post('/product/:id/images', authRequired, adminOnly, upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const newImages = req.files.map(f => ({
      url: f.path,          // multer-storage-cloudinary puts the URL here
      public_id: f.filename  // and the public_id here
    }));

    product.images.push(...newImages);
    await product.save();

    res.json({ success: true, images: product.images });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete one image from a product
router.delete('/product/:id/images/:publicId', authRequired, adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    // The publicId may contain slashes, so reconstruct it
    const publicId = req.params.publicId;
    await cloudinary.uploader.destroy(publicId);

    product.images = product.images.filter(img => img.public_id !== publicId);
    await product.save();

    res.json({ success: true, images: product.images });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
