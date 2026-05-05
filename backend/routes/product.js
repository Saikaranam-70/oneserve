const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadProduct } = require('../config/cloudinary');
const {
  getProducts, createProduct, getProduct,
  updateProduct, deleteProduct, deleteProductImage, getCategories,
} = require('../controllers/productController');

router.use(protect);

router.get('/categories', getCategories);
router.get('/', getProducts);
router.post('/', uploadProduct.array('images', 5), createProduct);
router.get('/:id', getProduct);
router.patch('/:id', uploadProduct.array('images', 5), updateProduct);
router.delete('/:id', deleteProduct);
router.delete('/:id/images/:publicId', deleteProductImage);

module.exports = router;
