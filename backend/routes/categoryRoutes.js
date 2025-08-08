const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Service = require('../models/Service');
const verifyToken = require('../middleware/verifyToken');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/categories - Obtener todas las categorías del comerciante
router.get('/', async (req, res) => {
  try {
    // Solo comerciantes pueden gestionar categorías
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        message: 'Solo los comerciantes pueden gestionar categorías'
      });
    }

    const categories = await Category.find({ 
      merchantId: req.user.id,
      isActive: true 
    }).sort({ order: 1, name: 1 });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías'
    });
  }
});

// POST /api/categories - Crear nueva categoría
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        message: 'Solo los comerciantes pueden crear categorías'
      });
    }

    const { name, description, icon, order } = req.body;

    // Validación
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }

    // Verificar si ya existe una categoría con ese nombre
    const existingCategory = await Category.findOne({
      merchantId: req.user.id,
      name: name.trim()
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    const category = new Category({
      merchantId: req.user.id,
      name: name.trim(),
      description: description || '',
      icon: icon || '📦',
      order: order || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: category
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear categoría'
    });
  }
});

// PUT /api/categories/:id - Actualizar categoría
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        message: 'Solo los comerciantes pueden actualizar categorías'
      });
    }

    const { name, description, icon, order, isActive } = req.body;

    const category = await Category.findOne({
      _id: req.params.id,
      merchantId: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Si cambia el nombre, verificar que no exista otra con ese nombre
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({
        merchantId: req.user.id,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una categoría con ese nombre'
        });
      }
    }

    // Actualizar campos
    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (order !== undefined) category.order = order;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: category
    });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoría'
    });
  }
});

// DELETE /api/categories/:id - Eliminar categoría (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        message: 'Solo los comerciantes pueden eliminar categorías'
      });
    }

    const category = await Category.findOne({
      _id: req.params.id,
      merchantId: req.user.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Verificar si hay productos en esta categoría
    const productsCount = await Service.countDocuments({
      merchantId: req.user.id,
      categoryId: req.params.id
    });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s)`
      });
    }

    // Soft delete
    category.isActive = false;
    await category.save();

    res.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar categoría'
    });
  }
});

// GET /api/categories/public/:merchantId - Obtener categorías públicas de un comerciante
router.get('/public/:merchantId', async (req, res) => {
  try {
    const categories = await Category.find({ 
      merchantId: req.params.merchantId,
      isActive: true 
    }).sort({ order: 1, name: 1 });

    // Obtener conteo de productos por categoría
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Service.countDocuments({
          merchantId: req.params.merchantId,
          categoryId: category._id,
          available: true
        });

        return {
          ...category.toObject(),
          productCount
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error('Error obteniendo categorías públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías'
    });
  }
});

module.exports = router;