import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage específico para imágenes del manual
const manualStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'puralino/manual',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit' }, { quality: 'auto:good' }]
  }
});

const upload = multer({ storage: manualStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// Endpoint para subir múltiples imágenes del manual
router.post('/manual/batch', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron imágenes' });
    }

    const uploadedImages = req.files.map(file => ({
      filename: file.originalname,
      url: file.path,
      public_id: file.filename,
      size: file.size
    }));

    res.json({ 
      success: true, 
      message: `Se subieron ${uploadedImages.length} imágenes`,
      images: uploadedImages 
    });
  } catch (err) {
    console.error('Error en batch upload:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para subir una imagen individual del manual
router.post('/manual/single', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const uploadedImage = {
      filename: req.file.originalname,
      url: req.file.path,
      public_id: req.file.filename,
      size: req.file.size
    };

    res.json({ 
      success: true, 
      message: 'Imagen subida exitosamente',
      image: uploadedImage 
    });
  } catch (err) {
    console.error('Error en single upload:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para listar todas las imágenes del manual
router.get('/manual/list', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:puralino/manual')
      .max_results(100)
      .execute();

    const images = result.resources.map(resource => ({
      filename: resource.public_id.split('/').pop(),
      url: resource.secure_url,
      public_id: resource.public_id,
      size: resource.bytes,
      format: resource.format
    }));

    res.json({ 
      success: true, 
      count: images.length,
      images: images 
    });
  } catch (err) {
    console.error('Error listando imágenes:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
