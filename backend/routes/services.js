const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const router = express.Router();
const Service = require('../models/Service');
const Category = require('../models/Category');
const verifyToken = require('../middleware/verifyToken');


const serviceSchema = Joi.object({
  image:      Joi.string().required(), // Permitir cualquier string, no solo URI
  title:      Joi.string().min(3).max(100).required(),
  price:      Joi.number().positive().required(),
  category:   Joi.string().required(),
  description:Joi.string().min(5).required(), // Reducir mínimo
});


router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { error, value } = serviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    // Find or create category
    let categoryDoc = await Category.findOne({
      merchantId: req.user.id,
      name: value.category,
      isActive: true
    });

    // If category doesn't exist, create it
    if (!categoryDoc) {
      categoryDoc = new Category({
        merchantId: req.user.id,
        name: value.category,
        description: `Categoría para ${value.category}`,
        icon: '📦',
        order: 0
      });
      await categoryDoc.save();
      console.log(`✅ Nueva categoría creada: ${value.category}`);
    }

    // Transform client data to match Service model
    const serviceData = {
      merchantId: req.user.id,
      name: value.title,           // Map title to name
      description: value.description,
      price: value.price,
      category: value.category,
      categoryId: categoryDoc._id, // Use real category ID
      images: value.image ? [value.image] : [], // Convert single image to array
    };

    const service = new Service(serviceData);
    const saved = await service.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('❌ Error creating service:', err);
    next(err);
  }
});


router.put('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const { error, value } = serviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    // Transform client data to match Service model
    const serviceData = {
      name: value.title,           // Map title to name
      description: value.description,
      price: value.price,
      category: value.category,
      images: value.image ? [value.image] : [], // Convert single image to array
    };

    const updated = await Service.findOneAndUpdate(
      { _id: id, merchantId: req.user.id },
      serviceData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Servicio no encontrado' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});


router.get('/mine', verifyToken, async (req, res, next) => {
  try {
    const services = await Service
      .find({ merchantId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});


router.get('/:merchantId', async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ success: false, message: 'ID de comerciante inválido' });
    }

    const services = await Service
      .find({ merchantId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
