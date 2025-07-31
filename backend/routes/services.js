const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const router = express.Router();
const Service = require('../models/Service');
const verifyToken = require('../middleware/verifyToken');


const serviceSchema = Joi.object({
  image:      Joi.string().uri().required(),
  title:      Joi.string().min(3).max(100).required(),
  price:      Joi.number().positive().required(),
  category:   Joi.string().required(),
  description:Joi.string().min(10).required(),
});


router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { error, value } = serviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const service = new Service({
      merchantId: req.user.id,
      ...value
    });

    const saved = await service.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
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

    const updated = await Service.findOneAndUpdate(
      { _id: id, merchantId: req.user.id },
      value,
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
