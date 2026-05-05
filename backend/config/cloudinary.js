const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom multer storage engine — works with cloudinary v2
const cloudinaryStorage = (folder) => ({
  _handleFile(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'));
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
        });
      }
    );
    file.stream.pipe(uploadStream);
  },
  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, cb);
  },
});

const uploadProduct = multer({
  storage: cloudinaryStorage('oneserve/products'),
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { cloudinary, uploadProduct };
