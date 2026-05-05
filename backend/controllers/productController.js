const Product = require('../models/Product');
const { cloudinary } = require('../config/cloudinary');
const { redis } = require('../config/rediss');

const CACHE_TTL = 300; // 5 minutes

const getCacheKey = (businessId) => `products:${businessId}`;

const invalidateCache = async (businessId) => {
  // const redis = getRedis();
  const keys = await redis.keys(`products:${businessId}*`);
  if (keys.length) await redis.del(...keys);
};

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const businessId = req.business._id.toString();
    const { category, available, page = 1, limit = 50 } = req.query;

    const cacheKey = `${getCacheKey(businessId)}:${category || 'all'}:${available || 'all'}:${page}`;
    // const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.json({ success: true, ...parsed, fromCache: true });
    }

    const filter = { business: businessId };
    if (category) filter.category = category;
    if (available !== undefined) filter.isAvailable = available === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);

    const payload = { products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));

    res.json({ success: true, ...payload });
  } catch (err) {
    next(err);
  }
};

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, discountPrice, category, tags, stock, sku } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const images = req.files?.map(f => ({ url: f.path, publicId: f.filename })) || [];

    const product = await Product.create({
      business: req.business._id,
      name, description,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      category: category || 'General',
      tags: tags ? JSON.parse(tags) : [],
      stock: stock !== undefined ? parseInt(stock) : -1,
      sku: sku || '',
      images,
    });

    await invalidateCache(req.business._id.toString());

    res.status(201).json({ success: true, message: 'Product created', product });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const fields = ['name', 'description', 'price', 'discountPrice', 'category', 'isAvailable', 'stock', 'sku', 'sortOrder'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    if (req.body.tags) product.tags = JSON.parse(req.body.tags);

    // New images uploaded
    if (req.files?.length) {
      const newImages = req.files.map(f => ({ url: f.path, publicId: f.filename }));
      product.images = [...product.images, ...newImages];
    }

    await product.save();
    await invalidateCache(req.business._id.toString());

    res.json({ success: true, message: 'Product updated', product });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Delete images from Cloudinary
    for (const img of product.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
    }

    await product.deleteOne();
    await invalidateCache(req.business._id.toString());

    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id/images/:publicId
const deleteProductImage = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, business: req.business._id });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const { publicId } = req.params;
    await cloudinary.uploader.destroy(decodeURIComponent(publicId));
    product.images = product.images.filter(i => i.publicId !== decodeURIComponent(publicId));
    await product.save();
    await invalidateCache(req.business._id.toString());

    res.json({ success: true, message: 'Image deleted', product });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', { business: req.business._id });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, createProduct, getProduct, updateProduct, deleteProduct, deleteProductImage, getCategories };
